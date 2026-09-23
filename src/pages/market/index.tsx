import { View, Text } from '@tarojs/components'
import { useState, useEffect, useCallback } from 'react'
import Taro from '@tarojs/taro'
import { Network } from '@/network'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { VirtualList } from '@/components/ui/virtual-list'
import { Search, TrendingUp, TrendingDown, Star, TriangleAlert } from 'lucide-react-taro'
import { useStaleQuery } from '@/lib/use-stale-query'

interface MarketItem {
  symbol: string
  name: string
  price: number
  change24h: number
  changePercent: number
  volume24h: number
  high24h: number
  low24h: number
  isFavorite: boolean
}

const MARKET_STALE_MS = 30_000 // 30 秒视为 stale

/**
 * 行情页行高 + 视口高度估算
 *
 * - 行高 64px：紧凑、单行（symbol+price+涨跌%），符合 Taro 客户端单帧预算
 * - 视口 = windowHeight - navbar（~44px）- 搜索栏（~44px）- 表头（~28px）- tabBar（49px） ≈ windowHeight - 175
 * - 触底 stale 浮条时，UX 上一行高度（~32px）的位移由最外层 View 的 gap 自然吸收
 * - 首屏可见 ~10 行 + overscan=5（两侧）≈ 20 节点渲染；相比 5553 大幅瘦身
 *
 * 注意：
 *  - 移动端安全区差异（iPhone X 顶部刘海、底部 home indicator）由 Taro.getSystemInfoSync
 *    适配，navbar/tabBar 的实际高度按 best-effort 减下去
 */
const MARKET_ROW_HEIGHT = 64
const MARKET_LIST_HEADROOM_PX = 175

function calcMarketListHeight(): number {
  try {
    const info = Taro.getSystemInfoSync() as { windowHeight?: number; screenHeight?: number }
    const h = Number(info.windowHeight ?? info.screenHeight ?? 0)
    if (!Number.isFinite(h) || h <= 0) return 600
    return Math.max(360, Math.floor(h - MARKET_LIST_HEADROOM_PX))
  } catch {
    return 600
  }
}

const MarketPage = () => {
  const [tab, setTab] = useState('favorites')
  const [searchText, setSearchText] = useState('')
  // 行情列表容器高度；客户端首次挂载后通过 Taro.getSystemInfoSync 计算
  const [listHeight, setListHeight] = useState<number>(() => calcMarketListHeight())

  const {
    data: marketList,
    isStale,
    isLoading,
    isError,
    lastUpdatedAt,
    refetch,
  } = useStaleQuery<MarketItem[]>({
    cacheKey: 'market:list',
    fetcher: async () => {
      const res = await Network.request({ url: '/api/market/list' })
      const data = res.data?.data
      return Array.isArray(data) ? (data) : []
    },
    staleTime: MARKET_STALE_MS,
    cacheTime: 5 * 60_000,
  })

  const list: MarketItem[] = marketList ?? []

  const filteredList = list.filter((item) => {
    const matchSearch =
      !searchText ||
      item.symbol.toLowerCase().includes(searchText.toLowerCase()) ||
      item.name.toLowerCase().includes(searchText.toLowerCase())
    if (tab === 'favorites') return matchSearch && item.isFavorite
    if (tab === 'gainers') return matchSearch && item.changePercent > 0
    if (tab === 'losers') return matchSearch && item.changePercent < 0
    return matchSearch
  })

  const sortedList = [...filteredList].sort((a, b) => {
    if (tab === 'gainers') return b.changePercent - a.changePercent
    if (tab === 'losers') return a.changePercent - b.changePercent
    return 0
  })

  // 挂载后用真实屏幕尺寸更新一次列表高度（navbar / status bar 差异）
  useEffect(() => {
    setListHeight(calcMarketListHeight())
  }, [])

  /**
   * 触底回调 —— 当前接口一次性返回 5553 只，没有分页。
   * 这里作为接入点保留，offscreen 滚动触底时触发空跑；
   * 后续对接分页时替换为真实加载逻辑即可。
   */
  const handleReachEnd = useCallback(() => {
    // no-op：保留接口；分页接口接入后在此触发下一页 fetcher
  }, [])

  const formatVolume = (val: number) => {
    if (val >= 1e9) return `${(val / 1e9).toFixed(1)}B`
    if (val >= 1e6) return `${(val / 1e6).toFixed(1)}M`
    if (val >= 1e3) return `${(val / 1e3).toFixed(1)}K`
    return val.toFixed(0)
  }

  const formatAge = (ts: number | null): string => {
    if (ts === null) return ''
    const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000))
    if (diffSec < 60) return `${diffSec} 秒`
    const min = Math.floor(diffSec / 60)
    return `${min} 分钟`
  }

  /**
   * 单行渲染 —— VirtualList 对每条可见数据调用一次。
   *
   * 行布局：symbol 标签｜最新价｜24h 涨跌（badge）｜24h 成交额
   * 高 64px（与 VirtualList 的 itemHeight 严格一致）
   *
   * 注意：作为函数 / 闭包定义在组件内时，每次渲染会创建新引用。
   * 当前实现里 VirtualList 用 index 作为 key（见 itemKey 的默认逻辑），
   * 因此 renderItem 引用变化不会触发 React 重新挂载行节点，
   * 触发的只是 props 变化上的有限重渲染。
   */
  const renderMarketRow = useCallback((item: MarketItem) => {
    return (
      <View className="flex flex-row items-center justify-between px-4 py-3 border-b border-slate-800">
        <View className="flex flex-row items-center gap-2 flex-1">
          {item.isFavorite ? (
            <Star size={12} color="#f59e0b" />
          ) : (
            <View className="w-3" />
          )}
          <View className="flex flex-col gap-1">
            <View className="flex flex-row items-center gap-1">
              <Text className="block text-sm font-medium text-slate-100">
                {item.symbol}
              </Text>
              {item.changePercent > 0 ? (
                <TrendingUp size={10} color="#22c55e" />
              ) : item.changePercent < 0 ? (
                <TrendingDown size={10} color="#ef4444" />
              ) : null}
            </View>
            <Text className="block text-xs text-slate-500">{item.name}</Text>
          </View>
        </View>
        <Text className="block text-sm font-medium text-slate-100 text-right flex-1 tabular-nums">
          ${item.price.toLocaleString()}
        </Text>
        <View className="flex items-end flex-1">
          <Badge
            className={`text-xs tabular-nums ${
              item.changePercent > 0
                ? 'bg-green-500 bg-opacity-20 text-green-400 border-green-500 border-opacity-30'
                : item.changePercent < 0
                  ? 'bg-red-500 bg-opacity-20 text-red-400 border-red-500 border-opacity-30'
                  : 'bg-slate-700 text-slate-400 border-slate-600'
            }`}
          >
            {item.changePercent >= 0 ? '+' : ''}
            {item.changePercent.toFixed(2)}%
          </Badge>
        </View>
        <Text className="block text-xs text-slate-400 text-right flex-1 tabular-nums">
          {formatVolume(item.volume24h)}
        </Text>
      </View>
    )
  }, [])

  // 数据更新 / tab 切换时给每行一个稳定 key（symbol 优先）
  const rowKey = useCallback((item: MarketItem) => item.symbol, [])

  return (
    <View className="flex flex-col h-full bg-slate-900">
      {/* 搜索栏 */}
      <View className="px-4 pt-3 pb-2">
        <View className="flex flex-row items-center gap-2 bg-slate-800 rounded-lg px-3 py-2">
          <Search size={16} color="#64748b" />
          <Input
            className="flex-1 bg-transparent text-sm text-slate-100 border-none"
            placeholder="搜索币种名称或代号..."
            placeholderStyle="color: #64748b"
            value={searchText}
            onInput={(e) => setSearchText(e.detail.value)}
          />
        </View>
      </View>

      {/* Stale / 离线兜底提示：网络拉取失败或数据超 staleTime 时显示 */}
      {lastUpdatedAt !== null && (isStale || isError) ? (
        <View
          className="mx-4 mb-2 flex flex-row items-center justify-between gap-2 rounded-lg bg-amber-500 bg-opacity-10 border border-amber-500 border-opacity-30 px-3 py-2"
          onClick={() => {
            refetch()
          }}
        >
          <View className="flex flex-row items-center gap-2 flex-1">
            <TriangleAlert size={14} color="#f59e0b" />
            <Text className="block text-xs text-amber-400">
              {isError
                ? `行情拉取失败，展示 ${formatAge(lastUpdatedAt)}前的数据`
                : `行情已 ${formatAge(lastUpdatedAt)} 未更新`}
            </Text>
          </View>
          <Text className="block text-xs text-amber-300 font-medium">点此重试</Text>
        </View>
      ) : null}

      {/* Tab 切换 */}
      <Tabs value={tab} onValueChange={setTab} className="flex-1">
        <View className="px-4">
          <TabsList className="bg-slate-800">
            <TabsTrigger value="favorites">自选</TabsTrigger>
            <TabsTrigger value="all">全部</TabsTrigger>
            <TabsTrigger value="gainers">涨幅榜</TabsTrigger>
            <TabsTrigger value="losers">跌幅榜</TabsTrigger>
          </TabsList>
        </View>

        <TabsContent value={tab} className="flex-1">
          {/* 表头：固定在列表区域顶部，不进入虚拟滚动 */}
          <View className="flex flex-row items-center justify-between px-4 py-2 border-b border-slate-700">
            <Text className="block text-xs text-slate-500 flex-1">币种</Text>
            <Text className="block text-xs text-slate-500 text-right flex-1">
              最新价
            </Text>
            <Text className="block text-xs text-slate-500 text-right flex-1">
              24h涨跌
            </Text>
            <Text className="block text-xs text-slate-500 text-right flex-1">
              24h成交额
            </Text>
          </View>

          {isLoading ? (
            <View className="flex items-center justify-center py-12">
              <Text className="block text-sm text-slate-500">加载中...</Text>
            </View>
          ) : sortedList.length === 0 ? (
            <View className="flex items-center justify-center py-12">
              <Text className="block text-sm text-slate-500">暂无数据</Text>
            </View>
          ) : (
            <VirtualList<MarketItem>
              data={sortedList}
              itemHeight={MARKET_ROW_HEIGHT}
              height={listHeight}
              overscan={5}
              endThreshold={200}
              renderItem={renderMarketRow}
              itemKey={rowKey}
              onReachEnd={handleReachEnd}
              style={{ width: '100%' }}
            />
          )}
        </TabsContent>
      </Tabs>
    </View>
  )
}

export default MarketPage
