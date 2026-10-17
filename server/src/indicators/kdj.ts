export type KdjExtremeType = 'overbought' | 'oversold';

export interface KdjExtreme {
  index: number;
  type: KdjExtremeType;
}

export interface KdjResult {
  /** K 值（快线） */
  k: (number | null)[];
  /** D 值（慢线） */
  d: (number | null)[];
  /** J 值 = 3K - 2D */
  j: (number | null)[];
  /** 超买超卖识别（基于 J 值：A 股常用 J<0 超卖、J>100 超买） */
  extremes: KdjExtreme[];
}

/**
 * KDJ 随机指标
 *
 * 默认参数：n=9（RSV 回溯周期）, m1=3（K 平滑）, m2=3（D 平滑）
 *
 * 算法：
 * - RSV[i] = (close[i] - min(low[i-n+1..i])) / (max(high[i-n+1..i]) - min(low[i-n+1..i])) * 100
 *   分母为 0 时 RSV = 50（中性）
 * - K[i] = (K[i-1] * (m1-1) + RSV[i]) / m1；初始 K = 50
 * - D[i] = (D[i-1] * (m2-1) + K[i]) / m2；初始 D = 50
 * - J[i] = 3*K[i] - 2*D[i]
 *
 * 超买：J > 100
 * 超卖：J < 0
 */
export function kdj(
  highs: number[],
  lows: number[],
  closes: number[],
  n = 9,
  m1 = 3,
  m2 = 3,
): KdjResult {
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`kdj: n must be positive integer, got ${n}`);
  }
  if (!Number.isInteger(m1) || m1 < 1) {
    throw new Error(`kdj: m1 must be positive integer, got ${m1}`);
  }
  if (!Number.isInteger(m2) || m2 < 1) {
    throw new Error(`kdj: m2 must be positive integer, got ${m2}`);
  }
  if (highs.length !== lows.length || highs.length !== closes.length) {
    throw new Error('kdj: highs/lows/closes must have equal length');
  }

  const len = closes.length;
  const kArr: (number | null)[] = new Array(len).fill(null);
  const dArr: (number | null)[] = new Array(len).fill(null);
  const jArr: (number | null)[] = new Array(len).fill(null);

  let prevK = 50;
  let prevD = 50;

  for (let i = 0; i < len; i++) {
    if (i < n - 1) continue;

    // 计算窗口内 high max / low min
    let hMax = highs[i - n + 1];
    let lMin = lows[i - n + 1];
    for (let j = i - n + 2; j <= i; j++) {
      if (highs[j] > hMax) hMax = highs[j];
      if (lows[j] < lMin) lMin = lows[j];
    }

    // RSV
    let rsv: number;
    if (hMax === lMin) rsv = 50;
    else rsv = ((closes[i] - lMin) / (hMax - lMin)) * 100;

    // K / D / J
    const curK = (prevK * (m1 - 1) + rsv) / m1;
    const curD = (prevD * (m2 - 1) + curK) / m2;
    const curJ = 3 * curK - 2 * curD;

    kArr[i] = curK;
    dArr[i] = curD;
    jArr[i] = curJ;

    prevK = curK;
    prevD = curD;
  }

  // 超买超卖识别（warmup 之后）
  const extremes: KdjExtreme[] = [];
  for (let i = n - 1; i < len; i++) {
    const j = jArr[i] as number;
    if (j > 100) extremes.push({ index: i, type: 'overbought' });
    else if (j < 0) extremes.push({ index: i, type: 'oversold' });
  }

  return { k: kArr, d: dArr, j: jArr, extremes };
}