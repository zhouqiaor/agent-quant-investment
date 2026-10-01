import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PersistenceService } from '../persistence/persistence.service'
import { SimulationFactory } from './simulation.factory'
import {
  STRATEGY_DAILY_TRADE_LIMITS,
  type StrategyCode,
} from './simulation.constants'
import { normalSample } from './simulation.constants'

/**
 * 100 账户仿真调度器
 * - 实时模式：每 30s 一个 tick，价格走合成 walk
 * - 回放模式（replayMode）：每 N ms 一个 tick，价格读 history_kline，每 tick 推进 1 个虚拟交易日
 *   - 配置：start(runId, { priceSource: 'history', month: '2026-09', replayTickMs: 60000 })
 *   - 虚拟日期初始为 `${month}-01`，每 tick +1 个交易日；超出 month 末自动 stop
 * - 落库：trades / snapshots（回放模式下 ts 用虚拟日期）
 */
@Injectable()
export class SimulationScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SimulationScheduler.name)
  private timer: NodeJS.Timeout | null = null
  private readonly TICK_INTERVAL_MS = 30_000  // 30s 一个 tick（实时模式）
  private readonly SNAPSHOT_INTERVAL_MS = 60 * 60 * 1000  // 1h 一份快照
  // 内存态：合成价格游走
  private priceBook = new Map<string, { price: number; changePct: number }>()
  // 内存态：每个账户持仓（symbol -> qty, avgCost）
  private positions = new Map<string, Map<string, { qty: number; avgCost: number }>>()
  // 内存态：每个账户日内交易次数
  private dailyTradeCounts = new Map<string, { count: number; dateKey: string }>()
  // 内存态：每个账户总交易次数
  private totalTradeCounts = new Map<string, number>()
  // 当前活跃 run
  private activeRunId: string | null = null
  private lastSnapshotAt = 0
  // 回放模式配置
  private priceSource: 'synthetic' | 'history' = 'synthetic'
  private replayMode = false
  private replayMonth: string | null = null  // YYYY-MM
  private replayTickMs = 60_000  // 回放模式 tick 间隔
  private virtualDateKey: string | null = null  // YYYY-MM-DD，当前虚拟日期
  private replayTradingDays: string[] = []  // 回放月的所有交易日
  private replayDayIndex = 0  // 当前推进到第几个交易日

  constructor(
    private readonly persistence: PersistenceService,
    
    private readonly factory: SimulationFactory,
  ) {}

  async onModuleInit() {
    // 不自动启动，需要显式调用 start()
  }

  onModuleDestroy() {
    this.stop()
  }

  /** 启动指定 run 的调度 */
  start(runId: string, opts?: { priceSource?: 'synthetic' | 'history'; month?: string; replayTickMs?: number }): void {
    if (this.timer) this.stop()
    this.activeRunId = runId
    this.positions.clear()
    this.dailyTradeCounts.clear()
    this.totalTradeCounts.clear()
    this.lastSnapshotAt = Date.now()

    // 回放模式配置
    this.priceSource = opts?.priceSource ?? 'synthetic'
    this.replayMonth = opts?.month ?? null
    this.replayMode = !!this.replayMonth
    this.replayTickMs = opts?.replayTickMs ?? 60_000
    if (this.replayMode && this.replayMonth) {
      this.replayTradingDays = this.persistence.getHistoryKlineDates(
        '', `${this.replayMonth}-01`, `${this.replayMonth}-31`,
      ).size > 0
        ? this.persistence.getTradingDaysForMonth(this.replayMonth)
        : this.persistence.getTradingDaysForMonth(this.replayMonth)
      this.replayDayIndex = 0
      this.virtualDateKey = this.replayTradingDays[0] ?? null
      this.logger.log(`回放模式: month=${this.replayMonth} days=${this.replayTradingDays.length} tickMs=${this.replayTickMs}`)
    } else {
      this.replayTradingDays = []
      this.virtualDateKey = null
      this.replayDayIndex = 0
    }

    // 初始化价格游走（基于各 watchlist 中的股票）
    const accounts = this.persistence.listSimAccounts(runId)
    for (const acc of accounts) {
      for (const sym of acc.watchlist) {
        if (!this.priceBook.has(sym)) {
          this.priceBook.set(sym, { price: this.seedPrice(sym), changePct: 0 })
        }
      }
    }

    const interval = this.replayMode ? this.replayTickMs : this.TICK_INTERVAL_MS
    this.timer = setInterval(() => this.tickOnce().catch(err => {
      this.logger.error('tick 失败', err as Error)
    }), interval)

    // 立即先跑一次
    void this.tickOnce()
    this.logger.log(`SimulationScheduler 已启动 (run=${runId}, accounts=${accounts.length}, mode=${this.replayMode ? 'replay' : 'live'}, interval=${interval}ms)`)
  }

  /** 当前虚拟/真实日期（YYYY-MM-DD） */
  private todayKey(): string {
    if (this.replayMode && this.virtualDateKey) return this.virtualDateKey
    return new Date().toISOString().slice(0, 10)
  }

  /** 当前虚拟/真实 ts（毫秒） */
  private nowMs(): number {
    if (this.replayMode && this.virtualDateKey) {
      // 用当天中午 12:00 作为虚拟时间戳
      return new Date(`${this.virtualDateKey}T12:00:00`).getTime()
    }
    return Date.now()
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
      this.activeRunId = null
      this.logger.log('SimulationScheduler 已停止')
    }
  }

  getStatus(): { running: boolean; runId: string | null; intervalMs: number; accountCount: number; lastTickAt: number; replayMode?: boolean; month?: string | null; dayIndex?: number; totalDays?: number; virtualDate?: string | null } {
    const accounts = this.activeRunId ? this.persistence.listSimAccounts(this.activeRunId) : []
    return {
      running: this.timer !== null,
      runId: this.activeRunId,
      intervalMs: this.replayMode ? this.replayTickMs : this.TICK_INTERVAL_MS,
      accountCount: accounts.length,
      lastTickAt: this.lastSnapshotAt,
      replayMode: this.replayMode,
      month: this.replayMonth,
      dayIndex: this.replayDayIndex,
      totalDays: this.replayTradingDays.length,
      virtualDate: this.virtualDateKey,
    }
  }

  /**
   * 初始种子价（基于股票代码 hash 的伪随机）
   */
  private seedPrice(sym: string): number {
    let h = 0
    for (let i = 0; i < sym.length; i++) h = (h * 31 + sym.charCodeAt(i)) >>> 0
    const base = 8 + (h % 240)  // 8 ~ 248
    return base
  }

  /**
   * 价格推进：合成 walk 或读历史 K 线
   * - 实时/合成模式：正态分布均值 0，标准差 1%，涨跌幅上限 ±8%
   * - 回放/history 模式：读 history_kline 当前虚拟日期的 close
   */
  private walkPrice(sym: string): { price: number; changePct: number } | null {
    if (this.priceSource === 'history') {
      const k = this.getHistoryPrice(sym, this.virtualDateKey)
      if (!k) return null
      // changePct = 相对上一 tick 的变化
      const prev = this.priceBook.get(sym)
      const prevPrice = prev?.price ?? k.close
      const changePct = ((k.close - prevPrice) / prevPrice) * 100
      const next = { price: k.close, changePct }
      this.priceBook.set(sym, next)
      return next
    }
    const prev = this.priceBook.get(sym) ?? { price: this.seedPrice(sym), changePct: 0 }
    const ret = Math.max(-0.08, Math.min(0.08, normalSample(0, 0.01)))
    const newPrice = Math.max(0.5, prev.price * (1 + ret))
    const changePct = ((newPrice - prev.price) / prev.price) * 100
    const next = { price: newPrice, changePct }
    this.priceBook.set(sym, next)
    return next
  }

  /**
   * 读取 history_kline 在指定日期的 K 线
   * - 返回该日期的 { close, high, low, open } 或 null（无数据）
   */
  private getHistoryPrice(sym: string, dateKey: string | null): { open: number; high: number; low: number; close: number; volume: number } | null {
    if (!dateKey) return null
    const rows = this.persistence.getHistoryKline(sym, dateKey, dateKey)
    if (rows.length === 0) return null
    const r = rows[0]
    return {
      open: Number(r.open),
      high: Number(r.high),
      low: Number(r.low),
      close: Number(r.close),
      volume: Number(r.volume),
    }
  }

  /**
   * 主 tick：扫描所有账户 + 走价 + 决策 + 下单 + 周期快照
   */
  private async tickOnce(): Promise<void> {
    if (!this.activeRunId) return
    const ts = this.nowMs()
    const accounts = this.persistence.listSimAccounts(this.activeRunId)
    if (accounts.length === 0) return

    // 1) 先把每个 watchlist 股票走价一次
    const touchedSymbols = new Set<string>()
    for (const acc of accounts) {
      for (const sym of acc.watchlist) touchedSymbols.add(sym)
    }
    for (const sym of touchedSymbols) {
      const r = this.walkPrice(sym)
      // history 模式下某日无数据 → 跳过（不会更新 priceBook）
      if (!r && this.priceSource === 'history') continue
    }

    // 2) 每个账户：日内计数检查 + 决策
    const dateKey = this.todayKey()
    let totalTrades = 0
    for (const acc of accounts) {
      const daily = this.dailyTradeCounts.get(acc.id) ?? { count: 0, dateKey }
      if (daily.dateKey !== dateKey) { daily.count = 0; daily.dateKey = dateKey }
      const dailyLimit = STRATEGY_DAILY_TRADE_LIMITS[acc.riskPreference as keyof typeof STRATEGY_DAILY_TRADE_LIMITS] ?? 12
      if (acc.frozen) continue
      if (daily.count >= dailyLimit) continue

      const accPos = this.positions.get(acc.id) ?? new Map()
      this.positions.set(acc.id, accPos)
      for (const sym of acc.watchlist) {
        if (daily.count >= dailyLimit) break
        const px = this.priceBook.get(sym)
        if (!px) continue
        const signal = this.decide(acc.strategy as StrategyCode, acc.paramOverrides, sym, px, accPos.get(sym))
        if (!signal) continue
        const result = this.executeTrade(acc, sym, signal, px.price, ts)
        if (result) {
          totalTrades++
          daily.count++
          this.dailyTradeCounts.set(acc.id, daily)
          this.totalTradeCounts.set(acc.id, (this.totalTradeCounts.get(acc.id) ?? 0) + 1)
        }
      }
    }

    // 3) 周期快照（实时：每小时；回放：每个 tick）
    const shouldSnapshot = this.replayMode
      ? true
      : (ts - this.lastSnapshotAt >= this.SNAPSHOT_INTERVAL_MS)
    if (shouldSnapshot) {
      this.takeSnapshots(ts)
      this.lastSnapshotAt = ts
    }

    // 4) 回放模式：推进虚拟日期；超出月末 → 自动 stop
    if (this.replayMode) {
      this.replayDayIndex++
      if (this.replayDayIndex >= this.replayTradingDays.length) {
        const finishedRunId = this.activeRunId
        this.logger.log(`回放完成: month=${this.replayMonth} 已走完 ${this.replayTradingDays.length} 个交易日`)
        this.stop()
        if (finishedRunId) {
          this.persistence.updateSimulationRun(finishedRunId, {
            status: 'completed',
            finishedAt: Date.now(),
          })
        }
        return
      }
      this.virtualDateKey = this.replayTradingDays[this.replayDayIndex]
    }

    if (totalTrades > 0) {
      this.logger.log(`tick 完成：mode=${this.replayMode ? 'replay' : 'live'} date=${dateKey} accounts=${accounts.length} trades=${totalTrades}`)
    }
  }

  /**
   * 策略决策
   * 返回 { side: 'BUY'|'SELL', quantity: number, reason: string }
   */
  private decide(
    strategy: StrategyCode,
    params: Record<string, number>,
    sym: string,
    px: { price: number; changePct: number },
    pos: { qty: number; avgCost: number } | undefined,
  ): { side: 'BUY' | 'SELL'; quantity: number; reason: string } | null {
    const posQty = pos?.qty ?? 0
    const posCost = pos?.avgCost ?? 0
    switch (strategy) {
      case 'ma_cross': {
        const { takeProfit, stopLoss } = params
        // 简化：用 changePct 当作"短线强度"
        if (px.changePct > 0.5 && posQty === 0) {
          return { side: 'BUY', quantity: 100, reason: `MA 金叉(chg=${px.changePct.toFixed(2)}%)` }
        }
        if (posQty > 0 && (px.changePct < -0.5 || (px.price - posCost) / posCost >= takeProfit)) {
          return { side: 'SELL', quantity: posQty, reason: `MA 死叉 / 止盈触发` }
        }
        return null
      }
      case 'momentum': {
        const { threshold, takeProfit, stopLoss } = params
        if (px.changePct / 100 > threshold && posQty === 0) {
          return { side: 'BUY', quantity: 100, reason: `动量突破 ${(px.changePct).toFixed(2)}%` }
        }
        if (posQty > 0 && ((px.price - posCost) / posCost >= takeProfit || (px.price - posCost) / posCost <= -stopLoss)) {
          return { side: 'SELL', quantity: posQty, reason: `动量止盈/止损` }
        }
        return null
      }
      case 'reversal': {
        const { oversold, overbought, takeProfit, stopLoss } = params
        if (px.changePct / 100 < oversold && posQty === 0) {
          return { side: 'BUY', quantity: 100, reason: `反转抄底 ${(px.changePct).toFixed(2)}%` }
        }
        if (posQty > 0 && (px.changePct / 100 > overbought || (px.price - posCost) / posCost >= takeProfit || (px.price - posCost) / posCost <= -stopLoss)) {
          return { side: 'SELL', quantity: posQty, reason: `反转止盈/止损` }
        }
        return null
      }
      case 'breakout': {
        const { takeProfit, stopLoss } = params
        if (px.changePct / 100 > 0.03 && posQty === 0) {
          return { side: 'BUY', quantity: 100, reason: `突破 ${(px.changePct).toFixed(2)}%` }
        }
        if (posQty > 0 && ((px.price - posCost) / posCost >= takeProfit || (px.price - posCost) / posCost <= -stopLoss)) {
          return { side: 'SELL', quantity: posQty, reason: `突破止盈/止损` }
        }
        return null
      }
      case 'trend_follow': {
        const { takeProfit, stopLoss } = params
        if (px.changePct / 100 > 0.02 && posQty === 0) {
          return { side: 'BUY', quantity: 100, reason: `趋势 ${(px.changePct).toFixed(2)}%` }
        }
        if (posQty > 0 && ((px.price - posCost) / posCost >= takeProfit || (px.price - posCost) / posCost <= -stopLoss)) {
          return { side: 'SELL', quantity: posQty, reason: `趋势止盈/止损` }
        }
        return null
      }
    }
  }

  /**
   * 模拟下单
   */
  private executeTrade(
    acc: any,
    sym: string,
    signal: { side: 'BUY' | 'SELL'; quantity: number; reason: string },
    price: number,
    ts: number,
  ): boolean {
    const accPos = this.positions.get(acc.id)!
    const amount = price * signal.quantity
    const pos = accPos.get(sym)
    if (signal.side === 'BUY') {
      // 风控：单次买入 ≤ 现金 30%，最多 30% 仓位
      const maxAmount = acc.cash * 0.3
      if (amount > maxAmount) return false
      if (acc.cash < amount) return false
      acc.cash -= amount
      const newQty = (pos?.qty ?? 0) + signal.quantity
      const newCost = pos
        ? (pos.qty * pos.avgCost + signal.quantity * price) / newQty
        : price
      accPos.set(sym, { qty: newQty, avgCost: newCost })
      this.persistence.updateSimAccount(acc.id, { cash: acc.cash })
      this.persistence.saveSimTrade({
        id: `t_${ts}_${acc.id.slice(-6)}_${sym}_BUY`,
        runId: acc.runId, accountId: acc.id, symbol: sym,
        side: 'BUY', quantity: signal.quantity, price, amount, reason: signal.reason, pnl: null, ts,
      })
      return true
    } else {
      // SELL
      if (!pos || pos.qty < signal.quantity) return false
      const pnl = (price - pos.avgCost) * signal.quantity
      acc.cash += amount
      const remain = pos.qty - signal.quantity
      if (remain <= 0) accPos.delete(sym)
      else accPos.set(sym, { qty: remain, avgCost: pos.avgCost })
      this.persistence.updateSimAccount(acc.id, { cash: acc.cash })
      this.persistence.saveSimTrade({
        id: `t_${ts}_${acc.id.slice(-6)}_${sym}_SELL`,
        runId: acc.runId, accountId: acc.id, symbol: sym,
        side: 'SELL', quantity: signal.quantity, price, amount, reason: signal.reason, pnl, ts,
      })
      return true
    }
  }

  /**
   * 周期快照：所有账户当前权益快照入库
   */
  private takeSnapshots(ts: number): void {
    if (!this.activeRunId) return
    const accounts = this.persistence.listSimAccounts(this.activeRunId)
    for (const acc of accounts) {
      const accPos = this.positions.get(acc.id) ?? new Map()
      let positionValue = 0
      for (const [sym, p] of accPos) {
        const px = this.priceBook.get(sym)
        if (px) positionValue += p.qty * px.price
      }
      const equity = acc.cash + positionValue
      const totalPnl = equity - acc.initialCapital
      const totalPnlRate = totalPnl / acc.initialCapital
      const tradeCount = this.totalTradeCounts.get(acc.id) ?? 0
      this.persistence.saveSimSnapshot({
        runId: acc.runId, accountId: acc.id, ts,
        cash: acc.cash, equity, positionValue,
        totalPnl, totalPnlRate, tradeCount,
      })
    }
  }

  /** 暴露给 controller 用于读取当前账户状态 */
  getCurrentState(runId: string): Array<{ accountId: string; cash: number; equity: number; pnl: number; pnlRate: number; positions: Array<{ symbol: string; qty: number; avgCost: number; marketValue: number; price: number }> }> {
    const accounts = this.persistence.listSimAccounts(runId)
    return accounts.map(acc => {
      const accPos = this.positions.get(acc.id) ?? new Map()
      let positionValue = 0
      const positions: any[] = []
      for (const [sym, p] of accPos) {
        const px = this.priceBook.get(sym)
        const price = px?.price ?? 0
        positionValue += p.qty * price
        positions.push({ symbol: sym, qty: p.qty, avgCost: p.avgCost, marketValue: p.qty * price, price })
      }
      const equity = acc.cash + positionValue
      const pnl = equity - acc.initialCapital
      const pnlRate = pnl / acc.initialCapital
      return { accountId: acc.id, cash: acc.cash, equity, pnl, pnlRate, positions }
    })
  }

  getPriceBook(): Record<string, { price: number; changePct: number }> {
    const obj: any = {}
    for (const [k, v] of this.priceBook) obj[k] = v
    return obj
  }
}