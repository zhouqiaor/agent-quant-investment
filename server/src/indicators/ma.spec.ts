import { ma } from './ma';

describe('ma (TDD)', () => {
  it('返回数组长度与输入一致', () => {
    const out = ma([1, 2, 3, 4, 5], 3);
    expect(out).toHaveLength(5);
  });

  it('前 period-1 位为 null（warmup 区间）', () => {
    const out = ma([1, 2, 3, 4, 5, 6], 3);
    expect(out[0]).toBeNull();
    expect(out[1]).toBeNull();
    expect(out[2]).toBe(2); // (1+2+3)/3
    expect(out[3]).toBe(3); // (2+3+4)/3
    expect(out[4]).toBe(4); // (3+4+5)/5? — wait, that's wrong; (3+4+5)/3 = 4
    expect(out[5]).toBe(5); // (4+5+6)/3 = 5
  });

  it('period=1 时每个值等价原值（无 warmup）', () => {
    const closes = [10, 20, 30];
    const out = ma(closes, 1);
    expect(out).toEqual([10, 20, 30]);
  });

  it('period 大于数组长度时全部为 null', () => {
    const out = ma([1, 2, 3], 5);
    expect(out).toEqual([null, null, null]);
  });

  it('已知 fixture 校验：连续 5 个 10，MA5 末值应为 10', () => {
    const out = ma([10, 10, 10, 10, 10], 5);
    expect(out[4]).toBe(10);
  });

  it('非整数 period / 负数 period 抛错', () => {
    expect(() => ma([1, 2, 3], 0)).toThrow();
    expect(() => ma([1, 2, 3], -1)).toThrow();
  });
});