import type { PortfolioState } from './mock-match-engine'

export interface PositionView {
  symbol: string
  qty: number
  avgCost: number
  currentPrice: number
  marketValue: number
  unrealizedPnl: number
  unrealizedPnlPct: number
}

export interface PortfolioSnapshot {
  cash: number
  initialCash: number
  positions: PositionView[]
  realizedPnl: number
  unrealizedPnl: number
  totalPnl: number
  totalPnlPct: number
  equity: number
  /** 权益曲线（最近 N 个点） */
  equityCurve: { ts: number; equity: number }[]
}

/**
 * 实时组合账本
 * - 维护 cash / positions[] / realizedPnl / equityCurve
 * - mark-to-market 后产出快照
 */
export class LivePortfolio {
  /** 单组合保留的 equity 曲线最大点数 */
  private static readonly EQUITY_HISTORY_MAX = 200

  readonly runId: string
  readonly initialCash: number
  cash: number
  realizedPnl = 0
  /** symbol -> {qty, avgCost}（cost 包含费用） */
  positions: Record<string, { qty: number; avgCost: number }> = {}
  /** 最近价格缓存 */
  private lastPrices: Record<string, number> = {}
  /** 权益曲线 */
  private _equityCurve: { ts: number; equity: number }[] = []

  constructor(runId: string, initialCash: number) {
    this.runId = runId
    this.initialCash = initialCash
    this.cash = initialCash
    this._equityCurve.push({ ts: Date.now(), equity: initialCash })
  }

  /**
   * 更新最新价格（mark-to-market 前调用）
   */
  updatePrice(symbol: string, price: number): void {
    this.lastPrices[symbol] = price
  }

  /**
   * 把当前权益追加到曲线（节流：与上次相差 > 1 元 或 距上次 > 1s）
   */
  recordEquityTick(ts: number): void {
    const { equity } = this.markToMarket()
    const last = this._equityCurve[this._equityCurve.length - 1]
    if (last && ts - last.ts < 1000 && Math.abs(equity - last.equity) < 1) return
    this._equityCurve.push({ ts, equity })
    if (this._equityCurve.length > LivePortfolio.EQUITY_HISTORY_MAX) {
      this._equityCurve.shift()
    }
  }

  /**
   * mark-to-market
   */
  markToMarket(): { unrealizedPnl: number; equity: number } {
    let unrealized = 0
    for (const [symbol, pos] of Object.entries(this.positions)) {
      const px = this.lastPrices[symbol]
      if (px == null) continue
      unrealized += (px - pos.avgCost) * pos.qty
    }
    return { unrealizedPnl: unrealized, equity: this.cash + unrealized }
  }

  /**
   * 给外部撮合引擎用的 state（共享引用）
   */
  toState(): PortfolioState {
    return {
      cash: this.cash,
      positions: this.positions,
      realizedPnl: this.realizedPnl,
    }
  }

  /**
   * 快照（前端用）
   */
  snapshot(): PortfolioSnapshot {
    const { unrealizedPnl, equity } = this.markToMarket()
    const positions: PositionView[] = Object.entries(this.positions).map(([symbol, pos]) => {
      const px = this.lastPrices[symbol] ?? pos.avgCost
      const marketValue = px * pos.qty
      const upnl = (px - pos.avgCost) * pos.qty
      return {
        symbol,
        qty: pos.qty,
        avgCost: Number(pos.avgCost.toFixed(4)),
        currentPrice: px,
        marketValue: Number(marketValue.toFixed(2)),
        unrealizedPnl: Number(upnl.toFixed(2)),
        unrealizedPnlPct: pos.avgCost > 0 ? Number(((upnl / (pos.avgCost * pos.qty)) * 100).toFixed(2)) : 0,
      }
    })
    const totalPnl = this.realizedPnl + unrealizedPnl
    return {
      cash: Number(this.cash.toFixed(2)),
      initialCash: this.initialCash,
      positions,
      realizedPnl: Number(this.realizedPnl.toFixed(2)),
      unrealizedPnl: Number(unrealizedPnl.toFixed(2)),
      totalPnl: Number(totalPnl.toFixed(2)),
      totalPnlPct: Number(((totalPnl / this.initialCash) * 100).toFixed(2)),
      equity: Number(equity.toFixed(2)),
      equityCurve: [...this._equityCurve],
    }
  }

  /**
   * 撤掉所有 tick 缓存
   */
  reset(): void {
    this.cash = this.initialCash
    this.realizedPnl = 0
    this.positions = {}
    this.lastPrices = {}
    this._equityCurve = [{ ts: Date.now(), equity: this.initialCash }]
  }
}