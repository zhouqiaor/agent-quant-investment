import { computeRisk, emptyRisk, equityToRates } from './risk.util'

describe('risk.util', () => {
  describe('emptyRisk', () => {
    it('返回全零指标', () => {
      expect(emptyRisk()).toEqual({ sharpe: 0, sortino: 0, maxDD: 0, calmar: 0 })
    })
  })

  describe('computeRisk', () => {
    it('空序列返回全零', () => {
      expect(computeRisk([])).toEqual({ sharpe: 0, sortino: 0, maxDD: 0, calmar: 0 })
    })

    it('恒定正收益：std=0 → sharpe/sortino 为 0，无回撤 → calmar 为 0', () => {
      const series = Array.from({ length: 10 }, (_, i) => ({ t: i, rate: 0.001 }))
      const r = computeRisk(series)
      expect(r.sharpe).toBe(0)
      expect(r.sortino).toBe(0)
      expect(r.maxDD).toBe(0)
      expect(r.calmar).toBe(0)
    })

    it('先涨后跌：maxDD 与回撤公式一致', () => {
      // equity: 0 → 0.1 → 0.21 → -0.032
      const series = [
        { t: 1, rate: 0.1 },
        { t: 2, rate: 0.1 },
        { t: 3, rate: -0.2 },
      ]
      const r = computeRisk(series)
      // peak = 0.21, dd = (-0.032 - 0.21) / 1.21 = -0.2 → -20%
      expect(r.maxDD).toBeCloseTo(-20, 1)
      // mean = 0 → sharpe/sortino 均为 0（0 / std）
      expect(r.sharpe).toBe(0)
      expect(r.sortino).toBe(0)
      // annualReturn = 0 → calmar = 0
      expect(r.calmar).toBe(0)
    })

    it('正均值的波动序列：sharpe 为正且按 sqrt(periodsPerYear) 年化', () => {
      // 交替 +1% / -0.5%：mean = 0.25%，std ≈ 0.0075
      const series = [
        { t: 1, rate: 0.01 },
        { t: 2, rate: -0.005 },
        { t: 3, rate: 0.01 },
        { t: 4, rate: -0.005 },
      ]
      const r = computeRisk(series)
      const mean = 0.0025
      const variance = ((0.01 - mean) ** 2 + (-0.005 - mean) ** 2) * 2 / 4
      const expectedSharpe = (mean / Math.sqrt(variance)) * Math.sqrt(252)
      expect(r.sharpe).toBeCloseTo(expectedSharpe, 1)
      // 下行只用负收益计算 → sortino > sharpe
      expect(r.sortino).toBeGreaterThan(r.sharpe)
      // 有回撤（-0.5% 的期）→ maxDD 为负的小值
      expect(r.maxDD).toBeLessThan(0)
      expect(r.maxDD).toBeGreaterThan(-2)
    })

    it('自定义 periodsPerYear 影响年化系数', () => {
      const series = [
        { t: 1, rate: 0.01 },
        { t: 2, rate: -0.005 },
        { t: 3, rate: 0.01 },
        { t: 4, rate: -0.005 },
      ]
      const daily = computeRisk(series, 252)
      const weekly = computeRisk(series, 52)
      expect(weekly.sharpe).toBeCloseTo((daily.sharpe * Math.sqrt(52)) / Math.sqrt(252), 1)
    })
  })

  describe('equityToRates', () => {
    it('正常序列：rate = (cur - prev) / prev', () => {
      const out = equityToRates([100, 110, 99])
      expect(out).toEqual([
        { t: 1, rate: 0.1 },
        { t: 2, rate: -0.1 },
      ])
    })

    it('prev <= 0 时该期 rate 记 0（防御）', () => {
      const out = equityToRates([0, 5, 10])
      expect(out).toEqual([
        { t: 1, rate: 0 },
        { t: 2, rate: 1 },
      ])
    })

    it('单点序列返回空', () => {
      expect(equityToRates([100])).toEqual([])
    })
  })
})
