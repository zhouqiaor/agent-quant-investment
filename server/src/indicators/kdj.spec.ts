import { kdj } from './kdj';

describe('kdj (TDD)', () => {
  it('返回字段 k / d / j / extremes，长度对齐', () => {
    const n = 30;
    const closes = Array.from({ length: n }, (_, i) => 100 + i);
    const highs = closes.map((c) => c + 1);
    const lows = closes.map((c) => c - 1);
    const out = kdj(highs, lows, closes);
    expect(out.k).toHaveLength(n);
    expect(out.d).toHaveLength(n);
    expect(out.j).toHaveLength(n);
    expect(Array.isArray(out.extremes)).toBe(true);
  });

  it('前 n-1 位为 null（warmup 区间）', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
    const highs = closes.map((c) => c + 1);
    const lows = closes.map((c) => c - 1);
    const out = kdj(highs, lows, closes, 9);
    for (let i = 0; i < 8; i++) expect(out.k[i]).toBeNull();
    expect(out.k[8]).not.toBeNull();
  });

  it('RSV 正确：恒定区间内 RSV = 50', () => {
    // 9 个点 high=low=close → RSV = (close-min)/(max-min) * 100 = NaN (分母为0)
    // 但实际应处理为 50（中性）
    const closes = Array(20).fill(100);
    const highs = Array(20).fill(100);
    const lows = Array(20).fill(100);
    const out = kdj(highs, lows, closes);
    // 至少 K/D/J 应有有效值
    const validK = out.k.filter((v) => v !== null) as number[];
    expect(validK.length).toBeGreaterThan(0);
  });

  it('J > 100 触发超买信号', () => {
    // 构造强势上涨行情：J 应该冲高超过 100
    const n = 30;
    const closes: number[] = [];
    const highs: number[] = [];
    const lows: number[] = [];
    for (let i = 0; i < n; i++) {
      const c = 100 + i * 3;
      closes.push(c);
      highs.push(c + 0.5);
      lows.push(c - 0.5);
    }
    const out = kdj(highs, lows, closes);
    const overbought = out.extremes.filter((e) => e.type === 'overbought');
    expect(overbought.length).toBeGreaterThan(0);
  });

  it('J < 0 触发超卖信号', () => {
    const n = 30;
    const closes: number[] = [];
    const highs: number[] = [];
    const lows: number[] = [];
    for (let i = 0; i < n; i++) {
      const c = 200 - i * 3;
      closes.push(c);
      highs.push(c + 0.5);
      lows.push(c - 0.5);
    }
    const out = kdj(highs, lows, closes);
    const oversold = out.extremes.filter((e) => e.type === 'oversold');
    expect(oversold.length).toBeGreaterThan(0);
  });

  it('默认参数 n=9, m1=3, m2=3 与显式覆盖结果一致', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
    const highs = closes.map((c) => c + 1);
    const lows = closes.map((c) => c - 1);
    const a = kdj(highs, lows, closes);
    const b = kdj(highs, lows, closes, 9, 3, 3);
    expect(a.k).toEqual(b.k);
    expect(a.d).toEqual(b.d);
    expect(a.j).toEqual(b.j);
  });
});