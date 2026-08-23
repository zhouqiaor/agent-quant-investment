import { View, Text, ScrollView } from '@tarojs/components'
import { useState, useEffect } from 'react'
import { Network } from '@/network'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  Brain,
  Zap,
  TrendingUp,
  TrendingDown,
  Play,
  Pause,
  Settings,
  Activity,
  Clock,
  Target,
} from 'lucide-react-taro'

interface StrategyItem {
  id: string
  name: string
  type: string
  status: 'running' | 'stopped' | 'backtesting'
  pnl: number
  pnlRate: number
  winRate: number
  trades: number
  description: string
}

interface AgentSignal {
  id: string
  type: 'buy' | 'sell'
  symbol: string
  price: number
  confidence: number
  reason: string
  time: string
  executed: boolean
}

const StrategyPage = () => {
  const [autoTrade, setAutoTrade] = useState(false)
  const [strategies, setStrategies] = useState<StrategyItem[]>([])
  const [agentSignals, setAgentSignals] = useState<AgentSignal[]>([])
  const [agentActive, setAgentActive] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStrategies()
    loadSignals()
    loadAgentStatus()
  }, [])

  const loadStrategies = async () => {
    try {
      const res = await Network.request({ url: '/api/strategies' })
      console.log('strategies:', res.data)
      const data = res.data?.data
      if (data) setStrategies(data)
    } catch (e) {
      console.error('loadStrategies error:', e)
    }
  }

  const loadSignals = async () => {
    try {
      const res = await Network.request({ url: '/api/agent/signals?limit=5' })
      console.log('signals:', res.data)
      const data = res.data?.data
      if (data) setAgentSignals(data)
    } catch (e) {
      console.error('loadSignals error:', e)
    }
  }

  const loadAgentStatus = async () => {
    try {
      const res = await Network.request({ url: '/api/agent/status' })
      const data = res.data?.data
      if (data) setAgentActive(data.isActive)
    } catch (e) {
      console.error('loadAgentStatus error:', e)
    } finally {
      setLoading(false)
    }
  }

  const toggleAgent = async () => {
    try {
      const method = agentActive ? 'POST' : 'POST'
      const action = agentActive ? 'stop' : 'start'
      const res = await Network.request({
        url: `/api/agent/${action}`,
        method,
      })
      console.log('toggle agent:', res.data)
      setAgentActive(!agentActive)
    } catch (e) {
      console.error('toggleAgent error:', e)
    }
  }

  const toggleStrategy = async (id: string, currentStatus: string) => {
    try {
      const action = currentStatus === 'running' ? 'stop' : 'start'
      const res = await Network.request({
        url: `/api/strategies/${id}/${action}`,
        method: 'POST',
      })
      console.log('toggle strategy:', res.data)
      loadStrategies()
    } catch (e) {
      console.error('toggleStrategy error:', e)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return (
          <Badge className="bg-emerald-500 bg-opacity-20 text-emerald-400 border-emerald-500 border-opacity-30">
            运行中
          </Badge>
        )
      case 'stopped':
        return (
          <Badge className="bg-slate-700 text-slate-400 border-slate-600">
            已停止
          </Badge>
        )
      case 'backtesting':
        return (
          <Badge className="bg-blue-500 bg-opacity-20 text-blue-400 border-blue-500 border-opacity-30">
            回测中
          </Badge>
        )
      default:
        return null
    }
  }

  return (
    <ScrollView scrollY className="h-full bg-slate-900">
      <View className="px-4 pb-24 gap-4 flex flex-col">
        {/* Agent 控制面板 */}
        <Card className="bg-slate-800 border-slate-700 mt-4">
          <CardContent className="p-4">
            <View className="flex flex-row items-center justify-between mb-3">
              <View className="flex flex-row items-center gap-2">
                <View
                  className={`flex items-center justify-center w-10 h-10 rounded-lg ${
                    agentActive
                      ? 'bg-emerald-500 bg-opacity-20'
                      : 'bg-slate-700'
                  }`}
                >
                  <Brain
                    size={22}
                    color={agentActive ? '#10b981' : '#64748b'}
                  />
                </View>
                <View className="flex flex-col gap-1">
                  <Text className="block text-base font-bold text-slate-100">
                    AI 量化 Agent
                  </Text>
                  <Text className="block text-xs text-slate-500">
                    {agentActive ? '正在分析市场并执行策略' : 'Agent 已停止运行'}
                  </Text>
                </View>
              </View>
            </View>

            <View className="flex flex-row items-center justify-between bg-slate-900 rounded-lg p-3">
              <View className="flex flex-row items-center gap-2">
                <Zap size={16} color="#f59e0b" />
                <View className="flex flex-col gap-1">
                  <Text className="block text-sm font-medium text-slate-100">
                    自动交易
                  </Text>
                  <Text className="block text-xs text-slate-500">
                    Agent 自动执行买卖信号
                  </Text>
                </View>
              </View>
              <Switch checked={autoTrade} onCheckedChange={setAutoTrade} />
            </View>

            <View className="flex flex-row gap-2 mt-3">
              <Button
                className={`flex-1 ${
                  agentActive ? 'bg-red-500 bg-opacity-20 text-red-400' : 'bg-emerald-500 text-white'
                }`}
                onClick={toggleAgent}
              >
                {agentActive ? (
                  <>
                    <Pause size={14} color="#f87171" />
                    <Text className="text-sm font-medium ml-1">停止 Agent</Text>
                  </>
                ) : (
                  <>
                    <Play size={14} color="#ffffff" />
                    <Text className="text-sm font-medium ml-1">启动 Agent</Text>
                  </>
                )}
              </Button>
              <Button className="flex-1 bg-slate-700 text-slate-100" variant="secondary">
                <Settings size={14} color="#f1f5f9" />
                <Text className="text-sm font-medium ml-1">Agent 配置</Text>
              </Button>
            </View>
          </CardContent>
        </Card>

        {/* 策略列表 */}
        <View className="flex flex-col gap-3">
          <View className="flex flex-row items-center justify-between">
            <Text className="block text-base font-bold text-slate-100">
              策略管理
            </Text>
            <Button className="bg-emerald-500 bg-opacity-20 text-emerald-400 h-8 px-3">
              <Text className="text-xs">+ 新建策略</Text>
            </Button>
          </View>

          {loading ? (
            <View className="flex items-center justify-center py-8">
              <Text className="block text-sm text-slate-500">加载中...</Text>
            </View>
          ) : (
            strategies.map((s) => (
              <Card key={s.id} className="bg-slate-800 border-slate-700">
                <CardContent className="p-4">
                  <View className="flex flex-row items-start justify-between mb-2">
                    <View className="flex flex-col gap-1 flex-1">
                      <View className="flex flex-row items-center gap-2">
                        <Text className="block text-sm font-semibold text-slate-100">
                          {s.name}
                        </Text>
                        {getStatusBadge(s.status)}
                      </View>
                      <Text className="block text-xs text-slate-500">
                        {s.description}
                      </Text>
                    </View>
                  </View>

                  <View className="flex flex-row gap-2 mt-2">
                    <View className="flex flex-1 flex-col items-center bg-slate-900 rounded-lg p-2">
                      <Text className="block text-xs text-slate-500">收益</Text>
                      <Text
                        className={`block text-sm font-bold tabular-nums ${
                          s.pnl >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}
                      >
                        {s.pnl >= 0 ? '+' : ''}{s.pnlRate.toFixed(2)}%
                      </Text>
                    </View>
                    <View className="flex flex-1 flex-col items-center bg-slate-900 rounded-lg p-2">
                      <Text className="block text-xs text-slate-500">胜率</Text>
                      <Text className="block text-sm font-bold text-blue-500 tabular-nums">
                        {s.winRate}%
                      </Text>
                    </View>
                    <View className="flex flex-1 flex-col items-center bg-slate-900 rounded-lg p-2">
                      <Text className="block text-xs text-slate-500">交易次数</Text>
                      <Text className="block text-sm font-bold text-slate-100 tabular-nums">
                        {s.trades}
                      </Text>
                    </View>
                  </View>

                  <View className="flex flex-row gap-2 mt-3">
                    <Button
                      className={`flex-1 h-8 ${
                        s.status === 'running'
                          ? 'bg-red-500 bg-opacity-20 text-red-400'
                          : 'bg-emerald-500 bg-opacity-20 text-emerald-400'
                      }`}
                      onClick={() => toggleStrategy(s.id, s.status)}
                    >
                      <Text className="text-xs font-medium">
                        {s.status === 'running' ? '停止' : '启动'}
                      </Text>
                    </Button>
                    <Button
                      className="flex-1 h-8 bg-blue-500 bg-opacity-20 text-blue-400"
                      variant="secondary"
                    >
                      <Activity size={12} color="#60a5fa" />
                      <Text className="text-xs font-medium ml-1">回测</Text>
                    </Button>
                    <Button
                      className="flex-1 h-8 bg-slate-700 text-slate-300"
                      variant="secondary"
                    >
                      <Target size={12} color="#cbd5e1" />
                      <Text className="text-xs font-medium ml-1">参数</Text>
                    </Button>
                  </View>
                </CardContent>
              </Card>
            ))
          )}
        </View>

        {/* Agent 信号流 */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <View className="flex flex-row items-center justify-between mb-3">
              <View className="flex flex-row items-center gap-2">
                <Zap size={14} color="#f59e0b" />
                <Text className="block text-sm font-semibold text-slate-100">
                  Agent 信号流
                </Text>
              </View>
              <Badge className="bg-amber-500 bg-opacity-20 text-amber-400 border-amber-500 border-opacity-30">
                实时
              </Badge>
            </View>

            {agentSignals.length === 0 ? (
              <View className="flex items-center justify-center py-6">
                <Text className="block text-sm text-slate-500">暂无信号</Text>
              </View>
            ) : (
              <View className="flex flex-col gap-2">
                {agentSignals.map((sig, idx) => (
                  <View key={sig.id}>
                    <View className="flex flex-row items-center justify-between bg-slate-900 rounded-lg p-3">
                      <View className="flex flex-row items-center gap-2 flex-1">
                        {sig.type === 'buy' ? (
                          <TrendingUp size={14} color="#22c55e" />
                        ) : (
                          <TrendingDown size={14} color="#ef4444" />
                        )}
                        <View className="flex flex-col gap-1 flex-1">
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
                              置信度 {sig.confidence}%
                            </Badge>
                            {sig.executed && (
                              <Badge className="bg-blue-500 bg-opacity-20 text-blue-400 border-blue-500 border-opacity-30 text-xs">
                                已执行
                              </Badge>
                            )}
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
                        <View className="flex flex-row items-center gap-1">
                          <Clock size={10} color="#64748b" />
                          <Text className="block text-xs text-slate-500">
                            {sig.time}
                          </Text>
                        </View>
                      </View>
                    </View>
                    {idx < agentSignals.length - 1 && (
                      <Separator className="bg-slate-700 my-0" />
                    )}
                  </View>
                ))}
              </View>
            )}
          </CardContent>
        </Card>
      </View>
    </ScrollView>
  )
}

export default StrategyPage
