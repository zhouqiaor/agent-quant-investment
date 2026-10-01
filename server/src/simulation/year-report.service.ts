import { Injectable, Logger } from '@nestjs/common'
import { PersistenceService } from '../persistence/persistence.service'

interface IndustryStat {
  industry: string
  accounts: number
  avgReturn: number
  totalReturn: number
  winAccounts: number
  winRate: number
}

interface StrategyStat {
  strategy: string
  accounts: number
  avgReturn: number
  totalReturn: number
  winAccounts: number
  winRate: number
}

interface AccountRow {
  industry: string
  strategy: string
  totalReturn: number
}

interface RunSummary {
  runId: string
  month: string
  accountCount: number
  aggregateReturn: number
  winRate: number
  industryStats: IndustryStat[]
  strategyStats: StrategyStat[]
}

interface MonthCell {
  month: string
  industry: string
  avgReturn: number
  accounts: number
}

@Injectable()
export class YearReportService {
  private readonly logger = new Logger(YearReportService.name)

  constructor(private readonly persistence: PersistenceService) {}

  async aggregate(): Promise<RunSummary[]> {
    const runs = this.persistence.listSimulationRuns().filter((r) => /2026-/.test(r.name ?? ''))
    const out: RunSummary[] = []
    for (const run of runs) {
      const accounts: any[] = this.persistence.listSimAccounts(run.id)
      if (!accounts.length) continue
      const snaps = this.persistence['db'].prepare(
        `SELECT account_id, total_pnl, total_pnl_rate FROM sim_snapshots
         WHERE run_id = ? ORDER BY ts DESC`,
      ).all(run.id) as any[]
      const latestSnap = new Map<string, { total_pnl: number; total_pnl_rate: number }>()
      for (const s of snaps) {
        if (!latestSnap.has(s.account_id)) latestSnap.set(s.account_id, { total_pnl: s.total_pnl ?? 0, total_pnl_rate: s.total_pnl_rate ?? 0 })
      }
      const enriched: AccountRow[] = accounts.map((a: any) => {
        const snap = latestSnap.get(a.id)
        return {
          industry: a.industry,
          strategy: a.strategy,
          totalReturn: snap?.total_pnl_rate ?? 0,
        }
      })
      const totalReturn = enriched.reduce((s, a) => s + a.totalReturn, 0)
      const winners = enriched.filter((a) => a.totalReturn > 0).length
      const industries = new Map<string, { sum: number; n: number; wins: number }>()
      const strategies = new Map<string, { sum: number; n: number; wins: number }>()
      for (const a of enriched) {
        const ii = industries.get(a.industry) ?? { sum: 0, n: 0, wins: 0 }
        ii.sum += a.totalReturn
        ii.n += 1
        if (a.totalReturn > 0) ii.wins += 1
        industries.set(a.industry, ii)
        const ss = strategies.get(a.strategy) ?? { sum: 0, n: 0, wins: 0 }
        ss.sum += a.totalReturn
        ss.n += 1
        if (a.totalReturn > 0) ss.wins += 1
        strategies.set(a.strategy, ss)
      }
      const round = (v: number) => Math.round(v * 10000) / 10000
      out.push({
        runId: run.id,
        month: (run as any).config?.month ?? '',
        accountCount: enriched.length,
        aggregateReturn: round(totalReturn),
        winRate: round(winners / enriched.length),
        industryStats: Array.from(industries.entries())
          .map(([industry, status]) => ({
            industry,
            accounts: status.n,
            avgReturn: round(status.sum / status.n),
            totalReturn: round(status.sum),
            winAccounts: status.wins,
            winRate: round(status.wins / status.n),
          }))
          .sort((a, b) => b.avgReturn - a.avgReturn),
        strategyStats: Array.from(strategies.entries())
          .map(([strategy, status]) => ({
            strategy,
            accounts: status.n,
            avgReturn: round(status.sum / status.n),
            totalReturn: round(status.sum),
            winAccounts: status.wins,
            winRate: round(status.wins / status.n),
          }))
          .sort((a, b) => b.avgReturn - a.avgReturn),
      })
    }
    return out.sort((a, b) => a.month.localeCompare(b.month))
  }

  renderMarkdown(runs: RunSummary[]): string {
    if (!runs.length) return '# 2026 年度仿真迭代报告\n\n无数据\n'
    const lines: string[] = []
    lines.push('# 2026 年度仿真迭代报告')
    lines.push('')
    lines.push(`> 月度回放 + 自动调优，按月串行迭代；样本规模：每月 100 账户（12 月 200 账户），价格源：历史 K 线`)
    lines.push('')

    lines.push('## §1 月度表现总览')
    lines.push('')
    lines.push('| 月份 | 账户数 | 累计收益 | 胜率 |')
    lines.push('|------|--------|----------|------|')
    for (const r of runs) {
      lines.push(`| ${r.month} | ${r.accountCount} | ${(r.aggregateReturn * 100).toFixed(2)}% | ${(r.winRate * 100).toFixed(2)}% |`)
    }
    lines.push('')

    lines.push('## §2 月度行业收益榜（Top 3 行业）')
    lines.push('')
    lines.push('| 月份 | Top 1 | Top 2 | Top 3 |')
    lines.push('|------|-------|-------|-------|')
    for (const r of runs) {
      const top = r.industryStats.slice(0, 3).map((s) => `${s.industry} ${(s.avgReturn * 100).toFixed(2)}%`).join(' / ')
      lines.push(`| ${r.month} | ${top} | | |`)
    }
    lines.push('')

    lines.push('## §3 月度策略收益榜（Top 2 策略）')
    lines.push('')
    lines.push('| 月份 | Top 1 | Top 2 |')
    lines.push('|------|-------|-------|')
    for (const r of runs) {
      const top = r.strategyStats.slice(0, 2).map((s) => `${s.strategy} ${(s.avgReturn * 100).toFixed(2)}%`).join(' / ')
      lines.push(`| ${r.month} | ${top} | |`)
    }
    lines.push('')

    const industries = new Set<string>()
    const strategies = new Set<string>()
    runs.forEach((r) => r.industryStats.forEach((s) => industries.add(s.industry)))
    runs.forEach((r) => r.strategyStats.forEach((s) => strategies.add(s.strategy)))

    lines.push('## §4 月度行业收益热力（%）')
    lines.push('')
    const indList = Array.from(industries)
    lines.push('| 行业 | ' + runs.map((r) => r.month).join(' | ') + ' |')
    lines.push('|' + '-'.repeat(6) + '|' + indList.map(() => '-'.repeat(8)).join('|') + '|')
    for (const ind of indList) {
      const cells = runs.map((r) => {
        const stat = r.industryStats.find((s) => s.industry === ind)
        return stat ? (stat.avgReturn * 100).toFixed(2) : '-'
      })
      lines.push(`| ${ind} | ${cells.join(' | ')} |`)
    }
    lines.push('')

    lines.push('## §5 月度策略收益热力（%）')
    lines.push('')
    const strList = Array.from(strategies)
    lines.push('| 策略 | ' + runs.map((r) => r.month).join(' | ') + ' |')
    lines.push('|' + '-'.repeat(6) + '|' + strList.map(() => '-'.repeat(8)).join('|') + '|')
    for (const str of strList) {
      const cells = runs.map((r) => {
        const stat = r.strategyStats.find((s) => s.strategy === str)
        return stat ? (stat.avgReturn * 100).toFixed(2) : '-'
      })
      lines.push(`| ${str} | ${cells.join(' | ')} |`)
    }
    lines.push('')

    const totalAccounts = runs.reduce((s, r) => s + r.accountCount, 0)
    const totalReturn = runs.reduce((s, r) => s + r.aggregateReturn, 0)
    const avgWinRate = runs.reduce((s, r) => s + r.winRate, 0) / runs.length
    lines.push('## §6 年度汇总')
    lines.push('')
    lines.push(`- 总账户数：**${totalAccounts}**`)
    lines.push(`- 累计加权收益：**${(totalReturn * 100).toFixed(2)}%**`)
    lines.push(`- 平均月胜率：**${(avgWinRate * 100).toFixed(2)}%**`)
    lines.push('')

    return lines.join('\n')
  }
}