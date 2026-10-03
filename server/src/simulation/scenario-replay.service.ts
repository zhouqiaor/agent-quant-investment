import { Injectable, Logger } from '@nestjs/common'
import { computeRisk, equityToRates, type RiskMetrics } from './risk.util'
import { ScenarioKlineService, type KLineRow, type Scenario } from './scenario-kline.service'
import { LiveStrategyAdapter } from './live-strategy-adapter'
import { MockMatchEngine } from './mock-match-engine'
import { LivePortfolio } from './live-portfolio'
import type { TickEvent } from './mock-feed.service'
import type { StrategyCode } from './simulation.constants'

/**
 * 单次仿真汇总
 */
export interface ReplayResult {
  /** 标签：baseline / scenario 名 */
  label: string
  /** 月份 */
  month: string
  /** 初始现金 */
  initialCash: number
  /** 最终权益 */
  finalEquity: number
  /** 总 P&L */
  totalPnl: number
  /** 总收益率 % */
  totalReturnPct: number
  /** 风险指标 */
  risk: RiskMetrics
  /** 已实现 P&L */
  realizedPnl: number
  /** 累计成交笔数 */
  totalTrades: number
  /** 当前持仓数量 */
  positionCount: number
}

/**
 * 一次"基准+冲击"对比
 */
export interface ScenarioComparison {
  month: string
  strategy: StrategyCode
  baseline: ReplayResult
  scenarios: { scenario: Scenario; result: ReplayResult; deltaVsBaseline: { totalReturn: number; sharpe: number; maxDD: number } }[]
}

@Injectable()
export class ScenarioReplayService {
  private readonly logger = new Logger(ScenarioReplayService.name)

  constructor(
    private readonly kline: ScenarioKlineService,
    private readonly adapter: LiveStrategyAdapter,
    private readonly matcher: MockMatchEngine,
  ) {}

  /**
   * 对一组场景做对比回放
   * - 第一个结果固定为 baseline
   * - 后面每个结果对应一个 scenario
   * - 流程：baseline + scenarios 并行回放（实际是顺序，但每个 run 独立 state）
   */
  async compare(args: {
    month: string
    strategy: StrategyCode
    initialCash?: number
    scenarios: Scenario[]
    seed?: number
  }): Promise<ScenarioComparison> {
    const initialCash = args.initialCash ?? 1_000_000
    const seed = args.seed ?? 42
    const baseRows = await this.kline.rowsForMonth(args.month)
    if (!baseRows.length) {
      throw new Error(`月份 ${args.month} 没有 K 线数据`)
    }
    const baseResult = this.replayOnce({
      label: 'baseline',
      month: args.month,
      strategy: args.strategy,
      initialCash,
      rows: baseRows,
      seed,
    })
    const scenarios = args.scenarios.map((s) => {
      const modified = this.kline.applyScenario(baseRows, s)
      const result = this.replayOnce({
        label: s.name,
        month: args.month,
        strategy: args.strategy,
        initialCash,
        rows: modified,
        seed,
      })
      return {
        scenario: s,
        result,
        deltaVsBaseline: {
          totalReturn: Number((result.totalReturnPct - baseResult.totalReturnPct).toFixed(2)),
          sharpe: Number((result.risk.sharpe - baseResult.risk.sharpe).toFixed(2)),
          maxDD: Number((result.risk.maxDD - baseResult.risk.maxDD).toFixed(2)),
        },
      }
    })
    return {
      month: args.month,
      strategy: args.strategy,
      baseline: baseResult,
      scenarios,
    }
  }

  private replayOnce(args: {
    label: string
    month: string
    strategy: StrategyCode
    initialCash: number
    rows: KLineRow[]
    seed: number
  }): ReplayResult {
    const runId = `replay-${args.label}-${args.month}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const portfolio = new LivePortfolio(runId, args.initialCash)
    this.adapter.registerRun(runId, args.strategy)
    let totalTrades = 0
    for (const row of args.rows) {
      const ts = new Date(row.date).getTime()
      const changePct =
        args.rows.indexOf(row) > 0
          ? ((row.close - args.rows[args.rows.indexOf(row) - 1].close) / args.rows[args.rows.indexOf(row) - 1].close) * 100
          : 0
      const tick: TickEvent = {
        symbol: row.symbol,
        name: row.name,
        ts,
        open: row.open,
        high: row.high,
        low: row.low,
        price: row.close,
        changePct,
        volume: row.volume,
      }
      portfolio.updatePrice(tick.symbol, tick.price)
      const signal = this.adapter.onTick(runId, tick)
      if (!signal || signal.side === 'HOLD') {
        portfolio.recordEquityTick(ts)
        continue
      }
      const ps = portfolio.toState()
      const fill = this.matcher.match(runId, signal, ps)
      if (!fill) {
        portfolio.recordEquityTick(ts)
        continue
      }
      portfolio.cash = ps.cash
      portfolio.realizedPnl = ps.realizedPnl
      portfolio.positions = ps.positions
      this.adapter.updatePosition(runId, fill.symbol, ps.positions[fill.symbol]?.qty ?? 0, ps.positions[fill.symbol]?.avgCost ?? 0)
      totalTrades += 1
      portfolio.recordEquityTick(ts)
    }
    const snap = portfolio.snapshot()
    const equity = snap.equity
    const totalPnl = snap.totalPnl
    const rates = equityToRates(snap.equityCurve.map((p) => p.equity))
    const risk = computeRisk(rates, Math.sqrt(252 * 390))
    this.adapter.unregisterRun(runId)
    return {
      label: args.label,
      month: args.month,
      initialCash: args.initialCash,
      finalEquity: equity,
      totalPnl,
      totalReturnPct: Number(((totalPnl / args.initialCash) * 100).toFixed(2)),
      risk,
      realizedPnl: snap.realizedPnl,
      totalTrades,
      positionCount: snap.positions.length,
    }
  }
}