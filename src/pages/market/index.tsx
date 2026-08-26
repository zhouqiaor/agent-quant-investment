import { View, Text, ScrollView } from '@tarojs/components'
import { useState, useEffect } from 'react'
import { Network } from '@/network'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Search, TrendingUp, TrendingDown, Star } from 'lucide-react-taro'

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

const MarketPage = () => {
  const [tab, setTab] = useState('favorites')
  const [searchText, setSearchText] = useState('')
  const [marketList, setMarketList] = useState<MarketItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMarket()
  }, [])

  const loadMarket = async () => {
    try {
      setLoading(true)
      const res = await Network.request({ url: '/api/market/list' })
      console.log('market:', res.data)
      const data = res.data?.data
      if (data) setMarketList(data)
    } catch (e) {
      console.error('loadMarket error:', e)
    } finally {
      setLoading(false)
    }
  }

  const filteredList = marketList.filter((item) => {
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

  const formatVolume = (val: number) => {
    if (val >= 1e9) return `${(val / 1e9).toFixed(1)}B`
    if (val >= 1e6) return `${(val / 1e6).toFixed(1)}M`
    if (val >= 1e3) return `${(val / 1e3).toFixed(1)}K`
    return val.toFixed(0)
  }

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
          <ScrollView scrollY className="flex-1 smooth-scroll hide-scrollbar">
            <View className="px-4 pb-20">
              {/* 表头 */}
              <View className="flex flex-row items-center justify-between py-2 border-b border-slate-700">
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

              {loading ? (
                <View className="flex items-center justify-center py-12">
                  <Text className="block text-sm text-slate-500">加载中...</Text>
                </View>
              ) : sortedList.length === 0 ? (
                <View className="flex items-center justify-center py-12">
                  <Text className="block text-sm text-slate-500">暂无数据</Text>
                </View>
              ) : (
                sortedList.map((item) => (
                  <Card
                    key={item.symbol}
                    className="bg-transparent border-none mt-0"
                  >
                    <CardContent className="p-0">
                      <View className="flex flex-row items-center justify-between py-3 border-b border-slate-800">
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
                            <Text className="block text-xs text-slate-500">
                              {item.name}
                            </Text>
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
                    </CardContent>
                  </Card>
                ))
              )}
            </View>
          </ScrollView>
        </TabsContent>
      </Tabs>
    </View>
  )
}

export default MarketPage
