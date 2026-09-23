import { ema } from './ema';

describe('ema (TDD)', () => {
  it('返回数组长度与输入一致', () => {
    const out = ema([1, 2, 3, 4, 5, 6], 3);
    expect(out).toHaveLength(6);
  });

  it('前 period-1 位为 null（warmup 区间）', () => {
    const out = ema([1, 2, 3, 4, 5], 3);
    expect(out[0]).toBeNull();
    expect(out[1]).toBeNull();
    expect(out[2]).not.toBeNull();
    expect(out[3]).not.toBeNull();
    expect(out[4]).not.toBeNull();
  });

  it('seed = SMA(values[0..period-1])，后续值按 multiplier 递推', () => {
    // period=3, multiplier = 2/4 = 0.5
    // seed = (1+2+3)/3 = 2
    // i=3: (4 - 2)*0.5 + 2 = 3
    // i=4: (5 - 3)*0.5 + 3 = 4
    const out = ema([1, 2, 3, 4, 5], 3) as number[];
    expect(out[2]).toBe(2);
    expect(out[3]).toBe(3);
    expect(out[4]).toBe(4);
  });

  it('EMA 是 MA 的延迟平滑版（恒定输入时两者相等）', () => {
    const closes = [10, 10, 10, 10, 10, 10];
    const out = ema(closes, 3);
    // 仅检查非 null 位（warmup 区间除外），恒定输入下 EMA 也应锁定 10
    const nonNull = out.filter((v) => v !== null);
    expect(nonNull.length).toBeGreaterThan(0);
    expect(nonNull.every((v) => v === 10)).toBe(true);
  });

  it('period=1 时每个值等价原值', () => {
    const closes = [10, 20, 30];
    const out = ema(closes, 1);
    expect(out).toEqual([10, 20, 30]);
  });
});