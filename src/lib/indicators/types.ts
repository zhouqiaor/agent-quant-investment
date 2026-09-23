/**
 * 前端指标数据类型
 * 与 server/src/indicators/types.ts 的 IndicatorBundle 对齐
 */

export interface MacdConfig {
  fast: number;
  slow: number;
  signal: number;
}

export interface BollConfig {
  period: number;
  k: number;
}

export interface KdjConfig {
  n: number;
  m1: number;
  m2: number;
}

export interface IndicatorConfig {
  maPeriods: number[];
  macd: MacdConfig;
  boll: BollConfig;
  kdj: KdjConfig;
}

export const DEFAULT_INDICATOR_CONFIG: IndicatorConfig = {
  maPeriods: [5, 10, 20, 60],
  macd: { fast: 12, slow: 26, signal: 9 },
  boll: { period: 20, k: 2 },
  kdj: { n: 9, m1: 3, m2: 3 },
};

/** 参数上限：超过此值的配置视为非法（拒绝） */
export const INDICATOR_PARAM_MAX = 200;

export type MacdCrossType = 'golden' | 'death';
export type BollBreakType = 'upper' | 'lower';
export type KdjExtremeType = 'overbought' | 'oversold';

export interface MacdResult {
  dif: (number | null)[]
  dea: (number | null)[]
  hist: (number | null)[]
  crosses: { index: number; type: MacdCrossType }[]
}

export interface BollResult {
  mid: (number | null)[]
  upper: (number | null)[]
  lower: (number | null)[]
  breaks: { index: number; type: BollBreakType }[]
}

export interface KdjResult {
  k: (number | null)[]
  d: (number | null)[]
  j: (number | null)[]
  extremes: { index: number; type: KdjExtremeType }[]
}

export interface IndicatorBundle {
  ma: Record<string, (number | null)[]>
  macd: MacdResult
  boll: BollResult
  kdj: KdjResult
  signals: IndicatorSignal[]
}

export type IndicatorSignal =
  | { index: number; type: 'macd_golden' | 'macd_death' }
  | { index: number; type: 'boll_upper_break' | 'boll_lower_break' }
  | { index: number; type: 'kdj_overbought' | 'kdj_oversold' };

/** 默认 MA 周期对应的展示颜色（与同花顺/通达信风格对齐） */
export const MA_COLORS: Record<string, string> = {
  '5': '#3b82f6',   // 蓝
  '10': '#f97316',  // 橙
  '20': '#a855f7',  // 紫
  '30': '#eab308',  // 黄
  '60': '#22c55e',  // 绿
};
