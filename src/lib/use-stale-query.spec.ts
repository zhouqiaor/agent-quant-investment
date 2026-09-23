/**
 * useStaleQuery 单测（无 React Testing Library 时的策略）
 * - 抽离 controller 后，对纯函数状态机做黑盒测试
 * - 覆盖：初始无缓存 / 初始有缓存 / 过期清理 / fetch 成功 / fetch 失败 / isStale 计算
 */
import {
  createStaleQueryController,
  DEFAULT_CACHE_TIME,
  DEFAULT_STALE_TIME,
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