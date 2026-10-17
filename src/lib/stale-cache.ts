/**
 * 离线兜底本地缓存
 * - H5: window.localStorage
 * - 小程序: Taro.setStorageSync / getStorageSync
 * - 通过 PREFIX 命名空间隔离，clear() 只清理本模块写入的 key
 * - 支持注入 adapter，便于在 Node 单测里用内存对象替代
 */
import Taro from '@tarojs/taro'
import { isH5 } from '@/lib/platform'

export const STALE_CACHE_PREFIX = 'stale_cache:'

export interface StaleCacheEntry<T> {
  data: T
  updatedAt: number
}

export interface StorageAdapter {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  listKeys?(): string[]
}

function createDefaultAdapter(): StorageAdapter | null {
  // H5: localStorage
  if (isH5()) {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      return {
        getItem: (k) => window.localStorage.getItem(k),
        setItem: (k, v) => window.localStorage.setItem(k, v),
        removeItem: (k) => window.localStorage.removeItem(k),
        listKeys: () => Object.keys(window.localStorage),
      }
    }
    return null
  }
  // 小程序/抖音小程序: Taro 同步 API
  try {
    if (Taro && typeof (Taro as { setStorageSync?: unknown }).setStorageSync === 'function') {
      return {
        getItem: (k) => {
          const v = (Taro.getStorageSync as (k: string) => unknown)(k)
          return v == null ? null : (v as string)
        },
        setItem: (k, v) => {
          ;(Taro.setStorageSync as (k: string, v: string) => void)(k, v)
        },
        removeItem: (k) => {
          ;(Taro.removeStorageSync as (k: string) => void)(k)
        },
        listKeys: () => {
          const info = (Taro.getStorageInfoSync as () => { keys?: string[] } | undefined)?.()
          return info?.keys ?? []
        },
      }
    }
  } catch {
    return null
  }
  return null
}

let currentAdapter: StorageAdapter | null = createDefaultAdapter()

/**
 * 注入底层存储（仅供测试使用）。
 * 传入 null 可"禁用"缓存模块，所有 get/set 都成 no-op。
 */
export function __setStaleCacheAdapter(adapter: StorageAdapter | null): void {
  currentAdapter = adapter
}

/** 当前底层 adapter（供测试/调试读取） */
export function __getStaleCacheAdapter(): StorageAdapter | null {
  return currentAdapter
}

function isValidEntry<T>(value: unknown): value is StaleCacheEntry<T> {
  if (!value || typeof value !== 'object') return false
  const v = value as { data?: unknown; updatedAt?: unknown }
  return typeof v.updatedAt === 'number'
}

export const staleCache = {
  /**
   * 读取缓存：返回 `{ data, updatedAt }`，无则返回 null
   */
  get<T>(key: string): { data: T; updatedAt: number } | null {
    if (!currentAdapter) return null
    const fullKey = STALE_CACHE_PREFIX + key
    let raw: string | null
    try {
      raw = currentAdapter.getItem(fullKey)
    } catch {
      return null
    }
    if (!raw) return null
    try {
      const parsed: unknown = JSON.parse(raw)
      if (!isValidEntry<T>(parsed)) return null
      return { data: parsed.data, updatedAt: parsed.updatedAt }
    } catch {
      return null
    }
  },

  /**
   * 写入缓存：自动打 `updatedAt` 时间戳
   */
  set<T>(key: string, data: T): void {
    if (!currentAdapter) return
    const fullKey = STALE_CACHE_PREFIX + key
    const entry: StaleCacheEntry<T> = { data, updatedAt: Date.now() }
    try {
      currentAdapter.setItem(fullKey, JSON.stringify(entry))
    } catch {
      // 静默：序列化失败或 quota 满，丢缓存不致命
    }
  },

  /**
   * 删除指定 key
   */
  remove(key: string): void {
    if (!currentAdapter) return
    const fullKey = STALE_CACHE_PREFIX + key
    try {
      currentAdapter.removeItem(fullKey)
    } catch {
      // 静默
    }
  },

  /**
   * 清空所有 stale_cache 前缀的 entry
   * 不影响其他模块的存储
   */
  clear(): void {
    if (!currentAdapter) return
    let keys: string[] = []
    try {
      keys = currentAdapter.listKeys?.() ?? []
    } catch {
      keys = []
    }
    keys
      .filter((k) => k.startsWith(STALE_CACHE_PREFIX))
      .forEach((k) => {
        try {
          currentAdapter!.removeItem(k)
        } catch {
          // 静默
        }
      })
  },
}