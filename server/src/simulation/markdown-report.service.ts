import { Injectable } from '@nestjs/common'
import { SimulationReportService } from './simulation-report.service'
import { PersistenceService } from '../persistence/persistence.service'

/**
 * 仿真报告 → Markdown 渲染器
 * - 输入：SimulationReportService.generate() 的输出 + run 元数据
 * - 输出：完整 Markdown 文档（含概览/行业/策略/资金/Top-Bottom/洞察/附录）
 */
@Injectable()
export class MarkdownReportRenderer {
  constructor(
    private readonly persistence: PersistenceService,
  ) {}

  render(runId: string, generatedAt: Date = new Date()): string {
    // 直接调 report.generate 复用相同口径
    const report = new SimulationReportService(this.persistence).generate(runId)
    if (!report) return `# SimulationReport\n\nrun ${runId} 无可渲染数据\n`
    const run = this.persistence.getSimulationRun(runId)
    const trades = this.persistence.listSimTrades(runId)
    const snapshotCount = (this.persistence as any).db
      .prepare('SELECT COUNT(*) as n FROM sim_snapshots WHERE run_id = ?')
      .get(runId) as { n: number }

    const lines: string[] = []
    const push = (s: string = '') => lines.push(s)

    push(`# 仿真复盘报告 · ${run?.name ?? runId}`)
    push()
    push(`- **Run ID**: \`${runId}\``)
    push(`- **生成时间**: ${generatedAt.toISOString()}`)
    push(`- **运行状态**: ${run?.status ?? 'unknown'}`)
    push(`- **账户数**: ${report.overall.accountCount}`)
    push(`- **交易日数**: ${snapshotCount.n} 条`)
    push(`- **交易笔数**: ${trades.length} 笔`)
    if (run?.config) {
      try {
        const cfg = JSON.parse(run.config)
        if (cfg.month) push(`- **回放月份**: ${cfg.month}`)
        if (cfg.priceSource) push(`- **价格源**: ${cfg.priceSource}`)
      } catch {}
    }

    // 1. 整体概览
    push()
    push(`## 1. 整体表现`)
    push()
    push(`| 指标 | 数值 |`)
    push(`|------|------|`)
    push(`| 账户数 | ${report.overall.accountCount} |`)
    push(`| 平均收益率 | ${fmtPct(report.overall.meanReturn)} |`)
    push(`| 中位收益率 | ${fmtPct(report.overall.medianReturn)} |`)
    push(`| 收益率标准差 | ${fmtPct(report.overall.stdDev)} |`)
    push(`| 盈利账户数 | ${report.overall.winnerCount} (${fmtPct(report.overall.winRate)}) |`)
    push(`| 亏损账户数 | ${report.overall.loserCount} |`)
    push(`| 最高收益率 | ${fmtPct(report.overall.topReturn)} |`)
    push(`| 最低收益率 | ${fmtPct(report.overall.bottomReturn)} |`)
    push()

    // 2. 行业分布
    push(`## 2. 行业分布（按 INDUSTRIES）`)
    push()
    push(`| 行业 | 账户数 | 平均收益 | 中位收益 | 胜率 |`)
    push(`|------|--------|----------|----------|------|`)
    for (const r of report.industryStats) {
      push(`| ${r.industry} | ${r.count} | ${fmtPct(r.meanReturn)} | ${fmtPct(r.medianReturn)} | ${fmtPct(r.winRate)} |`)
    }
    push()

    // 3. 策略分布
    push(`## 3. 策略分布`)
    push()
    push(`| 策略 | 账户数 | 平均收益 | 胜率 |`)
    push(`|------|--------|----------|------|`)
    for (const r of report.strategyStats) {
      push(`| ${r.strategy} | ${r.count} | ${fmtPct(r.meanReturn)} | ${fmtPct(r.winRate)} |`)
    }
    push()

    // 4. 资金规模分布
    push(`## 4. 资金规模分布`)
    push()
    push(`| 档位 | 标准 | 账户数 | 平均收益 |`)
    push(`|------|------|--------|----------|`)
    const tierLabel: Record<string, string> = { small: '小额 (<10万)', medium: '中额 (10-50万)', large: '大额 (≥50万)' }
    for (const r of report.capitalStats) {
      push(`| ${tierLabel[r.tier] ?? r.tier} | — | ${r.count} | ${fmtPct(r.meanReturn)} |`)
    }
    push()

    // 5. Top 10 / Bottom 10
    push(`## 5. Top 10 账户`)
    push()
    push(`| # | 账户名 | 行业 | 策略 | 收益率 | 收益额 |`)
    push(`|---|--------|------|------|--------|--------|`)
    report.top10.forEach((e, i) => {
      push(`| ${i + 1} | ${e.name} | ${e.industry} | ${e.strategy} | ${fmtPct(e.pnlRate)} | ${fmtMoney(e.pnl)} |`)
    })
    push()
    push(`## 6. Bottom 10 账户`)
    push()
    push(`| # | 账户名 | 行业 | 策略 | 收益率 | 收益额 |`)
    push(`|---|--------|------|------|--------|--------|`)
    report.bottom10.forEach((e, i) => {
      push(`| ${i + 1} | ${e.name} | ${e.industry} | ${e.strategy} | ${fmtPct(e.pnlRate)} | ${fmtMoney(e.pnl)} |`)
    })
    push()

    // 7. 关键洞察（基于数据自动生成）
    push(`## 7. 关键洞察`)
    push()
    const insights = generateInsights(report)
    for (const ins of insights) {
      push(`- ${ins}`)
    }
    push()

    // 8. 附录
    push(`## 8. 附录`)
    push()
    push(`### 8.1 数据口径`)
    push(`- **账户收益**：基于 sim_snapshots 最新快照的 totalPnl / initialCapital`)
    push(`- **行业**：引用 simulation.constants.ts INDUSTRIES 定义`)
    push(`- **策略**：固定 5 类（ma_cross / momentum / reversal / breakout / trend_follow）`)
    push(`- **价格源**：history_kline 真实 K 线 close（回放模式）`)
    push()
    push(`### 8.2 已知限制`)
    push(`- K 线样本仅 16 只仿真股票，非全 A 股；不代表真实大盘`)
    push(`- 价格驱动基于历史 K 线 close，未引入分时/盘前盘后波动`)
    push(`- 策略决策仅依赖日内 changePct，未使用多日均线/真实 K 线形态`)
    push(`- 单次回放约 ${run?.config ? (() => { try { return JSON.parse(run.config).replayTickMs ?? 60_000 } catch { return 60_000 } })() : 60_000}ms/tick × 交易日数`)
    push()

    return lines.join('\n')
  }
}

function fmtPct(n: number): string {
  if (!Number.isFinite(n)) return 'N/A'
  return `${(n * 100).toFixed(2)}%`
}
function fmtMoney(n: number): string {
  if (!Number.isFinite(n)) return 'N/A'
  return `${n.toFixed(0)} 元`
}

function generateInsights(report: any): string[] {
  const out: string[] = []
  // 最佳/最差行业
  if (report.industryStats.length >= 2) {
    const best = report.industryStats[0]
    const worst = report.industryStats[report.industryStats.length - 1]
    out.push(`**行业分化**：最佳行业「${best.industry}」平均收益 ${fmtPct(best.meanReturn)}，最差「${worst.industry}」${fmtPct(worst.meanReturn)}，差距 ${fmtPct(best.meanReturn - worst.meanReturn)}`)
  }
  // 最佳/最差策略
  if (report.strategyStats.length >= 2) {
    const best = report.strategyStats[0]
    const worst = report.strategyStats[report.strategyStats.length - 1]
    out.push(`**策略对比**：策略「${best.strategy}」平均收益 ${fmtPct(best.meanReturn)} 胜率 ${fmtPct(best.winRate)}；「${worst.strategy}」${fmtPct(worst.meanReturn)} 胜率 ${fmtPct(worst.winRate)}`)
  }
  // 资金规模
  const caps = report.capitalStats
  if (caps.length === 3) {
    const small = caps.find((c: any) => c.tier === 'small')
    const large = caps.find((c: any) => c.tier === 'large')
    if (small && large) {
      out.push(`**资金规模**：小额账户平均 ${fmtPct(small.meanReturn)} vs 大额账户 ${fmtPct(large.meanReturn)}`)
    }
  }
  // 极端账户
  if (report.top10.length > 0 && report.bottom10.length > 0) {
    out.push(`**极端表现**：Top1「${report.top10[0].name}」${fmtPct(report.top10[0].pnlRate)}；Bottom1「${report.bottom10[0].name}」${fmtPct(report.bottom10[0].pnlRate)}`)
  }
  return out
}