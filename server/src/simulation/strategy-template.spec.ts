import { StrategyTemplateService } from './strategy-template.service'

/** 构造受控的 TryoutReplayService 替身：totalReturnPct / sharpe / calmar 均可由参数推导 */
function makeFakeTryout(
  fn: (params: Record<string, number>) => { totalReturnPct: number; sharpe: number; calmar: number },
) {
  return {
    run: jest.fn(async (args: { params: Record<string, number> }) => {
      const m = fn(args.params)
      return {
        totalReturnPct: m.totalReturnPct,
        risk: { sharpe: m.sharpe, calmar: m.calmar, maxDD: -1 },
        orders: 0,
        signals: 0,
      }
    }),
  } as unknown as ConstructorParameters<typeof StrategyTemplateService>[0] & {
    run: jest.Mock
  }
}

describe('StrategyTemplateService', () => {
  describe('list / get', () => {
    it('返回 5 个策略模板，参数元数据与预设完整', () => {
      const svc = new StrategyTemplateService({} as never)
      const list = svc.list()
      expect(list).toHaveLength(5)
      const codes = list.map((t) => t.code)
      expect(codes).toEqual(['ma_cross', 'momentum', 'reversal', 'breakout', 'trend_follow'])
      for (const t of list) {
        expect(t.name).toBeTruthy()
        expect(t.shortDesc).toBeTruthy()
        expect(Object.keys(t.params).length).toBeGreaterThan(0)
        expect(t.paramMeta.length).toBeGreaterThan(0)
        for (const meta of t.paramMeta) {
          expect(meta.min).toBeLessThanOrEqual(meta.max)
          expect(meta.step).toBeGreaterThan(0)
          expect(['slider', 'number']).toContain(meta.type)
        }
        expect(t.presets.length).toBeGreaterThan(0)
        for (const preset of t.presets) {
          expect(preset.name).toBeTruthy()
          expect(Object.keys(preset.params).length).toBeGreaterThan(0)
        }
      }
    })

    it('每个预设的参数 key 与模板默认参数 key 一致', () => {
      const svc = new StrategyTemplateService({} as never)
      for (const t of svc.list()) {
        for (const preset of t.presets) {
          for (const key of Object.keys(preset.params)) {
            expect(Object.keys(t.params)).toContain(key)
          }
        }
      }
    })

    it('get() 命中已知策略；未知返回 null', () => {
      const svc = new StrategyTemplateService({} as never)
      expect(svc.get('ma_cross')!.name).toBe('均线交叉')
      expect(svc.get('momentum')!.name).toBe('动量')
      expect(svc.get('nope' as never)).toBeNull()
    })

    it('list() 返回深拷贝：修改返回值不影响后续调用', () => {
      const svc = new StrategyTemplateService({} as never)
      const first = svc.list()
      first[0].params.maShort = 999
      expect(svc.list()[0].params.maShort).not.toBe(999)
    })
  })

  describe('gridSearch', () => {
    it('按网格展开全部组合并按指标降序返回 top5/bottom5', async () => {
      // 每个组合的收益 = maShort 值本身（可控排序）
      const fake = makeFakeTryout((params) => ({
        totalReturnPct: params.maShort,
        sharpe: params.maShort * 10,
        calmar: params.maShort * 100,
      }))
      const svc = new StrategyTemplateService(fake)
      const r = await svc.gridSearch({
        month: '2026-01',
        strategy: 'ma_cross',
        params: { maShort: { min: 3, max: 7, step: 1 } },
        metric: 'totalReturnPct',
      })
      expect(r.total).toBe(5) // 3,4,5,6,7
      expect(fake.run).toHaveBeenCalledTimes(5)
      expect(r.top5).toHaveLength(5)
      expect(r.top5[0].params.maShort).toBe(7)
      expect(r.top5[0].metricValue).toBe(7)
      expect(r.top5[4].params.maShort).toBe(3)
      // bottom5 是从差到好反转后的列表：最差在前
      expect(r.bottom5[0].params.maShort).toBe(3)
      expect(r.bottom5[0].metricValue).toBe(3)
    })

    it('多参数笛卡尔积组合数正确', async () => {
      const fake = makeFakeTryout(() => ({ totalReturnPct: 0, sharpe: 0, calmar: 0 }))
      const svc = new StrategyTemplateService(fake)
      const r = await svc.gridSearch({
        month: '2026-01',
        strategy: 'ma_cross',
        params: {
          maShort: { min: 3, max: 5, step: 1 }, // 3
          maLong: { min: 10, max: 20, step: 10 }, // 2
        },
      })
      expect(r.total).toBe(6) // 3 × 2
      expect(fake.run).toHaveBeenCalledTimes(6)
      // 第一层参数在外层循环（maShort 先变化）
      const firstCombos = (fake.run.mock.calls as Array<[{ params: Record<string, number> }]>).map(
        (c) => c[0].params,
      )
      expect(firstCombos[0]).toEqual({ maShort: 3, maLong: 10 })
      // 递归枚举：最后一个参数（maLong）先变化
      expect(firstCombos[1]).toEqual({ maShort: 3, maLong: 20 })
      expect(firstCombos[2]).toEqual({ maShort: 4, maLong: 10 })
    })

    it('metric=sharpe / calmar 时按对应指标排序', async () => {
      // totalReturnPct 全部相同，但 calmar 随 maShort 变化
      const fake = makeFakeTryout((params) => ({
        totalReturnPct: 5,
        sharpe: 100 - params.maShort,
        calmar: params.maShort,
      }))
      const svc = new StrategyTemplateService(fake)

      const bySharpe = await svc.gridSearch({
        month: '2026-01',
        strategy: 'ma_cross',
        params: { maShort: { min: 3, max: 5, step: 1 } },
        metric: 'sharpe',
      })
      expect(bySharpe.top5[0].metricValue).toBe(97) // 100 - 3（maShort 最小 → sharpe 最大）

      const byCalmar = await svc.gridSearch({
        month: '2026-01',
        strategy: 'ma_cross',
        params: { maShort: { min: 3, max: 5, step: 1 } },
        metric: 'calmar',
      })
      expect(byCalmar.top5[0].metricValue).toBe(5) // maShort 最大
    })

    it('浮点 step 的网格不会因精度丢组合（1e6 取整容错）', async () => {
      const fake = makeFakeTryout(() => ({ totalReturnPct: 0, sharpe: 0, calmar: 0 }))
      const svc = new StrategyTemplateService(fake)
      const r = await svc.gridSearch({
        month: '2026-01',
        strategy: 'momentum',
        params: { threshold: { min: 0.01, max: 0.03, step: 0.01 } },
      })
      expect(r.total).toBe(3) // 0.01, 0.02, 0.03
    })
  })
})
