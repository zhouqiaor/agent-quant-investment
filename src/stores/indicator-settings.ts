/**
 * 指标参数设置 store（Zustand + localStorage）
 *
 * 持久化策略：
 * - localStorage 命名空间 `indicator_settings`（与 screener / watchlist 等互不冲突）
 * - 初始读取时严格校验：任何字段非法 → 静默 fallback DEFAULT_INDICATOR_CONFIG
 * - 不引入新依赖；仅 zustand + localStorage
 *
 * 容错：
 * - localStorage 不可用（H5 quota / 隐私模式 / 非 H5 无 adapter）：set/get 静默 no-op
 * - 解析失败（JSON.parse 抛错 / schema 不匹配）：静默 fallback 默认
 */
import { create } from 'zustand'
import {
  DEFAULT_INDICATOR_CONFIG,
  type IndicatorConfig,
} from '@/lib/indicators/types'

const STORAGE_KEY = 'indicator_settings'

/** 参数上限：与后端 normalizeIndicatorConfig 对齐 */
const PARAM_MAX = 200

/** 布尔 helper：判断 value 是否是正整数 */
function isPositiveInteger(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= PARAM_MAX
}

/** 校验并规范化一份 IndicatorConfig。失败返回 null */
function validateConfig(input: unknown): IndicatorConfig | null {
  if (!input || typeof input !== 'object') return null
  const cfg = input as Partial<IndicatorConfig>

  if (!Array.isArray(cfg.maPeriods) || cfg.maPeriods.length === 0) return null
  const maCleaned: number[] = []
  for (const p of cfg.maPeriods) {
    if (!isPositiveInteger(p)) return null
    if (!maCleaned.includes(p)) maCleaned.push(p)
  }
  maCleaned.sort((a, b) => a - b)

  const macd = cfg.macd as { fast?: number; slow?: number; signal?: number } | undefined
  if (
    !macd ||
    !isPositiveInteger(macd.fast) ||
    !isPositiveInteger(macd.slow) ||
    !isPositiveInteger(macd.signal)
  ) {
    return null
  }
  if (macd.fast >= macd.slow) return null

  const boll = cfg.boll as { period?: number; k?: number } | undefined
  if (
    !boll ||
    !isPositiveInteger(boll.period) ||
    typeof boll.k !== 'number' ||
    !Number.isFinite(boll.k) ||
    boll.k < 0.1 ||
    boll.k > 5
  ) {
    return null
  }

  const kdj = cfg.kdj as { n?: number; m1?: number; m2?: number } | undefined
  if (
    !kdj ||
    !isPositiveInteger(kdj.n) ||
    !isPositiveInteger(kdj.m1) ||
    !isPositiveInteger(kdj.m2)
  ) {
    return null
  }

  return {
    maPeriods: maCleaned,
    macd: { fast: macd.fast, slow: macd.slow, signal: macd.signal },
    boll: { period: boll.period, k: boll.k },
    kdj: { n: kdj.n, m1: kdj.m1, m2: kdj.m2 },
  }
}

function readFromStorage(): IndicatorConfig {
  if (typeof localStorage === 'undefined') return DEFAULT_INDICATOR_CONFIG
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_INDICATOR_CONFIG
    const validated = validateConfig(JSON.parse(raw))
    return validated ?? DEFAULT_INDICATOR_CONFIG
  } catch {
    return DEFAULT_INDICATOR_CONFIG
  }
}

function writeToStorage(config: IndicatorConfig): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch {
    // quota 或隐私模式：静默降级
  }
}

/**
 * 对外的 setter 校验：拒绝会破坏契约的输入
 * （保留 default fallback 行为，不抛错）
 */
function normalizeMaPeriods(periods: number[]): number[] | null {
  if (!Array.isArray(periods) || periods.length === 0) return null
  const cleaned: number[] = []
  for (const p of periods) {
    if (!isPositiveInteger(p)) return null
    if (!cleaned.includes(p)) cleaned.push(p)
  }
  cleaned.sort((a, b) => a - b)
  return cleaned
}

export interface IndicatorSettingsState {
  config: IndicatorConfig

  setMaPeriods: (periods: number[]) => void
  setMacdConfig: (fast: number, slow: number, signal: number) => void
  setBollConfig: (period: number, k: number) => void
  setKdjConfig: (n: number, m1: number, m2: number) => void
  reset: () => void
}

export const useIndicatorSettingsStore = create<IndicatorSettingsState>((set, get) => ({
  config: readFromStorage(),

  setMaPeriods: (periods) => {
    const cleaned = normalizeMaPeriods(periods)
    if (!cleaned) return // 非法 → 静默忽略
    const next: IndicatorConfig = { ...get().config, maPeriods: cleaned }
    writeToStorage(next)
    set({ config: next })
  },

  setMacdConfig: (fast, slow, signal) => {
    if (
      !isPositiveInteger(fast) ||
      !isPositiveInteger(slow) ||
      !isPositiveInteger(signal) ||
      fast >= slow
    ) {
      return
    }
    const next: IndicatorConfig = {
      ...get().config,
      macd: { fast, slow, signal },
    }
    writeToStorage(next)
    set({ config: next })
  },

  setBollConfig: (period, k) => {
    if (
      !isPositiveInteger(period) ||
      typeof k !== 'number' ||
      !Number.isFinite(k) ||
      k < 0.1 ||
      k > 5
    ) {
      return
    }
    const next: IndicatorConfig = {
      ...get().config,
      boll: { period, k },
    }
    writeToStorage(next)
    set({ config: next })
  },

  setKdjConfig: (n, m1, m2) => {
    if (
      !isPositiveInteger(n) ||
      !isPositiveInteger(m1) ||
      !isPositiveInteger(m2)
    ) {
      return
    }
    const next: IndicatorConfig = {
      ...get().config,
      kdj: { n, m1, m2 },
    }
    writeToStorage(next)
    set({ config: next })
  },

  reset: () => {
    writeToStorage(DEFAULT_INDICATOR_CONFIG)
    set({ config: DEFAULT_INDICATOR_CONFIG })
  },
}))

/** 暴露 STORAGE_KEY 给测试用 */
export const INDICATOR_SETTINGS_STORAGE_KEY = STORAGE_KEY

/** 暴露 readFromStorage 给测试用（验证初始读取逻辑） */
export const __readFromStorage = readFromStorage

/** 暴露 validator 给测试用 */
export const __validateIndicatorConfig = validateConfig
