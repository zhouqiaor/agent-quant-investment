import {
  INDUSTRIES,
  STRATEGIES,
  STRATEGY_BASE_PARAMS,
  STRATEGY_DAILY_TRADE_LIMITS,
  STRATEGY_LABEL,
  RISK_PREFERENCES,
  RISK_LABEL,
  logUniform,
  normalSample,
  perturbParams,
  uniform,
  weightedPick,
} from './simulation.constants'

describe('simulation.constants', () => {
  describe('行业与策略配置', () => {
    it('INDUSTRIES 覆盖 11 个行业且每行有代表股票', () => {
      expect(INDUSTRIES).toHaveLength(11)
      for (const ind of INDUSTRIES) {
        expect(ind.code).toBeTruthy()
        expect(ind.name).toBeTruthy()
        expect(ind.stocks.length).toBeGreaterThan(0)
      }
    })

    it('STRATEGIES 定义 5 个策略且 LABEL/基础参数一一对应', () => {
      expect(STRATEGIES).toHaveLength(5)
      for (const s of STRATEGIES) {
        expect(STRATEGY_LABEL[s]).toBeTruthy()
        const params = STRATEGY_BASE_PARAMS[s]
        expect(Object.keys(params).length).toBeGreaterThan(0)
        // 止盈止损必须是比例（0..1 区间）
        expect(params['takeProfit']).toBeGreaterThan(0)
        expect(params['takeProfit']).toBeLessThan(1)
        expect(params['stopLoss']).toBeGreaterThan(0)
        expect(params['stopLoss']).toBeLessThan(1)
      }
    })

    it('RISK_PREFERENCES 三个风险偏好均有标签与日交易上限', () => {
      expect(RISK_PREFERENCES).toHaveLength(3)
      for (const r of RISK_PREFERENCES) {
        expect(RISK_LABEL[r]).toBeTruthy()
        expect(STRATEGY_DAILY_TRADE_LIMITS[r]).toBeGreaterThan(0)
      }
      // 保守 < 中性 < 激进
      expect(STRATEGY_DAILY_TRADE_LIMITS.conservative).toBeLessThan(
        STRATEGY_DAILY_TRADE_LIMITS.neutral,
      )
      expect(STRATEGY_DAILY_TRADE_LIMITS.neutral).toBeLessThan(
        STRATEGY_DAILY_TRADE_LIMITS.aggressive,
      )
    })
  })

  describe('weightedPick', () => {
    it('空列表抛错', () => {
      expect(() => weightedPick([], [])).toThrow('empty')
    })

    it('权重悬殊时稳定命中高权重项', () => {
      const picked = weightedPick(['a', 'b'], [1e9, 1])
      expect(picked).toBe('a')
    })

    it('确定性随机值下命中预期项', () => {
      const spy = jest.spyOn(Math, 'random').mockReturnValue(0.5)
      // total = 2, r = 0.5*2 = 1 → 减去 w0=0.4 → 0.6 > 0 → 命中 'b'
      expect(weightedPick(['a', 'b'], [0.4, 1.6])).toBe('b')
      spy.mockRestore()
    })
  })

  describe('uniform / logUniform / normalSample', () => {
    it('uniform 返回值在 [min,max] 内（1000 次采样）', () => {
      for (let i = 0; i < 1000; i++) {
        const v = uniform(5, 7)
        expect(v).toBeGreaterThanOrEqual(5)
        expect(v).toBeLessThanOrEqual(7)
      }
    })

    it('uniform 确定性：random=0.5 → 中点', () => {
      const spy = jest.spyOn(Math, 'random').mockReturnValue(0.5)
      expect(uniform(4, 8)).toBe(6)
      spy.mockRestore()
    })

    it('logUniform 返回值在 [min,max] 内且确定性中点为几何均值', () => {
      for (let i = 0; i < 1000; i++) {
        const v = logUniform(2, 8)
        expect(v).toBeGreaterThanOrEqual(2)
        expect(v).toBeLessThanOrEqual(8)
      }
      const spy = jest.spyOn(Math, 'random').mockReturnValue(0.5)
      expect(logUniform(2, 8)).toBeCloseTo(4, 6) // sqrt(2*8) = 4
      spy.mockRestore()
    })

    it('normalSample 确定性：Box-Muller 在 u1=0.5,u2=0.5 时 ≈ -1.1774', () => {
      const spy = jest.spyOn(Math, 'random').mockReturnValue(0.5)
      const z = normalSample(0, 1)
      expect(z).toBeCloseTo(-1.1774, 3)
      // mean/std 平移
      expect(normalSample(10, 2)).toBeCloseTo(10 + 2 * -1.1774, 3)
      spy.mockRestore()
    })
  })

  describe('perturbParams', () => {
    it('大于 1 的参数扰动保持在 ±ratio 区间内', () => {
      const base = { maShort: 20, lookback: 10 }
      for (let i = 0; i < 200; i++) {
        const p = perturbParams(base, 0.2)
        expect(p.maShort).toBeGreaterThanOrEqual(20 * 0.8)
        expect(p.maShort).toBeLessThanOrEqual(20 * 1.2)
        expect(p.lookback).toBeGreaterThanOrEqual(10 * 0.8)
        expect(p.lookback).toBeLessThanOrEqual(10 * 1.2)
      }
    })

    it('确定性：random=0.5 → 无扰动', () => {
      const spy = jest.spyOn(Math, 'random').mockReturnValue(0.5)
      const p = perturbParams({ a: 10 }, 0.2)
      expect(p.a).toBeCloseTo(10, 6)
      spy.mockRestore()
    })

    it('极小参数有下限保护（Math.max(1, ...) → 小数参数会被钳到 1）', () => {
      // 行为契约：扰动结果恒 >= 1，因此 < 1.2 的小数参数（如 takeProfit 0.1）
      // 在向下扰动时会被抬升到 1（该函数面向均线窗口等整数参数设计）
      for (let i = 0; i < 100; i++) {
        const p = perturbParams({ a: 0.1 }, 0.2)
        expect(p.a).toBeGreaterThanOrEqual(1)
      }
    })
  })
})
