import { Injectable, Logger } from '@nestjs/common'
import { PersistenceService } from '../persistence/persistence.service'

/**
 * 策略调优引擎
 * 输入：prior runId + 调优规则
 * 输出：下月仿真账户分布权重（industryWeights, strategyWeights, watchlist, capitalTierWeights）
 *
 * 调优逻辑：
 * 1. 从 sim_snapshots 取每个账户最新快照的 pnlRate
 * 2. 按 industry 聚合：avgReturn + winRate
 * 3. 按 strategy 聚合：同上
 * 4. 套用 rules：
 *    - winner: 胜率 ≥ winnerMinWillingR 且 avgReturn ≥ winnerMinMeanReturn → 权重 ×winnerMultiplier
 *    - loser: 胜率 < loserMaxWinRate 且 avgReturn < loserMaxMeanReturn → 权重 ×loserMultiplier
 *    - neutral: 中间情况 → ×neutralMultiplier (1.0)
 * 5. 边界裁剪到 [minWeight, maxWeight]
 * 6. 归一化使总和 = 1
 * 7. Watchlist: 上月盈利 Top3 股票 + 新随机
 */
@Injectable()
export class StrategyTunerService {
  private readonly logger = new Logger(StrategyTunerService.name)
  private readonly DEFAULT_RULES_PATH = 'data/tuning-rules.json'

  constructor(private readonly persistence: PersistenceService) {}

  /**
   * 主入口：基于 prior run 调优，返回下月配置
   */
  tuneFromRun(priorRunId: string, opts: { rules?: any; priorWatchlist?: string[] } = {}): {
    industryWeights: Record<string, number>
    strategyWeights: Record<string, number>
    watchlist: string[]
    capitalTierWeights: Record<string, number>
    rulesApplied: Array<{ code: string; type: string; oldWeight: number; newWeight: number; reason: string }>
    diagnostics?: {
      priorRunId: string
      accountCount: number
      winnerIndustries: string[]
      loserIndustries: string[]
      winnerStrategies: string[]
      loserStrategies: string[]
    }
  } {
    const rules = opts.rules ?? this.loadRules()

    const accounts = this.persistence.listSimAccounts(priorRunId)
    if (accounts.length === 0) {
      this.logger.warn(`prior run ${priorRunId} 无账户，返回默认均匀权重`)
      return this.defaultWeights(rules)
    }

    // 取每个账户最新快照
    const snaps = this.persistence['db'].prepare(
      `SELECT account_id, total_pnl, total_pnl_rate, equity, trade_count
       FROM sim_snapshots WHERE run_id = ? ORDER BY ts DESC`,
    ).all(priorRunId) as any[]
    const latestSnap = new Map<string, any>()
    for (const s of snaps) if (!latestSnap.has(s.account_id)) latestSnap.set(s.account_id, s)

    const enriched = accounts.map((a: any) => {
      const snap = latestSnap.get(a.id)
      return {
        id: a.id, industry: a.industry, strategy: a.strategy,
        pnlRate: snap?.total_pnl_rate ?? 0,
        pnl: snap?.total_pnl ?? 0,
      }
    })

    // 按 industry / strategy 聚合
    const industryStats = this.aggregate(enriched, 'industry')
    const strategyStats = this.aggregate(enriched, 'strategy')

    // 套用规则
    const rulesApplied: any[] = []
    const industryWeights = this.applyRules(rules, industryStats, 'industry', rulesApplied)
    const strategyWeights = this.applyRules(rules, strategyStats, 'strategy', rulesApplied)

    // Watchlist: 取上月 Top3 盈利股票 + 随机补足
    const topAccByPnl = [...enriched].sort((a, b) => b.pnlRate - a.pnlRate).slice(0, 3)
    const topSymbols = topAccByPnl.flatMap((a: any) => {
      const acc = accounts.find((x: any) => x.id === a.id)
      return acc?.watchlist ?? []
    }).slice(0, 3)
    const watchlist = this.buildWatchlist(rules, opts.priorWatchlist, topSymbols)

    // Capital tier 直接沿用 rules
    const capitalTierWeights = rules.capitalTierWeights

    const winnerIndustries = rulesApplied
      .filter((r) => r.type === 'winner' && rules.industries.includes(r.code))
      .map((r) => r.code)
    const loserIndustries = rulesApplied
      .filter((r) => r.type === 'loser' && rules.industries.includes(r.code))
      .map((r) => r.code)
    const winnerStrategies = rulesApplied
      .filter((r) => r.type === 'winner' && rules.strategies.includes(r.code))
      .map((r) => r.code)
    const loserStrategies = rulesApplied
      .filter((r) => r.type === 'loser' && rules.strategies.includes(r.code))
      .map((r) => r.code)

    this.logger.log(`调优完成: industries=${JSON.stringify(industryWeights)} strategies=${JSON.stringify(strategyWeights)}`)
    return {
      industryWeights, strategyWeights, watchlist, capitalTierWeights, rulesApplied,
      diagnostics: {
        priorRunId,
        accountCount: accounts.length,
        winnerIndustries,
        loserIndustries,
        winnerStrategies,
        loserStrategies,
      },
    }
  }

  /**
   * 默认均匀权重（首月 / 异常情况）
   */
  defaultWeights(rules: any): {
    industryWeights: Record<string, number>
    strategyWeights: Record<string, number>
    watchlist: string[]
    capitalTierWeights: Record<string, number>
    rulesApplied: any[]
  } {
    const n = rules.industries.length
    const m = rules.strategies.length
    const industryWeights: Record<string, number> = {}
    rules.industries.forEach((k: string) => industryWeights[k] = 1 / n)
    const strategyWeights: Record<string, number> = {}
    rules.strategies.forEach((k: string) => strategyWeights[k] = 1 / m)
    return {
      industryWeights, strategyWeights,
      watchlist: [], capitalTierWeights: rules.capitalTierWeights,
      rulesApplied: [{ code: '*', type: 'default', oldWeight: 0, newWeight: 1 / n, reason: '首月 / 无 prior 数据，使用均匀分布' }],
    }
  }

  /**
   * 应用规则到一组维度权重
   */
  private applyRules(
    rules: any,
    stats: Record<string, { count: number; meanReturn: number; winRate: number }>,
    dim: string,
    rulesApplied: any[],
  ): Record<string, number> {
    const codes = dim === 'industry' ? rules.industries : rules.strategies
    const baseWeights: Record<string, number> = {}
    codes.forEach((c: string) => baseWeights[c] = 1 / codes.length)

    for (const code of codes) {
      const s = stats[code]
      if (!s || s.count === 0) continue
      const old = baseWeights[code]
      let mult = rules.weightAdjustments.neutralMultiplier
      let type = 'neutral'
      if (s.winRate >= rules.thresholds.winnerMinWinRate && s.meanReturn >= rules.thresholds.winnerMinMeanReturn) {
        mult = rules.weightAdjustments.winnerMultiplier
        type = 'winner'
      } else if (s.winRate < rules.thresholds.loserMaxWinRate && s.meanReturn < rules.thresholds.loserMaxMeanReturn) {
        mult = rules.weightAdjustments.loserMultiplier
        type = 'loser'
      }
      baseWeights[code] = this.clamp(old * mult, rules.bounds.minWeight, rules.bounds.maxWeight)
      rulesApplied.push({
        code, type, oldWeight: old, newWeight: baseWeights[code],
        reason: `count=${s.count} winRate=${(s.winRate * 100).toFixed(1)}% meanReturn=${(s.meanReturn * 100).toFixed(2)}%`,
      })
    }

    // 归一化
    const sum = Object.values(baseWeights).reduce((s, v) => s + v, 0)
    const normalized: Record<string, number> = {}
    for (const [k, v] of Object.entries(baseWeights)) normalized[k] = v / sum
    return normalized
  }

  private aggregate(records: any[], key: string) {
    const out: Record<string, { count: number; meanReturn: number; winRate: number }> = {}
    for (const r of records) {
      const k = r[key]
      if (!out[k]) out[k] = { count: 0, meanReturn: 0, winRate: 0 }
      out[k].count++
      out[k].meanReturn += r.pnlRate
      if (r.pnl > 0) out[k].winRate++
    }
    for (const k of Object.keys(out)) {
      out[k].meanReturn /= out[k].count
      out[k].winRate /= out[k].count
    }
    return out
  }

  private buildWatchlist(rules: any, priorWatchlist?: string[], topSymbols: string[] = []): string[] {
    const carry = new Set<string>()
    if (priorWatchlist) priorWatchlist.slice(0, rules.watchlist.carryTopN).forEach((s: string) => carry.add(s))
    topSymbols.slice(0, rules.watchlist.carryTopN).forEach((s: string) => carry.add(s))
    const randoms = this.persistence['db'].prepare(
      `SELECT DISTINCT symbol FROM stock_directory ORDER BY RANDOM() LIMIT ?`,
    ).all(rules.watchlist.randomizeEachMonth) as any[]
    for (const r of randoms) carry.add(r.symbol)
    return Array.from(carry).slice(0, rules.watchlist.baseSize + rules.watchlist.randomizeEachMonth)
  }

  private clamp(v: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, v))
  }

  private loadRules(): any {
    try {
      const path = require('path')
      const fs = require('fs')
      const candidates = [
        path.resolve(process.cwd(), this.DEFAULT_RULES_PATH),
        path.resolve(process.cwd(), '..', this.DEFAULT_RULES_PATH),
        path.resolve(__dirname, '..', '..', '..', this.DEFAULT_RULES_PATH),
      ]
      for (const p of candidates) {
        if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'))
      }
      throw new Error(`tuning-rules.json 未找到，尝试路径: ${candidates.join(', ')}`)
    } catch (e) {
      this.logger.warn(`无法读取 ${this.DEFAULT_RULES_PATH}：${(e as Error).message}，使用内置默认`)
      return JSON.parse(JSON.stringify({
        thresholds: { winnerMinWinRate: 0.55, winnerMinMeanReturn: 0.005, loserMaxWinRate: 0.35, loserMaxMeanReturn: -0.005 },
        weightAdjustments: { winnerMultiplier: 1.4, loserMultiplier: 0.6, neutralMultiplier: 1.0 },
        bounds: { minWeight: 0.05, maxWeight: 0.6 },
        watchlist: { baseSize: 5, carryTopN: 3, randomizeEachMonth: 5 },
        capitalTierWeights: { small: 0.4, medium: 0.4, large: 0.2 },
        industries: ['tech', 'finance', 'consumer', 'pharma', 'energy', 'industrial', 'material', 'utility', 'telecom', 'auto'],
        strategies: ['ma_cross', 'momentum', 'reversal', 'breakout', 'trend_follow'],
      }))
    }
  }
}