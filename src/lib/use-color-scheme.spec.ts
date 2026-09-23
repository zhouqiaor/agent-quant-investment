/**
 * useColorScheme 单元测试
 *
 * 覆盖点：
 *  1) 默认 'auto' + 系统 dark → 返回 dark
 *  2) 默认 'auto' + 系统 light → 返回 light
 *  3) localStorage 已存 'light' → 初始挂载即返回 light（忽略系统）
 *  4) setScheme('light') → 固定返回 light 并写入 localStorage
 *  5) setScheme('dark') → 固定返回 dark 并写入 localStorage
 *  6) 从 'dark' 切回 'auto' + 系统 light → scheme 跟随系统变为 light
 *  7) matchMedia change 事件触发 systemScheme 更新
 *  8) 非法本地值（如 'rainbow'）被规范化为 'auto'，不污染状态
 */

import { renderHook, act } from '@testing-library/react'
import { useColorScheme } from './use-color-scheme'

jest.mock('@tarojs/taro', () => ({
  getEnv: jest.fn(() => 'WEB'),
  ENV_TYPE: { WEB: 'WEB', WEAPP: 'WEAPP', TT: 'TT' },
  getSystemInfoSync: jest.fn(() => ({ theme: 'dark' })),
  getStorageSync: jest.fn(() => ''),
  setStorageSync: jest.fn(),
  setNavigationBarColor: jest.fn(),
  setBackgroundColor: jest.fn(),
}))

type Listener = (event: { matches: boolean }) => void
type MediaQueryListMock = {
  matches: boolean
  media: string
  onchange: null
  addEventListener: jest.Mock
  removeEventListener: jest.Mock
  addListener: (cb: Listener) => void
  removeListener: jest.Mock
  dispatchEvent: jest.Mock
}

let listeners: Listener[] = []
let mockMatches = false
let mediaQueryMock: jest.Mock
const STORAGE_KEY = 'color-scheme-preference'

function setupMatchMedia(matches: boolean) {
  mockMatches = matches
  listeners = []
  mediaQueryMock = jest.fn().mockImplementation((q: string): MediaQueryListMock => ({
    matches: mockMatches,
    media: q,
    onchange: null,
    addEventListener: jest.fn((_event: string, cb: Listener) => {
      listeners.push(cb)
    }),
    removeEventListener: jest.fn((_event: string, cb: Listener) => {
      listeners = listeners.filter((l) => l !== cb)
    }),
    addListener: (cb: Listener) => {
      listeners.push(cb)
    },
    removeListener: jest.fn((cb: Listener) => {
      listeners = listeners.filter((l) => l !== cb)
    }),
    dispatchEvent: jest.fn(),
  }))
  ;(window as unknown as { matchMedia: jest.Mock }).matchMedia = mediaQueryMock
}

interface LocalStorageMock {
  store: Record<string, string>
  getItem: jest.Mock
  setItem: jest.Mock
  removeItem: jest.Mock
  clear: jest.Mock
}

function setupLocalStorage(initial: Record<string, string> = {}): LocalStorageMock {
  const store: Record<string, string> = { ...initial }
  const mock: LocalStorageMock = {
    store,
    getItem: jest.fn((k: string) => (k in store ? store[k] : null)),
    setItem: jest.fn((k: string, v: string) => {
      store[k] = v
    }),
    removeItem: jest.fn((k: string) => {
      delete store[k]
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach((k) => delete store[k])
    }),
  }
  // jsdom 的 localStorage 为原型只读访问器，直接赋值不会生效，需 defineProperty
  Object.defineProperty(globalThis, 'localStorage', {
    value: mock,
    configurable: true,
    writable: true,
  })
  return mock
}

beforeEach(() => {
  jest.clearAllMocks()
  setupMatchMedia(true)
  setupLocalStorage()
})

describe('useColorScheme', () => {
  it('默认 (auto) + 系统 dark → 返回 dark，且 preference 为 auto', () => {
    setupMatchMedia(true)
    setupLocalStorage()
    const { result } = renderHook(() => useColorScheme())
    expect(result.current.scheme).toBe('dark')
    expect(result.current.preference).toBe('auto')
  })

  it('默认 (auto) + 系统 light → 返回 light', () => {
    setupMatchMedia(false)
    setupLocalStorage()
    const { result } = renderHook(() => useColorScheme())
    expect(result.current.scheme).toBe('light')
    expect(result.current.preference).toBe('auto')
  })

  it('localStorage 已存 light → 初始挂载即返回 light（忽略系统）', () => {
    setupMatchMedia(true)
    const ls = setupLocalStorage({ [STORAGE_KEY]: 'light' })
    const { result } = renderHook(() => useColorScheme())
    expect(result.current.scheme).toBe('light')
    expect(result.current.preference).toBe('light')
    expect(ls.store[STORAGE_KEY]).toBe('light')
  })

  it('setScheme("light") → 固定返回 light 并写入 localStorage', () => {
    setupMatchMedia(false)
    const ls = setupLocalStorage()
    const { result } = renderHook(() => useColorScheme())
    act(() => {
      result.current.setScheme('light')
    })
    expect(result.current.scheme).toBe('light')
    expect(result.current.preference).toBe('light')
    expect(ls.store[STORAGE_KEY]).toBe('light')
  })

  it('setScheme("dark") → 固定返回 dark 并写入 localStorage（即使系统是 light）', () => {
    setupMatchMedia(false)
    const ls = setupLocalStorage()
    const { result } = renderHook(() => useColorScheme())
    act(() => {
      result.current.setScheme('dark')
    })
    expect(result.current.scheme).toBe('dark')
    expect(result.current.preference).toBe('dark')
    expect(ls.store[STORAGE_KEY]).toBe('dark')
  })

  it('从 dark 切回 auto → scheme 跟随系统（light）', () => {
    setupMatchMedia(false)
    const ls = setupLocalStorage({ [STORAGE_KEY]: 'dark' })
    const { result } = renderHook(() => useColorScheme())
    expect(result.current.scheme).toBe('dark')
    expect(result.current.preference).toBe('dark')
    act(() => {
      result.current.setScheme('auto')
    })
    expect(result.current.scheme).toBe('light')
    expect(result.current.preference).toBe('auto')
    expect(ls.store[STORAGE_KEY]).toBe('auto')
  })

  it('matchMedia change 事件触发 systemScheme 更新（auto 模式下实时生效）', () => {
    setupMatchMedia(false)
    setupLocalStorage({ [STORAGE_KEY]: 'auto' })
    const { result } = renderHook(() => useColorScheme())
    expect(result.current.scheme).toBe('light')
    expect(result.current.preference).toBe('auto')
    expect(mediaQueryMock).toHaveBeenCalledWith('(prefers-color-scheme: dark)')
    expect(listeners.length).toBeGreaterThanOrEqual(1)

    act(() => {
      mockMatches = true
      const cb = listeners[0]
      cb({ matches: true })
    })
    expect(result.current.scheme).toBe('dark')
  })

  it('非法本地值（如 "rainbow"）被规范化，不影响默认 auto + dark', () => {
    setupMatchMedia(true)
    setupLocalStorage({ [STORAGE_KEY]: 'rainbow' })
    const { result } = renderHook(() => useColorScheme())
    expect(result.current.scheme).toBe('dark')
    expect(result.current.preference).toBe('auto')
  })

  it('scheme 变化时同步到 <html> class 与 data-theme 属性', () => {
    setupMatchMedia(false)
    setupLocalStorage()
    const { result } = renderHook(() => useColorScheme())
    expect(document.documentElement.classList.contains('light')).toBe(true)
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')

    act(() => {
      result.current.setScheme('dark')
    })
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.classList.contains('light')).toBe(false)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('卸载时移除 matchMedia change 监听', () => {
    setupMatchMedia(true)
    setupLocalStorage()
    const { unmount } = renderHook(() => useColorScheme())
    expect(listeners.length).toBeGreaterThanOrEqual(1)
    const countBefore = listeners.length
    unmount()
    expect(listeners.length).toBe(countBefore - 1)
  })
})
