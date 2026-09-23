/**
 * indicator-settings store 单测（TDD）
 *
 * 覆盖：
 *  - 默认值正确
 *  - setMaPeriods 后 localStorage 更新
 *  - localStorage 读取合法值
 *  - 非法值（负数/空数组）静默 fallback
 *  - reset 回到默认
 *
 * 通过 ambient describe/it/expect 声明保持 pnpm tsc 通过
 */

import { DEFAULT_INDICATOR_CONFIG } from '@/lib/indicators/types'
import {
  INDICATOR_SETTINGS_STORAGE_KEY,
  __readFromStorage,
  useIndicatorSettingsStore,
} from './indicator-settings'

/* eslint-disable @typescript-eslint/no-unused-vars */
declare const describe: (name: string, fn: () => void) => void
declare const it: (name: string, fn: () => void) => void
declare const expect: (val: unknown) => {
  toBe: (expected: unknown) => void
  toEqual: (expected: unknown) => void
  toBeTruthy: () => void
  toBeFalsy: () => void
  toBeDefined: () => void
  toContain: (expected: unknown) => void
}
declare const beforeEach: (fn: () => void) => void
declare const afterEach: (fn: () => void) => void

// 注入 localStorage shim（Node 环境无原生）
const _lsMap = new Map<string, string>()
;(globalThis as unknown as { localStorage: Map<string, string> & {
  getItem: (k: string) => string | null
  setItem: (k: string, v: string) => void
  removeItem: (k: string) => void
  clear: () => void
} }).localStorage = Object.assign(_lsMap, {
  getItem: (k: string) => (_lsMap.has(k) ? _lsMap.get(k)! : null),
  setItem: (k: string, v: string) => {
    _lsMap.set(k, v)
  },
  removeItem: (k: string) => {
    _lsMap.delete(k)
  },
  clear: () => {
    _lsMap.clear()
  },
})

beforeEach(() => {
  _lsMap.clear()
  useIndicatorSettingsStore.setState({
    config: { ...DEFAULT_INDICATOR_CONFIG },
  })
})

afterEach(() => {
  _lsMap.clear()
})

describe('useIndicatorSettingsStore', () => {
  it('默认值正确', () => {
    const { config } = useIndicatorSettingsStore.getState()
    expect(config.maPeriods).toEqual([5, 10, 20, 60])
    expect(config.macd).toEqual({ fast: 12, slow: 26, signal: 9 })
    expect(config.boll).toEqual({ period: 20, k: 2 })
    expect(config.kdj).toEqual({ n: 9, m1: 3, m2: 3 })
  })

  it('setMaPeriods 后 localStorage 更新', () => {
    useIndicatorSettingsStore.getState().setMaPeriods([5, 30])
    const stored = _lsMap.get(INDICATOR_SETTINGS_STORAGE_KEY)
    expect(stored).toBeDefined()
    const parsed = JSON.parse(stored!) as { maPeriods: number[] }
    expect(parsed.maPeriods).toEqual([5, 30])
  })

  it('localStorage 读取合法值（store 初始化时）', () => {
    const persisted = {
      maPeriods: [10, 30],
      macd: { fast: 8, slow: 21, signal: 5 },
      boll: { period: 14, k: 1.5 },
      kdj: { n: 5, m1: 3, m2: 3 },
    }
    _lsMap.set(INDICATOR_SETTINGS_STORAGE_KEY, JSON.stringify(persisted))
    const read = __readFromStorage()
    expect(read.maPeriods).toEqual([10, 30])
    expect(read.macd.fast).toBe(8)
    expect(read.macd.slow).toBe(21)
    expect(read.boll.period).toBe(14)
    expect(read.kdj.n).toBe(5)
  })

  it('localStorage 非法值（macd.fast >= slow）静默 fallback 默认', () => {
    _lsMap.set(
      INDICATOR_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        maPeriods: [5, 10],
        macd: { fast: 26, slow: 12, signal: 9 }, // fast >= slow 非法
        boll: { period: 20, k: 2 },
        kdj: { n: 9, m1: 3, m2: 3 },
      }),
    )
    const read = __readFromStorage()
    // 非法 → fallback DEFAULT
    expect(read.maPeriods).toEqual([5, 10, 20, 60])
    expect(read.macd).toEqual({ fast: 12, slow: 26, signal: 9 })
  })

  it('非法值（负数/空数组）静默 fallback —— setMaPeriods 不改 config', () => {
    const before = useIndicatorSettingsStore.getState().config
    useIndicatorSettingsStore.getState().setMaPeriods([-1, 5])
    const after = useIndicatorSettingsStore.getState().config
    expect(after).toEqual(before)

    useIndicatorSettingsStore.getState().setMaPeriods([])
    const after2 = useIndicatorSettingsStore.getState().config
    expect(after2).toEqual(before)
  })

  it('reset 回到默认', () => {
    useIndicatorSettingsStore.getState().setMaPeriods([7])
    useIndicatorSettingsStore.getState().setMacdConfig(8, 21, 5)
    expect(useIndicatorSettingsStore.getState().config.maPeriods).toEqual([7])

    useIndicatorSettingsStore.getState().reset()
    expect(useIndicatorSettingsStore.getState().config).toEqual(DEFAULT_INDICATOR_CONFIG)
    const stored = _lsMap.get(INDICATOR_SETTINGS_STORAGE_KEY)
    expect(stored).toBeDefined()
    expect(JSON.parse(stored!).maPeriods).toEqual([5, 10, 20, 60])
  })
})
