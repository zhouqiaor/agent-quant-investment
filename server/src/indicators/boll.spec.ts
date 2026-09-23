import { boll } from './boll';

describe('boll (TDD)', () => {
  it('返回字段 mid / upper / lower / breaks，长度对齐', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
    const out = boll(closes);
    expect(out.mid).toHaveLength(30);
    expect(out.upper).toHaveLength(30);
    expect(out.lower).toHaveLength(30);
    expect(Array.isArray(out.breaks)).toBe(true);
  });

  it('mid 默认 period=20，前 19 位为 null', () => {
    const closes = Array.from({ length: 25 }, (_, i) => 100 + i);
    const out = boll(closes);
    for (let i = 0; i < 19; i++) expect(out.mid[i]).toBeNull();
    expect(out.mid[19]).not.toBeNull();
  });

  it('mid = MA(period=20)，upper = mid + k*std, lower = mid - k*std', () => {
    // 已知 fixture：20 个连续相同值，mid=10, std=0, upper=mid, lower=mid
    const closes = Array(20).fill(10);
    const out = boll(closes);
    expect(out.mid[19]).toBe(10);
    expect(out.upper[19]).toBe(10);
    expect(out.lower[19]).toBe(10);
  });

  it('k=0 直角退化：upper=lower=mid', () => {
    const closes = Array.from({ length: 25 }, (_, i) => 50 + i);
    const out = boll(closes, 20, 0);
    for (let i = 19; i < 25; i++) {
      expect(out.upper[i]).toBe(out.mid[i]);
      expect(out.lower[i]).toBe(out.mid[i]);
    }
  });

  it('突破上轨识别：close > upper', () => {
    // 20 点平台 100，最后 5 点急升突破
    const closes: number[] = Array(20).fill(100);
    closes.push(110, 120, 130, 140, 150);
    const out = boll(closes);
    const upperBreaks = out.breaks.filter((b) => b.type === 'upper');
    expect(upperBreaks.length).toBeGreaterThan(0);
  });

  it('跌破下轨识别：close < lower', () => {
    const closes: number[] = Array(20).fill(100);
    closes.push(90, 80, 70, 60, 50);
    const out = boll(closes);
    const lowerBreaks = out.breaks.filter((b) => b.type === 'lower');
    expect(lowerBreaks.length).toBeGreaterThan(0);
  });
});