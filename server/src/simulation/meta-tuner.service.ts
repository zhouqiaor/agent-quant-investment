import { Injectable, Logger } from '@nestjs/common'
import { PersistenceService } from '../persistence/persistence.service'

export interface MetaTuneResult {
  bestThresholds: {
    winnerMinWinRate: number
    winnerMinMeanReturn: number
    loserMaxWinRate: number
    loserMaxMeanReturn: number
  }
  baselineCalmar: number
  tunedCalmar: number
  improvement: number
  scanCount: number
  bestTrajectory: Array<{ step: number; thresholds: any; calmar: number }>
}

/**
 * 元调优器：在历史 run 上反推最佳的调优阈值。
 * 算法：网格搜索 winnerMinWinRate × winnerMinMeanReturn × loserMaxWinRate × loserMaxMeanReturn，
 * 用合成组合收益 = Σ w_ind × meanReturn_ind 来估算 calmar（无风险2%年化），
 * 找到最大化合成 calmar 的组合。
 */
@Injectable()
export class MetaTunerService {
  private readonly logger = new Logger(MetaTunerService.name)

  constructor(private readonly persistence: PersistenceService) {}

  optimize(meta: { steps?: number; stepSize?: number; objective?: 'calmar' | 'sharpe' | 'sortino' }, opts: { runIds?: string[] } = {}): MetaTuneResult {
    const steps = meta.steps ?? 30
    const stepSize = meta.stepSize ?? 0.01
    const objective = meta.objective ?? 'calmar'

    const runs = opts.runIds && opts.runIds.length
      ? opts.runIds
      : this.persistence.listSimulationRuns().map((r: any) => r.id)
    if (!runs.length) throw new Error('无历史 run，无法 meta-tune')

    const industryReturns = new Map<string, { sum: number; n: number; wins: number }>()
    const industrySnapSeries = new Map<string, number[]>()
    for (const runId of runs) {
      const accounts = this.persistence.listSimAccounts(runId)
      if (!accounts.length) continue
      const snaps = this.persistence['db'].prepare(
        `SELECT account_id, ts, total_pnl_rate FROM sim_snapshots WHERE run_id = ? ORDER BY ts DESC`,
      ).all(runId) as any[]
      const latest = new Map<string, number>()
      const series = new Map<string, number[]>()
      for (const s of snaps) {
        if (!latest.has(s.account_id)) latest.set(s.account_id, s.total_pnl_rate ?? 0)
        const a = series.get(s.account_id) ?? []
        a.push(s.total_pnl_rate ?? 0)
        series.set(s.account_id, a)
      }
      for (const acc of accounts as any[]) {
        const ind = acc.industry
        const r = latest.get(acc.id) ?? 0
        const e = industryReturns.get(ind) ?? { sum: 0, n: 0, wins: 0 }
        e.sum += r
        e.n += 1
        if (r > 0) e.wins += 1
        industryReturns.set(ind, e)
      }
      for (const [aid, arr] of series) {
        const acc = (accounts as any[]).find((a) => a.id === aid)
        if (!acc) continue
        const ind = acc.industry
        const cur = industrySnapSeries.get(ind) ?? []
        for (const r of arr) cur.push(r)
        industrySnapSeries.set(ind, cur)
      }
    }

    const baselineRules = {
      winnerMinWinRate: 0.55,
      winnerMinMeanReturn: 0.005,
      loserMaxWinRate: 0.35,
      loserMaxMeanReturn: -0.005,
    }

    const baselineCalmar = this.score(baselineRules, industryReturns, industrySnapSeries, objective)

    let bestThresholds = { ...baselineRules }
    let bestCalmar = baselineCalmar
    const trajectory: Array<{ step: number; thresholds: any; calmar: number }> = []

    const wrGrid = [0.45, 0.5, 0.55, 0.6, 0.65]
    const mrGrid = [-0.01, -0.005, 0, 0.005, 0.01]

    let step = 0
    for (const winnerMinWinRate of wrGrid) {
      for (const winnerMinMeanReturn of mrGrid) {
        for (const loserMaxWinRate of wrGrid) {
          for (const loserMaxMeanReturn of mrGrid) {
            if (loserMaxWinRate >= winnerMinWinRate) continue
            if (loserMaxMeanReturn >= winnerMinMeanReturn) continue
            const cand = { winnerMinWinRate, winnerMinMeanReturn, loserMaxWinRate, loserMaxMeanReturn }
            const c = this.score(cand, industryReturns, industrySnapSeries, objective)
            trajectory.push({ step: ++step, thresholds: cand, calmar: c })
            if (c > bestCalmar) {
              bestCalmar = c
              bestThresholds = cand
            }
          }
        }
      }
    }

    const improvement = baselineCalmar > 1e-9 ? (bestCalmar - baselineCalmar) / baselineCalmar : 0

    this.logger.log(`meta-tune 完成: 扫描 ${trajectory.length} 组，最佳 calmar=${bestCalmar.toFixed(3)} 基线=${baselineCalmar.toFixed(3)} 改进 ${(improvement * 100).toFixed(2)}%`)
    return {
      bestThresholds,
      baselineCalmar: Math.round(baselineCalmar * 1000) / 1000,
      tunedCalmar: Math.round(bestCalmar * 1000) / 1000,
      improvement: Math.round(improvement * 10000) / 10000,
      scanCount: trajectory.length,
      bestTrajectory: trajectory
        .filter((t) => t.calmar >= bestCalmar * 0.95)
        .sort((a, b) => b.calmar - a.calmar)
        .slice(0, 10)
        .map((t) => ({ step: t.step, thresholds: t.thresholds, calmar: Math.round(t.calmar * 1000) / 1000 })),
    }
  }

  private score(
    thresholds: { winnerMinWinRate: number; winnerMinMeanReturn: number; loserMaxWinRate: number; loserMaxMeanReturn: number },
    industryReturns: Map<string, { sum: number; n: number; wins: number }>,
    industrySnapSeries: Map<string, number[]>,
    objective: 'calmar' | 'sharpe' | 'sortino',
  ): number {
    const weights: Record<string, number> = {}
    const codes = Array.from(industryReturns.keys())
    for (const c of codes) weights[c] = 1 / codes.length
    for (const [ind, s] of industryReturns) {
      const meanRet = s.sum / s.n
      const winRate = s.wins / s.n
      if (winRate >= thresholds.winnerMinWinRate && meanRet >= thresholds.winnerMinMeanReturn) {
        weights[ind] = 1.4
      } else if (winRate < thresholds.loserMaxWinRate && meanRet < thresholds.loserMaxMeanReturn) {
        weights[ind] = 0.6
      }
    }
    const sum = Object.values(weights).reduce((s, v) => s + v, 0)
    for (const k of Object.keys(weights)) weights[k] /= sum

    const portfolioReturns: number[] = []
    const allDates = new Set<number>()
    for (const arr of industrySnapSeries.values()) for (const _ of arr) void 0
    const datesByIndustry = new Map<string, number[]>()
    for (const [ind, arr] of industrySnapSeries) datesByIndustry.set(ind, arr)
    const tsSet = new Set<number>()
    for (const arr of industrySnapSeries.values()) {
      arr.forEach((_, i) => tsSet.add(i))
    }
    const tsArr = Array.from(tsSet).sort((a, b) => a - b)
    for (const t of tsArr) {
      let r = 0
      for (const [ind, arr] of industrySnapSeries) {
        const ret = arr[t] ?? 0
        r += (weights[ind] ?? 0) * ret
      }
      portfolioReturns.push(r)
    }
    if (!portfolioReturns.length) return 0
    const meanR = portfolioReturns.reduce((s, v) => s + v, 0) / portfolioReturns.length
    const variance = portfolioReturns.reduce((s, v) => s + (v - meanR) ** 2, 0) / portfolioReturns.length
    const std = Math.sqrt(variance)
    if (std < 1e-9) return 0
    const sharpe = (meanR / std) * Math.sqrt(252)
    let peak = 0
    let equity = 0
    let maxDD = 0
    for (const r of portfolioReturns) {
      equity = (1 + equity) * (1 + r) - 1
      if (equity > peak) peak = equity
      const dd = peak > 0 ? (equity - peak) / (1 + peak) : 0
      if (dd < maxDD) maxDD = dd
    }
    const annualReturn = meanR * 252
    const calmar = maxDD < -1e-9 ? annualReturn / Math.abs(maxDD) : 0
    if (objective === 'calmar') return calmar
    if (objective === 'sortino') {
      const downside = portfolioReturns.filter((r) => r < 0)
      const dStd = Math.sqrt(downside.reduce((s, v) => s + v * v, 0) / Math.max(1, downside.length))
      return dStd > 1e-9 ? (annualReturn - 0.02) / dStd : 0
    }
    return sharpe
  }
}