import { Injectable } from '@nestjs/common'
import { PersistenceService } from '../persistence/persistence.service'

@Injectable()
export class SimulationReportService {
  constructor(private readonly persistence: PersistenceService) {}

  /**
   * 生成 run 的聚合报告
   * 维度：整体 / 行业 / 策略 / 资金规模 / Top-Bottom
   */
  generate(runId: string): any {
    const accounts = this.persistence.listSimAccounts(runId)
    if (accounts.length === 0) return null

    // 计算每个账户的当前状态（基于最新快照或账户内存数据）
    const allSnapshots = this.persistence['db'].prepare(
      `SELECT account_id, total_pnl, total_pnl_rate, equity, trade_count
       FROM sim_snapshots WHERE run_id = ? ORDER BY ts DESC`
    ).all(runId) as any[]

    // 按 account 取最新快照
    const latestByAcc = new Map<string, any>()
    for (const s of allSnapshots) {
      if (!latestByAcc.has(s.account_id)) latestByAcc.set(s.account_id, s)
    }

    // 没有快照的用初始值
    const allTrades = this.persistence.listSimTrades(runId)
    const tradeCountByAcc = new Map<string, number>()
    for (const t of allTrades) {
      tradeCountByAcc.set(t.account_id, (tradeCountByAcc.get(t.account_id) ?? 0) + 1)
    }

    const enriched = accounts.map((a: any) => {
      const snap = latestByAcc.get(a.id)
      const equity = snap?.equity ?? a.initialCapital
      const pnl = snap?.total_pnl ?? 0
      const pnlRate = snap?.total_pnl_rate ?? 0
      const tradeCount = snap?.trade_count ?? tradeCountByAcc.get(a.id) ?? 0
      return {
        id: a.id, seq: a.seq, name: a.name,
        industry: a.industry, strategy: a.strategy,
        initialCapital: a.initialCapital, equity, pnl, pnlRate, tradeCount,
      }
    })

    // 1. 整体
    const sorted = enriched.sort((a, b) => b.pnlRate - a.pnlRate)
    const mean = enriched.reduce((s, e) => s + e.pnlRate, 0) / enriched.length
    const median = this.median(enriched.map(e => e.pnlRate))
    const winners = enriched.filter(e => e.pnl > 0).length
    const losers = enriched.filter(e => e.pnl < 0).length

    // 2. 行业
    const byIndustry = this.groupBy(enriched, 'industry')
    const industryStats = Object.entries(byIndustry).map(([k, list]: any) => ({
      industry: k,
      count: list.length,
      meanReturn: this.avg(list.map((x: any) => x.pnlRate)),
      medianReturn: this.median(list.map((x: any) => x.pnlRate)),
      winRate: list.filter((x: any) => x.pnl > 0).length / list.length,
    }))

    // 3. 策略
    const byStrategy = this.groupBy(enriched, 'strategy')
    const strategyStats = Object.entries(byStrategy).map(([k, list]: any) => ({
      strategy: k,
      count: list.length,
      meanReturn: this.avg(list.map((x: any) => x.pnlRate)),
      winRate: list.filter((x: any) => x.pnl > 0).length / list.length,
    }))

    // 4. 资金规模（10万以下/10-50万/50万以上）
    const byCapital = {
      small:  enriched.filter(e => e.initialCapital < 100_000),
      medium: enriched.filter(e => e.initialCapital >= 100_000 && e.initialCapital < 500_000),
      large:  enriched.filter(e => e.initialCapital >= 500_000),
    }
    const capitalStats = Object.entries(byCapital).map(([k, list]: any) => ({
      tier: k,
      count: list.length,
      meanReturn: this.avg(list.map((x: any) => x.pnlRate)),
    }))

    return {
      runId,
      generatedAt: Date.now(),
      overall: {
        accountCount: enriched.length,
        meanReturn: mean,
        medianReturn: median,
        winnerCount: winners,
        loserCount: losers,
        winRate: winners / enriched.length,
        topReturn: enriched[0]?.pnlRate ?? 0,
        bottomReturn: enriched[enriched.length - 1]?.pnlRate ?? 0,
        stdDev: this.stdDev(enriched.map(e => e.pnlRate)),
      },
      top10: sorted.slice(0, 10).map(e => ({ name: e.name, industry: e.industry, strategy: e.strategy, pnlRate: e.pnlRate, pnl: e.pnl })),
      bottom10: sorted.slice(-10).reverse().map(e => ({ name: e.name, industry: e.industry, strategy: e.strategy, pnlRate: e.pnlRate, pnl: e.pnl })),
      industryStats: industryStats.sort((a, b) => b.meanReturn - a.meanReturn),
      strategyStats: strategyStats.sort((a, b) => b.meanReturn - a.meanReturn),
      capitalStats,
    }
  }

  private avg(arr: number[]): number {
    if (arr.length === 0) return 0
    return arr.reduce((a, b) => a + b, 0) / arr.length
  }

  private median(arr: number[]): number {
    if (arr.length === 0) return 0
    const sorted = [...arr].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
  }

  private stdDev(arr: number[]): number {
    if (arr.length === 0) return 0
    const m = this.avg(arr)
    return Math.sqrt(this.avg(arr.map(x => (x - m) ** 2)))
  }

  private groupBy<T extends Record<string, any>>(arr: T[], key: keyof T): Record<string, T[]> {
    const out: Record<string, T[]> = {}
    for (const item of arr) {
      const k = String(item[key])
      if (!out[k]) out[k] = []
      out[k].push(item)
    }
    return out
  }
}