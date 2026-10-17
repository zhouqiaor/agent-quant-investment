/**
 * 指数移动平均 (Exponential Moving Average, EMA)
 *
 * 实现约定：seed = SMA(values[0..period-1])，后续按 multiplier = 2/(period+1) 递推。
 * 输出与输入等长，前 period-1 位为 null（warmup 区间）。
 *
 * @example
 * ema([1, 2, 3, 4, 5], 3) // => [null, null, 2, 3, 4]
 */
export function ema(values: number[], period: number): (number | null)[] {
  if (!Number.isInteger(period) || period < 1) {
    throw new Error(`ema: period must be a positive integer, got ${period}`);
  }
  const n = values.length;
  const out: (number | null)[] = new Array(n).fill(null);
  if (period > n) return out;

  // Seed: SMA of first `period` values
  let seed = 0;
  for (let i = 0; i < period; i++) seed += values[i];
  seed /= period;
  out[period - 1] = seed;

  const multiplier = 2 / (period + 1);
  let prev = seed;
  for (let i = period; i < n; i++) {
    const cur = (values[i] - prev) * multiplier + prev;
    out[i] = cur;
    prev = cur;
  }
  return out;
}