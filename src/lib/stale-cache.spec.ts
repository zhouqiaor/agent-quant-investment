/**
 * stale-cache 单测
 * - 通过 __setStaleCacheAdapter 注入内存 adapter，避免依赖 Taro / window
 */
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

describe('staleCache (TDD)', () => {
  let adapter: ReturnType<typeof createMemoryAdapter>

  beforeEach(() => {
    adapter = createMemoryAdapter()
    __setStaleCacheAdapter(adapter)
  })

  afterEach(() => {
    __setStaleCacheAdapter(null)
  })

  it('写入后能读取，且 updatedAt 是 number', () => {
    staleCache.set('market:list', [{ symbol: 'BTC', price: 60000 }])
    const entry = staleCache.get<Array<{ symbol: string; price: number }>>('market:list')
    expect(entry).not.toBeNull()
    expect(entry?.data).toEqual([{ symbol: 'BTC', price: 60000 }])
    expect(typeof entry?.updatedAt).toBe('number')
    expect(entry!.updatedAt).toBeGreaterThan(0)
  })

  it('读取不存在的 key 返回 null', () => {
    const entry = staleCache.get('not_exist')
    expect(entry).toBeNull()
  })

  it('remove 单个 key 后再读返回 null，其它 key 不受影响', () => {
    staleCache.set('a', 'alpha')
    staleCache.set('b', 'beta')
    staleCache.remove('a')
    expect(staleCache.get('a')).toBeNull()
    expect(staleCache.get<string>('b')?.data).toBe('beta')
  })

  it('clear 只清掉 stale_cache: 前缀的 key，其它不动', () => {
    // 模拟应用里其它模块的存储
    adapter.setItem('tour_seen_v2', '1')
    adapter.setItem('user_pref:theme', 'dark')

    staleCache.set('x', 'X')
    staleCache.set('y', 'Y')

    staleCache.clear()

    expect(staleCache.get('x')).toBeNull()
    expect(staleCache.get('y')).toBeNull()
    // 非本模块的存储应该原样保留
    expect(adapter.getItem('tour_seen_v2')).toBe('1')
    expect(adapter.getItem('user_pref:theme')).toBe('dark')
  })

  it('get 时遇到脏数据（非法 JSON / 缺 updatedAt）返回 null 而不抛错', () => {
    adapter.setItem(STALE_CACHE_PREFIX + 'dirty_json', '{not a valid json')
    expect(() => staleCache.get('dirty_json')).not.toThrow()
    expect(staleCache.get('dirty_json')).toBeNull()

    adapter.setItem(STALE_CACHE_PREFIX + 'no_ts', JSON.stringify({ data: { foo: 1 } }))
    expect(staleCache.get('no_ts')).toBeNull()
  })

  it('adapter 为 null（禁用）时所有操作是安全 no-op', () => {
    __setStaleCacheAdapter(null)
    expect(() => {
      staleCache.set('k', 'v')
      const got = staleCache.get('k')
      expect(got).toBeNull()
      staleCache.remove('k')
      staleCache.clear()
    }).not.toThrow()
  })
})