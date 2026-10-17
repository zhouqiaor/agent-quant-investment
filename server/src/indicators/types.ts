import type { MacdCross, MacdCrossType, MacdResult } from './macd';
import type { BollBreak, BollBreakType, BollResult } from './boll';
import type { KdjExtreme, KdjExtremeType, KdjResult } from './kdj';

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

export interface IndicatorBundle {
  ma: Record<string, (number | null)[]>;
  macd: MacdResult;
  boll: BollResult;
  kdj: KdjResult;
  /** 跨指标聚合的显著信号（仅含 cross/break/extreme） */
  signals: IndicatorSignal[];
}

export type IndicatorSignal =
  | { index: number; type: 'macd_golden' | 'macd_death' }
  | { index: number; type: 'boll_upper_break' | 'boll_lower_break' }
  | { index: number; type: 'kdj_overbought' | 'kdj_oversold' };

export type {
  MacdResult,
  MacdCross,
  MacdCrossType,
  BollResult,
  BollBreak,
  BollBreakType,
  KdjResult,
  KdjExtreme,
  KdjExtremeType,
};