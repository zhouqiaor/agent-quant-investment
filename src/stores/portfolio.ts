/**
 * 组合管理 Zustand store
 *
 * - loadSummary：GET /api/portfolio/summary
 * - toggleStrategy：POST /api/portfolio/strategy/toggle，乐观更新 running（及
 *   maxPositionPct），失败回滚 + toast
 * - createPortfolio：POST /api/portfolio/create
 *
 * 类型契约见 src/lib/portfolio.ts（对齐后端 PortfolioService.getSummary）。
 */
import { create } from 'zustand'
import Taro from '@tarojs/taro'
import { Network } from '@/network'
import type { PortfolioInfo, PortfolioSummary } from '@/lib/portfolio'

export interface PortfolioState {
  summary: PortfolioSummary | null
  loading: boolean
  error: string | null

  loadSummary: () => Promise<PortfolioSummary | null>
  toggleStrategy: (
    strategyId: string,
    running: boolean,
    maxPositionPct?: number,
  ) => Promise<void>
  createPortfolio: (name: string) => Promise<PortfolioInfo | null>
  reset: () => void
}

function unwrap<T>(res: { data?: { data?: T } }): T | null {
  return res.data?.data ?? null
}

export const usePortfolioStore = create<PortfolioState>((set, get) => ({
  summary: null,
  loading: false,
  error: null,

  loadSummary: async () => {
    set({ loading: true, error: null })
    try {
      const res = await Network.request({ url: '/api/portfolio/summary' })
      const data = unwrap<PortfolioSummary>(res)
      set({ summary: data, loading: false })
      return data
    } catch (e) {
      console.error('[portfolio] loadSummary error', e)
      const msg = e instanceof Error ? e.message : '加载组合失败'
      set({ loading: false, error: msg })
      return null
    }
  },

  toggleStrategy: async (strategyId, running, maxPositionPct) => {
    const prev = get().summary
    // 乐观更新：先写本地状态
    if (prev) {
      const next: PortfolioSummary = {
        ...prev,
        strategies: prev.strategies.map((s) =>
          s.strategyId === strategyId
            ? {
                ...s,
                running,
                ...(maxPositionPct !== undefined ? { maxPositionPct } : {}),
              }
            : s,
        ),
      }
      set({ summary: next })
    }
    try {
      await Network.request({
        url: '/api/portfolio/strategy/toggle',
        method: 'POST',
        data: {
          strategyId,
          running,
          ...(maxPositionPct !== undefined ? { maxPositionPct } : {}),
        },
      })
      Taro.showToast({ title: running ? '策略已启动' : '策略已停止', icon: 'none' })
    } catch (e) {
      console.error('[portfolio] toggleStrategy error', e)
      // 回滚 + toast
      set({ summary: prev })
      Taro.showToast({ title: '操作失败，已恢复', icon: 'none' })
    }
  },

  createPortfolio: async (name) => {
    const trimmed = name.trim()
    if (!trimmed) return null
    try {
      const res = await Network.request({
        url: '/api/portfolio/create',
        method: 'POST',
        data: { name: trimmed },
      })
      const data = unwrap<PortfolioInfo>(res)
      return data
    } catch (e) {
      console.error('[portfolio] createPortfolio error', e)
      Taro.showToast({ title: '创建组合失败', icon: 'none' })
      return null
    }
  },

  reset: () => {
    set({ summary: null, loading: false, error: null })
  },
}))
