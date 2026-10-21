import { useCallback, useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { isH5 } from './platform'

export type ColorScheme = 'light' | 'dark'
export type SchemePreference = ColorScheme | 'auto'

const STORAGE_KEY = 'color-scheme-preference'
const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)'

/**
 * 跨端持久化：
 *  - H5：使用 localStorage
 *  - 小程序：使用 Taro.getStorageSync / setStorageSync
 *
 * 单一入口避免各组件各自拼接 wx API 导致 H5 / 小程序行为分裂。
 */
function readStorage(key: string): string | null {
  try {
    if (isH5() && typeof localStorage !== 'undefined') {
      const value = localStorage.getItem(key)
      return value
    }
    const value = Taro.getStorageSync(key)
    return typeof value === 'string' && value.length > 0 ? value : null
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string): void {
  try {
    if (isH5() && typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value)
      return
    }
    Taro.setStorageSync(key, value)
  } catch {
    /* silent — 隐私模式 / 不可写存储等都静默吞掉 */
  }
}

function normalize(raw: string | null): SchemePreference {
  if (raw === 'light' || raw === 'dark' || raw === 'auto') return raw
  return 'auto'
}

function readPreference(): SchemePreference {
  return normalize(readStorage(STORAGE_KEY))
}

function writePreference(pref: SchemePreference): void {
  writeStorage(STORAGE_KEY, pref)
}

function systemSchemeH5(): ColorScheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    // SSR / 不支持的浏览器：保持深色以兼容现有视觉
    return 'dark'
  }
  try {
    return window.matchMedia(DARK_MEDIA_QUERY).matches ? 'dark' : 'light'
  } catch {
    return 'dark'
  }
}

function systemSchemeMiniProgram(): ColorScheme {
  try {
    const info = Taro.getSystemInfoSync() as { theme?: string }
    if (info && info.theme === 'dark') return 'dark'
    if (info && info.theme === 'light') return 'light'
  } catch {
    /* silent */
  }
  // 默认按深色处理，符合项目主视觉
  return 'dark'
}

/**
 * 把当前主题同步应用到 root：
 *  - H5：写入 <html class="dark|light" data-theme="...">
 *    这样 Tailwind 的 @custom-variant dark (&:is(.dark *)) 立即生效，
 *    同时也方便 CSS 里用 [data-theme="light"] 这种属性选择器。
 *  - 小程序：尝试 setNavigationBarColor + setBackgroundColor 做 best-effort 调整，
 *    注意 page / 组件自身的 backgroundColor 不在全局热替换范围内。
 */
export function applySchemeToRoot(scheme: ColorScheme): void {
  if (typeof document !== 'undefined' && document.documentElement) {
    const root = document.documentElement
    root.classList.remove('dark', 'light')
    root.classList.add(scheme)
    root.setAttribute('data-theme', scheme)
  }

  // 导航栏/窗口背景色 API 仅小程序支持；H5 端调用会返回被拒绝的 Promise
  //（"暂时不支持 API"），同步 try/catch 无法捕获，会触发 unhandledrejection 报错浮层
  const isMiniApp = Taro.getEnv() === Taro.ENV_TYPE.WEAPP || Taro.getEnv() === Taro.ENV_TYPE.TT
  if (isMiniApp) {
    try {
      if (scheme === 'light') {
        Taro.setNavigationBarColor({
          frontColor: '#000000',
          backgroundColor: '#f1f5f9',
        }).catch(() => {})
        Taro.setBackgroundColor({
          backgroundColor: '#f1f5f9',
          backgroundColorTop: '#f1f5f9',
          backgroundColorBottom: '#f1f5f9',
        }).catch(() => {})
      } else {
        Taro.setNavigationBarColor({
          frontColor: '#ffffff',
          backgroundColor: '#0f172a',
        }).catch(() => {})
        Taro.setBackgroundColor({
          backgroundColor: '#0f172a',
          backgroundColorTop: '#0f172a',
          backgroundColorBottom: '#0f172a',
        }).catch(() => {})
      }
    } catch {
      /* 部分机型 API 异常时静默 */
    }
  }
}

/**
 * 监听系统主题变化（H5 only）。
 *
 * 返回的清理函数确保组件卸载或 env 切换时正确解绑。
 */
function watchSystemScheme(onChange: (scheme: ColorScheme) => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => undefined
  }
  const mql = window.matchMedia(DARK_MEDIA_QUERY)
  const handler = (event: MediaQueryListEvent) => {
    onChange(event.matches ? 'dark' : 'light')
  }

  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }

  // 旧版 Safari (< 14) 兼容
  const legacy = mql as unknown as {
    addListener?: (cb: (e: MediaQueryListEvent) => void) => void
    removeListener?: (cb: (e: MediaQueryListEvent) => void) => void
  }
  if (typeof legacy.addListener === 'function' && typeof legacy.removeListener === 'function') {
    legacy.addListener(handler)
    return () => legacy.removeListener?.(handler)
  }

  return () => undefined
}

/**
 * Hook：监听系统 `prefers-color-scheme`，结合用户偏好覆盖。
 *
 * - 启动时读 localStorage（'light' | 'dark' | 'auto'）初始化偏好。
 * - 'auto' 时返回当前系统值；'light' / 'dark' 时固定返回该值，忽略系统。
 * - 系统主题通过 matchMedia change 事件实时更新（仅 H5）。
 * - scheme 变化时自动同步到 <html> class / data-theme，小程序端 best-effort 调整导航栏。
 *
 * 返回字段：
 *  - scheme: 当前解析后的生效主题 ('light' | 'dark')
 *  - preference: 用户原始偏好（含 'auto'），用于设置页回显
 *  - setScheme: 修改偏好并同步到 localStorage
 */
export function useColorScheme(): {
  scheme: ColorScheme
  preference: SchemePreference
  setScheme: (next: ColorScheme | 'auto') => void
} {
  const [preference, setPreferenceState] = useState<SchemePreference>(() => readPreference())

  const [systemScheme, setSystemScheme] = useState<ColorScheme>(() =>
    isH5() ? systemSchemeH5() : systemSchemeMiniProgram(),
  )

  useEffect(() => {
    if (!isH5()) return
    return watchSystemScheme((next) => {
      setSystemScheme(next)
    })
  }, [])

  const scheme: ColorScheme =
    preference === 'light' || preference === 'dark' ? preference : systemScheme

  // scheme 变化时同步写到 root（仅在浏览器 / 真实 DOM 存在时生效）
  useEffect(() => {
    applySchemeToRoot(scheme)
  }, [scheme])

  const setScheme = useCallback((next: ColorScheme | 'auto') => {
    const normalized: SchemePreference = next
    setPreferenceState(normalized)
    writePreference(normalized)
  }, [])

  return { scheme, preference, setScheme }
}
