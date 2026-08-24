import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Network } from '@/network'
import { Play, Pause, RotateCcw, Wallet, TrendingUp, TrendingDown, Activity } from 'lucide-react-taro'

interface PaperAccount {
  id: string
  name: string
  initialCapital: number
  cash: number
  positions: {
    symbol: string
    name: string
    quantity: number
    avgCost: number
    currentPrice: number
    marketValue: number
    pnl: number
    pnlRate: number
    openDate: string
  }[]
  trades: {
    id: string
    date: string
    time: string
    type: 'BUY' | 'SELL'
    symbol: string
    name: string
    price: number
    quantity: number
    amount: number
    reason: string
    strategyId: string
  }[]
  totalValue: number
  totalPnl: number
  totalPnlRate: number
  isRunning: boolean
  startDate: string
  strategies: string[]
}

export default function PaperTradingPage() {
  const [account, setAccount] = useState<PaperAccount | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'positions' | 'trades'>('positions')

  const fetchAccount = async () => {
    try {
      const res = await Network.request({
        url: '/api/paper-trading/account',
      })
      console.log('模拟交易账户:', res.data)
      setAccount(res.data?.data || null)
    } catch (error) {
      console.error('获取账户失败:', error)
    }
  }

  useEffect(() => {
    fetchAccount()
  }, [])

  const handleStart = async () => {
    setLoading(true)
    try {
      await Network.request({
        url: '/api/paper-trading/start',
        method: 'POST',
        data: { strategyIds: ['momentum', 'mean-reversion'] },
      })
      Taro.showToast({ title: '模拟交易已启动', icon: 'success' })
      fetchAccount()
    } catch (error) {
      console.error('启动失败:', error)
      Taro.showToast({ title: '启动失败', icon: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleStop = async () => {
    setLoading(true)
    try {
      await Network.request({
        url: '/api/paper-trading/stop',
        method: 'POST',
        data: {},
      })
      Taro.showToast({ title: '模拟交易已停止', icon: 'success' })
      fetchAccount()
    } catch (error) {
      console.error('停止失败:', error)
      Taro.showToast({ title: '停止失败', icon: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async () => {
    Taro.showModal({
      title: '确认重置',
      content: '重置将清空所有持仓和交易记录，恢复初始资金。',
      success: async (res) => {
        if (res.confirm) {
          setLoading(true)
          try {
            await Network.request({
              url: '/api/paper-trading/reset',
              method: 'POST',
              data: { initialCapital: 100000 },
            })
            Taro.showToast({ title: '已重置', icon: 'success' })
            fetchAccount()
          } catch (error) {
            console.error('重置失败:', error)
            Taro.showToast({ title: '重置失败', icon: 'error' })
          } finally {
            setLoading(false)
          }
        }
      },
    })
  }

  const handleSimulate = async () => {
    setLoading(true)
    try {
      const res = await Network.request({
        url: '/api/paper-trading/simulate',
        method: 'POST',
        data: {},
      })
      const data = res.data?.data
      if (data?.executed > 0) {
        Taro.showToast({ title: `执行了 ${data.executed} 笔交易`, icon: 'success' })
      } else {
        Taro.showToast({ title: '暂无交易信号', icon: 'none' })
      }
      fetchAccount()
    } catch (error) {
      console.error('模拟失败:', error)
      Taro.showToast({ title: '模拟失败', icon: 'error' })
    } finally {
      setLoading(false)
    }
  }

  if (!account) {
    return (
      <View className="flex items-center justify-center h-full bg-slate-900">
        <Text className="block text-slate-400">加载中...</Text>
      </View>
    )
  }

  return (
    <ScrollView scrollY className="h-full bg-slate-900">
      <View className="p-4 pb-20">
        {/* 账户概览 */}
        <Card className="bg-slate-800 border-slate-700 mb-4">
          <CardHeader className="pb-3">
            <View className="flex items-center justify-between">
              <CardTitle className="text-slate-100 text-base flex items-center gap-2">
                <Wallet size={18} color="#10b981" />
                <Text className="block">模拟交易账户</Text>
              </CardTitle>
              <Badge
                variant={account.isRunning ? 'default' : 'outline'}
                className={account.isRunning ? 'bg-green-500 bg-opacity-20 text-green-400 border-green-500 border-opacity-30' : 'border-slate-600 text-slate-400'}
              >
                <View className="flex items-center gap-1">
                  {account.isRunning && <Activity size={12} color="#22c55e" />}
                  <Text className="block text-xs">{account.isRunning ? '运行中' : '已停止'}</Text>
                </View>
              </Badge>
            </View>
          </CardHeader>
          <CardContent>
            <View className="grid grid-cols-2 gap-4 mb-4">
              <View>
                <Text className="block text-xs text-slate-400">总资产</Text>
                <Text className="block text-xl font-bold text-slate-100">
                  ¥{account.totalValue.toLocaleString()}
                </Text>
              </View>
              <View>
                <Text className="block text-xs text-slate-400">总收益</Text>
                <View className="flex items-center gap-1">
                  {account.totalPnl > 0 ? (
                    <TrendingUp size={14} color="#22c55e" />
                  ) : account.totalPnl < 0 ? (
                    <TrendingDown size={14} color="#ef4444" />
                  ) : null}
                  <Text className={`block text-xl font-bold ${
                    account.totalPnl > 0 ? 'text-green-500' : account.totalPnl < 0 ? 'text-red-500' : 'text-slate-400'
                  }`}
                  >
                    {account.totalPnl > 0 ? '+' : ''}{account.totalPnlRate}%
                  </Text>
                </View>
              </View>
              <View>
                <Text className="block text-xs text-slate-400">可用资金</Text>
                <Text className="block text-base font-bold text-slate-100">
                  ¥{account.cash.toLocaleString()}
                </Text>
              </View>
              <View>
                <Text className="block text-xs text-slate-400">持仓市值</Text>
                <Text className="block text-base font-bold text-slate-100">
                  ¥{(account.totalValue - account.cash).toLocaleString()}
                </Text>
              </View>
            </View>

            {/* 控制按钮 */}
            <View className="flex gap-2">
              {account.isRunning ? (
                <Button
                  variant="destructive"
                  className="flex-1 bg-red-500 bg-opacity-20 text-red-400 border border-red-500 border-opacity-30"
                  onClick={handleStop}
                  disabled={loading}
                >
                  <Pause size={16} className="mr-1" color="#ef4444" />
                  <Text className="block text-sm">停止</Text>
                </Button>
              ) : (
                <Button
                  className="flex-1 bg-green-500 text-white"
                  onClick={handleStart}
                  disabled={loading}
                >
                  <Play size={16} className="mr-1" color="#ffffff" />
                  <Text className="block text-sm">启动</Text>
                </Button>
              )}
              <Button
                variant="outline"
                className="border-slate-600 text-slate-300"
                onClick={handleSimulate}
                disabled={loading || !account.isRunning}
              >
                <Text className="block text-sm">模拟一次</Text>
              </Button>
              <Button
                variant="outline"
                className="border-slate-600 text-slate-300"
                onClick={handleReset}
                disabled={loading}
              >
                <RotateCcw size={14} color="#94a3b8" />
              </Button>
            </View>
          </CardContent>
        </Card>

        {/* Tab 切换 */}
        <View className="flex gap-2 mb-4">
          <Badge
            variant={activeTab === 'positions' ? 'default' : 'outline'}
            className={`cursor-pointer ${
              activeTab === 'positions'
                ? 'bg-emerald-500 bg-opacity-20 text-emerald-400 border-emerald-500 border-opacity-30'
                : 'border-slate-600 text-slate-400'
            }`}
            onClick={() => setActiveTab('positions')}
          >
            <Text className="block text-sm">持仓 ({account.positions.length})</Text>
          </Badge>
          <Badge
            variant={activeTab === 'trades' ? 'default' : 'outline'}
            className={`cursor-pointer ${
              activeTab === 'trades'
                ? 'bg-emerald-500 bg-opacity-20 text-emerald-400 border-emerald-500 border-opacity-30'
                : 'border-slate-600 text-slate-400'
            }`}
            onClick={() => setActiveTab('trades')}
          >
            <Text className="block text-sm">交易记录 ({account.trades.length})</Text>
          </Badge>
        </View>

        {/* 持仓列表 */}
        {activeTab === 'positions' && (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-0">
              {account.positions.length === 0 ? (
                <View className="py-8 text-center">
                  <Text className="block text-slate-400 text-sm">暂无持仓</Text>
                  <Text className="block text-slate-500 text-xs mt-1">启动模拟交易后，Agent 将自动执行交易</Text>
                </View>
              ) : (
                account.positions.map((pos, idx) => (
                  <View key={pos.symbol}>
                    <View className="p-4">
                      <View className="flex items-center justify-between mb-2">
                        <View>
                          <Text className="block text-sm font-medium text-slate-100">{pos.name}</Text>
                          <Text className="block text-xs text-slate-400">{pos.symbol}</Text>
                        </View>
                        <View className="text-right">
                          <Text className="block text-sm font-medium text-slate-100">
                            ¥{pos.marketValue.toLocaleString()}
                          </Text>
                          <View className="flex items-center gap-1 justify-end">
                            {pos.pnl > 0 ? (
                              <TrendingUp size={12} color="#22c55e" />
                            ) : pos.pnl < 0 ? (
                              <TrendingDown size={12} color="#ef4444" />
                            ) : null}
                            <Text className={`block text-xs ${
                              pos.pnl > 0 ? 'text-green-500' : pos.pnl < 0 ? 'text-red-500' : 'text-slate-400'
                            }`}
                            >
                              {pos.pnl > 0 ? '+' : ''}{pos.pnlRate}%
                            </Text>
                          </View>
                        </View>
                      </View>
                      <View className="flex justify-between text-xs text-slate-400">
                        <Text className="block">{pos.quantity}股 @ ¥{pos.avgCost}</Text>
                        <Text className="block">盈亏: {pos.pnl > 0 ? '+' : ''}¥{pos.pnl.toFixed(2)}</Text>
                      </View>
                    </View>
                    {idx < account.positions.length - 1 && <Separator className="bg-slate-700" />}
                  </View>
                ))
              )}
            </CardContent>
          </Card>
        )}

        {/* 交易记录 */}
        {activeTab === 'trades' && (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-0">
              {account.trades.length === 0 ? (
                <View className="py-8 text-center">
                  <Text className="block text-slate-400 text-sm">暂无交易记录</Text>
                </View>
              ) : (
                account.trades.slice().reverse().map((trade, idx) => (
                  <View key={trade.id}>
                    <View className="p-4">
                      <View className="flex items-center justify-between mb-1">
                        <View className="flex items-center gap-2">
                          <Badge
                            variant={trade.type === 'BUY' ? 'default' : 'destructive'}
                            className={trade.type === 'BUY' ? 'bg-green-500 bg-opacity-20 text-green-400' : 'bg-red-500 bg-opacity-20 text-red-400'}
                          >
                            <Text className="block text-xs">{trade.type === 'BUY' ? '买入' : '卖出'}</Text>
                          </Badge>
                          <Text className="block text-sm text-slate-100">{trade.name}</Text>
                        </View>
                        <Text className="block text-xs text-slate-400">
                          {trade.date} {trade.time}
                        </Text>
                      </View>
                      <View className="flex justify-between text-xs text-slate-400">
                        <Text className="block">¥{trade.price} x {trade.quantity}股</Text>
                        <Text className="block">金额: ¥{trade.amount.toLocaleString()}</Text>
                      </View>
                      <Text className="block text-xs text-slate-500 mt-1">{trade.reason}</Text>
                    </View>
                    {idx < account.trades.length - 1 && <Separator className="bg-slate-700" />}
                  </View>
                ))
              )}
            </CardContent>
          </Card>
        )}
      </View>
    </ScrollView>
  )
}
