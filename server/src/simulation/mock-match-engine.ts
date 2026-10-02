import { Injectable, Logger } from '@nestjs/common'
import type { LiveSignal } from './live-strategy-adapter'

/**
 * 成交回报
 */
export interface OrderFill {
  id: string
  /** 关联 runId */
  runId: string
  /** 关联 signal 的 quoteId */
  side: 'BUY' | 'SELL'
  symbol: string
  /** 成交数量 */
  quantity: number
  /** 成交价 */
  price: number
  /** 成交金额 */
  amount: number
  /** 手续费 */
  fee: number
  /** 本笔已实现 P&L（仅 SELL 时有意义） */
  realizedPnl: number | null
  /** 触发原因 */
  reason: string
  /** 时间戳（毫秒） */
  ts: number
}

export interface PortfolioState {
  cash: number
  positions: Record<string, { qty: number; avgCost: number }>
  realizedPnl: number
}

/**
 * 模拟撮合引擎
 * - 市价单：按 signal.price 立即成交，扣 0.1% 手续费
 * - 资金不足 / 持仓不足 → 部分成交或拒绝
 */
@Injectable()
export class MockMatchEngine {
  private readonly logger = new Logger(MockMatchEngine.name)
  /** 单笔手续费率（0.1%） */
  private static readonly FEE_RATE = 0.001
  /** 单 run 顺序号 */
  private readonly orderSeq = new Map<string, number>()

  /**
   * 撮合一笔信号
   * @returns 成交回报；HOLD 或拒绝时返回 null
   */
  match(
    runId: string,
    signal: LiveSignal,
    portfolio: PortfolioState,
  ): OrderFill | null {
    if (signal.side === 'HOLD') return null

    const seq = (this.orderSeq.get(runId) ?? 0) + 1
    this.orderSeq.set(runId, seq)
    const orderId = `${runId}-${seq}`

    if (signal.side === 'BUY') {
      const cashAvailable = portfolio.cash
      const feeRate = MockMatchEngine.FEE_RATE
      // 公式：现金 = price * qty * (1 + feeRate)  → qty = cash / (price * (1+feeRate))
      const maxQty = Math.floor(cashAvailable / (signal.price * (1 + feeRate)))
      const qty = Math.min(signal.quantity, maxQty)
      if (qty <= 0) {
        this.logger.warn(`撮合拒绝 BUY: runId=${runId} cash=${cashAvailable.toFixed(0)} price=${signal.price} reason=${signal.reason}`)
        return null
      }
      const amount = signal.price * qty
      const fee = amount * feeRate
      // 更新组合（多 fund）— 在外层 apply
      // 手续费算入成本
      const newCostPerShare = (amount + fee) / qty
      const pos = portfolio.positions[signal.symbol]
      if (pos && pos.qty > 0) {
        const newQty = pos.qty + qty
        pos.avgCost = (pos.avgCost * pos.qty + newCostPerShare * qty) / newQty
        pos.qty = newQty
      } else {
        portfolio.positions[signal.symbol] = { qty, avgCost: newCostPerShare }
      }
      portfolio.cash -= amount + fee
      return {
        id: orderId,
        runId,
        side: 'BUY',
        symbol: signal.symbol,
        quantity: qty,
        price: signal.price,
        amount,
        fee,
        realizedPnl: null,
        reason: signal.reason,
        ts: signal.ts,
      }
    }

    // SELL
    const pos = portfolio.positions[signal.symbol]
    if (!pos || pos.qty <= 0) {
      this.logger.warn(`撮合拒绝 SELL: runId=${runId} symbol=${signal.symbol} 无持仓`)
      return null
    }
    const qty = Math.min(signal.quantity, pos.qty)
    const amount = signal.price * qty
    const fee = amount * MockMatchEngine.FEE_RATE
    const realizedPnl = (signal.price - pos.avgCost) * qty - fee
    pos.qty -= qty
    if (pos.qty <= 0) {
      delete portfolio.positions[signal.symbol]
    }
    portfolio.cash += amount - fee
    portfolio.realizedPnl += realizedPnl
    return {
      id: orderId,
      runId,
      side: 'SELL',
      symbol: signal.symbol,
      quantity: qty,
      price: signal.price,
      amount,
      fee,
      realizedPnl,
      reason: signal.reason,
      ts: signal.ts,
    }
  }

  /**
   * 按当前价对组合做 mark-to-market
   */
  markToMarket(portfolio: PortfolioState, currentPrices: Record<string, number>): { unrealizedPnl: number; equity: number } {
    let unrealized = 0
    for (const [symbol, pos] of Object.entries(portfolio.positions)) {
      const px = currentPrices[symbol]
      if (px == null) continue
      unrealized += (px - pos.avgCost) * pos.qty
    }
    return { unrealizedPnl: unrealized, equity: portfolio.cash + unrealized }
  }

  /**
   * 清空 run 计数
   */
  resetRun(runId: string): void {
    this.orderSeq.delete(runId)
  }
}