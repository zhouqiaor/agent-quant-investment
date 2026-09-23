import { create } from 'zustand'
import Taro from '@tarojs/taro'
import { Network } from '@/network'

interface NotificationState {
  unreadCount: number
  loading: boolean
  refresh: () => Promise<void>
  decrement: () => void
  reset: () => void
}

/**
 * 通知未读数 store
 * - App 启动时 refresh 一次
 * - onShow 时 refresh
 * - 60s 轮询定时器
 * - 标记单条已读时 decrement
 */
export const useNotificationStore = create<NotificationState>((set, get) => ({
  unreadCount: 0,
  loading: false,

  refresh: async () => {
    if (get().loading) return
    set({ loading: true })
    try {
      const res = await Network.request({ url: '/api/notifications/unread-count' })
      const count = (res.data?.data?.count ?? 0) as number
      set({ unreadCount: count, loading: false })
    } catch (e) {
      console.error('[notification store] refresh error', e)
      set({ loading: false })
    }
  },

  decrement: () => {
    set((s) => ({ unreadCount: Math.max(0, s.unreadCount - 1) }))
  },

  reset: () => {
    set({ unreadCount: 0 })
  },
}))

/**
 * 初始化通知 store：注册 App onShow + 60s 轮询
 * 应在 app.tsx 中调用一次
 */
export function initNotificationPolling(): () => void {
  const store = useNotificationStore.getState()
  store.refresh()
  const timer = setInterval(() => {
    store.refresh()
  }, 60_000)
  return () => clearInterval(timer)
}

/**
 * 尝试调用 Taro.setTabBarBadge（在小程序端生效），失败静默降级
 */
export function applyTabBarBadge(count: number): void {
  if (count <= 0) {
    try {
      Taro.removeTabBarBadge({ index: 3 }) // "我的" TabBar 槽位 index
    } catch (e) {
      /* H5 等环境不支持，静默 */
    }
    return
  }
  try {
    Taro.setTabBarBadge({
      index: 3,
      text: count > 99 ? '99+' : String(count),
    })
  } catch (e) {
    /* 静默 */
  }
}