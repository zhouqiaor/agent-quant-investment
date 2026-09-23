/**
 * 简单移动平均 (Simple Moving Average, SMA)
 *
 * 输出与输入等长，前 period-1 位为 null（warmup 区间）。
 *
 * @example
 * ma([1, 2, 3, 4, 5], 3) // => [null, null, 2, 3, 4]
 */
export function ma(closes: number[], period: number): (number | null)[] {
  if (!Number.isInteger(period) || period < 1) {
    throw new Error(`ma: period must be a positive integer, got ${period}`);
  }
  const n = closes.length;
  const out: (number | null)[] = new Array(n).fill(null);
  if (period > n) return out;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += closes[i];
    if (i >= period) sum -= closes[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}