/**
 * lib/portfolio 纯函数单测：
 * - sortStrategiesByPnl 排序且不改原数组
 * - buildPnlBars 归一化宽度 / 全零边界 / 正负标记
 * - calcPositionPct 常规与边界
 * - withStrategyNames 命中与回退
 *
 * ambient describe/it/expect 声明，沿用项目 spec 风格（前端测试运行时由并行任务搭建）。
 */

import {
  buildPnlBars,
  calcPositionPct,
  sortStrategiesByPnl,
  withStrategyNames,
  type PortfolioStrategySummary,
} from './portfolio'

function mk(
  strategyId: string,
  pnl: number,
  extra?: Partial<PortfolioStrategySummary>,
): PortfolioStrategySummary {
  return {
    strategyId,
    pnl,
    pnlRate: 0,
    trades: 0,
    running: false,
    maxPositionPct: 0.1,
    ...extra,
  }
}

describe('sortStrategiesByPnl', () => {
  it('按 pnl 降序排列，且不修改原数组', () => {
    const input = [mk('a', -5), mk('b', 20), mk('c', 0)]
    const sorted = sortStrategiesByPnl(input)
    expect(sorted.map((s) => s.strategyId)).toEqual(['b', 'c', 'a'])
    expect(input.map((s) => s.strategyId)).toEqual(['a', 'b', 'c'])
  })
})

describe('buildPnlBars', () => {
  it('以最大 |pnl| 归一化宽度，保留 1 位小数', () => {
    const bars = buildPnlBars([mk('a', 100), mk('b', -25), mk('c', 0)])
    // buildPnlBars 内部按 pnl 降序排列：100, 0, -25 → a, c, b
    expect(bars.map((b) => b.strategyId)).toEqual(['a', 'c', 'b'])
    expect(bars[0].widthPct).toBe(100)
    expect(bars[1].widthPct).toBe(0)
    expect(bars[2].widthPct).toBe(25)
    expect(bars[0].positive).toBe(true)
    expect(bars[2].positive).toBe(false)
  })

  it('pnl 全部为 0 时宽度均为 0，不产生 NaN/Infinity', () => {
    const bars = buildPnlBars([mk('a', 0), mk('b', 0)])
    expect(bars.every((b) => b.widthPct === 0)).toBe(true)
  })
})

describe('calcPositionPct', () => {
  it('常规比例与 totalValue<=0 边界', () => {
    expect(calcPositionPct(100000, 40000)).toBe(60)
    expect(calcPositionPct(0, 0)).toBe(0)
    expect(calcPositionPct(-1, 0)).toBe(0)
  })

  it('结果保留 1 位小数', () => {
    expect(calcPositionPct(3, 1)).toBe(66.7)
  })
})

describe('withStrategyNames', () => {
  it('命中名称表时使用名称，未命中回退 strategyId', () => {
    const out = withStrategyNames([mk('a', 1), mk('b', 2)], { a: '均线策略' })
    expect(out[0].name).toBe('均线策略')
    expect(out[1].name).toBe('b')
  })
})
