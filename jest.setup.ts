/**
 * 前端 Jest 全局 setup（jsdom 环境）
 *
 * - @testing-library/jest-dom 断言扩展
 * - Taro API / 组件的轻量 mock（spec 内的 jest.mock 会覆盖这里的同名 mock）
 * - rAF / matchMedia / ResizeObserver 等 jsdom 缺失 API 的 polyfill
 */
import '@testing-library/jest-dom'

/* ------------------------------------------------------------------ */
/* jsdom 缺失的浏览器 API polyfill                                     */
/* ------------------------------------------------------------------ */

// requestAnimationFrame / cancelAnimationFrame（jsdom 默认不提供）
if (typeof globalThis.requestAnimationFrame !== 'function') {
  let rafId = 0
  // 记录 rAF id → 真实 timer 句柄，cancel 时才能正确清理，避免 pending 回调泄漏
  const rafTimers = new Map<number, ReturnType<typeof setTimeout>>()
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => {
    rafId += 1
    const id = rafId
    // 异步派发，更贴近真实行为
    const timer = setTimeout(() => {
      rafTimers.delete(id)
      cb(Date.now())
    }, 0)
    rafTimers.set(id, timer)
    return id
  }
  globalThis.cancelAnimationFrame = (id: number): void => {
    const timer = rafTimers.get(id)
    if (timer !== undefined) {
      clearTimeout(timer)
      rafTimers.delete(id)
    }
  }
}

// matchMedia
if (typeof window.matchMedia !== 'function') {
  const listeners = new Set<(event: { matches: boolean }) => void>()
  window.matchMedia = (query: string): MediaQueryList => {
    const mql = {
      matches: false,
      media: query,
      onchange: null,
      addListener: (cb: (event: { matches: boolean }) => void): void => {
        listeners.add(cb)
      },
      removeListener: (cb: (event: { matches: boolean }) => void): void => {
        listeners.delete(cb)
      },
      addEventListener: (
        _type: string,
        cb: (event: { matches: boolean }) => void,
      ): void => {
        listeners.add(cb)
      },
      removeEventListener: (
        _type: string,
        cb: (event: { matches: boolean }) => void,
      ): void => {
        listeners.delete(cb)
      },
      dispatchEvent: (): boolean => false,
    } as unknown as MediaQueryList
    return mql
  }
}

// ResizeObserver stub
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
}

// scrollTo stub（jsdom 的 window.scrollTo 仅打印未实现警告）
if (typeof window.scrollTo !== 'function') {
  window.scrollTo = (): void => {}
}

/* ------------------------------------------------------------------ */
/* Taro API mock（内存 storage；spec 内的 jest.mock 优先级更高）        */
/* ------------------------------------------------------------------ */

const storageMap = new Map<string, unknown>()

const taroMock = {
  /* 交互反馈 */
  showToast: jest.fn(),
  showLoading: jest.fn(),
  hideLoading: jest.fn(),
  showModal: jest.fn(
    async (): Promise<{ confirm: boolean; cancel: boolean }> => ({
      confirm: true,
      cancel: false,
    }),
  ),
  showActionSheet: jest.fn(),

  /* 存储（内存 Map 实现） */
  setStorageSync: jest.fn((key: string, data: unknown): void => {
    storageMap.set(key, data)
  }),
  getStorageSync: jest.fn((key: string): unknown => storageMap.get(key) ?? ''),
  removeStorageSync: jest.fn((key: string): void => {
    storageMap.delete(key)
  }),
  clearStorageSync: jest.fn((): void => {
    storageMap.clear()
  }),
  getStorageInfoSync: jest.fn(() => ({
    keys: Array.from(storageMap.keys()),
    currentSize: 0,
    limitSize: 0,
  })),

  /* 系统信息 */
  getSystemInfoSync: jest.fn(() => ({
    pixelRatio: 2,
    windowWidth: 375,
    windowHeight: 667,
    statusBarHeight: 20,
    platform: 'devtools',
    theme: 'light',
  })),
  getDeviceInfo: jest.fn(() => ({ platform: 'devtools' })),
  getWindowInfo: jest.fn(() => ({
    pixelRatio: 2,
    windowWidth: 375,
    windowHeight: 667,
    statusBarHeight: 20,
  })),

  /* 路由 */
  navigateTo: jest.fn(),
  redirectTo: jest.fn(),
  reLaunch: jest.fn(),
  switchTab: jest.fn(),
  navigateBack: jest.fn(),

  /* 剪贴板 */
  setClipboardData: jest.fn(),
  getClipboardData: jest.fn(async () => ({ data: '' })),

  /* 界面 */
  setNavigationBarColor: jest.fn(),
  setBackgroundColor: jest.fn(),

  /* 环境 */
  getEnv: jest.fn(() => 'WEB'),
  ENV_TYPE: { WEB: 'WEB', WEAPP: 'WEAPP', TT: 'TT', RN: 'RN', SWAN: 'SWAN', ALIPAY: 'ALIPAY' },

  /* 其它 */
  request: jest.fn(),
  nextTick: jest.fn((cb: () => void): NodeJS.Immediate => setImmediate(cb)),
  eventCenter: {
    on: jest.fn(),
    off: jest.fn(),
    once: jest.fn(),
    trigger: jest.fn(),
  },
  canIUse: jest.fn(() => true),
}

jest.mock('@tarojs/taro', () => taroMock)

/* ------------------------------------------------------------------ */
/* Taro 组件 mock：默认透传为原生 HTML 标签                             */
/* （spec 内若有自己的 jest.mock('@tarojs/components') 会覆盖此 mock）  */
/* ------------------------------------------------------------------ */

const React = require('react')

const passthrough =
  (tag: string) =>
  (props: {
    children?: React.ReactNode
    style?: React.CSSProperties
    className?: string
    [key: string]: unknown
  }) => {
    const { children, ...rest } = props ?? {}
    return React.createElement(tag, rest, children)
  }

jest.mock('@tarojs/components', () => ({
  View: passthrough('div'),
  Text: passthrough('span'),
  ScrollView: passthrough('div'),
  Image: passthrough('img'),
  Button: passthrough('button'),
  Input: passthrough('input'),
  Textarea: passthrough('textarea'),
  Swiper: passthrough('div'),
  SwiperItem: passthrough('div'),
  Picker: passthrough('div'),
  Navigator: passthrough('a'),
  WebView: passthrough('div'),
  Canvas: passthrough('canvas'),
  RichText: passthrough('div'),
  MovableView: passthrough('div'),
  MovableArea: passthrough('div'),
}))
