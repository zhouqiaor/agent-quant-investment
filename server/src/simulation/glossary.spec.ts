import { GlossaryService } from './glossary.service'

describe('GlossaryService', () => {
  let svc: GlossaryService

  beforeEach(() => {
    svc = new GlossaryService()
  })

  it('list() 返回全部 9 个词条且字段完整', () => {
    const list = svc.list()
    expect(list).toHaveLength(9)
    for (const e of list) {
      expect(e.term).toBeTruthy()
      expect(e.short).toBeTruthy()
      expect(e.detail).toBeTruthy()
    }
  })

  it('包含核心风险指标词条', () => {
    const terms = svc.list().map((e) => e.term)
    expect(terms).toContain('Sharpe Ratio')
    expect(terms).toContain('Sortino Ratio')
    expect(terms).toContain('最大回撤 (MaxDD)')
    expect(terms).toContain('Calmar Ratio')
  })

  it('get() 命中已知 key，返回带 formula/example 的完整词条', () => {
    const sharpe = svc.get('sharpe')
    expect(sharpe).not.toBeNull()
    expect(sharpe!.term).toBe('Sharpe Ratio')
    expect(sharpe!.formula).toContain('mean(rate)')
    expect(sharpe!.example).toBeTruthy()
  })

  it('get() 未知 key 返回 null', () => {
    expect(svc.get('no_such_term')).toBeNull()
    expect(svc.get('')).toBeNull()
  })
})
