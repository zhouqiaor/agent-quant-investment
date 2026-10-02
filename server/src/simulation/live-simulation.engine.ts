import { Injectable, Logger } from '@nestjs/common'
import { MockFeedService, type TickEvent } from './mock-feed.service'
import { LiveStrategyAdapter, type LiveSignal } from './live-strategy-adapter'
import { MockMatchEngine, type OrderFill, type PortfolioState } from './mock-match-engine'
import { LivePortfolio, type PortfolioSnapshot } from './live-portfolio'
import type { StrategyCode } from './simulation.constants'

export type LiveStatus = 'idle' | 'running' | 'paused' | 'finished' | 'errored'

export interface LiveRunOptions {
  month: string
  strategy: StrategyCode
  tickMs?: number
  initialCash?: number
  seed?: number
}

export interface RecentOrderView {
  id: string
  side: 'BUY' | 'SELL'
  symbol: string
  quantity: number
  price: number
  amount: number
  fee: number
  realizedPnl: number | null
  reason: string
  ts: number
}

export interface LiveStateView {
  runId: string
  status: LiveStatus
  month: string
  strategy: StrategyCode
  initialCash: number
  startedAt: number
  currentTick: number
  totalTicks: number
  feedStatus: 'idle' | 'running' | 'paused' | 'finished' | null
  portfolio: PortfolioSnapshot
  recentOrders: RecentOrderView[]
  currentPrices: Record<string, number>
  lastError: string | null
}

interface InternalRunState {
  options: LiveRunOptions
  portfolio: LivePortfolio
  status: LiveStatus
  startedAt: number
  lastTickTs: number
  recentOrders: RecentOrderView[]
  currentPrices: Record<string, number>
  totalFills: number
  lastError: string | null
}

/**
 * 实时仿真引擎
 * - 编排：MockFeed → LiveStrategyAdapter → MockMatchEngine → LivePortfolio
 * - 每个 runId 一个 InternalRunState（不持久化，重启丢失）
 */
@Injectable()
export class LiveSimulationEngine {
  private readonly logger = new Logger(LiveSimulationEngine.name)
  /** 单 run 保留的最近订单数量 */
  private static readonly RECENT_ORDERS_MAX = 50

  private readonly states = new Map<string, InternalRunState>()

  constructor(
    private readonly feed: MockFeedService,
    private readonly adapter: LiveStrategyAdapter,
    private readonly matcher: MockMatchEngine,
  ) {}

  /**
   * 启动 run
   */
  async start(runId: string, options: LiveRunOptions): Promise<{ runId: string; totalTicks: number; monthName: string }> {
    if (!/^\d{4}-\d{2}$/.test(options.month)) {
      throw new Error(`month 格式错误：${options.month}`)
    }
    const tickMs = options.tickMs ?? 500
    const initialCash = options.initialCash ?? 1_000_000

    // 已存在则先停
    if (this.states.has(runId)) {
      await this.stop(runId)
    }

    const portfolio = new LivePortfolio(runId, initialCash)
    const state: InternalRunState = {
      options,
      portfolio,
      status: 'idle',
      startedAt: Date.now(),
      lastTickTs: 0,
      recentOrders: [],
      currentPrices: {},
      totalFills: 0,
      lastError: null,
    }
    this.states.set(runId, state)

    // 注册策略
    this.adapter.registerRun(runId, options.strategy)

    try {
      const { totalTicks, monthName } = await this.feed.start(
        runId,
        options.month,
        tickMs,
        (tick: TickEvent) => this.onTick(runId, tick),
      )
      // 初始化 totalTicks（state 可能已存在但 totalTicks 默认 0，需更新）
      // 这里通过 feed.getStatus 暴露
      state.status = 'running'
      this.logger.log(`live run 启动: runId=${runId} month=${options.month} strategy=${options.strategy} tickMs=${tickMs} totalTicks=${totalTicks}`)
      return { runId, totalTicks, monthName }
    } catch (err) {
      state.status = 'errored'
      state.lastError = (err as Error).message
      this.states.delete(runId)
      this.adapter.unregisterRun(runId)
      this.matcher.resetRun(runId)
      throw err
    }
  }

  /**
   * 暂停
   */
  pause(runId: string): boolean {
    const state = this.states.get(runId)
    if (!state) return false
    const ok = this.feed.pause(runId)
    if (ok) state.status = 'paused'
    return ok
  }

  /**
   * 恢复
   */
  resume(runId: string): boolean {
    const state = this.states.get(runId)
    if (!state) return false
    const ok = this.feed.resume(runId)
    if (ok) state.status = 'running'
    return ok
  }

  /**
   * 停止并清理
   */
  async stop(runId: string): Promise<boolean> {
    const state = this.states.get(runId)
    if (!state) return false
    this.feed.stopFeed(runId)
    this.adapter.unregisterRun(runId)
    this.matcher.resetRun(runId)
    this.states.delete(runId)
    this.logger.log(`live run 停止: runId=${runId} totalFills=${state.totalFills}`)
    return true
  }

  /**
   * 取状态快照（前端每 2 秒拉一次）
   */
  getState(runId: string): LiveStateView | null {
    const state = this.states.get(runId)
    if (!state) return null
    const feedStatus = this.feed.getStatus(runId)
    return {
      runId,
      status: state.status,
      month: state.options.month,
      strategy: state.options.strategy,
      initialCash: state.portfolio.initialCash,
      startedAt: state.startedAt,
      currentTick: feedStatus?.currentTick ?? 0,
      totalTicks: feedStatus?.totalTicks ?? 0,
      feedStatus: feedStatus?.status ?? null,
      portfolio: state.portfolio.snapshot(),
      recentOrders: [...state.recentOrders],
      currentPrices: { ...state.currentPrices },
      lastError: state.lastError,
    }
  }

  /**
   * 列出所有 run（调试用）
   */
  listRuns(): string[] {
    return [...this.states.keys()]
  }

  /**
   * tick 回调（feed → engine）
   */
  private onTick(runId: string, tick: TickEvent): void {
    const state = this.states.get(runId)
    if (!state) return
    try {
      state.lastTickTs = tick.ts
      // 1. mark-to-market
      state.portfolio.updatePrice(tick.symbol, tick.price)
      state.currentPrices[tick.symbol] = tick.price

      // 2. 喂给策略
      const signal = this.adapter.onTick(runId, tick)
      if (!signal || signal.side === 'HOLD') {
        state.portfolio.recordEquityTick(tick.ts)
        return
      }

      // 3. 撮合
      const portfolioState: PortfolioState = state.portfolio.toState()
      const fill = this.matcher.match(runId, signal, portfolioState)
      if (!fill) {
        state.portfolio.recordEquityTick(tick.ts)
        return
      }

      // 3.5 把撮合后的 cash / realizedPnl / positions 同步回 LivePortfolio
      // （toState 给出的是值快照 + positions 引用；matcher 直接修改 portfolioState，要让 LivePortfolio 也感知）
      state.portfolio.cash = portfolioState.cash
      state.portfolio.realizedPnl = portfolioState.realizedPnl
      state.portfolio.positions = portfolioState.positions

      // 4. 同步持仓给 adapter
      this.adapter.updatePosition(runId, fill.symbol, portfolioState.positions[fill.symbol]?.qty ?? 0, portfolioState.positions[fill.symbol]?.avgCost ?? 0)

      // 5. 记录订单
      state.recentOrders.unshift({
        id: fill.id,
        side: fill.side,
        symbol: fill.symbol,
        quantity: fill.quantity,
        price: fill.price,
        amount: Number(fill.amount.toFixed(2)),
        fee: Number(fill.fee.toFixed(2)),
        realizedPnl: fill.realizedPnl == null ? null : Number(fill.realizedPnl.toFixed(2)),
        reason: fill.reason,
        ts: fill.ts,
      })
      if (state.recentOrders.length > LiveSimulationEngine.RECENT_ORDERS_MAX) {
        state.recentOrders.length = LiveSimulationEngine.RECENT_ORDERS_MAX
      }
      state.totalFills += 1

      // 6. 记权益
      state.portfolio.recordEquityTick(tick.ts)
    } catch (err) {
      this.logger.error(`tick 处理异常: runId=${runId} err=${(err as Error).message}`)
      state.lastError = (err as Error).message
    }
  }
}