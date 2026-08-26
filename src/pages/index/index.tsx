import { View, Text, ScrollView } from '@tarojs/components'
import { useState, useEffect } from 'react'
import { Network } from '@/network'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Activity,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Brain,
  Shield,
} from 'lucide-react-taro'

interface AssetInfo {
  totalAssets: number
  todayPnl: number
  todayPnlRate: number
  totalPnl: number
  totalPnlRate: number
  availableBalance: number
  frozenBalance: number
}

interface PositionItem {
  name: string
  symbol: string
  value: number
  percentage: number
  pnl: number
  pnlRate: number
}

interface AgentStatus {
  isActive: boolean
  strategy: string
  signals: number
  trades: number
  winRate: number
}

interface SignalItem {
  id: string
  type: 'buy' | 'sell'
  symbol: string
  price: number
  reason: string
  time: string
}

const IndexPage = () => {
  const [asset, setAsset] = useState<AssetInfo>({
    totalAssets: 0,
    todayPnl: 0,
    todayPnlRate: 0,
    totalPnl: 0,
    totalPnlRate: 0,
    availableBalance: 0,
    frozenBalance: 0,
  })
  const [positions, setPositions] = useState<PositionItem[]>([])
  const [agent, setAgent] = useState<AgentStatus>({
    isActive: false,
    strategy: '',
    signals: 0,
    trades: 0,
    winRate: 0,
  })
  const [signals, setSignals] = useState<SignalItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [assetRes, posRes, agentRes, signalRes] = await Promise.all([
        Network.request({ url: '/api/assets/overview' }),
        Network.request({ url: '/api/assets/positions' }),
        Network.request({ url: '/api/agent/status' }),
        Network.request({ url: '/api/agent/signals?limit=3' }),
      ])
      console.log('asset:', assetRes.data)
      console.log('positions:', posRes.data)
      console.log('agent:', agentRes.data)
      console.log('signals:', signalRes.data)

      const ad = assetRes.data?.data
      if (ad) setAsset(ad)

      const pd = posRes.data?.data
      if (pd) setPositions(pd)

      const ag = agentRes.data?.data
      if (ag) setAgent(ag)

      const sg = signalRes.data?.data
      if (sg) setSignals(sg)
    } catch (e) {
      console.error('loadData error:', e)
    } finally {
      setLoading(false)
    }
  }

  const formatMoney = (val: number) => {
    if (val >= 10000) return `${(val / 10000).toFixed(2)}万`
    return val.toFixed(2)
  }

  const formatPnl = (val: number) => {
    const prefix = val >= 0 ? '+' : ''
    return `${prefix}${val.toFixed(2)}`
  }

  return (
    <ScrollView scrollY className="h-full bg-slate-900 smooth-scroll hide-scrollbar tabbar-page">
      <View className="px-4 pb-8 gap-4 flex flex-col">
        {/* 资产概览卡片 */}
        <Card className="bg-slate-800 border-slate-700 mt-4">
          <CardContent className="p-5">
            <View className="flex flex-col gap-3">
              <View className="flex flex-row items-center gap-2">
                <Wallet size={16} color="#94a3b8" />
                <Text className="block text-xs text-slate-400">总资产 (USDT)</Text>
              </View>
              <Text className="block text-3xl font-bold text-slate-100 tabular-nums">
                {loading ? '---' : formatMoney(asset.totalAssets)}
              </Text>
              <View className="flex flex-row gap-4">
                <View className="flex flex-row items-center gap-1">
                  <Text className="block text-xs text-slate-500">今日盈亏</Text>
                  <Text
                    className={`block text-sm font-semibold tabular-nums ${
                      asset.todayPnl >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}
                  >
                    {loading ? '--' : `${formatPnl(asset.todayPnl)} (${asset.todayPnlRate >= 0 ? '+' : ''}${asset.todayPnlRate.toFixed(2)}%)`}
                  </Text>
                </View>
              </View>
              <View className="flex flex-row gap-4 mt-1">
                <View className="flex flex-1 flex-row items-center justify-between bg-slate-900 rounded-lg p-3">
                  <View className="flex flex-col gap-1">
                    <Text className="block text-xs text-slate-500">累计收益</Text>
                    <Text
                      className={`block text-sm font-semibold tabular-nums ${
                        asset.totalPnl >= 0 ? 'text-green-500' : 'text-red-500'
                      }`}
                    >
                      {formatPnl(asset.totalPnl)}
                    </Text>
                  </View>
                  {asset.totalPnl >= 0 ? (
                    <ArrowUpRight size={16} color="#22c55e" />
                  ) : (
                    <ArrowDownRight size={16} color="#ef4444" />
                  )}
                </View>
                <View className="flex flex-1 flex-row items-center justify-between bg-slate-900 rounded-lg p-3">
                  <View className="flex flex-col gap-1">
                    <Text className="block text-xs text-slate-500">收益率</Text>
                    <Text
                      className={`block text-sm font-semibold tabular-nums ${
                        asset.totalPnlRate >= 0 ? 'text-green-500' : 'text-red-500'
                      }`}
                    >
                      {asset.totalPnlRate >= 0 ? '+' : ''}{asset.totalPnlRate.toFixed(2)}%
                    </Text>
                  </View>
                  <Activity size={16} color="#3b82f6" />
                </View>
              </View>
            </View>
          </CardContent>
        </Card>

        {/* Agent 状态卡片 */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <View className="flex flex-row items-center justify-between">
              <View className="flex flex-row items-center gap-2">
                <View
                  className={`flex items-center justify-center w-8 h-8 rounded-lg ${
                    agent.isActive ? 'bg-emerald-500 bg-opacity-20' : 'bg-slate-700'
                  }`}
                >
                  <Brain size={18} color={agent.isActive ? '#10b981' : '#64748b'} />
                </View>
                <View className="flex flex-col gap-1">
                  <Text className="block text-sm font-semibold text-slate-100">
                    AI Agent
                  </Text>
                  <Text className="block text-xs text-slate-500">
                    {agent.strategy || '未配置策略'}
                  </Text>
                </View>
              </View>
              <Badge
                className={
                  agent.isActive
                    ? 'bg-emerald-500 bg-opacity-20 text-emerald-400 border-emerald-500 border-opacity-30'
                    : 'bg-slate-700 text-slate-400 border-slate-600'
                }
              >
                {agent.isActive ? '运行中' : '已停止'}
              </Badge>
            </View>
            {agent.isActive && (
              <View className="flex flex-row gap-3 mt-3">
                <View className="flex flex-1 flex-col items-center bg-slate-900 rounded-lg p-2">
                  <Text className="block text-xs text-slate-500">今日信号</Text>
                  <Text className="block text-lg font-bold text-amber-500 tabular-nums">
                    {agent.signals}
                  </Text>
                </View>
                <View className="flex flex-1 flex-col items-center bg-slate-900 rounded-lg p-2">
                  <Text className="block text-xs text-slate-500">执行交易</Text>
                  <Text className="block text-lg font-bold text-blue-500 tabular-nums">
                    {agent.trades}
                  </Text>
                </View>
                <View className="flex flex-1 flex-col items-center bg-slate-900 rounded-lg p-2">
                  <Text className="block text-xs text-slate-500">胜率</Text>
                  <Text className="block text-lg font-bold text-emerald-500 tabular-nums">
                    {agent.winRate}%
                  </Text>
                </View>
              </View>
            )}
          </CardContent>
        </Card>

        {/* 持仓分布 */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <View className="flex flex-row items-center justify-between mb-3">
              <Text className="block text-sm font-semibold text-slate-100">持仓分布</Text>
              <Text className="block text-xs text-slate-500">
                {positions.length} 个币种
              </Text>
            </View>
            {positions.length === 0 ? (
              <View className="flex items-center justify-center py-6">
                <Text className="block text-sm text-slate-500">暂无持仓</Text>
              </View>
            ) : (
              <View className="flex flex-col gap-3">
                {positions.map((pos) => (
                  <View key={pos.symbol} className="flex flex-col gap-2">
                    <View className="flex flex-row items-center justify-between">
                      <View className="flex flex-row items-center gap-2">
                        <Text className="block text-sm font-medium text-slate-100">
                          {pos.symbol}
                        </Text>
                        <Text className="block text-xs text-slate-500">{pos.name}</Text>
                      </View>
                      <View className="flex flex-row items-center gap-2">
                        <Text
                          className={`block text-xs font-medium tabular-nums ${
                            pos.pnl >= 0 ? 'text-green-500' : 'text-red-500'
                          }`}
                        >
                          {pos.pnl >= 0 ? '+' : ''}{pos.pnlRate.toFixed(2)}%
                        </Text>
                        <Text className="block text-xs text-slate-400 tabular-nums">
                          {pos.percentage.toFixed(1)}%
                        </Text>
                      </View>
                    </View>
                    <Progress value={pos.percentage} className="bg-slate-700 h-2" />
                  </View>
                ))}
              </View>
            )}
          </CardContent>
        </Card>

        {/* 最新交易信号 */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <View className="flex flex-row items-center justify-between mb-3">
              <View className="flex flex-row items-center gap-2">
                <Zap size={14} color="#f59e0b" />
                <Text className="block text-sm font-semibold text-slate-100">
                  交易信号
                </Text>
              </View>
              <Text className="block text-xs text-emerald-500">查看全部</Text>
            </View>
            {signals.length === 0 ? (
              <View className="flex items-center justify-center py-6">
                <Text className="block text-sm text-slate-500">暂无交易信号</Text>
              </View>
            ) : (
              <View className="flex flex-col gap-2">
                {signals.map((sig) => (
                  <View
                    key={sig.id}
                    className="flex flex-row items-center justify-between bg-slate-900 rounded-lg p-3"
                  >
                    <View className="flex flex-row items-center gap-2">
                      {sig.type === 'buy' ? (
                        <TrendingUp size={16} color="#22c55e" />
                      ) : (
                        <TrendingDown size={16} color="#ef4444" />
                      )}
                      <View className="flex flex-col gap-1">
                        <View className="flex flex-row items-center gap-2">
                          <Text className="block text-sm font-medium text-slate-100">
                            {sig.type === 'buy' ? '买入' : '卖出'} {sig.symbol}
                          </Text>
                          <Badge
                            className={`text-xs ${
                              sig.type === 'buy'
                                ? 'bg-green-500 bg-opacity-20 text-green-400 border-green-500 border-opacity-30'
                                : 'bg-red-500 bg-opacity-20 text-red-400 border-red-500 border-opacity-30'
                            }`}
                          >
                            {sig.type === 'buy' ? 'LONG' : 'SHORT'}
                          </Badge>
                        </View>
                        <Text className="block text-xs text-slate-500">
                          {sig.reason}
                        </Text>
                      </View>
                    </View>
                    <View className="flex flex-col items-end gap-1">
                      <Text className="block text-sm font-medium text-slate-100 tabular-nums">
                        ${sig.price.toLocaleString()}
                      </Text>
                      <Text className="block text-xs text-slate-500">{sig.time}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </CardContent>
        </Card>

        {/* 资金概览 */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <View className="flex flex-row items-center gap-2 mb-3">
              <Shield size={14} color="#3b82f6" />
              <Text className="block text-sm font-semibold text-slate-100">资金概览</Text>
            </View>
            <View className="flex flex-row gap-3">
              <View className="flex flex-1 flex-col gap-1 bg-slate-900 rounded-lg p-3">
                <Text className="block text-xs text-slate-500">可用余额</Text>
                <Text className="block text-base font-bold text-slate-100 tabular-nums">
                  {formatMoney(asset.availableBalance)}
                </Text>
              </View>
              <View className="flex flex-1 flex-col gap-1 bg-slate-900 rounded-lg p-3">
                <Text className="block text-xs text-slate-500">冻结保证金</Text>
                <Text className="block text-base font-bold text-amber-500 tabular-nums">
                  {formatMoney(asset.frozenBalance)}
                </Text>
              </View>
            </View>
          </CardContent>
        </Card>

        {/* 快捷操作 */}
        <View className="flex flex-row gap-3">
          <Button
            className="flex-1 bg-emerald-500 text-white"
            onClick={loadData}
          >
            <Text className="text-sm font-medium">刷新数据</Text>
          </Button>
          <Button
            className="flex-1 bg-slate-700 text-slate-100"
            variant="secondary"
          >
            <Text className="text-sm font-medium">风控设置</Text>
          </Button>
        </View>
      </View>
    </ScrollView>
  )
}

export default IndexPage
