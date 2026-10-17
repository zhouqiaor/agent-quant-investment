/**
 * useStaleQuery 单测（无 React Testing Library 时的策略）
 * - 抽离 controller 后，对纯函数状态机做黑盒测试
 * - 覆盖：初始无缓存 / 初始有缓存 / 过期清理 / fetch 成功 / fetch 失败 / isStale 计算
 */
import { renderHook, act } from '@testing-library/react'
import {
  createStaleQueryController,
  DEFAULT_CACHE_TIME,
  DEFAULT_STALE_TIME,
  useStaleQuery,
} from './use-stale-query'
import {
  staleCache,
  __setStaleCacheAdapter,
  STALE_CACHE_PREFIX,
  type StorageAdapter,
} from './stale-cache'

function createMemoryAdapter(): StorageAdapter & { _store: Map<string, string> } {
  const store = new Map<string, string>()
  return {
    _store: store,
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => {
      store.set(k, v)
    },
    removeItem: (k) => {
      store.delete(k)
    },
    listKeys: () => Array.from(store.keys()),
  }
}

describe('createStaleQueryController (TDD)', () => {
  let adapter: ReturnType<typeof createMemoryAdapter>

  beforeEach(() => {
    adapter = createMemoryAdapter()
    __setStaleCacheAdapter(adapter)
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
    __setStaleCacheAdapter(null)
  })

  it('首次进入无缓存 → loadInitial 返回 null/null，不抛错', () => {
    const c = createStaleQueryController<string>({
      cacheKey: 'market:list',
      staleTime: DEFAULT_STALE_TIME,
      cacheTime: DEFAULT_CACHE_TIME,
    })
    const init = c.loadInitial()
    expect(init.data).toBeNull()
    expect(init.updatedAt).toBeNull()
  })

  it('首次进入有缓存且未过期 → loadInitial 立即返回缓存 + updatedAt', () => {
    // 模拟 5 分钟前刚写过的缓存
    staleCache.set('market:list', [{ symbol: 'BTC', price: 60000 }])
    const c = createStaleQueryController<Array<{ symbol: string; price: number }>>({
      cacheKey: 'market:list',
      staleTime: DEFAULT_STALE_TIME,
      cacheTime: DEFAULT_CACHE_TIME,
    })
    const init = c.loadInitial()
    expect(init.data).toEqual([{ symbol: 'BTC', price: 60000 }])
    expect(init.updatedAt).toBeGreaterThan(0)
  })

  it('首次进入缓存已超过 cacheTime → loadInitial 清掉并返回 null', () => {
    // 写一个非常早的 updatedAt 让它必过期
    adapter.setItem(
      STALE_CACHE_PREFIX + 'stale:key',
      JSON.stringify({ data: 'old', updatedAt: 1 }),
    )
    const c = createStaleQueryController<string>({
      cacheKey: 'stale:key',
      staleTime: 60_000,
      cacheTime: 60_000,
    })
    const init = c.loadInitial()
    expect(init.data).toBeNull()
    expect(init.updatedAt).toBeNull()
    expect(staleCache.get('stale:key')).toBeNull()
  })

  it('fetchOnce 成功 → 写缓存并返回新 updatedAt；后续 loadInitial 能拿到', async () => {
    const c = createStaleQueryController<{ price: number }>({
      cacheKey: 'quote',
      staleTime: 60_000,
      cacheTime: 60_000,
    })

    const fetcher = jest.fn(async () => ({ price: 100 }))
    const result = await c.fetchOnce(fetcher)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(typeof result.updatedAt).toBe('number')
    expect(result.updatedAt).toBeGreaterThan(0)
    expect(fetcher).toHaveBeenCalledTimes(1)

    // 缓存已经被写入，下次 loadInitial 应能取到
    const init = c.loadInitial()
    expect(init.data).toEqual({ price: 100 })
  })

  it('fetchOnce 失败 → 返回 { ok: false }，不写缓存且不丢旧值', async () => {
    // 预置一份"上次"的缓存
    staleCache.set('quote', { price: 50 })
    const c = createStaleQueryController<{ price: number }>({
      cacheKey: 'quote',
      staleTime: 60_000,
      cacheTime: 60_000,
    })

    const fetcher = jest.fn(async () => {
      throw new Error('network down')
    })
    const result = await c.fetchOnce(fetcher)
    expect(result.ok).toBe(false)

    // 旧缓存仍在
    const init = c.loadInitial()
    expect(init.data).toEqual({ price: 50 })
  })

  it('isStale: updatedAt=null 视为 false；超过 staleTime 视为 true；未超过视为 false', () => {
    const c = createStaleQueryController<string>({
      cacheKey: 'k',
      staleTime: 1_000,
      cacheTime: 60_000,
    })
    expect(c.isStale(null)).toBe(false)

    const now = 100_000
    expect(c.isStale(now, now)).toBe(false)
    expect(c.isStale(now - 500, now)).toBe(false)
    expect(c.isStale(now - 2_000, now)).toBe(true)
  })

  it('不同 cacheKey 互相隔离；a 写不影响 b', async () => {
    const ca = createStaleQueryController<string>({
      cacheKey: 'a',
      staleTime: 60_000,
      cacheTime: 60_000,
    })
    const cb = createStaleQueryController<string>({
      cacheKey: 'b',
      staleTime: 60_000,
      cacheTime: 60_000,
    })

    await ca.fetchOnce(async () => 'A')
    expect(ca.loadInitial().data).toBe('A')
    expect(cb.loadInitial().data).toBeNull()
  })

  it('卸载语义：背景 fetchOnce 返回后由调用方负责 mounted 守卫（controller 自身不持有状态）', async () => {
    // controller 是纯函数，不直接绑定 React 生命周期
    // 调用方在 useEffect 里维护 mountedRef；这里验证 controller 多次 fetchOnce 的安全性
    const c = createStaleQueryController<number>({
      cacheKey: 'k',
      staleTime: 60_000,
      cacheTime: 60_000,
    })

    const f1 = jest.fn(async () => 1)
    const f2 = jest.fn(async () => 2)

    const r1 = await c.fetchOnce(f1)
    const r2 = await c.fetchOnce(f2)

    expect(r1.ok).toBe(true)
    expect(r2.ok).toBe(true)
    // 后写覆盖前写
    expect(c.loadInitial().data).toBe(2)
  })
})

/* ------------------------------------------------------------------ */
/* useStaleQuery Hook 运行时测试（renderHook + jsdom）                  */
/* ------------------------------------------------------------------ */

interface Deferred<T> {
  promise: Promise<T>
  resolve: (v: T) => void
  reject: (e: unknown) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useStaleQuery (renderHook 运行时)', () => {
  let adapter: ReturnType<typeof createMemoryAdapter>

  beforeEach(() => {
    adapter = createMemoryAdapter()
    __setStaleCacheAdapter(adapter)
  })

  afterEach(() => {
    __setStaleCacheAdapter(null)
  })

  it('挂载即触发 fetcher；成功后 data 更新、isLoading 归 false', async () => {
    const d = deferred<string>()
    const fetcher = jest.fn(() => d.promise)

    const { result } = renderHook(() =>
      useStaleQuery({ cacheKey: 'rt:1', fetcher }),
    )

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(result.current.data).toBeNull()
    expect(result.current.isLoading).toBe(true)

    await act(async () => {
      d.resolve('hello')
      await d.promise
    })

    expect(result.current.data).toBe('hello')
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isError).toBe(false)
    expect(typeof result.current.lastUpdatedAt).toBe('number')
  })

  it('refetch 再次调用 fetcher 并刷新 data', async () => {
    let n = 0
    const fetcher = jest.fn(async () => `v${++n}`)

    const { result } = renderHook(() =>
      useStaleQuery({ cacheKey: 'rt:2', fetcher }),
    )

    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.data).toBe('v1')

    await act(async () => {
      await result.current.refetch()
    })

    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(result.current.data).toBe('v2')
    expect(result.current.isLoading).toBe(false)
  })

  it('fetcher reject → isError=true、data 保持 null', async () => {
    const fetcher = jest.fn(async () => {
      throw new Error('boom')
    })

    const { result } = renderHook(() =>
      useStaleQuery({ cacheKey: 'rt:3', fetcher }),
    )

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.isError).toBe(true)
    expect(result.current.data).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('有缓存时挂载立即展示缓存（不闪 loading），后台静默 refetch 成功后刷新', async () => {
    staleCache.set('rt:4', 'cached')
    const fetcher = jest.fn(async () => 'fresh')

    const { result } = renderHook(() =>
      useStaleQuery({ cacheKey: 'rt:4', fetcher }),
    )

    // 同步初始值
    expect(result.current.data).toBe('cached')
    expect(result.current.isLoading).toBe(false)
    expect(fetcher).toHaveBeenCalledTimes(1)

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.data).toBe('fresh')
    expect(result.current.isLoading).toBe(false)
  })

  it('有缓存且后台 refetch 失败 → 保留缓存、isError=true', async () => {
    staleCache.set('rt:5', 'cached')
    const fetcher = jest.fn(async () => {
      throw new Error('offline')
    })

    const { result } = renderHook(() =>
      useStaleQuery({ cacheKey: 'rt:5', fetcher }),
    )
    expect(result.current.data).toBe('cached')

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.data).toBe('cached')
    expect(result.current.isError).toBe(true)
  })

  it('卸载后 fetcher 才 resolve → 不抛 setState after unmount，缓存仍被写入', async () => {
    const d = deferred<number>()
    const fetcher = jest.fn(() => d.promise)

    const { unmount } = renderHook(() =>
      useStaleQuery({ cacheKey: 'rt:6', fetcher }),
    )

    unmount()

    await act(async () => {
      d.resolve(42)
      await d.promise
    })

    // 缓存由 controller 写入，与 mounted 无关
    expect(staleCache.get<number>('rt:6')?.data).toBe(42)
  })

  it('超过 staleTime 后 isStale 派生为 true（30s forceTick 驱动重算）', () => {
    jest.useFakeTimers()
    try {
      // 预置一份 5s 前的缓存，staleTime=1s
      adapter.setItem(
        STALE_CACHE_PREFIX + 'rt:7',
        JSON.stringify({ data: 'old', updatedAt: Date.now() - 5_000 }),
      )

      const fetcher = jest.fn(async () => 'old')
      const { result } = renderHook(() =>
        useStaleQuery({
          cacheKey: 'rt:7',
          fetcher,
          staleTime: 1_000,
          cacheTime: 300_000,
        }),
      )

      expect(result.current.data).toBe('old')
      expect(result.current.isStale).toBe(true)
    } finally {
      jest.useRealTimers()
    }
  })
})