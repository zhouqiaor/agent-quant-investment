import { Injectable, Logger } from '@nestjs/common'
import {
  STRATEGY_BASE_PARAMS,
  type StrategyCode,
} from './simulation.constants'
import type { TickEvent } from './mock-feed.service'

/**
 * 实时策略信号
 */
export interface LiveSignal {
  side: 'BUY' | 'SELL' | 'HOLD'
  reason: string
  /** 建议数量（股） */
  quantity: number
  /** 触发时的价格 */
  price: number
  /** 触发时的时间戳 */
  ts: number
  /** 触发时的股票 */
  symbol: string
}

/**
 * 单 symbol 内部状态
 */
interface SymbolState {
  /** 最近价格（用于计算瞬时涨跌） */
  lastPrice: number | null
  /** 滚动窗口（简化版：保存最近 N 个 tick 收盘价） */
  window: number[]
  /** 当前持仓量（由外部喂入） */
  positionQty: number
  /** 当前持仓均价 */
  avgCost: number
  /** 距离上一次 BUY 的 tick 数（防止反复触发） */
  ticksSinceLastBuy: number
}

/**
 * 实时策略适配器
 * - 复用 P0+P1 已有的 5 个策略（ma_cross / momentum / reversal / breakout / trend_follow）
 * - 策略决策原以 K 线 + changePct 为输入，改为接收单 tick 的 close + 自维护滚动窗口
 * - onTick 返回 LiveSignal | null
 */
@Injectable()
export class LiveStrategyAdapter {
  private readonly logger = new Logger(LiveStrategyAdapter.name)
  /** 滚动窗口长度（覆盖所有策略需求：momentum.lookback=10 / ma_cross.maLong=20 / breakout.range=20 / trend_follow.slowLen=30） */
  private static readonly WINDOW_SIZE = 30

  /** runId -> strategyCode */
  private readonly runStrategyMap = new Map<string, StrategyCode>()
  /** runId -> symbol -> state */
  private readonly runStateMap = new Map<string, Map<string, SymbolState>>()

  /**
   * 注册 run 与默认 strategy
   */
  registerRun(runId: string, strategy: StrategyCode): void {
    this.runStrategyMap.set(runId, strategy)
    this.runStateMap.set(runId, new Map())
  }

  /**
   * 注销
   */
  unregisterRun(runId: string): void {
    this.runStrategyMap.delete(runId)
    this.runStateMap.delete(runId)
  }

  /**
   * 从外部喂入持仓（撮合后回调）
   */
  updatePosition(runId: string, symbol: string, qty: number, avgCost: number): void {
    const stateMap = this.runStateMap.get(runId)
    if (!stateMap) return
    const state = this.getOrCreateState(stateMap, symbol)
    state.positionQty = qty
    state.avgCost = avgCost
  }

  /**
   * 处理 tick，返回信号
   */
  onTick(runId: string, tick: TickEvent): LiveSignal | null {
    const strategy = this.runStrategyMap.get(runId)
    if (!strategy) return null
    const stateMap = this.runStateMap.get(runId)
    if (!stateMap) return null
    const state = this.getOrCreateState(stateMap, tick.symbol)

    // 更新窗口
    if (state.window.length >= LiveStrategyAdapter.WINDOW_SIZE) state.window.shift()
    state.window.push(tick.price)
    const prevPrice = state.lastPrice
    state.lastPrice = tick.price
    state.ticksSinceLastBuy += 1

    // 计算 changePct（与上一 tick 对比）
    const changePct = prevPrice && prevPrice > 0 ? ((tick.price - prevPrice) / prevPrice) * 100 : 0

    // 取策略基础参数
    const params = STRATEGY_BASE_PARAMS[strategy]

    // 调用决策
    const signal = this.decide(strategy, params, tick, changePct, state)
    return signal
  }

  /**
   * 复用 simulation.scheduler.decide 思路，但参数适配 onTick 场景
   */
  private decide(
    strategy: StrategyCode,
    params: Record<string, number>,
    tick: TickEvent,
    changePct: number,
    state: SymbolState,
  ): LiveSignal | null {
    const posQty = state.positionQty
    const posCost = state.avgCost
    const ts = tick.ts
    const px = tick.price
    const qty = 100

    switch (strategy) {
      case 'ma_cross': {
        // 用 changePct 模拟"金叉强度"
        if (changePct > 0.5 && posQty === 0 && state.ticksSinceLastBuy > 3) {
          state.ticksSinceLastBuy = 0
          return { side: 'BUY', quantity: qty, reason: `MA 金叉(chg=${changePct.toFixed(2)}%)`, price: px, ts, symbol: tick.symbol }
        }
        if (posQty > 0 && (changePct < -0.5 || (px - posCost) / posCost >= params.takeProfit)) {
          return { side: 'SELL', quantity: posQty, reason: `MA 死叉 / 止盈`, price: px, ts, symbol: tick.symbol }
        }
        return null
      }
      case 'momentum': {
        if (changePct / 100 > params.threshold && posQty === 0 && state.ticksSinceLastBuy > 3) {
          state.ticksSinceLastBuy = 0
          return { side: 'BUY', quantity: qty, reason: `动量 ${changePct.toFixed(2)}%`, price: px, ts, symbol: tick.symbol }
        }
        if (
          posQty > 0 &&
          ((px - posCost) / posCost >= params.takeProfit || (px - posCost) / posCost <= -params.stopLoss)
        ) {
          return { side: 'SELL', quantity: posQty, reason: `动量止盈/止损`, price: px, ts, symbol: tick.symbol }
        }
        return null
      }
      case 'reversal': {
        if (changePct / 100 < params.oversold && posQty === 0 && state.ticksSinceLastBuy > 3) {
          state.ticksSinceLastBuy = 0
          return { side: 'BUY', quantity: qty, reason: `反转抄底 ${changePct.toFixed(2)}%`, price: px, ts, symbol: tick.symbol }
        }
        if (
          posQty > 0 &&
          (changePct / 100 > params.overbought ||
            (px - posCost) / posCost >= params.takeProfit ||
            (px - posCost) / posCost <= -params.stopLoss)
        ) {
          return { side: 'SELL', quantity: posQty, reason: `反转止盈/止损`, price: px, ts, symbol: tick.symbol }
        }
        return null
      }
      case 'breakout': {
        if (changePct / 100 > 0.03 && posQty === 0 && state.ticksSinceLastBuy > 3) {
          state.ticksSinceLastBuy = 0
          return { side: 'BUY', quantity: qty, reason: `突破 ${changePct.toFixed(2)}%`, price: px, ts, symbol: tick.symbol }
        }
        if (
          posQty > 0 &&
          ((px - posCost) / posCost >= params.takeProfit || (px - posCost) / posCost <= -params.stopLoss)
        ) {
          return { side: 'SELL', quantity: posQty, reason: `突破止盈/止损`, price: px, ts, symbol: tick.symbol }
        }
        return null
      }
      case 'trend_follow': {
        if (changePct / 100 > 0.02 && posQty === 0 && state.ticksSinceLastBuy > 3) {
          state.ticksSinceLastBuy = 0
          return { side: 'BUY', quantity: qty, reason: `趋势 ${changePct.toFixed(2)}%`, price: px, ts, symbol: tick.symbol }
        }
        if (
          posQty > 0 &&
          ((px - posCost) / posCost >= params.takeProfit || (px - posCost) / posCost <= -params.stopLoss)
        ) {
          return { side: 'SELL', quantity: posQty, reason: `趋势止盈/止损`, price: px, ts, symbol: tick.symbol }
        }
        return null
      }
    }
    return null
  }

  private getOrCreateState(stateMap: Map<string, SymbolState>, symbol: string): SymbolState {
    let s = stateMap.get(symbol)
    if (!s) {
      s = { lastPrice: null, window: [], positionQty: 0, avgCost: 0, ticksSinceLastBuy: 999 }
      stateMap.set(symbol, s)
    }
    return s
  }

  /**
   * 用于测试 / state 快照
   */
  getStateWindow(runId: string, symbol: string): number[] {
    const stateMap = this.runStateMap.get(runId)
    if (!stateMap) return []
    return [...(stateMap.get(symbol)?.window ?? [])]
  }
}