import { ScenarioKlineService } from './scenario-kline.service'

describe('ScenarioKlineService', () => {
  let svc: ScenarioKlineService

  beforeEach(() => {
    svc = new ScenarioKlineService()
  })

  it('load() 加载真实 year-kline.json', async () => {
    const data = await svc.load()
    expect(data.totalRows).toBeGreaterThan(0)
    expect(data.symbolCount).toBeGreaterThan(0)
    expect(data.rows.length).toBe(data.totalRows)
  })

  it('months() 返回全年 12 个月', async () => {
    const months = await svc.months()
    expect(months).toHaveLength(12)
    expect(months[0]).toMatch(/^\d{4}-\d{2}$/)
  })

  it('rowsForMonth() 只返回该月数据', async () => {
    const rows = await svc.rowsForMonth('2026-01')
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) {
      expect(r.date.startsWith('2026-01')).toBe(true)
    }
  })

  describe('applyScenario', () => {
    let baseRows: Awaited<ReturnType<ScenarioKlineService['rowsForMonth']>>

    beforeAll(async () => {
      const s = new ScenarioKlineService()
      baseRows = await s.rowsForMonth('2026-01')
    })

    it('sector_drop：consumer 板块整体下移，tech 板块不受影响，原数据不被修改', () => {
      const before600519 = baseRows.find((r) => r.symbol === '600519')!
      const before688981 = baseRows.find((r) => r.symbol === '688981')!
      const out = svc.applyScenario(baseRows, {
        name: '消费暴跌',
        description: 'test',
        shocks: [
          { type: 'sector_drop', sector: 'consumer', magnitude: 0.1, startDate: '2026-01-01', endDate: '2026-12-31' },
        ],
      })
      const after600519 = out.find((r) => r.symbol === '600519')!
      const after688981 = out.find((r) => r.symbol === '688981')!
      // consumer ×0.9
      expect(after600519.close).toBeCloseTo(before600519.close * 0.9, 6)
      expect(after600519.open).toBeCloseTo(before600519.open * 0.9, 6)
      expect(after600519.high).toBeCloseTo(before600519.high * 0.9, 6)
      // tech 不变
      expect(after688981.close).toBe(before688981.close)
      // 原数组不被修改
      expect(baseRows.find((r) => r.symbol === '600519')!.close).toBe(before600519.close)
    })

    it('sector_rise：指定板块上移', () => {
      const before = baseRows.find((r) => r.symbol === '688981')! // tech
      const out = svc.applyScenario(baseRows, {
        name: '科技暴涨',
        description: 'test',
        shocks: [
          { type: 'sector_rise', sector: 'tech', magnitude: 0.2, startDate: '2026-01-01', endDate: '2026-12-31' },
        ],
      })
      const after = out.find((r) => r.symbol === '688981')!
      expect(after.close).toBeCloseTo(before.close * 1.2, 6)
    })

    it('single_symbol：只影响指定 symbol', () => {
      const beforeA = baseRows.find((r) => r.symbol === '600519')!
      const beforeB = baseRows.find((r) => r.symbol === '000858')!
      const out = svc.applyScenario(baseRows, {
        name: '个股暴雷',
        description: 'test',
        shocks: [
          { type: 'single_symbol', symbol: '600519', magnitude: 0.3, startDate: '2026-01-01', endDate: '2026-12-31' },
        ],
      })
      expect(out.find((r) => r.symbol === '600519')!.close).toBeCloseTo(beforeA.close * 0.7, 6)
      expect(out.find((r) => r.symbol === '000858')!.close).toBe(beforeB.close)
    })

    it('volatility_scale：围绕 mid 放大波动（收盘价偏离 mid 一倍）', () => {
      const before = baseRows.find((r) => r.symbol === '600519')!
      const out = svc.applyScenario(baseRows, {
        name: '波动翻倍',
        description: 'test',
        shocks: [
          { type: 'volatility_scale', magnitude: 2, startDate: '2026-01-01', endDate: '2026-12-31' },
        ],
      })
      const after = out.find((r) => r.symbol === '600519')!
      const mid = (before.open + before.close) / 2
      expect(after.close).toBeCloseTo(mid + (before.close - mid) * 2, 6)
      expect(after.high).toBeCloseTo(mid + (before.high - mid) * 2, 6)
      expect(after.low).toBeCloseTo(mid + (before.low - mid) * 2, 6)
      expect(after.open).toBe(before.open) // open 不缩放
    })

    it('日期范围过滤：范围外的行保持不变', () => {
      const rows = baseRows
      const out = svc.applyScenario(rows, {
        name: '未来场景',
        description: 'test',
        shocks: [
          { type: 'sector_drop', sector: 'consumer', magnitude: -0.5, startDate: '2099-01-01', endDate: '2099-12-31' },
        ],
      })
      const before = rows.find((r) => r.symbol === '600519')!
      const after = out.find((r) => r.symbol === '600519')!
      expect(after.close).toBe(before.close)
    })

    it('多个 shock 叠加依次生效', () => {
      const before = baseRows.find((r) => r.symbol === '600519')!
      const out = svc.applyScenario(baseRows, {
        name: '复合冲击',
        description: 'test',
        shocks: [
          { type: 'single_symbol', symbol: '600519', magnitude: 0.1, startDate: '2026-01-01', endDate: '2026-12-31' },
          { type: 'single_symbol', symbol: '600519', magnitude: 0.1, startDate: '2026-01-01', endDate: '2026-12-31' },
        ],
      })
      const after = out.find((r) => r.symbol === '600519')!
      // (-10%) 再 (-10%) → 0.9 × 0.9
      expect(after.close).toBeCloseTo(before.close * 0.81, 6)
    })
  })
})
