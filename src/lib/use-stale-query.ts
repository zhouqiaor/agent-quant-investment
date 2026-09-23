/**
 * useStaleQuery —— 离线兜底 + stale query
 *
 * 设计目标：
 * - 首次进入若有缓存（且未过期），立即展示 + 后台静默 refetch（不闪 Skeleton）
 * - refetch 失败时保留缓存，isStale=true（如果过了 staleTime）
 * - 返回 refetch 供手动重试
 *
 * 测试策略：
 * - React 状态机被收敛到 `createStaleQueryController`，是无副作用的纯函数
 * - `useStaleQuery` 只是 React 的薄包装，方便在无 RTL 的环境下单测
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { staleCache } from './stale-cache'

export interface StaleQueryOptions<T> {
  fetcher: () => Promise<T>
  /** 本地缓存 key */
  cacheKey: string
  /** 多少 ms 后视为 stale（默认 60000 = 60s） */
  staleTime?: number
  /** 数据保留时长（默认 5 分钟 = 300000ms，过期清掉） */
  cacheTime?: number
}

export interface StaleQueryResult<T> {
  data: T | null
  /** 当前展示的是 stale 数据（lastUpdatedAt 距离现在 > staleTime） */
  isStale: boolean
  isLoading: boolean
  isError: boolean
  lastUpdatedAt: number | null
  refetch: () => Promise<void>
}

export const DEFAULT_STALE_TIME = 60_000
export const DEFAULT_CACHE_TIME = 300_000

/**
 * 控制器 —— 纯函数的状态机，可独立单测
 * 不持有 React 状态，所有副作用通过 staleCache
 */
export interface StaleQueryController<T> {
  /** 读取初始值（同步）；cacheTime 之外的会被清掉 */
  loadInitial(): { data: T | null; updatedAt: number | null }
  /** 拉取一次，成功则写缓存并返回新 updatedAt；失败返回错误且不动缓存 */
  fetchOnce(fetcher: () => Promise<T>): Promise<{ ok: true; updatedAt: number } | { ok: false }>
  /** 当前 updatedAt 是否已 stale */
  isStale(updatedAt: number | null, now?: number): boolean
}

export function createStaleQueryController<T>(opts: {
  cacheKey: string
  staleTime: number
  cacheTime: number
}): StaleQueryController<T> {
  const { cacheKey, staleTime, cacheTime } = opts
  return {
    loadInitial() {
      const entry = staleCache.get<T>(cacheKey)
      if (!entry) return { data: null, updatedAt: null }
      if (Date.now() - entry.updatedAt > cacheTime) {
        staleCache.remove(cacheKey)
        return { data: null, updatedAt: null }
      }
      return { data: entry.data, updatedAt: entry.updatedAt }
    },

    async fetchOnce(fetcher) {
      try {
        const data = await fetcher()
        staleCache.set(cacheKey, data)
        const entry = staleCache.get<T>(cacheKey)
        return { ok: true as const, updatedAt: entry?.updatedAt ?? Date.now() }
      } catch {
        return { ok: false as const }
      }
    },

    isStale(updatedAt, now = Date.now()) {
      if (updatedAt === null) return false
      return now - updatedAt > staleTime
    },
  }
}

/**
 * React Hook：组合 controller + useState + useEffect
 */
export function useStaleQuery<T>(options: StaleQueryOptions<T>): StaleQueryResult<T> {
  const {
    fetcher,
    cacheKey,
    staleTime = DEFAULT_STALE_TIME,
    cacheTime = DEFAULT_CACHE_TIME,
  } = options

  // 一个 controller 实例化一次（key/time 变化时重建）
  const controllerRef = useRef<StaleQueryController<T> | null>(null)
  if (controllerRef.current === null) {
    controllerRef.current = createStaleQueryController<T>({
      cacheKey,
      staleTime,
      cacheTime,
    })
  }
  const controller = controllerRef.current

  // 同步初始化：避免 Skeleton 闪烁
  const initRef = useRef<{ data: T | null; updatedAt: number | null } | null>(null)
  if (initRef.current === null) {
    initRef.current = controller.loadInitial()
  }

  const [data, setData] = useState<T | null>(initRef.current.data)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(initRef.current.updatedAt)
  const [isLoading, setIsLoading] = useState<boolean>(initRef.current.data === null)
  const [isError, setIsError] = useState<boolean>(false)
  const [, forceTick] = useState(0) // 仅用于触发 isStale 重算

  // 卸载标记，避免 setState after unmount
  const mountedRef = useRef<boolean>(true)

  // fetcher ref 避免 effect 频繁重建
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const refetch = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    setIsError(false)
    const r = await controller.fetchOnce(() => fetcherRef.current())
    if (!mountedRef.current) return
    if (r.ok) {
      const entry = staleCache.get<T>(cacheKey)
      setData(entry?.data ?? null)
      setLastUpdatedAt(r.updatedAt)
    } else {
      setIsError(true)
    }
    setIsLoading(false)
  }, [cacheKey, controller])

  useEffect(() => {
    mountedRef.current = true
    const hadInitialData = initRef.current?.data !== null

    if (!hadInitialData) {
      // 首次无缓存 → 主动拉一次
      refetch()
    } else {
      // 有缓存 → 后台静默 refetch，不闪 Skeleton
      ;(async () => {
        const r = await controller.fetchOnce(() => fetcherRef.current())
        if (!mountedRef.current) return
        if (r.ok) {
          const entry = staleCache.get<T>(cacheKey)
          setData(entry?.data ?? null)
          setLastUpdatedAt(r.updatedAt)
        } else {
          setIsError(true)
        }
      })()
    }

    return () => {
      mountedRef.current = false
    }
    // 仅在 cacheKey 变化时重跑（controller 已经是稳定的）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey])

  // isStale 衍生自 lastUpdatedAt + staleTime。
  // 由于 lastUpdatedAt 一旦写入就稳定，需要 forceTick 周期触发重算。
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  const isStale = controller.isStale(lastUpdatedAt)

  return {
    data,
    isStale,
    isLoading,
    isError,
    lastUpdatedAt,
    refetch,
  }
}