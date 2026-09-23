import { IndicatorCalcService } from './indicator-calc.service';
import { DEFAULT_INDICATOR_CONFIG } from './types';
import type { KlineData } from '../stock/stock.service';

function makeKlines(closes: number[]): KlineData[] {
  return closes.map((c, i) => ({
    date: `2024-06-${(i + 1).toString().padStart(2, '0')}`,
    open: c,
    high: c + 0.5,
    low: c - 0.5,
    close: c,
    volume: 1000 + i,
  }));
}

describe('IndicatorCalcService (TDD)', () => {
  let service: IndicatorCalcService;

  beforeEach(() => {
    service = new IndicatorCalcService();
  });

  it('服务可被实例化', () => {
    expect(service).toBeDefined();
  });

  it('默认 config 计算 MA5/10/20/60 + MACD + BOLL + KDJ', () => {
    const closes = Array.from({ length: 100 }, (_, i) => 100 + i);
    const bundle = service.computeAll(makeKlines(closes));
    expect(Object.keys(bundle.ma).sort()).toEqual(['10', '20', '5', '60']);
    expect(bundle.macd.dif).toHaveLength(100);
    expect(bundle.boll.mid).toHaveLength(100);
    expect(bundle.kdj.k).toHaveLength(100);
  });

  it('空 klines 返回空 bundle 不挂', () => {
    const bundle = service.computeAll([]);
    expect(bundle.ma).toEqual({});
    expect(bundle.macd.dif).toEqual([]);
    expect(bundle.signals).toEqual([]);
  });

  it('custom config：MA 周期可裁剪', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
    const bundle = service.computeAll(makeKlines(closes), {
      ...DEFAULT_INDICATOR_CONFIG,
      maPeriods: [5],
    });
    expect(Object.keys(bundle.ma)).toEqual(['5']);
  });

  it('period > n 的 MA 不出现在结果中', () => {
    const closes = [10, 20, 30];
    const bundle = service.computeAll(makeKlines(closes), {
      ...DEFAULT_INDICATOR_CONFIG,
      maPeriods: [5, 60],
    });
    expect(bundle.ma).toEqual({});
  });

  it('signals 按 index 升序排列', () => {
    // 构造同时触发多信号的 series
    const closes: number[] = Array(20).fill(100);
    closes.push(150); // 突破上轨
    closes.push(160); // 继续
    const bundle = service.computeAll(makeKlines(closes));
    const sorted = bundle.signals.map((s) => s.index);
    expect(sorted).toEqual([...sorted].sort((a, b) => a - b));
  });
});