/**
 * 条件选股器 Zustand store
 *
 * 设计目标：
 * - conditions / combinator / sort / page 是纯 reducer 语义（可单测）
 * - 网络副作用（runQuery）放在 store 内部，方便页面零模板调用
 * - 预设（presets）通过 localStorage 持久化，命名空间 screener_presets
 *
 * 防抖策略：
 * - runQuery 自身不带防抖，组件层 useDebouncedConditions 在 conditions.length 变化时调用
 * - 每键击不触发请求，避免抖动
 */
import { create } from 'zustand'
import { Network } from '@/network'
import {
  type Condition,
  type Preset,
  type ScreenerCombinator,
  type ScreenerItem,
  type ScreenerResponse,
  type ScreenerSort,
  PRESETS_SCHEMA_VERSION,
  PRESETS_STORAGE_KEY,
} from '@/lib/screener/types'

const DEFAULT_SORT: ScreenerSort = { field: 'changePct', order: 'desc' }
const DEFAULT_PAGE_SIZE = 20

/**
 * localStorage 形态（与后端无关，纯前端）
 */
interface PresetsBlob {
  version: number
  presets: Preset[]
}

function readPresetsFromStorage(): Preset[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY)
    if (!raw) return []
    const blob = JSON.parse(raw) as Partial<PresetsBlob>
    if (!blob || blob.version !== PRESETS_SCHEMA_VERSION || !Array.isArray(blob.presets)) {
      return []
    }
    return blob.presets
  } catch {
    return []
  }
}

function writePresetsToStorage(presets: Preset[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    const blob: PresetsBlob = { version: PRESETS_SCHEMA_VERSION, presets }
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(blob))
  } catch {
    // quota 或隐私模式：静默降级，不影响主流程
  }
}

export interface ScreenerState {
  // ---- query params ----
  conditions: Condition[]
  combinator: ScreenerCombinator
  sort: ScreenerSort
  page: number
  pageSize: number

  // ---- result ----
  results: ScreenerItem[]
  total: number
  loading: boolean
  error: string | null

  // ---- presets ----
  presets: Preset[]

  // ---- reducers（无副作用，可单测）----
  addCondition: (c?: Partial<Condition>) => void
  removeCondition: (index: number) => void
  updateCondition: (index: number, patch: Partial<Condition>) => void
  setCombinator: (combinator: ScreenerCombinator) => void
  setSort: (sort: ScreenerSort) => void
  setPage: (page: number) => void

  // ---- async actions ----
  runQuery: () => Promise<void>
  loadPreset: (id: string) => void
  savePreset: (name: string) => Preset | null
  deletePreset: (id: string) => void
  reset: () => void
}

export const useScreenerStore = create<ScreenerState>((set, get) => ({
  conditions: [],
  combinator: 'AND',
  sort: { ...DEFAULT_SORT },
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  results: [],
  total: 0,
  loading: false,
  error: null,
  presets: readPresetsFromStorage(),

  // -------------------------------------------------------------------------
  // Reducers
  // -------------------------------------------------------------------------

  addCondition: (c) => {
    const condition: Condition = {
      field: c?.field ?? 'pe',
      op: c?.op ?? '<',
      value: c?.value ?? 0,
    }
    set((s) => ({
      conditions: [...s.conditions, condition],
      page: 1, // 条件变化时回到首页
    }))
  },

  removeCondition: (index) => {
    set((s) => ({
      conditions: s.conditions.filter((_, i) => i !== index),
      page: 1,
    }))
  },

  updateCondition: (index, patch) => {
    set((s) => ({
      conditions: s.conditions.map((c, i) => (i === index ? { ...c, ...patch } : c)),
      page: 1,
    }))
  },

  setCombinator: (combinator) => {
    set({ combinator, page: 1 })
  },

  setSort: (sort) => {
    set({ sort, page: 1 })
  },

  setPage: (page) => {
    set({ page })
  },

  // -------------------------------------------------------------------------
  // Async: 查询
  // -------------------------------------------------------------------------

  runQuery: async () => {
    const { conditions, combinator, sort, page, pageSize } = get()
    if (conditions.length === 0) {
      // 无条件时清空结果但不发请求（约定：避免误触发全市场扫描）
      set({ results: [], total: 0, error: null, loading: false })
      return
    }
    set({ loading: true, error: null })
    try {
      const res = await Network.request({
        url: '/api/screener/query',
        method: 'POST',
        data: {
          combinator,
          groups: conditions,
          sort,
          page,
          pageSize,
        },
      })
      const data = (res.data?.data ?? {}) as Partial<ScreenerResponse>
      set({
        results: Array.isArray(data.items) ? data.items : [],
        total: typeof data.total === 'number' ? data.total : 0,
        loading: false,
      })
    } catch (e) {
      console.error('[screener] runQuery error', e)
      const msg = e instanceof Error ? e.message : '查询失败'
      set({ loading: false, error: msg, results: [], total: 0 })
    }
  },

  // -------------------------------------------------------------------------
  // Async: 预设
  // -------------------------------------------------------------------------

  loadPreset: (id) => {
    const preset = get().presets.find((p) => p.id === id)
    if (!preset) return
    set({
      conditions: preset.conditions.map((c) => ({ ...c })),
      combinator: preset.combinator,
      sort: { ...preset.sort },
      page: 1,
    })
  },

  savePreset: (name) => {
    const trimmed = name.trim()
    if (!trimmed) return null
    const { conditions, combinator, sort, presets } = get()
    const preset: Preset = {
      id: `preset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name: trimmed,
      combinator,
      conditions: conditions.map((c) => ({ ...c })),
      sort: { ...sort },
      createdAt: new Date().toISOString(),
    }
    const next = [preset, ...presets]
    writePresetsToStorage(next)
    set({ presets: next })
    return preset
  },

  deletePreset: (id) => {
    const next = get().presets.filter((p) => p.id !== id)
    writePresetsToStorage(next)
    set({ presets: next })
  },

  // -------------------------------------------------------------------------
  // 重置
  // -------------------------------------------------------------------------

  reset: () => {
    set({
      conditions: [],
      combinator: 'AND',
      sort: { ...DEFAULT_SORT },
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      results: [],
      total: 0,
      loading: false,
      error: null,
    })
  },
}))
