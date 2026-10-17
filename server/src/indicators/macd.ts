import { ema } from './ema';

export type MacdCrossType = 'golden' | 'death';

export interface MacdCross {
  index: number;
  type: MacdCrossType;
}

export interface MacdResult {
  /** DIF = EMA(fast) - EMA(slow)，长度与 closes 一致 */
  dif: (number | null)[];
  /** DEA = EMA(DIF, signal)，长度与 closes 一致 */
  dea: (number | null)[];
  /** HIST = (DIF - DEA) * 2，长度与 closes 一致 */
  hist: (number | null)[];
  /** 金叉/死叉识别（基于 DEA valid 之后的索引） */
  crosses: MacdCross[];
}

/**
 * MACD 指标（异同移动平均线）
 *
 * 默认参数：fast=12, slow=26, signal=9（DIF 暖启动需要 slow-1=25 位，DEA 再 +signal-1=8 位）。
 * - 前 slow-1 位：DIF 暖启动，dif/dea/hist 全部为 null
 * - 第 slow-1 到 slow+signal-2 位：DIF 已就绪但 DEA 还在暖启动，dea/hist 仍为 null
 * - slow+signal-1 之后：全部就绪
 *
 * 金叉：DIF 上穿 DEA（DIF[i-1] ≤ DEA[i-1] 且 DIF[i] > DEA[i]）
 * 死叉：DIF 下穿 DEA（DIF[i-1] ≥ DEA[i-1] 且 DIF[i] < DEA[i]）
 */
export function macd(
  closes: number[],
  fast = 12,
  slow = 26,
  signal = 9,
): MacdResult {
  if (!Number.isInteger(fast) || fast < 1) {
    throw new Error(`macd: fast must be positive integer, got ${fast}`);
  }
  if (!Number.isInteger(slow) || slow < 1) {
    throw new Error(`macd: slow must be positive integer, got ${slow}`);
  }
  if (!Number.isInteger(signal) || signal < 1) {
    throw new Error(`macd: signal must be positive integer, got ${signal}`);
  }
  if (fast >= slow) {
    throw new Error(`macd: fast (${fast}) must be < slow (${slow})`);
  }

  const n = closes.length;
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);

  // DIF = emaFast - emaSlow
  const dif: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (emaFast[i] !== null && emaSlow[i] !== null) {
      dif[i] = (emaFast[i] as number) - (emaSlow[i] as number);
    }
  }

  // DEA = EMA(DIF, signal)
  // DIF 在 slow-1 之后才有值；先抽取出有效 DIF 段计算，再写回原位置
  const difValidStart = slow - 1;
  const difValidValues: number[] = [];
  for (let i = difValidStart; i < n; i++) difValidValues.push(dif[i] as number);

  let deaValidSeries: (number | null)[] = [];
  if (difValidValues.length >= signal) {
    const deaOnValid = ema(difValidValues, signal);
    deaValidSeries = deaOnValid;
  } else {
    deaValidSeries = new Array(difValidValues.length).fill(null);
  }

  // DEA 写回原数组：原 slow+signal-2 之后才有意义
  const deaValidStart = slow + signal - 2;
  const dea: (number | null)[] = new Array(n).fill(null);
  for (let i = deaValidStart; i < n; i++) {
    const localIdx = i - difValidStart;
    if (localIdx < deaValidSeries.length) {
      dea[i] = deaValidSeries[localIdx];
    }
  }

  // HIST = (DIF - DEA) * 2，仅在两者都有效时
  const hist: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (dif[i] !== null && dea[i] !== null) {
      hist[i] = ((dif[i] as number) - (dea[i] as number)) * 2;
    }
  }

  // 金叉/死叉识别
  const crosses: MacdCross[] = [];
  for (let i = deaValidStart + 1; i < n; i++) {
    const d0 = dif[i - 1];
    const d1 = dif[i];
    const e0 = dea[i - 1];
    const e1 = dea[i];
    if (d0 === null || d1 === null || e0 === null || e1 === null) continue;
    if (d0 <= e0 && d1 > e1) {
      crosses.push({ index: i, type: 'golden' });
    } else if (d0 >= e0 && d1 < e1) {
      crosses.push({ index: i, type: 'death' });
    }
  }

  return { dif, dea, hist, crosses };
}