function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export interface RiskMetrics {
  sharpe: number
  sortino: number
  maxDD: number
  calmar: number
}

export interface SeriesPoint {
  t: number
  rate: number
}

export function emptyRisk(): RiskMetrics {
  return { sharpe: 0, sortino: 0, maxDD: 0, calmar: 0 }
}

/**
 * 计算一组时间序列上的风险指标
 * - sharpe: (meanR / std) * sqrt(periodsPerYear)
 * - sortino: (meanR / downsideStd) * sqrt(periodsPerYear)
 * - maxDD: 最大回撤（负数）
 * - calmar: 年化收益 / |最大回撤|
 *
 * @param series 单调递增的时间序列（已按 t 排序）
 * @param periodsPerYear 一个年度周期数（默认 252 = 日级）
 */
export function computeRisk(series: SeriesPoint[], periodsPerYear = 252): RiskMetrics {
  if (!series.length) return emptyRisk()
  const rates = series.map((s) => s.rate)
  const meanR = rates.reduce((s, r) => s + r, 0) / rates.length
  const variance = rates.reduce((s, r) => s + (r - meanR) ** 2, 0) / rates.length
  const std = Math.sqrt(variance)
  const sharpe = std > 1e-9 ? (meanR / std) * Math.sqrt(periodsPerYear) : 0
  const downsideVar = rates.reduce((s, r) => s + (r < 0 ? (r - 0) ** 2 : 0), 0) / rates.length
  const downsideStd = Math.sqrt(downsideVar)
  const sortino = downsideStd > 1e-9 ? (meanR / downsideStd) * Math.sqrt(periodsPerYear) : 0
  let peak = 0
  let equity = 0
  let maxDD = 0
  for (const r of rates) {
    equity = (1 + equity) * (1 + r) - 1
    if (equity > peak) peak = equity
    // 同时考虑正、负区间：用 peak 做基准
    const dd = peak !== 0 ? (equity - peak) / (1 + peak) : 0
    if (dd < maxDD) maxDD = dd
  }
  const annualReturn = meanR * periodsPerYear
  const calmar = maxDD < -1e-9 ? annualReturn / Math.abs(maxDD) : 0
  return {
    sharpe: round2(sharpe),
    sortino: round2(sortino),
    maxDD: round2(maxDD * 10000) / 100,
    calmar: round2(calmar),
  }
}

/**
 * 从 equity 值序列反推每期收益率（t 是 tick 序号或时间戳）
 */
export function equityToRates(equitySeries: number[]): SeriesPoint[] {
  const out: SeriesPoint[] = []
  for (let i = 1; i < equitySeries.length; i++) {
    const prev = equitySeries[i - 1]
    const cur = equitySeries[i]
    if (prev <= 0) {
      out.push({ t: i, rate: 0 })
      continue
    }
    out.push({ t: i, rate: (cur - prev) / prev })
  }
  return out
}