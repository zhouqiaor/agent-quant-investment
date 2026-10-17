import { Injectable } from '@nestjs/common';
import { ma } from './ma';
import { macd } from './macd';
import { boll } from './boll';
import { kdj } from './kdj';
import {
  DEFAULT_INDICATOR_CONFIG,
  IndicatorBundle,
  IndicatorConfig,
  IndicatorSignal,
} from './types';
import type { KlineData } from '../stock/stock.service';

/**
 * IndicatorCalcService - 指标计算服务
 *
 * 接收 KlineData[] 与可选 config，返回与 closes 等长的指标包：
 * - ma: Record<period, (number|null)[]>
 * - macd: { dif, dea, hist, crosses }
 * - boll: { mid, upper, lower, breaks }
 * - kdj: { k, d, j, extremes }
 * - signals: 跨指标聚合的显著信号
 *
 * 默认配置：MA5/10/20/60 + MACD(12,26,9) + BOLL(20,2) + KDJ(9,3,3)
 */
@Injectable()
export class IndicatorCalcService {
  computeAll(
    klines: KlineData[],
    config: IndicatorConfig = DEFAULT_INDICATOR_CONFIG,
  ): IndicatorBundle {
    const n = klines.length;
    if (n === 0) {
      return {
        ma: {},
        macd: { dif: [], dea: [], hist: [], crosses: [] },
        boll: { mid: [], upper: [], lower: [], breaks: [] },
        kdj: { k: [], d: [], j: [], extremes: [] },
        signals: [],
      };
    }

    const closes = klines.map((k) => k.close);
    const highs = klines.map((k) => k.high);
    const lows = klines.map((k) => k.low);

    // MA（仅在有足够长度时计算，避免全 null 浪费）
    const maBundle: Record<string, (number | null)[]> = {};
    for (const period of config.maPeriods) {
      if (period <= n) {
        maBundle[String(period)] = ma(closes, period);
      }
    }

    const macdResult = macd(closes, config.macd.fast, config.macd.slow, config.macd.signal);
    const bollResult = boll(closes, config.boll.period, config.boll.k);
    const kdjResult = kdj(highs, lows, closes, config.kdj.n, config.kdj.m1, config.kdj.m2);

    // 聚合显著信号（统一按 index 升序）
    const signals: IndicatorSignal[] = [
      ...macdResult.crosses.map((c) => ({
        index: c.index,
        type: c.type === 'golden' ? ('macd_golden' as const) : ('macd_death' as const),
      })),
      ...bollResult.breaks.map((b) => ({
        index: b.index,
        type: b.type === 'upper' ? ('boll_upper_break' as const) : ('boll_lower_break' as const),
      })),
      ...kdjResult.extremes.map((e) => ({
        index: e.index,
        type: e.type === 'overbought' ? ('kdj_overbought' as const) : ('kdj_oversold' as const),
      })),
    ].sort((a, b) => a.index - b.index);

    return {
      ma: maBundle,
      macd: macdResult,
      boll: bollResult,
      kdj: kdjResult,
      signals,
    };
  }
}