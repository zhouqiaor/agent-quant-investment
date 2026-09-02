import { View, Text, ScrollView } from '@tarojs/components'
import { useState, useEffect, useRef, useCallback } from 'react'
import Taro from '@tarojs/taro'
import { Network } from '@/network'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Wallet,
  Activity,
  Shield,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Bell,
  Rocket,
  Eye,
  RefreshCw,
} from 'lucide-react-taro'

interface WatchItem {
  symbol: string
  name: string
  enabled: boolean
}

interface PositionItem {
  symbol: string
  name: string
  quantity: number
  avgCost: number
  currentPrice: number
  marketValue: number
  pnl: number
  pnlRate: number
}

interface AccountInfo {
  cash: number
  totalValue: number
  totalPnl: number
  totalPnlRate: number
  isRunning: boolean
  positions: PositionItem[]
}

interface NotifyItem {
  id: string
  title: string
  content?: string
  type?: string
  createdAt?: number
}

interface StatusInfo {
  configured: boolean
  config: { initialCapital?: number; strategyId?: string; autoTrade?: boolean } | null
  totalValue: number
  totalPnl: number
  totalPnlRate: number
  cash: number
  positions: PositionItem[]
  watchedEnabled: number
  isRunning: boolean
}

const POLL_INTERVAL = 6000

const IndexPage = () => {
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<StatusInfo | null>(null)
  const [watchlist, setWatchlist] = useState<WatchItem[]>([])
  const [notifications, setNotifications] = useState<NotifyItem[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [lastTickAt, setLastTickAt] = useState<number>(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const formatMoney = (val: number) => {
    if (Math.abs(val) >= 10000) return `${(val / 10000).toFixed(2)}万`
    return val.toFixed(2)
  }

  const fmtPct = (val: number) => `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`
  const fmtPnl = (val: number) => `${val >= 0 ? '+' : ''}${formatMoney(val)}`

  const [showTour, setShowTour] = useState(false)
  const [tourStep, setTourStep] = useState(0)

  // 首次配置完成后展示功能 Tour
  useEffect(() => {
    if (status?.configured && !loading) {
      const hasSeen = Taro.getStorageSync('tour_seen_v2')
      if (!hasSeen) {
        setShowTour(true)
      }
    }
  }, [status?.configured, loading])

  const closeTour = () => {
    setShowTour(false)
    Taro.setStorageSync('tour_seen_v2', '1')
  }

  /** 拉取关注列表启用标的的真实行情，驱动后端实时重估+信号引擎 */
  const tickOnce = useCallback(async () => {
    try {
      setRefreshing(true)
      const wlRes = await Network.request({ url: '/api/stock/watchlist' })
      const wl: WatchItem[] = Array.isArray(wlRes.data?.data) ? wlRes.data.data : []
      setWatchlist(wl)

      const statusRes = await Network.request({ url: '/api/beta/status' })
      const st = statusRes.data?.data
      setStatus(st)
      if (!st?.configured) {
        setLoading(false)
        return
      }

      // 启用标的 → 拉真实行情 → 后端重估 + 信号检测
      const enabled = wl.filter((w) => w.enabled)
      if (enabled.length > 0) {
        const marketRes = await Network.request({ url: '/api/market/list' })
        const allQuotes: Array<{ symbol: string; price: number; changePercent: number }> = Array.isArray(
          marketRes.data?.data,
        )
          ? marketRes.data.data
          : []
        const enabledSet = new Set(enabled.map((w) => w.symbol))
        const quotes = allQuotes.filter((q) => enabledSet.has(q.symbol))
        const marketData = quotes.map((q) => ({
          symbol: q.symbol,
          price: q.price,
          changePercent: q.changePercent ?? 0,
        }))
        if (marketData.length > 0) {
          const tickRes = await Network.request({
            url: '/api/beta/tick',
            method: 'POST',
            data: { marketData },
          })
          console.log('beta tick:', tickRes.data)
        }
      }

      // tick 后再拉最新账户收益
      const statusRes2 = await Network.request({ url: '/api/beta/status' })
      setStatus(statusRes2.data?.data)

      const notifyRes = await Network.request({ url: '/api/notifications?limit=5' })
      const notes = notifyRes.data?.data
      setNotifications(Array.isArray(notes) ? notes : Array.isArray(notes?.items) ? notes.items : [])
      setLastTickAt(Date.now())
    } catch (e) {
      console.error('tickOnce error:', e)
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    tickOnce()
    timerRef.current = setInterval(tickOnce, POLL_INTERVAL)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [tickOnce])

  const account: AccountInfo | null =
    status?.configured && status
      ? {
          cash: status.cash ?? 0,
          totalValue: status.totalValue ?? 0,
          totalPnl: status.totalPnl ?? 0,
          totalPnlRate: status.totalPnlRate ?? 0,
          isRunning: !!status.isRunning,
          positions: status.positions ?? [],
        }
      : null

  const fmtTime = (ts?: number) => {
    if (!ts) return ''
    const d = new Date(ts)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  // ============ 未配置：内测引导 ============
  if (!loading && status && !status.configured) {
    return (
      <ScrollView scrollY className="h-full bg-slate-900 smooth-scroll hide-scrollbar tabbar-page">
        <View className="px-4 pb-8 pt-16 flex flex-col gap-6 items-center">
          <View className="flex items-center justify-center w-20 h-20 rounded-2xl bg-emerald-500 bg-opacity-10">
            <Rocket size={40} color="#10b981" />
          </View>
          <View className="flex flex-col gap-2 items-center">
            <Text className="block text-xl font-bold text-slate-100">开始内测投资体验</Text>
            <Text className="block text-sm text-slate-500 text-center">
              {'三步从零开始：设定投入金额、关注股票、配置策略\nAI Agent 自动监听实时行情并模拟交易'}
            </Text>
          </View>
          <Button
            className="bg-emerald-500 text-slate-900 rounded-xl px-8"
            onClick={() => Taro.navigateTo({ url: '/pages/onboarding/index' })}
          >
            <View className="flex flex-row items-center gap-2">
              <Zap size={16} color="#0f172a" />
              <Text className="block text-base font-semibold">立即开始</Text>
            </View>
          </Button>
        </View>
      </ScrollView>
    )
  }

  const pnlColor = (val: number) => (val >= 0 ? 'text-red-500' : 'text-green-500')

  return (
    <ScrollView
      scrollY
      className="h-full bg-slate-900 smooth-scroll hide-scrollbar tabbar-page"
    >
      <View className="px-4 pb-8 pt-4 flex flex-col gap-4">
        {/* 头部：标题 + 实时状态 */}
        <View className="flex flex-row items-center justify-between">
          <View className="flex flex-col gap-1">
            <Text className="block text-lg font-bold text-slate-100">实时看盘</Text>
            <Text className="block text-xs text-slate-500">
              {account?.isRunning ? `模拟投资运行中 · ${watchlist.filter((w) => w.enabled).length} 只启用` : '已停止'}
            </Text>
          </View>
          <View className="flex flex-row items-center gap-2">
            {refreshing && <RefreshCw size={12} color="#10b981" />}
            <Text className="block text-xs text-slate-500">
              {lastTickAt ? `更新 ${fmtTime(lastTickAt)}` : '连接中...'}
            </Text>
          </View>
        </View>

        {/* 模拟盘标识胶囊 */}
        <View className="flex flex-row items-center justify-center mb-3">
          <View className="flex flex-row items-center gap-2 px-3 py-1 rounded-full bg-amber-500 bg-opacity-10 border border-amber-500 border-opacity-30">
            <Shield size={12} color="#fbbf24" />
            <Text className="block text-xs font-medium text-amber-400">
              模拟交易中 · 不涉及真实资金
            </Text>
          </View>
        </View>

        {/* 资产总览 */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-5">
            <View className="flex flex-col gap-3">
              <View className="flex flex-row items-center gap-2">
                <Wallet size={16} color="#94a3b8" />
                <Text className="block text-xs text-slate-400">模拟账户总资产</Text>
              </View>
              {loading || !account ? (
                <Skeleton className="h-9 w-40 bg-slate-700" />
              ) : (
                <Text className="block text-3xl font-bold text-slate-100 tabular-nums">
                  {formatMoney(account.totalValue)}
                </Text>
              )}
              <View className="flex flex-row gap-4 mt-1">
                <View className="flex flex-1 flex-row items-center justify-between bg-slate-900 rounded-lg p-3">
                  <View className="flex flex-col gap-1">
                    <Text className="block text-xs text-slate-500">总收益</Text>
                    <Text className={`block text-sm font-semibold tabular-nums ${account ? pnlColor(account.totalPnl) : 'text-slate-400'}`}>
                      {account ? `${fmtPnl(account.totalPnl)} (${fmtPct(account.totalPnlRate)})` : '--'}
                    </Text>
                  </View>
                  {account && account.totalPnl >= 0 ? (
                    <ArrowUpRight size={16} color="#ef4444" />
                  ) : (
                    <ArrowDownRight size={16} color="#22c55e" />
                  )}
                </View>
                <View className="flex flex-1 flex-row items-center justify-between bg-slate-900 rounded-lg p-3">
                  <View className="flex flex-col gap-1">
                    <Text className="block text-xs text-slate-500">可用现金</Text>
                    <Text className="block text-sm font-semibold tabular-nums text-slate-100">
                      {account ? formatMoney(account.cash) : '--'}
                    </Text>
                  </View>
                  <Activity size={16} color="#3b82f6" />
                </View>
              </View>
            </View>
          </CardContent>
        </Card>

        {/* 持仓明细（实时价格/浮盈） */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <View className="flex flex-col gap-3">
              <View className="flex flex-row items-center gap-2">
                <Eye size={14} color="#10b981" />
                <Text className="block text-sm font-semibold text-slate-100">持仓明细</Text>
              </View>
              {!account || account.positions.length === 0 ? (
                <View className="bg-slate-900 rounded-lg p-4">
                  <Text className="block text-xs text-slate-500 text-center">
                    暂无持仓 · 信号触发后将自动模拟买入
                  </Text>
                </View>
              ) : (
                <View className="flex flex-col gap-2">
                  {account.positions.map((p) => (
                    <View key={p.symbol} className="flex flex-row items-center justify-between bg-slate-900 rounded-lg px-3 py-2">
                      <View className="flex flex-col gap-1">
                        <View className="flex flex-row items-center gap-2">
                          <Text className="block text-sm text-slate-100">{p.name || p.symbol}</Text>
                          <Text className="block text-xs text-slate-500">{p.symbol}</Text>
                        </View>
                        <Text className="block text-xs text-slate-500">
                          {p.quantity}股 · 成本 {p.avgCost?.toFixed?.(2) ?? p.avgCost} · 市值 {formatMoney(p.marketValue)}
                        </Text>
                      </View>
                      <View className="flex flex-col gap-1 items-end">
                        <Text className="block text-sm font-semibold tabular-nums text-slate-100">
                          {p.currentPrice?.toFixed?.(2) ?? p.currentPrice}
                        </Text>
                        <Text className={`block text-xs tabular-nums ${pnlColor(p.pnl)}`}>
                          {fmtPnl(p.pnl)} ({fmtPct(p.pnlRate)})
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </CardContent>
        </Card>

        {/* 首次功能引导 Tour */}
        {showTour && status?.configured && (
          <View className="fixed inset-0 z-50 pointer-events-none">
            <View className="absolute inset-0 bg-black bg-opacity-70" />
            <View className="absolute top-24 left-4 right-4 pointer-events-auto">
              <Card className="bg-slate-800 border-emerald-500 border-opacity-60 shadow-xl">
                <CardContent className="p-4">
                  <View className="flex flex-row items-center gap-2 mb-2">
                    <Badge className="bg-emerald-500 bg-opacity-20 text-emerald-400 border-emerald-500 border-opacity-40">
                      第 {tourStep + 1} 步 / 共 3 步
                    </Badge>
                    <Text
                      className="block text-xs text-slate-400 ml-auto"
                      onClick={closeTour}
                    >
                      跳过
                    </Text>
                  </View>
                  {tourStep === 0 && (
                    <>
                      <Text className="block text-base font-bold text-emerald-400 mb-1">
                        实时资产总览
                      </Text>
                      <Text className="block text-sm text-slate-300 leading-relaxed">
                        顶部卡片展示总资产、今日盈亏和收益率，每 6 秒自动刷新。
                      </Text>
                    </>
                  )}
                  {tourStep === 1 && (
                    <>
                      <Text className="block text-base font-bold text-emerald-400 mb-1">
                        持仓明细
                      </Text>
                      <Text className="block text-sm text-slate-300 leading-relaxed">
                        点进单只股票查看成本、浮盈浮亏，支持手动加仓、减仓、清仓。
                      </Text>
                    </>
                  )}
                  {tourStep === 2 && (
                    <>
                      <Text className="block text-base font-bold text-emerald-400 mb-1">
                        底部四大模块
                      </Text>
                      <Text className="block text-sm text-slate-300 leading-relaxed">
                        首页看盘、行情选股、策略配置、我的设置，按需切换。
                      </Text>
                    </>
                  )}
                  <View className="flex flex-row gap-2 mt-4">
                    {tourStep > 0 && (
                      <Button
                        className="flex-1 h-8 bg-slate-700 text-slate-200"
                        variant="secondary"
                        onClick={() => setTourStep(tourStep - 1)}
                      >
                        <Text className="text-sm">上一步</Text>
                      </Button>
                    )}
                    <Button
                      className="flex-1 h-8 bg-emerald-500 text-white"
                      onClick={() => {
                        if (tourStep < 2) {
                          setTourStep(tourStep + 1)
                        } else {
                          closeTour()
                        }
                      }}
                    >
                      <Text className="text-sm font-medium">
                        {tourStep < 2 ? '下一步' : '开始体验'}
                      </Text>
                    </Button>
                  </View>
                </CardContent>
              </Card>
            </View>
          </View>
        )}

        {/* 信号与通知 */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <View className="flex flex-col gap-3">
              <View className="flex flex-row items-center gap-2">
                <Bell size={14} color="#facc15" />
                <Text className="block text-sm font-semibold text-slate-100">Agent 信号通知</Text>
                {status?.config?.autoTrade && (
                  <Badge className="bg-emerald-500 bg-opacity-20 text-emerald-400">
                    <Text className="block text-[10px]">自动交易开启</Text>
                  </Badge>
                )}
              </View>
              {notifications.length === 0 ? (
                <View className="bg-slate-900 rounded-lg p-4">
                  <Text className="block text-xs text-slate-500 text-center">
                    暂无信号 · 监听引擎运行中，触发后将实时推送
                  </Text>
                </View>
              ) : (
                <View className="flex flex-col gap-2">
                  {notifications.map((n) => (
                    <View key={n.id} className="flex flex-row items-start justify-between bg-slate-900 rounded-lg px-3 py-2 gap-2">
                      <View className="flex flex-col gap-1 flex-1">
                        <Text className="block text-xs font-medium text-slate-100">{n.title}</Text>
                        {n.content && <Text className="block text-xs text-slate-500">{n.content}</Text>}
                      </View>
                      {n.createdAt && <Text className="block text-[10px] text-slate-600">{fmtTime(n.createdAt)}</Text>}
                    </View>
                  ))}
                </View>
              )}
            </View>
          </CardContent>
        </Card>

        {/* 快捷入口 */}
        <View className="flex flex-row gap-2">
          <Button
            variant="outline"
            className="flex-1 bg-slate-800 border-slate-600 text-slate-300 rounded-xl"
            onClick={() => Taro.navigateTo({ url: '/pages/backtest/index' })}
          >
            <Text className="block text-xs">区间回测</Text>
          </Button>
          <Button
            variant="outline"
            className="flex-1 bg-slate-800 border-slate-600 text-slate-300 rounded-xl"
            onClick={() => Taro.navigateTo({ url: '/pages/paper-trading/index' })}
          >
            <Text className="block text-xs">交易明细</Text>
          </Button>
          <Button
            variant="outline"
            className="flex-1 bg-slate-800 border-slate-600 text-slate-300 rounded-xl"
            onClick={() => Taro.navigateTo({ url: '/pages/onboarding/index' })}
          >
            <Text className="block text-xs">重新配置</Text>
          </Button>
        </View>
      </View>
    </ScrollView>
  )
}

export default IndexPage
