import { View, Text, ScrollView } from '@tarojs/components'
import { useState, useEffect, useCallback } from 'react'
import Taro from '@tarojs/taro'
import { Network } from '@/network'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search, TrendingUp, TrendingDown, Star, Plus } from 'lucide-react-taro'

interface MarketItem {
  symbol: string
  name: string
  price: number
  change24h?: number
  changePercent: number
  volume24h?: number
  high24h?: number
  low24h?: number
  volume?: number
  isFavorite: boolean
  isCustom?: boolean
  industry?: string
}

const MarketPage = () => {
  const [tab, setTab] = useState('favorites')
  const [searchText, setSearchText] = useState('')
  const [marketList, setMarketList] = useState<MarketItem[]>([])
  const [searchResults, setSearchResults] = useState<MarketItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchLoading, setSearchLoading] = useState(false)
  const [favoriteSymbols, setFavoriteSymbols] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadMarket()
  }, [])

  const loadMarket = async () => {
    try {
      setLoading(true)
      // 并行加载市场列表和自选列表
      const [marketRes, watchRes] = await Promise.all([
        Network.request({ url: '/api/market/list' }),
        Network.request({ url: '/api/stock/watchlist' }),
      ])
      console.log('market:', marketRes.data)
      const marketData = marketRes.data?.data || []
      const watchData = watchRes.data?.data || []
      const favSet = new Set<string>(
        watchData.filter((w: any) => w.enabled).map((w: any) => w.symbol),
      )
      setFavoriteSymbols(favSet)
      setMarketList(
        marketData.map((item: any) => ({
          ...item,
          changePercent: item.changePercent || 0,
          price: item.price || 0,
          volume24h: item.volume24h || item.volume || 0,
          isFavorite: favSet.has(item.symbol),
        })),
      )
    } catch (e) {
      console.error('loadMarket error:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = useCallback(async (query: string) => {
    const q = query.trim()
    if (!q) {
      setSearchResults([])
      return
    }
    try {
      setSearchLoading(true)
      const res = await Network.request({ url: '/api/stock/search', data: { q } })
      console.log('search results:', res.data)
      const data = res.data?.data || []
      setSearchResults(
        data.map((item: any) => ({
          symbol: item.symbol,
          name: item.name,
          price: item.price || 0,
          changePercent: item.changePercent || 0,
          volume24h: item.volume || 0,
          isFavorite: favoriteSymbols.has(item.symbol),
          isCustom: item.isCustom,
          industry: item.industry,
        })),
      )
    } catch (e) {
      console.error('search error:', e)
    } finally {
      setSearchLoading(false)
    }
  }, [favoriteSymbols])

  const toggleFavorite = async (symbol: string, name: string) => {
    try {
      const isFav = favoriteSymbols.has(symbol)
      if (isFav) {
        await Network.request({
          url: `/api/stock/watchlist/${symbol}`,
          method: 'DELETE',
        })
      } else {
        await Network.request({
          url: '/api/stock/watchlist',
          method: 'POST',
          data: { symbol, name, enabled: true },
        })
      }
      Taro.showToast({
        title: isFav ? '已移除自选' : '已添加自选',
        icon: 'success',
      })
      // 更新本地状态
      const newFavs = new Set(favoriteSymbols)
      if (isFav) {
        newFavs.delete(symbol)
      } else {
        newFavs.add(symbol)
      }
      setFavoriteSymbols(newFavs)
      // 更新列表状态
      setMarketList(prev =>
        prev.map(item =>
          item.symbol === symbol ? { ...item, isFavorite: !isFav } : item,
        ),
      )
      setSearchResults(prev =>
        prev.map(item =>
          item.symbol === symbol ? { ...item, isFavorite: !isFav } : item,
        ),
      )
    } catch (e) {
      console.error('toggleFavorite error:', e)
      Taro.showToast({ title: '操作失败', icon: 'error' })
    }
  }

  const displayList = searchText.trim()
    ? searchResults
    : (() => {
        let list = marketList.filter((item) => {
          if (tab === 'favorites') return item.isFavorite
          if (tab === 'gainers') return item.changePercent > 0
          if (tab === 'losers') return item.changePercent < 0
          return true
        })
        if (tab === 'gainers') list = list.sort((a, b) => b.changePercent - a.changePercent)
        if (tab === 'losers') list = list.sort((a, b) => a.changePercent - b.changePercent)
        return list
      })()

  return (
    <View className="flex flex-col h-full bg-slate-900">
      {/* 搜索栏 */}
      <View className="px-4 pt-3 pb-2">
        <View className="flex flex-row items-center gap-2 bg-slate-800 rounded-lg px-3 py-2">
          <Search size={16} color="#64748b" />
          <Input
            className="flex-1 bg-transparent text-sm text-slate-100 border-none"
            placeholder="搜索股票代码或名称..."
            placeholderStyle="color: #64748b"
            value={searchText}
            onInput={(e) => {
              const val = e.detail.value
              setSearchText(val)
              handleSearch(val)
            }}
          />
        </View>
        {searchText.trim() && (
          <Text className="block text-xs text-slate-500 mt-1 pl-1">
            搜索到 {searchResults.length} 只股票，点击星标加自选
          </Text>
        )}
      </View>

      {/* Tab 切换（仅非搜索状态显示） */}
      {!searchText.trim() && (
        <Tabs value={tab} onValueChange={setTab} className="flex-1">
          <View className="px-4">
            <TabsList className="bg-slate-800">
              <TabsTrigger value="favorites">自选</TabsTrigger>
              <TabsTrigger value="all">全部</TabsTrigger>
              <TabsTrigger value="gainers">涨幅榜</TabsTrigger>
              <TabsTrigger value="losers">跌幅榜</TabsTrigger>
            </TabsList>
          </View>
        </Tabs>
      )}

      {/* 列表 */}
      <ScrollView scrollY className="flex-1 smooth-scroll hide-scrollbar">
        <View className="px-4 pb-20">
          {/* 表头 */}
          <View className="flex flex-row items-center justify-between py-2 border-b border-slate-700">
            <Text className="block text-xs text-slate-500 flex-1">股票</Text>
            <Text className="block text-xs text-slate-500 text-right w-20">最新价</Text>
            <Text className="block text-xs text-slate-500 text-right w-20">涨跌幅</Text>
            <Text className="block text-xs text-slate-500 text-right w-10">自选</Text>
          </View>

          {loading || searchLoading ? (
            <View className="flex items-center justify-center py-12">
              <Text className="block text-sm text-slate-500">加载中...</Text>
            </View>
          ) : displayList.length === 0 ? (
            <View className="flex items-center justify-center py-12">
              <Text className="block text-sm text-slate-500">
                {searchText.trim() ? '未找到相关股票' : '暂无数据'}
              </Text>
            </View>
          ) : (
            displayList.map((item) => (
              <Card
                key={item.symbol}
                className="bg-transparent border-none mt-0"
              >
                <CardContent className="p-0">
                  <View className="flex flex-row items-center justify-between py-3 border-b border-slate-800">
                    <View className="flex flex-row items-center gap-2 flex-1 min-w-0">
                      <View className="flex flex-col gap-0.5">
                        <View className="flex flex-row items-center gap-1">
                          <Text className="block text-sm font-medium text-slate-100">
                            {item.symbol}
                          </Text>
                          {item.isCustom && (
                            <Badge className="bg-blue-500 bg-opacity-20 text-blue-400 border-none text-[10px] px-1 py-0">
                              自定义
                            </Badge>
                          )}
                          {item.changePercent > 0 ? (
                            <TrendingUp size={10} color="#22c55e" />
                          ) : item.changePercent < 0 ? (
                            <TrendingDown size={10} color="#ef4444" />
                          ) : null}
                        </View>
                        <Text className="block text-xs text-slate-500 truncate max-w-32">
                          {item.name}
                        </Text>
                      </View>
                    </View>
                    <Text className="block text-sm font-medium text-slate-100 text-right w-20 tabular-nums">
                      {item.price > 0 ? item.price.toFixed(2) : '--'}
                    </Text>
                    <View className="w-20 flex justify-end">
                      {item.price > 0 ? (
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
                      ) : (
                        <Text className="block text-xs text-slate-600">--</Text>
                      )}
                    </View>
                    {/* 添加/移除自选按钮 */}
                    <View
                      className="w-10 flex justify-center items-center"
                      onClick={() => toggleFavorite(item.symbol, item.name)}
                    >
                      {item.isFavorite ? (
                        <Star size={18} color="#f59e0b" filled />
                      ) : (
                        <View className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-800">
                          <Plus size={14} color="#94a3b8" />
                        </View>
                      )}
                    </View>
                  </View>
                </CardContent>
              </Card>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  )
}

export default MarketPage
