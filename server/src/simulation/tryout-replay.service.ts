import { Injectable, Logger } from '@nestjs/common'
import { computeRisk, equityToRates, type RiskMetrics } from './risk.util'
import { ScenarioKlineService, type KLineRow } from './scenario-kline.service'
import { LiveStrategyAdapter } from './live-strategy-adapter'
import { MockMatchEngine } from './mock-match-engine'
import { LivePortfolio } from './live-portfolio'
import type { TickEvent } from './mock-feed.service'
import type { StrategyCode } from './simulation.constants'

/**
 * 单次"自定义参数"试跑结果
 */
export interface TryoutResult {
  month: string
  strategy: StrategyCode
  /** 实际使用的参数 */
  params: Record<string, number>
  initialCash: number
  finalEquity: number
  totalPnl: number
  totalReturnPct: number
  risk: RiskMetrics
  realizedPnl: number
  totalTrades: number
  positionCount: number
}

@Injectable()
export class TryoutReplayService {
  private readonly logger = new Logger(TryoutReplayService.name)

  constructor(
    private readonly kline: ScenarioKlineService,
    private readonly adapter: LiveStrategyAdapter,
    private readonly matcher: MockMatchEngine,
  ) {}

  /**
   * 用自定义参数跑一次完整月回放
   * 与 ScenarioReplayService.replayOnce 流程一致，但参数透传到 onTick
   * 由于 LiveStrategyAdapter.onTick 内部用的是 STRATEGY_BASE_PARAMS，
   * 这里通过 SymbolState 注入：把 params 写到 SymbolState.params
   */
  async run(args: {
    month: string
    strategy: StrategyCode
    params: Record<string, number>
    initialCash?: number
  }): Promise<TryoutResult> {
    const initialCash = args.initialCash ?? 1_000_000
    const rows = await this.kline.rowsForMonth(args.month)
    if (!rows.length) throw new Error(`月份 ${args.month} 无数据`)
    const runId = `tryout-${args.strategy}-${args.month}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const portfolio = new LivePortfolio(runId, initialCash)
    this.adapter.registerRun(runId, args.strategy)
    let totalTrades = 0
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const ts = new Date(row.date).getTime()
      const prev = i > 0 ? rows[i - 1].close : row.open
      const changePct = prev > 0 ? ((row.close - prev) / prev) * 100 : 0
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
      const signal = this.tryoutDecide(runId, tick, changePct, args.params)
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
    const totalPnl = snap.totalPnl
    const rates = equityToRates(snap.equityCurve.map((p) => p.equity))
    const risk = computeRisk(rates, Math.sqrt(252 * 390))
    this.adapter.unregisterRun(runId)
    return {
      month: args.month,
      strategy: args.strategy,
      params: args.params,
      initialCash,
      finalEquity: snap.equity,
      totalPnl,
      totalReturnPct: Number(((totalPnl / initialCash) * 100).toFixed(2)),
      risk,
      realizedPnl: snap.realizedPnl,
      totalTrades,
      positionCount: snap.positions.length,
    }
  }

  /**
   * 镜像 LiveStrategyAdapter.decide，但用调用方提供的 params
   * （不复用 adapter 内部，因为 registerRun 用的是 STRATEGY_BASE_PARAMS）
   */
  private tryoutDecide(
    runId: string,
    tick: TickEvent,
    changePct: number,
    params: Record<string, number>,
  ): { side: 'BUY' | 'SELL' | 'HOLD'; quantity: number; reason: string; price: number; ts: number; symbol: string } | null {
    const stateMap = (this.adapter as any).runStateMap?.get(runId)
    if (!stateMap) return null
    const state = (this.adapter as any).getOrCreateState?.(stateMap, tick.symbol)
    if (!state) return null
    // 更新窗口
    if (state.window.length >= 30) state.window.shift()
    state.window.push(tick.price)
    state.ticksSinceLastBuy += 1
    const posQty = state.positionQty ?? 0
    const posCost = state.avgCost ?? 0
    const px = tick.price
    const qty = 100
    switch (true) {
      case params.maShort != null && params.maLong != null: {
        // ma_cross
        if (changePct > 0.5 && posQty === 0 && state.ticksSinceLastBuy > 3) {
          state.ticksSinceLastBuy = 0
          return { side: 'BUY', quantity: qty, reason: `MA 金叉`, price: px, ts: tick.ts, symbol: tick.symbol }
        }
        if (posQty > 0 && (changePct < -0.5 || (px - posCost) / posCost >= params.takeProfit || (px - posCost) / posCost <= -params.stopLoss)) {
          return { side: 'SELL', quantity: posQty, reason: `MA 死叉/止盈止损`, price: px, ts: tick.ts, symbol: tick.symbol }
        }
        return null
      }
      case params.threshold != null && params.lookback != null: {
        // momentum
        if (changePct / 100 > params.threshold && posQty === 0 && state.ticksSinceLastBuy > 3) {
          state.ticksSinceLastBuy = 0
          return { side: 'BUY', quantity: qty, reason: `Momentum 触发`, price: px, ts: tick.ts, symbol: tick.symbol }
        }
        if (posQty > 0 && ((px - posCost) / posCost >= params.takeProfit || (px - posCost) / posCost <= -params.stopLoss)) {
          return { side: 'SELL', quantity: posQty, reason: `止盈止损`, price: px, ts: tick.ts, symbol: tick.symbol }
        }
        return null
      }
      case params.oversold != null && params.overbought != null: {
        // reversal
        if (changePct / 100 < params.oversold && posQty === 0 && state.ticksSinceLastBuy > 3) {
          state.ticksSinceLastBuy = 0
          return { side: 'BUY', quantity: qty, reason: `超卖反弹`, price: px, ts: tick.ts, symbol: tick.symbol }
        }
        if (changePct / 100 > params.overbought && posQty > 0) {
          return { side: 'SELL', quantity: posQty, reason: `超买卖出`, price: px, ts: tick.ts, symbol: tick.symbol }
        }
        if (posQty > 0 && ((px - posCost) / posCost >= params.takeProfit || (px - posCost) / posCost <= -params.stopLoss)) {
          return { side: 'SELL', quantity: posQty, reason: `止盈止损`, price: px, ts: tick.ts, symbol: tick.symbol }
        }
        return null
      }
      case params.range != null: {
        // breakout
        if (changePct > 0.5 && posQty === 0 && state.ticksSinceLastBuy > 3) {
          state.ticksSinceLastBuy = 0
          return { side: 'BUY', quantity: qty, reason: `突破买入`, price: px, ts: tick.ts, symbol: tick.symbol }
        }
        if (posQty > 0 && (changePct < -0.5 || (px - posCost) / posCost >= params.takeProfit || (px - posCost) / posCost <= -params.stopLoss)) {
          return { side: 'SELL', quantity: posQty, reason: `跌破/止盈止损`, price: px, ts: tick.ts, symbol: tick.symbol }
        }
        return null
      }
      default: {
        // trend_follow
        if (changePct > 0.8 && posQty === 0 && state.ticksSinceLastBuy > 3) {
          state.ticksSinceLastBuy = 0
          return { side: 'BUY', quantity: qty, reason: `Trend 信号`, price: px, ts: tick.ts, symbol: tick.symbol }
        }
        if (posQty > 0 && ((px - posCost) / posCost >= params.takeProfit || (px - posCost) / posCost <= -params.stopLoss)) {
          return { side: 'SELL', quantity: posQty, reason: `止盈止损`, price: px, ts: tick.ts, symbol: tick.symbol }
        }
        return null
      }
    }
  }
}