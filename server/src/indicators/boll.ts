import { ma } from './ma';

export type BollBreakType = 'upper' | 'lower';

export interface BollBreak {
  index: number;
  type: BollBreakType;
}

export interface BollResult {
  /** 中轨 = MA(period) */
  mid: (number | null)[];
  /** 上轨 = mid + k * std(period) */
  upper: (number | null)[];
  /** 下轨 = mid - k * std(period) */
  lower: (number | null)[];
  /** 收盘价突破上下轨识别 */
  breaks: BollBreak[];
}

/**
 * 布林带 (Bollinger Bands)
 *
 * 默认参数：period=20, k=2（中轨 20 日均线，±2 倍标准差）
 * - 前 period-1 位为 null（warmup）
 * - std 使用总体标准差（与同花顺/通达信对齐，n 而非 n-1）
 *
 * 突破识别：close > upper (上轨突破) 或 close < lower (下轨跌破)
 */
export function boll(
  closes: number[],
  period = 20,
  k = 2,
): BollResult {
  if (!Number.isInteger(period) || period < 1) {
    throw new Error(`boll: period must be positive integer, got ${period}`);
  }
  if (!Number.isFinite(k)) {
    throw new Error(`boll: k must be a finite number, got ${k}`);
  }

  const n = closes.length;
  const mid = ma(closes, period);

  // 上下轨
  const upper: (number | null)[] = new Array(n).fill(null);
  const lower: (number | null)[] = new Array(n).fill(null);
  for (let i = period - 1; i < n; i++) {
    const m = mid[i] as number;
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sumSq += (closes[j] - m) ** 2;
    }
    const std = Math.sqrt(sumSq / period);
    upper[i] = m + k * std;
    lower[i] = m - k * std;
  }

  // 突破识别（warmup 区间之后）
  const breaks: BollBreak[] = [];
  for (let i = period - 1; i < n; i++) {
    const u = upper[i] as number;
    const l = lower[i] as number;
    if (closes[i] > u) breaks.push({ index: i, type: 'upper' });
    else if (closes[i] < l) breaks.push({ index: i, type: 'lower' });
  }

  return { mid, upper, lower, breaks };
}