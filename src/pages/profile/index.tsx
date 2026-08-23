import { View, Text, ScrollView } from '@tarojs/components'
import { useState, useEffect } from 'react'
import { Network } from '@/network'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Shield,
  Bell,
  TriangleAlert,
} from 'lucide-react-taro'

interface PositionDetail {
  symbol: string
  name: string
  side: 'long' | 'short'
  entryPrice: number
  currentPrice: number
  quantity: number
  pnl: number
  pnlRate: number
  margin: number
  leverage: number
}

interface TradeRecord {
  id: string
  type: 'buy' | 'sell'
  symbol: string
  price: number
  quantity: number
  amount: number
  pnl: number
  time: string
  strategy: string
}

interface RiskSettings {
  maxDrawdown: number
  stopLossRate: number
  takeProfitRate: number
  maxPositionRate: number
  dailyTradeLimit: number
}

const ProfilePage = () => {
  const [tab, setTab] = useState('positions')
  const [positions, setPositions] = useState<PositionDetail[]>([])
  const [trades, setTrades] = useState<TradeRecord[]>([])
  const [risk, setRisk] = useState<RiskSettings>({
    maxDrawdown: 10,
    stopLossRate: 5,
    takeProfitRate: 10,
    maxPositionRate: 30,
    dailyTradeLimit: 20,
  })
  const [notifyEnabled, setNotifyEnabled] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPositions()
    loadTrades()
    loadRiskSettings()
  }, [])

  const loadPositions = async () => {
    try {
      const res = await Network.request({ url: '/api/assets/positions/detail' })
      console.log('positions detail:', res.data)
      const data = res.data?.data
      if (data) setPositions(data)
    } catch (e) {
      console.error('loadPositions error:', e)
    }
  }

  const loadTrades = async () => {
    try {
      const res = await Network.request({ url: '/api/trades/history?limit=10' })
      console.log('trades:', res.data)
      const data = res.data?.data
      if (data) setTrades(data)
    } catch (e) {
      console.error('loadTrades error:', e)
    } finally {
      setLoading(false)
    }
  }

  const loadRiskSettings = async () => {
    try {
      const res = await Network.request({ url: '/api/risk/settings' })
      const data = res.data?.data
      if (data) setRisk(data)
    } catch (e) {
      console.error('loadRiskSettings error:', e)
    }
  }

  const saveRiskSettings = async () => {
    try {
      const res = await Network.request({
        url: '/api/risk/settings',
        method: 'POST',
        data: risk,
      })
      console.log('save risk:', res.data)
    } catch (e) {
      console.error('saveRiskSettings error:', e)
    }
  }

  return (
    <View className="flex flex-col h-full bg-slate-900">
      <Tabs value={tab} onValueChange={setTab} className="flex-1">
        <View className="px-4 pt-3">
          <TabsList className="bg-slate-800">
            <TabsTrigger value="positions">持仓</TabsTrigger>
            <TabsTrigger value="trades">交易记录</TabsTrigger>
            <TabsTrigger value="risk">风控</TabsTrigger>
          </TabsList>
        </View>

        {/* 持仓明细 */}
        <TabsContent value="positions" className="flex-1">
          <ScrollView scrollY className="flex-1">
            <View className="px-4 pb-24 gap-3 flex flex-col">
              {loading ? (
                <View className="flex items-center justify-center py-12">
                  <Text className="block text-sm text-slate-500">加载中...</Text>
                </View>
              ) : positions.length === 0 ? (
                <View className="flex flex-col items-center justify-center py-16 gap-3">
                  <Wallet size={40} color="#334155" />
                  <Text className="block text-sm text-slate-500">暂无持仓</Text>
                </View>
              ) : (
                positions.map((pos) => (
                  <Card key={pos.symbol} className="bg-slate-800 border-slate-700">
                    <CardContent className="p-4">
                      <View className="flex flex-row items-center justify-between mb-2">
                        <View className="flex flex-row items-center gap-2">
                          <Text className="block text-sm font-semibold text-slate-100">
                            {pos.symbol}
                          </Text>
                          <Badge
                            className={
                              pos.side === 'long'
                                ? 'bg-green-500 bg-opacity-20 text-green-400 border-green-500 border-opacity-30'
                                : 'bg-red-500 bg-opacity-20 text-red-400 border-red-500 border-opacity-30'
                            }
                          >
                            {pos.side === 'long' ? 'MULTI' : 'EMPTY'} {pos.leverage}x
                          </Badge>
                        </View>
                        <View className="flex flex-row items-center gap-1">
                          {pos.pnl >= 0 ? (
                            <ArrowUpRight size={14} color="#22c55e" />
                          ) : (
                            <ArrowDownRight size={14} color="#ef4444" />
                          )}
                          <Text
                            className={`block text-sm font-bold tabular-nums ${
                              pos.pnl >= 0 ? 'text-green-500' : 'text-red-500'
                            }`}
                          >
                            {pos.pnl >= 0 ? '+' : ''}
                            {pos.pnl.toFixed(2)} ({pos.pnlRate >= 0 ? '+' : ''}
                            {pos.pnlRate.toFixed(2)}%)
                          </Text>
                        </View>
                      </View>

                      <View className="flex flex-row gap-2">
                        <View className="flex flex-1 flex-col gap-1 bg-slate-900 rounded-lg p-2">
                          <Text className="block text-xs text-slate-500">开仓价</Text>
                          <Text className="block text-xs font-medium text-slate-100 tabular-nums">
                            ${pos.entryPrice.toLocaleString()}
                          </Text>
                        </View>
                        <View className="flex flex-1 flex-col gap-1 bg-slate-900 rounded-lg p-2">
                          <Text className="block text-xs text-slate-500">当前价</Text>
                          <Text className="block text-xs font-medium text-slate-100 tabular-nums">
                            ${pos.currentPrice.toLocaleString()}
                          </Text>
                        </View>
                        <View className="flex flex-1 flex-col gap-1 bg-slate-900 rounded-lg p-2">
                          <Text className="block text-xs text-slate-500">数量</Text>
                          <Text className="block text-xs font-medium text-slate-100 tabular-nums">
                            {pos.quantity}
                          </Text>
                        </View>
                        <View className="flex flex-1 flex-col gap-1 bg-slate-900 rounded-lg p-2">
                          <Text className="block text-xs text-slate-500">保证金</Text>
                          <Text className="block text-xs font-medium text-amber-500 tabular-nums">
                            ${pos.margin.toFixed(0)}
                          </Text>
                        </View>
                      </View>

                      <View className="flex flex-row gap-2 mt-2">
                        <Button className="flex-1 h-8 bg-red-500 bg-opacity-20 text-red-400">
                          <Text className="text-xs font-medium">平仓</Text>
                        </Button>
                        <Button className="flex-1 h-8 bg-slate-700 text-slate-300" variant="secondary">
                          <Text className="text-xs font-medium">调整</Text>
                        </Button>
                      </View>
                    </CardContent>
                  </Card>
                ))
              )}
            </View>
          </ScrollView>
        </TabsContent>

        {/* 交易记录 */}
        <TabsContent value="trades" className="flex-1">
          <ScrollView scrollY className="flex-1">
            <View className="px-4 pb-24 gap-2 flex flex-col">
              {loading ? (
                <View className="flex items-center justify-center py-12">
                  <Text className="block text-sm text-slate-500">加载中...</Text>
                </View>
              ) : trades.length === 0 ? (
                <View className="flex flex-col items-center justify-center py-16 gap-3">
                  <Clock size={40} color="#334155" />
                  <Text className="block text-sm text-slate-500">暂无交易记录</Text>
                </View>
              ) : (
                trades.map((t) => (
                  <Card key={t.id} className="bg-slate-800 border-slate-700">
                    <CardContent className="p-3">
                      <View className="flex flex-row items-center justify-between">
                        <View className="flex flex-row items-center gap-2">
                          {t.type === 'buy' ? (
                            <TrendingUp size={14} color="#22c55e" />
                          ) : (
                            <TrendingDown size={14} color="#ef4444" />
                          )}
                          <View className="flex flex-col gap-1">
                            <View className="flex flex-row items-center gap-2">
                              <Text className="block text-sm font-medium text-slate-100">
                                {t.type === 'buy' ? '买入' : '卖出'} {t.symbol}
                              </Text>
                              <Text className="block text-xs text-slate-500">
                                x{t.quantity}
                              </Text>
                            </View>
                            <Text className="block text-xs text-slate-500">
                              策略: {t.strategy}
                            </Text>
                          </View>
                        </View>
                        <View className="flex flex-col items-end gap-1">
                          <Text className="block text-sm font-medium text-slate-100 tabular-nums">
                            ${t.price.toLocaleString()}
                          </Text>
                          <Text
                            className={`block text-xs tabular-nums ${
                              t.pnl >= 0 ? 'text-green-500' : 'text-red-500'
                            }`}
                          >
                            {t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(2)}
                          </Text>
                        </View>
                      </View>
                      <View className="flex flex-row items-center justify-between mt-2">
                        <Text className="block text-xs text-slate-500">
                          金额: ${t.amount.toFixed(2)}
                        </Text>
                        <View className="flex flex-row items-center gap-1">
                          <Clock size={10} color="#64748b" />
                          <Text className="block text-xs text-slate-500">{t.time}</Text>
                        </View>
                      </View>
                    </CardContent>
                  </Card>
                ))
              )}
            </View>
          </ScrollView>
        </TabsContent>

        {/* 风控设置 */}
        <TabsContent value="risk" className="flex-1">
          <ScrollView scrollY className="flex-1">
            <View className="px-4 pb-24 gap-4 flex flex-col">
              {/* 风控概览 */}
              <Card className="bg-slate-800 border-slate-700 mt-3">
                <CardContent className="p-4">
                  <View className="flex flex-row items-center gap-2 mb-3">
                    <Shield size={16} color="#3b82f6" />
                    <Text className="block text-sm font-semibold text-slate-100">
                      风控概览
                    </Text>
                  </View>
                  <View className="flex flex-row gap-2">
                    <View className="flex flex-1 flex-col items-center bg-slate-900 rounded-lg p-3">
                      <Text className="block text-xs text-slate-500">最大回撤</Text>
                      <Text className="block text-lg font-bold text-amber-500 tabular-nums">
                        {risk.maxDrawdown}%
                      </Text>
                    </View>
                    <View className="flex flex-1 flex-col items-center bg-slate-900 rounded-lg p-3">
                      <Text className="block text-xs text-slate-500">止损线</Text>
                      <Text className="block text-lg font-bold text-red-500 tabular-nums">
                        {risk.stopLossRate}%
                      </Text>
                    </View>
                    <View className="flex flex-1 flex-col items-center bg-slate-900 rounded-lg p-3">
                      <Text className="block text-xs text-slate-500">止盈线</Text>
                      <Text className="block text-lg font-bold text-green-500 tabular-nums">
                        {risk.takeProfitRate}%
                      </Text>
                    </View>
                  </View>
                </CardContent>
              </Card>

              {/* 风控参数 */}
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-4">
                  <Text className="block text-sm font-semibold text-slate-100 mb-3">
                    风控参数设置
                  </Text>

                  <View className="flex flex-col gap-3">
                    <View className="flex flex-row items-center justify-between">
                      <View className="flex flex-col gap-1">
                        <Text className="block text-sm text-slate-100">止损比例</Text>
                        <Text className="block text-xs text-slate-500">
                          单笔亏损超过此比例自动平仓
                        </Text>
                      </View>
                      <Badge className="bg-red-500 bg-opacity-20 text-red-400 border-red-500 border-opacity-30 tabular-nums">
                        {risk.stopLossRate}%
                      </Badge>
                    </View>
                    <Separator className="bg-slate-700" />

                    <View className="flex flex-row items-center justify-between">
                      <View className="flex flex-col gap-1">
                        <Text className="block text-sm text-slate-100">止盈比例</Text>
                        <Text className="block text-xs text-slate-500">
                          单笔盈利达到此比例自动止盈
                        </Text>
                      </View>
                      <Badge className="bg-green-500 bg-opacity-20 text-green-400 border-green-500 border-opacity-30 tabular-nums">
                        {risk.takeProfitRate}%
                      </Badge>
                    </View>
                    <Separator className="bg-slate-700" />

                    <View className="flex flex-row items-center justify-between">
                      <View className="flex flex-col gap-1">
                        <Text className="block text-sm text-slate-100">最大仓位占比</Text>
                        <Text className="block text-xs text-slate-500">
                          单个币种最大持仓占总资产比例
                        </Text>
                      </View>
                      <Badge className="bg-blue-500 bg-opacity-20 text-blue-400 border-blue-500 border-opacity-30 tabular-nums">
                        {risk.maxPositionRate}%
                      </Badge>
                    </View>
                    <Separator className="bg-slate-700" />

                    <View className="flex flex-row items-center justify-between">
                      <View className="flex flex-col gap-1">
                        <Text className="block text-sm text-slate-100">每日交易上限</Text>
                        <Text className="block text-xs text-slate-500">
                          Agent 每日最大交易次数
                        </Text>
                      </View>
                      <Badge className="bg-amber-500 bg-opacity-20 text-amber-400 border-amber-500 border-opacity-30 tabular-nums">
                        {risk.dailyTradeLimit} 次
                      </Badge>
                    </View>
                  </View>
                </CardContent>
              </Card>

              {/* 通知设置 */}
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-4">
                  <View className="flex flex-row items-center justify-between">
                    <View className="flex flex-row items-center gap-2">
                      <Bell size={16} color="#f59e0b" />
                      <View className="flex flex-col gap-1">
                        <Text className="block text-sm text-slate-100">交易通知</Text>
                        <Text className="block text-xs text-slate-500">
                          Agent 执行交易时推送通知
                        </Text>
                      </View>
                    </View>
                    <Switch
                      checked={notifyEnabled}
                      onCheckedChange={setNotifyEnabled}
                    />
                  </View>
                </CardContent>
              </Card>

              {/* 风险提示 */}
              <Card className="bg-amber-500 bg-opacity-10 border-amber-500 border-opacity-30">
                <CardContent className="p-4">
                  <View className="flex flex-row items-start gap-2">
                    <TriangleAlert size={16} color="#f59e0b" />
                    <View className="flex flex-col gap-1">
                      <Text className="block text-sm font-medium text-amber-400">
                        风险提示
                      </Text>
                      <Text className="block text-xs text-slate-400">
                        量化交易存在风险，过往收益不代表未来表现。请根据自身风险承受能力合理配置资金，设置好止损参数。
                      </Text>
                    </View>
                  </View>
                </CardContent>
              </Card>

              <Button className="bg-emerald-500 text-white" onClick={saveRiskSettings}>
                <Text className="text-sm font-medium">保存风控设置</Text>
              </Button>
            </View>
          </ScrollView>
        </TabsContent>
      </Tabs>
    </View>
  )
}

export default ProfilePage
