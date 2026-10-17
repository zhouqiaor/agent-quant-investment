import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useState, useCallback, useEffect } from 'react'
import { Network } from '@/network'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Bell, ArrowUpRight, ArrowDownRight, Info } from 'lucide-react-taro'

interface NotificationItem {
  id: string
  title: string
  body: string
  read: boolean
  type: 'BUY' | 'SELL'
  symbol: string
  time: string
}

type TabKey = 'all' | 'unread'
type TypeFilter = 'ALL' | 'BUY' | 'SELL'

const PAGE_SIZE = 20

export default function NotificationsPage() {
  const [list, setList] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<TabKey>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  const load = useCallback(
    async (opts: { reset?: boolean } = {}) => {
      setLoading(true)
      try {
        const params: Record<string, string | number> = {
          limit: PAGE_SIZE * (opts.reset ? 1 : page),
        }
        if (tab === 'unread') params.unread = 'true'
        const res = await Network.request({
          url: '/api/notifications',
          data: params,
        })
        const all = (res.data?.data ?? []) as NotificationItem[]
        const filtered = typeFilter === 'ALL' ? all : all.filter((n) => n.type === typeFilter)
        setList(filtered)
        setHasMore(all.length >= PAGE_SIZE * page)
        if (opts.reset) setPage(1)
      } catch (e) {
        console.error('[Notifications] load error', e)
        setList([])
      } finally {
        setLoading(false)
      }
    },
    [tab, typeFilter, page],
  )

  useEffect(() => {
    load({ reset: true })
  }, [tab, typeFilter, load])

  useDidShow(() => {
    // 每次进入页面刷新一次
    load({ reset: true })
  })

  usePullDownRefresh(async () => {
    await load({ reset: true })
    Taro.stopPullDownRefresh()
  })

  const handleMarkRead = async (id: string) => {
    try {
      await Network.request({
        url: `/api/notifications/${id}/read`,
        method: 'POST',
      })
      setList((cur) => cur.map((n) => (n.id === id ? { ...n, read: true } : n)))
    } catch (e) {
      console.error('[Notifications] mark read error', e)
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await Network.request({
        url: '/api/notifications/read-all',
        method: 'POST',
      })
      setList((cur) => cur.map((n) => ({ ...n, read: true })))
      Taro.showToast({ title: '已全部标为已读', icon: 'success' })
    } catch (e) {
      console.error('[Notifications] mark all read error', e)
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }

  const handleClickItem = (item: NotificationItem) => {
    if (!item.read) handleMarkRead(item.id)
    // 跳转到该 symbol 的持仓详情（如有）
    if (item.symbol) {
      Taro.navigateTo({ url: `/pages/position/index?symbol=${item.symbol}` })
    }
  }

  const handleLoadMore = async () => {
    if (loading || !hasMore) return
    setPage((p) => p + 1)
    await load()
  }

  const iconFor = (n: NotificationItem) => {
    if (n.type === 'BUY') return <ArrowUpRight size={20} color="#22c55e" />
    if (n.type === 'SELL') return <ArrowDownRight size={20} color="#ef4444" />
    return <Info size={20} color="#94a3b8" />
  }

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso)
      const now = Date.now()
      const diff = now - d.getTime()
      if (diff < 60_000) return '刚刚'
      if (diff < 3600_000) return `${Math.floor(diff / 60_000)}分钟前`
      if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}小时前`
      return d.toLocaleDateString('zh-CN')
    } catch {
      return iso
    }
  }

  const empty = !loading && list.length === 0

  return (
    <View className="flex flex-col h-full bg-slate-900">
      {/* 顶部 Tab */}
      <View className="flex flex-row px-4 pt-3 pb-2 gap-2 border-b border-slate-700">
        <View
          className={`flex-1 py-2 rounded-lg text-center ${tab === 'all' ? 'bg-slate-700' : 'bg-slate-800'}`}
          onClick={() => setTab('all')}
        >
          <Text className={`block text-sm ${tab === 'all' ? 'text-white font-medium' : 'text-slate-400'}`}>全部</Text>
        </View>
        <View
          className={`flex-1 py-2 rounded-lg text-center ${tab === 'unread' ? 'bg-slate-700' : 'bg-slate-800'}`}
          onClick={() => setTab('unread')}
        >
          <Text className={`block text-sm ${tab === 'unread' ? 'text-white font-medium' : 'text-slate-400'}`}>未读</Text>
        </View>
        <Button
          size="sm"
          className="h-9 px-3 bg-slate-700 text-slate-200"
          onClick={handleMarkAllRead}
        >
          <Text className="text-xs">全部已读</Text>
        </Button>
      </View>

      {/* 类型筛选 Chips */}
      <View className="flex flex-row gap-2 px-4 py-2 overflow-x-auto">
        {(['ALL', 'BUY', 'SELL'] as TypeFilter[]).map((t) => (
          <View
            key={t}
            className={`px-3 py-1 rounded-full ${
              typeFilter === t ? 'bg-emerald-500' : 'bg-slate-800 border border-slate-700'
            }`}
            onClick={() => setTypeFilter(t)}
          >
            <Text className={`block text-xs ${typeFilter === t ? 'text-white' : 'text-slate-400'}`}>
              {t === 'ALL' ? '全部类型' : t === 'BUY' ? '买入信号' : '卖出信号'}
            </Text>
          </View>
        ))}
      </View>

      {/* 列表 */}
      <ScrollView
        scrollY
        className="flex-1 px-4 smooth-scroll"
        onScrollToLower={handleLoadMore}
        lowerThreshold={50}
      >
        {empty ? (
          <View className="flex flex-col items-center justify-center py-20">
            <Bell size={48} color="#475569" />
            <Text className="block text-sm text-slate-500 mt-4">
              还没有{tab === 'unread' ? '未读' : ''}信号通知
            </Text>
            <Text className="block text-xs text-slate-600 mt-2 text-center">
              开启自动交易后，策略信号会推送到这里
            </Text>
            <View
              className="mt-6 px-6 py-2 bg-emerald-500 rounded-lg"
              onClick={() => Taro.navigateTo({ url: '/pages/paper-trading/index' })}
            >
              <Text className="block text-sm text-white">前往设置</Text>
            </View>
          </View>
        ) : (
          list.map((n) => (
            <Card
              key={n.id}
              className={`bg-slate-800 border-slate-700 rounded-xl mb-3 ${
                n.read ? 'opacity-60' : ''
              }`}
              onClick={() => handleClickItem(n)}
            >
              <CardContent className="p-4">
                <View className="flex flex-row items-start gap-3">
                  <View className="flex-shrink-0 mt-1">{iconFor(n)}</View>
                  <View className="flex-1 min-w-0">
                    <View className="flex flex-row items-center justify-between mb-1">
                      <Text className="block text-sm font-medium text-white flex-1 truncate">
                        {n.title}
                      </Text>
                      {!n.read && (
                        <View className="w-2 h-2 rounded-full bg-emerald-500 ml-2 flex-shrink-0" />
                      )}
                    </View>
                    <Text className="block text-xs text-slate-400 leading-relaxed mb-2">
                      {n.body}
                    </Text>
                    <Text className="block text-xs text-slate-500">{formatTime(n.time)}</Text>
                  </View>
                </View>
              </CardContent>
            </Card>
          ))
        )}
        {hasMore && list.length > 0 && (
          <View className="flex items-center justify-center py-4">
            <Text className="block text-xs text-slate-500">{loading ? '加载中...' : '上拉加载更多'}</Text>
          </View>
        )}
        <View style={{ height: '40px' }} />
      </ScrollView>
    </View>
  )
}