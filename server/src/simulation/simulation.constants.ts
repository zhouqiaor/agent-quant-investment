/**
 * 100 账户仿真 — 共享配置与工具
 */

// 11 个行业及代表股票（与 server/src/stock/stock.service.ts 对齐）
export const INDUSTRIES = [
  { code: 'tech',    name: '科技',     stocks: ['300750', '688981'] }, // 宁德 / 中芯
  { code: 'finance', name: '金融',     stocks: ['601318', '600036'] }, // 中国平安 / 招商
  { code: 'consumer',name: '消费',     stocks: ['600519', '000858'] }, // 茅台 / 五粮液
  { code: 'pharma',  name: '医药',     stocks: ['600276'] },           // 恒瑞
  { code: 'energy',  name: '能源',     stocks: ['601857', '600028'] }, // 中石油 / 中石化
  { code: 'industrial', name: '工业',  stocks: ['600031'] },           // 三一
  { code: 'material',name: '材料',     stocks: ['601899'] },           // 紫金
  { code: 'utility', name: '公用事业', stocks: ['600900'] },           // 长江电力
  { code: 'telecom', name: '通信',     stocks: ['600050'] },           // 中国联通
  { code: 'auto',    name: '汽车',     stocks: ['002594'] },           // 比亚迪
  { code: 'media',   name: '传媒',     stocks: ['300059'] },           // 东方财富
] as const

export type IndustryCode = typeof INDUSTRIES[number]['code']

export const STRATEGIES = ['ma_cross', 'momentum', 'reversal', 'breakout', 'trend_follow'] as const
export type StrategyCode = typeof STRATEGIES[number]

export const STRATEGY_LABEL: Record<StrategyCode, string> = {
  ma_cross: '均线交叉',
  momentum: '动量',
  reversal: '反转',
  breakout: '突破',
  trend_follow: '趋势跟随',
}

export const RISK_PREFERENCES = ['conservative', 'neutral', 'aggressive'] as const
export type RiskPreference = typeof RISK_PREFERENCES[number]

export const RISK_LABEL: Record<RiskPreference, string> = {
  conservative: '保守',
  neutral: '中性',
  aggressive: '激进',
}

export const STRATEGY_BASE_PARAMS: Record<StrategyCode, Record<string, number>> = {
  ma_cross:     { maShort: 5,  maLong: 20, takeProfit: 0.08, stopLoss: 0.05 },
  momentum:     { lookback: 10, threshold: 0.02, takeProfit: 0.10, stopLoss: 0.04 },
  reversal:     { oversold: -0.05, overbought: 0.05, takeProfit: 0.06, stopLoss: 0.06 },
  breakout:     { range: 20, takeProfit: 0.12, stopLoss: 0.04 },
  trend_follow: { fastLen: 3, slowLen: 30, takeProfit: 0.15, stopLoss: 0.05 },
}

export const STRATEGY_DAILY_TRADE_LIMITS: Record<RiskPreference, number> = {
  conservative: 5,
  neutral: 12,
  aggressive: 25,
}

/** 加权随机选择 */
export function weightedPick<T>(items: T[], weights: number[]): T {
  if (items.length === 0) throw new Error('empty')
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}

/** 在 [min, max] 区间均匀分布 */
export function uniform(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

/** 对数均匀分布 [min, max] */
export function logUniform(min: number, max: number): number {
  const logMin = Math.log(min)
  const logMax = Math.log(max)
  return Math.exp(logMin + Math.random() * (logMax - logMin))
}

/** 正态分布采样 (Box-Muller) */
export function normalSample(mean = 0, std = 1): number {
  const u1 = Math.max(1e-9, Math.random())
  const u2 = Math.random()
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return mean + z * std
}

/** 策略参数扰动 ±20% */
export function perturbParams<T extends Record<string, number>>(base: T, ratio = 0.2): T {
  const out: any = {}
  for (const [k, v] of Object.entries(base)) {
    const delta = v * ratio
    out[k] = Math.max(1, v + uniform(-delta, delta))
  }
  return out as T
}