import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { Network } from '@/network'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowUpRight, ArrowDownLeft, ChartBar, ListFilter } from 'lucide-react-taro'

interface TradeItem {
  id: string
  symbol: string
  name: string
  type: 'BUY' | 'SELL'
  price: number
  quantity: number
  amount: number
  reason: string
  strategyId: string
  timestamp: number
}

interface TradeSummary {
  totalTrades: number
  buyCount: number
  sellCount: number
  totalBuyAmount: number
  totalSellAmount: number
  realizedPnl: number
}

const FILTER_TABS = [
  { key: 'all', label: '全部' },
  { key: 'BUY', label: '买入' },
  { key: 'SELL', label: '卖出' },
]

export default function TradesPage() {
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [trades, setTrades] = useState<TradeItem[]>([])
  const [summary, setSummary] = useState<TradeSummary | null>(null)
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [tradeRes, sumRes] = await Promise.all([
        Network.request({
          url: activeFilter === 'all' ? '/api/paper-trading/trades' : `/api/paper-trading/trades?type=${activeFilter}`,
        }),
        Network.request({ url: '/api/paper-trading/summary' }),
      ])
      setTrades(Array.isArray(tradeRes.data?.data?.list) ? tradeRes.data.data.list : [])
      setSummary(sumRes.data?.data ?? null)
    } catch (e) {
      console.error('[trades] load error', e)
    } finally {
      setLoading(false)
    }
  }, [activeFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  const fmtMoney = (n: number) => (n >= 0 ? '' : '-') + '¥' + Math.abs(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtTime = (ts: number) => {
    const d = new Date(ts)
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  const isUp = (trade: TradeItem) => trade.type === 'SELL'

  return (
    <View className="flex flex-col h-full bg-slate-900 smooth-scroll">
      <ScrollView
        scrollY
        className="flex-1 px-4 pt-3 pb-6"
        refresherEnabled
        refresherTriggered={loading}
        onRefresherRefresh={loadData}
      >
        {/* 汇总卡片 */}
        {summary && (
          <Card className="bg-slate-800 border-slate-700 rounded-xl mb-4">
            <CardContent className="p-4">
              <View className="flex flex-row items-center gap-2 mb-3">
                <ChartBar size={16} color="#94a3b8" />
                <Text className="block text-sm font-medium text-slate-300">交易汇总</Text>
              </View>
              <View className="grid grid-cols-3 gap-2">
                <View>
                  <Text className="block text-xs text-slate-400">交易笔数</Text>
                  <Text className="block text-lg font-bold text-white tabular-nums mt-1">{summary.totalTrades}</Text>
                </View>
                <View>
                  <Text className="block text-xs text-slate-400">买入</Text>
                  <Text className="block text-base font-semibold text-emerald-400 tabular-nums mt-1">{summary.buyCount}笔</Text>
                </View>
                <View>
                  <Text className="block text-xs text-slate-400">卖出</Text>
                  <Text className="block text-base font-semibold text-red-400 tabular-nums mt-1">{summary.sellCount}笔</Text>
                </View>
              </View>
              <Separator className="my-3 bg-slate-700" />
              <View className="flex flex-row justify-between">
                <View>
                  <Text className="block text-xs text-slate-400">累计买入</Text>
                  <Text className="block text-sm font-medium text-slate-200 tabular-nums mt-1">{fmtMoney(summary.totalBuyAmount)}</Text>
                </View>
                <View>
                  <Text className="block text-xs text-slate-400">累计卖出</Text>
                  <Text className="block text-sm font-medium text-slate-200 tabular-nums mt-1">{fmtMoney(summary.totalSellAmount)}</Text>
                </View>
                <View>
                  <Text className="block text-xs text-slate-400">已实现盈亏</Text>
                  <Text className={`block text-sm font-semibold tabular-nums mt-1 ${summary.realizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {fmtMoney(summary.realizedPnl)}
                  </Text>
                </View>
              </View>
            </CardContent>
          </Card>
        )}

        {/* 筛选 Tab */}
        <View className="flex flex-row items-center gap-2 mb-3">
          <ListFilter size={14} color="#94a3b8" />
          <View className="flex flex-row gap-2">
            {FILTER_TABS.map((tab) => (
              <View
                key={tab.key}
                className={`px-3 py-2 rounded-full text-xs font-medium transition-colors ${
                  activeFilter === tab.key
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-800 text-slate-400'
                }`}
                onClick={() => setActiveFilter(tab.key)}
              >
                <Text className="block">{tab.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 交易列表 */}
        {trades.length === 0 && !loading && (
          <View className="flex flex-col items-center justify-center py-16">
            <Text className="block text-slate-500 text-sm">暂无交易记录</Text>
          </View>
        )}

        <View className="flex flex-col gap-2">
          {trades.map((trade) => (
            <Card key={trade.id} className="bg-slate-800 border-slate-700 rounded-xl">
              <CardContent className="p-3">
                <View className="flex flex-row items-center justify-between">
                  <View className="flex flex-row items-center gap-2">
                    <View className={`w-8 h-8 rounded-full flex items-center justify-center ${isUp(trade) ? 'bg-red-500 bg-opacity-20' : 'bg-emerald-500 bg-opacity-20'}`}>
                      {isUp(trade) ? (
                        <ArrowUpRight size={14} color="#f87171" />
                      ) : (
                        <ArrowDownLeft size={14} color="#34d399" />
                      )}
                    </View>
                    <View>
                      <Text className="block text-sm font-medium text-white">{trade.name}</Text>
                      <Text className="block text-xs text-slate-400 mt-1 tabular-nums">{trade.symbol} · {fmtTime(trade.timestamp)}</Text>
                    </View>
                  </View>
                  <View className="text-right">
                    <Text className={`block text-sm font-bold tabular-nums ${isUp(trade) ? 'text-red-400' : 'text-emerald-400'}`}>
                      {trade.type === 'BUY' ? '+' : '-'}{trade.quantity}股
                    </Text>
                    <Text className="block text-xs text-slate-400 mt-1 tabular-nums">¥{trade.price.toFixed(2)}</Text>
                  </View>
                </View>
                <Separator className="my-2 bg-slate-700" />
                <View className="flex flex-row justify-between items-center">
                  <Badge className={trade.type === 'BUY' ? 'bg-emerald-500 bg-opacity-20 text-emerald-400' : 'bg-red-500 bg-opacity-20 text-red-400'}>
                    {trade.type === 'BUY' ? '买入' : '卖出'}
                  </Badge>
                  <View className="text-right">
                    <Text className="block text-xs text-slate-400">成交额</Text>
                    <Text className="block text-sm font-semibold text-white tabular-nums">{fmtMoney(trade.amount)}</Text>
                  </View>
                </View>
                {trade.reason && trade.reason !== trade.type && (
                  <Text className="block text-xs text-slate-500 mt-2">原因：{trade.reason}</Text>
                )}
              </CardContent>
            </Card>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}
