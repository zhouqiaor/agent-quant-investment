import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { Network } from '@/network'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  ChevronLeft,
  Save,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  Target,
  Activity,
  Radio,
  Settings2,
  CircleAlert,
} from 'lucide-react-taro'

// 技术指标定义
interface IndicatorDef {
  key: string
  name: string
  description: string
  params: { key: string; label: string; defaultValue: number; min: number; max: number; step: number }[]
}

const INDICATORS: IndicatorDef[] = [
  {
    key: 'MA',
    name: '均线 MA',
    description: '移动平均线，判断趋势方向',
    params: [
      { key: 'period', label: '周期', defaultValue: 20, min: 2, max: 250, step: 1 },
    ],
  },
  {
    key: 'EMA',
    name: '指数均线 EMA',
    description: '指数加权移动平均线，对近期价格更敏感',
    params: [
      { key: 'period', label: '周期', defaultValue: 12, min: 2, max: 250, step: 1 },
    ],
  },
  {
    key: 'MACD',
    name: 'MACD',
    description: '趋势动量指标，金叉/死叉信号',
    params: [
      { key: 'fast', label: '快线', defaultValue: 12, min: 2, max: 50, step: 1 },
      { key: 'slow', label: '慢线', defaultValue: 26, min: 10, max: 100, step: 1 },
      { key: 'signal', label: '信号线', defaultValue: 9, min: 2, max: 50, step: 1 },
    ],
  },
  {
    key: 'RSI',
    name: 'RSI 相对强弱',
    description: '衡量超买/超卖状态',
    params: [
      { key: 'period', label: '周期', defaultValue: 14, min: 2, max: 50, step: 1 },
      { key: 'overbought', label: '超买阈值', defaultValue: 70, min: 50, max: 95, step: 1 },
      { key: 'oversold', label: '超卖阈值', defaultValue: 30, min: 5, max: 50, step: 1 },
    ],
  },
  {
    key: 'BOLL',
    name: '布林带 BOLL',
    description: '价格通道指标，判断波动区间',
    params: [
      { key: 'period', label: '周期', defaultValue: 20, min: 5, max: 100, step: 1 },
      { key: 'stdDev', label: '标准差倍数', defaultValue: 2, min: 1, max: 4, step: 0.5 },
    ],
  },
  {
    key: 'KDJ',
    name: 'KDJ 随机指标',
    description: '短期超买超卖指标',
    params: [
      { key: 'period', label: '周期', defaultValue: 9, min: 2, max: 50, step: 1 },
    ],
  },
  {
    key: 'VOLUME',
    name: '成交量',
    description: '量能分析，确认趋势有效性',
    params: [
      { key: 'maPeriod', label: '量能均线', defaultValue: 20, min: 5, max: 100, step: 1 },
      { key: 'threshold', label: '放量倍数', defaultValue: 1.5, min: 1, max: 5, step: 0.1 },
    ],
  },
]

// 条件类型
interface Condition {
  id: string
  indicator: string
  operator: 'cross_above' | 'cross_below' | 'above' | 'below' | 'equal' | 'greater' | 'less'
  value: number
  description: string
}

const OPERATOR_LABELS: Record<string, string> = {
  cross_above: '上穿',
  cross_below: '下穿',
  above: '大于',
  below: '小于',
  equal: '等于',
  greater: '强于',
  less: '弱于',
}

// 股票搜索结果
interface StockSearchResult {
  symbol: string
  name: string
  market: 'A' | 'HK' | 'US'
  industry: string
  price: number
  change: number
  changePercent: number
  volume: number
  marketCap: number
  pe: number
  pb: number
  roe: number
}

// Agent 分析结果
interface AgentAnalysisData {
  overallScore: number
  overallSignal: string
  technical: { score: number; signal: string; summary: string; indicators: { name: string; value: string; signal: string }[] }
  fundamental: { score: number; signal: string; summary: string; metrics: { name: string; value: string; rating: string }[] }
  capitalFlow: { score: number; signal: string; summary: string }
  sentiment: { score: number; signal: string; summary: string; news: { title: string; sentiment: string; time: string }[] }
  recommendation: string
  actionPlan: { action: string; targetPrice: number; stopLoss: number; positionSize: number; confidence: number; reason: string }
}

const StrategyCreatePage = () => {
  const [strategyName, setStrategyName] = useState('')
  const [selectedStock, setSelectedStock] = useState('')
  const [selectedStockInfo, setSelectedStockInfo] = useState<StockSearchResult | null>(null)
  const [showStockPicker, setShowStockPicker] = useState(false)
  const [stockSearch, setStockSearch] = useState('')
  const [stockSearchResults, setStockSearchResults] = useState<StockSearchResult[]>([])
  const [searchingStock, setSearchingStock] = useState(false)
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([])
  const [indicatorParams, setIndicatorParams] = useState<Record<string, Record<string, number>>>({})
  const [buyConditions, setBuyConditions] = useState<Condition[]>([])
  const [sellConditions, setSellConditions] = useState<Condition[]>([])
  const [positionSize, setPositionSize] = useState(10)
  const [stopLoss, setStopLoss] = useState(5)
  const [takeProfit, setTakeProfit] = useState(15)
  const [autoTrade, setAutoTrade] = useState(false)
  const [saving, setSaving] = useState(false)
  const [monitorEnabled, setMonitorEnabled] = useState(true)

  // Agent 分析
  const [agentAnalysis, setAgentAnalysis] = useState<AgentAnalysisData | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [showAnalysis, setShowAnalysis] = useState(false)

  // 编辑模式
  const [editId, setEditId] = useState<string | null>(null)

  useEffect(() => {
    const pages = Taro.getCurrentPages()
    const currentPage = pages[pages.length - 1]
    const id = currentPage?.options?.id
    if (id) {
      setEditId(id)
      loadStrategy(id)
    }
  }, [])

  const loadStrategy = async (id: string) => {
    try {
      const res = await Network.request({ url: `/api/strategies/custom/${id}` })
      console.log('load strategy:', res.data)
      const data = res.data?.data
      if (data) {
        setStrategyName(data.name)
        setSelectedStock(data.symbol)
        setSelectedIndicators(data.indicators || [])
        setIndicatorParams(data.indicatorParams || {})
        setBuyConditions(data.buyConditions || [])
        setSellConditions(data.sellConditions || [])
        setPositionSize(data.positionSize || 10)
        setStopLoss(data.stopLoss || 5)
        setTakeProfit(data.takeProfit || 15)
        setAutoTrade(data.autoTrade || false)
        setMonitorEnabled(data.monitorEnabled !== false)
      }
    } catch (e) {
      console.error('loadStrategy error:', e)
    }
  }

  const toggleIndicator = (key: string) => {
    setSelectedIndicators((prev) => {
      if (prev.includes(key)) {
        const next = prev.filter((k) => k !== key)
        const newParams = { ...indicatorParams }
        delete newParams[key]
        setIndicatorParams(newParams)
        return next
      }
      const def = INDICATORS.find((i) => i.key === key)
      if (def) {
        const defaults: Record<string, number> = {}
        def.params.forEach((p) => {
          defaults[p.key] = p.defaultValue
        })
        setIndicatorParams({ ...indicatorParams, [key]: defaults })
      }
      return [...prev, key]
    })
  }

  const updateParam = (indicatorKey: string, paramKey: string, value: number) => {
    setIndicatorParams((prev) => ({
      ...prev,
      [indicatorKey]: {
        ...prev[indicatorKey],
        [paramKey]: value,
      },
    }))
  }

  const addCondition = (type: 'buy' | 'sell') => {
    const newCondition: Condition = {
      id: `c_${Date.now()}`,
      indicator: selectedIndicators[0] || 'MA',
      operator: type === 'buy' ? 'cross_below' : 'cross_above',
      value: 0,
      description: '',
    }
    if (type === 'buy') {
      setBuyConditions([...buyConditions, newCondition])
    } else {
      setSellConditions([...sellConditions, newCondition])
    }
  }

  const removeCondition = (type: 'buy' | 'sell', id: string) => {
    if (type === 'buy') {
      setBuyConditions(buyConditions.filter((c) => c.id !== id))
    } else {
      setSellConditions(sellConditions.filter((c) => c.id !== id))
    }
  }

  const updateCondition = (type: 'buy' | 'sell', id: string, field: string, value: string | number) => {
    const updater = (conditions: Condition[]) =>
      conditions.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    if (type === 'buy') {
      setBuyConditions(updater(buyConditions))
    } else {
      setSellConditions(updater(sellConditions))
    }
  }

  // 搜索股票（调用后端API）
  const searchStocks = async (query: string) => {
    setStockSearch(query)
    if (!query.trim()) {
      setStockSearchResults([])
      return
    }
    setSearchingStock(true)
    try {
      const res = await Network.request({ url: '/api/stock/search', data: { q: query }, method: 'GET' })
      console.log('search stocks:', res.data)
      const data = res.data?.data || []
      setStockSearchResults(data)
    } catch (e) {
      console.error('searchStocks error:', e)
    } finally {
      setSearchingStock(false)
    }
  }

  // 防抖搜索
  let searchTimer: ReturnType<typeof setTimeout> | null = null
  const searchStocksDebounced = (query: string) => {
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => searchStocks(query), 300)
  }

  // Agent 分析
  const runAgentAnalysis = async () => {
    if (!selectedStock) return
    setAnalyzing(true)
    setShowAnalysis(true)
    try {
      const res = await Network.request({ url: '/api/agent-analysis/analyze', data: { symbol: selectedStock }, method: 'GET' })
      console.log('agent analysis:', res.data)
      const data = res.data?.data
      if (data) {
        setAgentAnalysis(data)
      }
    } catch (e) {
      console.error('agentAnalysis error:', e)
      Taro.showToast({ title: '分析失败，请重试', icon: 'none' })
    } finally {
      setAnalyzing(false)
    }
  }

  const handleSave = async () => {
    if (!strategyName.trim()) {
      Taro.showToast({ title: '请输入策略名称', icon: 'none' })
      return
    }
    if (!selectedStock) {
      Taro.showToast({ title: '请选择股票标的', icon: 'none' })
      return
    }
    if (selectedIndicators.length === 0) {
      Taro.showToast({ title: '请至少选择一个技术指标', icon: 'none' })
      return
    }
    if (buyConditions.length === 0 && sellConditions.length === 0) {
      Taro.showToast({ title: '请至少设置一个买卖条件', icon: 'none' })
      return
    }

    setSaving(true)
    try {
      const payload = {
        id: editId || undefined,
        name: strategyName,
        symbol: selectedStock,
        indicators: selectedIndicators,
        indicatorParams,
        buyConditions,
        sellConditions,
        positionSize,
        stopLoss,
        takeProfit,
        autoTrade,
        monitorEnabled,
      }

      const url = editId ? '/api/strategies/custom' : '/api/strategies/custom'
      const method = editId ? 'PUT' : 'POST'
      const res = await Network.request({ url, method, data: payload })
      console.log('save strategy:', res.data)

      if (res.data?.code === 200) {
        Taro.showToast({ title: editId ? '策略已更新' : '策略已创建', icon: 'success' })
        setTimeout(() => Taro.navigateBack(), 1500)
      }
    } catch (e) {
      console.error('saveStrategy error:', e)
      Taro.showToast({ title: '保存失败，请重试', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  const stockInfo = selectedStockInfo

  return (
    <ScrollView scrollY className="h-full bg-slate-900">
      <View className="px-4 pb-24 gap-4 flex flex-col">
        {/* 顶部返回 */}
        <View className="flex flex-row items-center gap-3 mt-4">
          <View
            className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-800"
            onClick={() => Taro.navigateBack()}
          >
            <ChevronLeft size={20} color="#e2e8f0" />
          </View>
          <Text className="block text-lg font-bold text-slate-100">
            {editId ? '编辑策略' : '创建自定义策略'}
          </Text>
        </View>

        {/* 基本信息 */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <View className="flex flex-row items-center gap-2 mb-3">
              <Settings2 size={18} color="#10b981" />
              <Text className="block text-sm font-bold text-slate-100">基本信息</Text>
            </View>

            <View className="flex flex-col gap-3">
              <View className="flex flex-col gap-2">
                <Text className="block text-xs text-slate-400">策略名称</Text>
                <View className="bg-slate-900 rounded-lg px-3 py-2">
                  <Input
                    className="w-full bg-transparent text-slate-100"
                    placeholder="输入策略名称，如：MACD金叉+放量确认"
                    value={strategyName}
                    onInput={(e) => setStrategyName(e.detail.value)}
                  />
                </View>
              </View>

              <View className="flex flex-col gap-2">
                <Text className="block text-xs text-slate-400">股票标的（支持A股/港股/美股搜索）</Text>
                <View className="bg-slate-900 rounded-lg px-3 py-2">
                  <Input
                    className="w-full bg-transparent text-slate-100"
                    placeholder="输入股票代码或名称搜索，如：茅台、600519、AAPL"
                    value={stockSearch}
                    onInput={(e) => {
                      const val = e.detail.value
                      setStockSearch(val)
                      if (val.trim()) {
                        searchStocksDebounced(val)
                      } else {
                        setStockSearchResults([])
                      }
                    }}
                    onFocus={() => setShowStockPicker(true)}
                  />
                </View>

                {selectedStock && selectedStockInfo && (
                  <View className="bg-emerald-500 bg-opacity-10 border border-emerald-500 border-opacity-30 rounded-lg p-3 flex flex-row items-center justify-between">
                    <View className="flex flex-col gap-1">
                      <View className="flex flex-row items-center gap-2">
                        <Text className="block text-sm font-bold text-slate-100">
                          {selectedStockInfo.name}
                        </Text>
                        <Badge className={`${
                          selectedStockInfo.market === 'A' ? 'bg-red-500 bg-opacity-20 text-red-400 border-red-500 border-opacity-30' :
                          selectedStockInfo.market === 'HK' ? 'bg-blue-500 bg-opacity-20 text-blue-400 border-blue-500 border-opacity-30' :
                          'bg-amber-500 bg-opacity-20 text-amber-400 border-amber-500 border-opacity-30'
                        }`}
                        >
                          {selectedStockInfo.market}
                        </Badge>
                        <Text className="block text-xs text-slate-500">{selectedStockInfo.symbol}</Text>
                      </View>
                      <View className="flex flex-row items-center gap-3">
                        <Text className="block text-xs text-slate-400">
                          ¥{selectedStockInfo.price.toFixed(2)}
                        </Text>
                        <Text className={`block text-xs font-medium ${
                          selectedStockInfo.changePercent >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}
                        >
                          {selectedStockInfo.changePercent >= 0 ? '+' : ''}{selectedStockInfo.changePercent.toFixed(2)}%
                        </Text>
                        <Text className="block text-xs text-slate-500">PE:{selectedStockInfo.pe}</Text>
                        <Text className="block text-xs text-slate-500">{selectedStockInfo.industry}</Text>
                      </View>
                    </View>
                    <View
                      className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-800"
                      onClick={() => {
                        setSelectedStock('')
                        setSelectedStockInfo(null)
                        setAgentAnalysis(null)
                      }}
                    >
                      <Trash2 size={14} color="#ef4444" />
                    </View>
                  </View>
                )}

                {showStockPicker && stockSearchResults.length > 0 && (
                  <View className="bg-slate-900 rounded-lg p-3 flex flex-col gap-2">
                    <ScrollView scrollY className="max-h-48">
                      <View className="flex flex-col gap-1">
                        {stockSearchResults.map((s) => (
                          <View
                            key={s.symbol}
                            className={`flex flex-row items-center justify-between px-3 py-2 rounded-lg ${
                              selectedStock === s.symbol
                                ? 'bg-emerald-500 bg-opacity-20'
                                : 'bg-slate-800'
                            }`}
                            onClick={() => {
                              setSelectedStock(s.symbol)
                              setSelectedStockInfo(s)
                              setShowStockPicker(false)
                              setStockSearch('')
                              setStockSearchResults([])
                              setAgentAnalysis(null)
                            }}
                          >
                            <View className="flex flex-col gap-1">
                              <View className="flex flex-row items-center gap-2">
                                <Text className="block text-sm text-slate-100">{s.name}</Text>
                                <Badge className={`${
                                  s.market === 'A' ? 'bg-red-500 bg-opacity-20 text-red-400 border-red-500 border-opacity-30' :
                                  s.market === 'HK' ? 'bg-blue-500 bg-opacity-20 text-blue-400 border-blue-500 border-opacity-30' :
                                  'bg-amber-500 bg-opacity-20 text-amber-400 border-amber-500 border-opacity-30'
                                }`}
                                >
                                  {s.market}
                                </Badge>
                                <Text className="block text-xs text-slate-500">{s.industry}</Text>
                              </View>
                              <View className="flex flex-row items-center gap-2">
                                <Text className="block text-xs text-slate-400">{s.symbol}</Text>
                                <Text className="block text-xs text-slate-400">¥{s.price.toFixed(2)}</Text>
                                <Text className={`block text-xs ${
                                  s.changePercent >= 0 ? 'text-green-400' : 'text-red-400'
                                }`}
                                >
                                  {s.changePercent >= 0 ? '+' : ''}{s.changePercent.toFixed(2)}%
                                </Text>
                              </View>
                            </View>
                          </View>
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                )}

                {searchingStock && (
                  <Text className="block text-xs text-slate-500">搜索中...</Text>
                )}
              </View>
            </View>
          </CardContent>
        </Card>

        {/* Agent 智能分析 */}
        {selectedStock && (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <View className="flex flex-row items-center justify-between mb-3">
                <View className="flex flex-row items-center gap-2">
                  <Radio size={18} color="#a855f7" />
                  <Text className="block text-sm font-bold text-slate-100">Agent 智能分析</Text>
                </View>
                <Button
                  className="bg-purple-500 bg-opacity-20 text-purple-400 h-7 px-3"
                  onClick={runAgentAnalysis}
                >
                  {analyzing ? (
                    <Text className="text-xs">分析中...</Text>
                  ) : (
                    <Text className="text-xs">{agentAnalysis ? '重新分析' : '开始分析'}</Text>
                  )}
                </Button>
              </View>

              {analyzing && (
                <View className="flex items-center justify-center py-6">
                  <View className="w-10 h-10 rounded-full border-2 border-purple-500 border-t-transparent" style={{ animation: 'spin 1s linear infinite' }} />
                  <Text className="block text-xs text-slate-400 mt-3">Agent 正在进行多维度分析...</Text>
                </View>
              )}

              {agentAnalysis && !analyzing && (
                <View className="flex flex-col gap-3">
                  {/* 综合评分 */}
                  <View className="bg-slate-900 rounded-lg p-3 flex flex-row items-center justify-between">
                    <View className="flex flex-col gap-1">
                      <Text className="block text-xs text-slate-400">综合评分</Text>
                      <View className="flex flex-row items-center gap-2">
                        <Text className={`block text-2xl font-bold ${
                          agentAnalysis.overallScore >= 70 ? 'text-green-400' :
                          agentAnalysis.overallScore >= 50 ? 'text-amber-400' : 'text-red-400'
                        }`}
                        >
                          {agentAnalysis.overallScore}
                        </Text>
                        <Badge className={`${
                          agentAnalysis.overallSignal === 'strong_buy' || agentAnalysis.overallSignal === 'buy'
                            ? 'bg-green-500 bg-opacity-20 text-green-400 border-green-500 border-opacity-30'
                            : agentAnalysis.overallSignal === 'neutral'
                            ? 'bg-amber-500 bg-opacity-20 text-amber-400 border-amber-500 border-opacity-30'
                            : 'bg-red-500 bg-opacity-20 text-red-400 border-red-500 border-opacity-30'
                        }`}
                        >
                          {agentAnalysis.overallSignal === 'strong_buy' ? '强烈买入' :
                           agentAnalysis.overallSignal === 'buy' ? '买入' :
                           agentAnalysis.overallSignal === 'neutral' ? '中性' :
                           agentAnalysis.overallSignal === 'sell' ? '卖出' : '强烈卖出'}
                        </Badge>
                      </View>
                    </View>
                    <View className="flex flex-col items-end gap-1">
                      <Text className="block text-xs text-slate-500">建议操作</Text>
                      <Text className={`block text-sm font-bold ${
                        agentAnalysis.actionPlan.action === 'buy' ? 'text-green-400' :
                        agentAnalysis.actionPlan.action === 'sell' ? 'text-red-400' :
                        agentAnalysis.actionPlan.action === 'reduce' ? 'text-orange-400' : 'text-slate-400'
                      }`}
                      >
                        {agentAnalysis.actionPlan.action === 'buy' ? '买入' :
                         agentAnalysis.actionPlan.action === 'sell' ? '卖出' :
                         agentAnalysis.actionPlan.action === 'reduce' ? '减仓' : '持仓观望'}
                      </Text>
                      <Text className="block text-xs text-slate-500">
                        置信度 {agentAnalysis.actionPlan.confidence}%
                      </Text>
                    </View>
                  </View>

                  {/* 四维评分 */}
                  <View className="flex flex-row gap-2">
                    <View className="flex-1 bg-slate-900 rounded-lg p-2 flex flex-col items-center">
                      <Text className="block text-xs text-slate-500">技术面</Text>
                      <Text className={`block text-lg font-bold ${
                        agentAnalysis.technical.score >= 60 ? 'text-green-400' :
                        agentAnalysis.technical.score <= 40 ? 'text-red-400' : 'text-amber-400'
                      }`}
                      >{agentAnalysis.technical.score}</Text>
                    </View>
                    <View className="flex-1 bg-slate-900 rounded-lg p-2 flex flex-col items-center">
                      <Text className="block text-xs text-slate-500">基本面</Text>
                      <Text className={`block text-lg font-bold ${
                        agentAnalysis.fundamental.score >= 60 ? 'text-green-400' :
                        agentAnalysis.fundamental.score <= 40 ? 'text-red-400' : 'text-amber-400'
                      }`}
                      >{agentAnalysis.fundamental.score}</Text>
                    </View>
                    <View className="flex-1 bg-slate-900 rounded-lg p-2 flex flex-col items-center">
                      <Text className="block text-xs text-slate-500">资金面</Text>
                      <Text className={`block text-lg font-bold ${
                        agentAnalysis.capitalFlow.score >= 60 ? 'text-green-400' :
                        agentAnalysis.capitalFlow.score <= 40 ? 'text-red-400' : 'text-amber-400'
                      }`}
                      >{agentAnalysis.capitalFlow.score}</Text>
                    </View>
                    <View className="flex-1 bg-slate-900 rounded-lg p-2 flex flex-col items-center">
                      <Text className="block text-xs text-slate-500">消息面</Text>
                      <Text className={`block text-lg font-bold ${
                        agentAnalysis.sentiment.score >= 60 ? 'text-green-400' :
                        agentAnalysis.sentiment.score <= 40 ? 'text-red-400' : 'text-amber-400'
                      }`}
                      >{agentAnalysis.sentiment.score}</Text>
                    </View>
                  </View>

                  {/* 综合建议 */}
                  <View className="bg-slate-900 rounded-lg p-3">
                    <Text className="block text-xs text-slate-400 mb-2">Agent 建议</Text>
                    <Text className="block text-xs text-slate-300 leading-5">
                      {agentAnalysis.recommendation}
                    </Text>
                    <Text className="block text-xs text-slate-500 mt-2">
                      {agentAnalysis.actionPlan.reason}
                    </Text>
                    {agentAnalysis.actionPlan.targetPrice > 0 && (
                      <View className="flex flex-row gap-4 mt-2">
                        <Text className="block text-xs text-green-400">
                          目标价: ¥{agentAnalysis.actionPlan.targetPrice.toFixed(2)}
                        </Text>
                        <Text className="block text-xs text-red-400">
                          止损价: ¥{agentAnalysis.actionPlan.stopLoss.toFixed(2)}
                        </Text>
                        {agentAnalysis.actionPlan.positionSize > 0 && (
                          <Text className="block text-xs text-amber-400">
                            建议仓位: {agentAnalysis.actionPlan.positionSize}%
                          </Text>
                        )}
                      </View>
                    )}
                  </View>

                  {/* 技术指标详情 */}
                  {showAnalysis && (
                    <View className="flex flex-col gap-2">
                      <Text className="block text-xs text-slate-400">技术指标信号</Text>
                      <View className="flex flex-col gap-1">
                        {agentAnalysis.technical.indicators.map((ind, idx) => (
                          <View key={idx} className="flex flex-row items-center justify-between bg-slate-900 rounded px-3 py-2">
                            <Text className="block text-xs text-slate-300">{ind.name}</Text>
                            <View className="flex flex-row items-center gap-2">
                              <Text className="block text-xs text-slate-400">{ind.value}</Text>
                              <Badge className={`${
                                ind.signal === 'buy' ? 'bg-green-500 bg-opacity-20 text-green-400 border-green-500 border-opacity-30' :
                                ind.signal === 'sell' ? 'bg-red-500 bg-opacity-20 text-red-400 border-red-500 border-opacity-30' :
                                'bg-slate-700 text-slate-400 border-slate-600'
                              }`}
                              >
                                {ind.signal === 'buy' ? '买入' : ind.signal === 'sell' ? '卖出' : '中性'}
                              </Badge>
                            </View>
                          </View>
                        ))}
                      </View>

                      <Text className="block text-xs text-slate-400 mt-2">基本面指标</Text>
                      <View className="flex flex-col gap-1">
                        {agentAnalysis.fundamental.metrics.map((m, idx) => (
                          <View key={idx} className="flex flex-row items-center justify-between bg-slate-900 rounded px-3 py-2">
                            <Text className="block text-xs text-slate-300">{m.name}</Text>
                            <View className="flex flex-row items-center gap-2">
                              <Text className="block text-xs text-slate-400">{m.value}</Text>
                              <Badge className={`${
                                m.rating === 'excellent' ? 'bg-green-500 bg-opacity-20 text-green-400 border-green-500 border-opacity-30' :
                                m.rating === 'good' ? 'bg-blue-500 bg-opacity-20 text-blue-400 border-blue-500 border-opacity-30' :
                                m.rating === 'fair' ? 'bg-amber-500 bg-opacity-20 text-amber-400 border-amber-500 border-opacity-30' :
                                'bg-red-500 bg-opacity-20 text-red-400 border-red-500 border-opacity-30'
                              }`}
                              >
                                {m.rating === 'excellent' ? '优秀' : m.rating === 'good' ? '良好' : m.rating === 'fair' ? '一般' : '较差'}
                              </Badge>
                            </View>
                          </View>
                        ))}
                      </View>

                      <Text className="block text-xs text-slate-400 mt-2">近期消息</Text>
                      <View className="flex flex-col gap-1">
                        {agentAnalysis.sentiment.news.map((n, idx) => (
                          <View key={idx} className="flex flex-row items-center justify-between bg-slate-900 rounded px-3 py-2">
                            <Text className="block text-xs text-slate-300 flex-1">{n.title}</Text>
                            <View className="flex flex-row items-center gap-2 ml-2">
                              <Text className="block text-xs text-slate-500">{n.time}</Text>
                              <Badge className={`${
                                n.sentiment === 'positive' ? 'bg-green-500 bg-opacity-20 text-green-400 border-green-500 border-opacity-30' :
                                n.sentiment === 'negative' ? 'bg-red-500 bg-opacity-20 text-red-400 border-red-500 border-opacity-30' :
                                'bg-slate-700 text-slate-400 border-slate-600'
                              }`}
                              >
                                {n.sentiment === 'positive' ? '利好' : n.sentiment === 'negative' ? '利空' : '中性'}
                              </Badge>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  <View
                    className="flex items-center py-2"
                    onClick={() => setShowAnalysis(!showAnalysis)}
                  >
                    <Text className="block text-xs text-purple-400">
                      {showAnalysis ? '收起详情' : '展开详情'}
                    </Text>
                  </View>
                </View>
              )}
            </CardContent>
          </Card>
        )}

        {/* 技术指标选择 */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <View className="flex flex-row items-center gap-2 mb-3">
              <Activity size={18} color="#3b82f6" />
              <Text className="block text-sm font-bold text-slate-100">技术指标</Text>
              <Text className="block text-xs text-slate-500 ml-2">
                已选 {selectedIndicators.length} 个
              </Text>
            </View>

            <View className="flex flex-col gap-2">
              {INDICATORS.map((ind) => {
                const isSelected = selectedIndicators.includes(ind.key)
                return (
                  <View key={ind.key}>
                    <View
                      className={`flex flex-row items-center justify-between px-3 py-3 rounded-lg border ${
                        isSelected
                          ? 'bg-blue-500 bg-opacity-10 border-blue-500 border-opacity-30'
                          : 'bg-slate-900 border-slate-700'
                      }`}
                      onClick={() => toggleIndicator(ind.key)}
                    >
                      <View className="flex flex-col gap-1 flex-1">
                        <View className="flex flex-row items-center gap-2">
                          <Text className="block text-sm font-semibold text-slate-100">
                            {ind.name}
                          </Text>
                          {isSelected && (
                            <Badge className="bg-blue-500 bg-opacity-20 text-blue-400 border-blue-500 border-opacity-30">
                              已选
                            </Badge>
                          )}
                        </View>
                        <Text className="block text-xs text-slate-500">{ind.description}</Text>
                      </View>
                      <View
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-600'
                        }`}
                      >
                        {isSelected && <Text className="block text-xs text-white">✓</Text>}
                      </View>
                    </View>

                    {/* 参数配置 */}
                    {isSelected && (
                      <View className="flex flex-col gap-2 mt-2 ml-3 mb-2">
                        {ind.params.map((p) => (
                          <View key={p.key} className="flex flex-row items-center justify-between">
                            <Text className="block text-xs text-slate-400">{p.label}</Text>
                            <View className="flex flex-row items-center gap-2">
                              <View
                                className="w-7 h-7 rounded bg-slate-700 flex items-center justify-center"
                                onClick={() => {
                                  const cur = indicatorParams[ind.key]?.[p.key] ?? p.defaultValue
                                  if (cur > p.min) updateParam(ind.key, p.key, cur - p.step)
                                }}
                              >
                                <Text className="block text-sm text-slate-300">-</Text>
                              </View>
                              <Text className="block text-sm font-mono text-slate-100 w-10 text-center">
                                {indicatorParams[ind.key]?.[p.key] ?? p.defaultValue}
                              </Text>
                              <View
                                className="w-7 h-7 rounded bg-slate-700 flex items-center justify-center"
                                onClick={() => {
                                  const cur = indicatorParams[ind.key]?.[p.key] ?? p.defaultValue
                                  if (cur < p.max) updateParam(ind.key, p.key, +(cur + p.step).toFixed(2))
                                }}
                              >
                                <Text className="block text-sm text-slate-300">+</Text>
                              </View>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )
              })}
            </View>
          </CardContent>
        </Card>

        {/* 买入条件 */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <View className="flex flex-row items-center justify-between mb-3">
              <View className="flex flex-row items-center gap-2">
                <TrendingUp size={18} color="#22c55e" />
                <Text className="block text-sm font-bold text-slate-100">买入条件</Text>
              </View>
              {selectedIndicators.length > 0 && (
                <Button
                  className="bg-green-500 bg-opacity-20 text-green-400 h-7 px-3"
                  onClick={() => addCondition('buy')}
                >
                  <Plus size={14} color="#4ade80" />
                  <Text className="text-xs ml-1">添加</Text>
                </Button>
              )}
            </View>

            {buyConditions.length === 0 ? (
              <View className="flex items-center justify-center py-4">
                <Text className="block text-xs text-slate-500">
                  请先选择技术指标，然后添加买入条件
                </Text>
              </View>
            ) : (
              <View className="flex flex-col gap-2">
                {buyConditions.map((c, idx) => (
                  <View key={c.id} className="bg-slate-900 rounded-lg p-3 flex flex-col gap-2">
                    <View className="flex flex-row items-center justify-between">
                      <Text className="block text-xs text-green-400 font-medium">
                        条件 {idx + 1}
                      </Text>
                      <View onClick={() => removeCondition('buy', c.id)}>
                        <Trash2 size={14} color="#ef4444" />
                      </View>
                    </View>
                    <View className="flex flex-row gap-2">
                      <View className="flex-1 bg-slate-800 rounded px-2 py-2">
                        <View
                          className="flex flex-row items-center justify-between"
                          onClick={() => {
                            const curIdx = selectedIndicators.indexOf(c.indicator)
                            const nextIdx = (curIdx + 1) % selectedIndicators.length
                            updateCondition('buy', c.id, 'indicator', selectedIndicators[nextIdx])
                          }}
                        >
                          <Text className="block text-xs text-slate-100">
                            {INDICATORS.find((i) => i.key === c.indicator)?.name || c.indicator}
                          </Text>
                          <Text className="block text-xs text-slate-500">切换</Text>
                        </View>
                      </View>
                      <View className="flex-1 bg-slate-800 rounded px-2 py-2">
                        <View
                          className="flex flex-row items-center justify-between"
                          onClick={() => {
                            const ops = Object.keys(OPERATOR_LABELS)
                            const curIdx = ops.indexOf(c.operator)
                            const nextOp = ops[(curIdx + 1) % ops.length]
                            updateCondition('buy', c.id, 'operator', nextOp)
                          }}
                        >
                          <Text className="block text-xs text-slate-100">
                            {OPERATOR_LABELS[c.operator]}
                          </Text>
                          <Text className="block text-xs text-slate-500">切换</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </CardContent>
        </Card>

        {/* 卖出条件 */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <View className="flex flex-row items-center justify-between mb-3">
              <View className="flex flex-row items-center gap-2">
                <TrendingDown size={18} color="#ef4444" />
                <Text className="block text-sm font-bold text-slate-100">卖出条件</Text>
              </View>
              {selectedIndicators.length > 0 && (
                <Button
                  className="bg-red-500 bg-opacity-20 text-red-400 h-7 px-3"
                  onClick={() => addCondition('sell')}
                >
                  <Plus size={14} color="#f87171" />
                  <Text className="text-xs ml-1">添加</Text>
                </Button>
              )}
            </View>

            {sellConditions.length === 0 ? (
              <View className="flex items-center justify-center py-4">
                <Text className="block text-xs text-slate-500">
                  请先选择技术指标，然后添加卖出条件
                </Text>
              </View>
            ) : (
              <View className="flex flex-col gap-2">
                {sellConditions.map((c, idx) => (
                  <View key={c.id} className="bg-slate-900 rounded-lg p-3 flex flex-col gap-2">
                    <View className="flex flex-row items-center justify-between">
                      <Text className="block text-xs text-red-400 font-medium">
                        条件 {idx + 1}
                      </Text>
                      <View onClick={() => removeCondition('sell', c.id)}>
                        <Trash2 size={14} color="#ef4444" />
                      </View>
                    </View>
                    <View className="flex flex-row gap-2">
                      <View className="flex-1 bg-slate-800 rounded px-2 py-2">
                        <View
                          className="flex flex-row items-center justify-between"
                          onClick={() => {
                            const curIdx = selectedIndicators.indexOf(c.indicator)
                            const nextIdx = (curIdx + 1) % selectedIndicators.length
                            updateCondition('sell', c.id, 'indicator', selectedIndicators[nextIdx])
                          }}
                        >
                          <Text className="block text-xs text-slate-100">
                            {INDICATORS.find((i) => i.key === c.indicator)?.name || c.indicator}
                          </Text>
                          <Text className="block text-xs text-slate-500">切换</Text>
                        </View>
                      </View>
                      <View className="flex-1 bg-slate-800 rounded px-2 py-2">
                        <View
                          className="flex flex-row items-center justify-between"
                          onClick={() => {
                            const ops = Object.keys(OPERATOR_LABELS)
                            const curIdx = ops.indexOf(c.operator)
                            const nextOp = ops[(curIdx + 1) % ops.length]
                            updateCondition('sell', c.id, 'operator', nextOp)
                          }}
                        >
                          <Text className="block text-xs text-slate-100">
                            {OPERATOR_LABELS[c.operator]}
                          </Text>
                          <Text className="block text-xs text-slate-500">切换</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </CardContent>
        </Card>

        {/* 风控参数 */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <View className="flex flex-row items-center gap-2 mb-3">
              <Target size={18} color="#f59e0b" />
              <Text className="block text-sm font-bold text-slate-100">风控参数</Text>
            </View>

            <View className="flex flex-col gap-3">
              <View className="flex flex-row items-center justify-between">
                <View className="flex flex-col gap-1">
                  <Text className="block text-xs text-slate-400">仓位比例</Text>
                  <Text className="block text-xs text-slate-500">单次交易占总资金比例</Text>
                </View>
                <View className="flex flex-row items-center gap-2">
                  <View
                    className="w-7 h-7 rounded bg-slate-700 flex items-center justify-center"
                    onClick={() => setPositionSize(Math.max(1, positionSize - 1))}
                  >
                    <Text className="block text-sm text-slate-300">-</Text>
                  </View>
                  <Text className="block text-sm font-mono text-slate-100 w-12 text-center">
                    {positionSize}%
                  </Text>
                  <View
                    className="w-7 h-7 rounded bg-slate-700 flex items-center justify-center"
                    onClick={() => setPositionSize(Math.min(100, positionSize + 1))}
                  >
                    <Text className="block text-sm text-slate-300">+</Text>
                  </View>
                </View>
              </View>

              <Separator className="bg-slate-700" />

              <View className="flex flex-row items-center justify-between">
                <View className="flex flex-col gap-1">
                  <Text className="block text-xs text-slate-400">止损比例</Text>
                  <Text className="block text-xs text-slate-500">亏损达到此比例自动平仓</Text>
                </View>
                <View className="flex flex-row items-center gap-2">
                  <View
                    className="w-7 h-7 rounded bg-slate-700 flex items-center justify-center"
                    onClick={() => setStopLoss(Math.max(1, stopLoss - 1))}
                  >
                    <Text className="block text-sm text-slate-300">-</Text>
                  </View>
                  <Text className="block text-sm font-mono text-red-400 w-12 text-center">
                    {stopLoss}%
                  </Text>
                  <View
                    className="w-7 h-7 rounded bg-slate-700 flex items-center justify-center"
                    onClick={() => setStopLoss(Math.min(50, stopLoss + 1))}
                  >
                    <Text className="block text-sm text-slate-300">+</Text>
                  </View>
                </View>
              </View>

              <Separator className="bg-slate-700" />

              <View className="flex flex-row items-center justify-between">
                <View className="flex flex-col gap-1">
                  <Text className="block text-xs text-slate-400">止盈比例</Text>
                  <Text className="block text-xs text-slate-500">盈利达到此比例自动平仓</Text>
                </View>
                <View className="flex flex-row items-center gap-2">
                  <View
                    className="w-7 h-7 rounded bg-slate-700 flex items-center justify-center"
                    onClick={() => setTakeProfit(Math.max(2, takeProfit - 1))}
                  >
                    <Text className="block text-sm text-slate-300">-</Text>
                  </View>
                  <Text className="block text-sm font-mono text-green-400 w-12 text-center">
                    {takeProfit}%
                  </Text>
                  <View
                    className="w-7 h-7 rounded bg-slate-700 flex items-center justify-center"
                    onClick={() => setTakeProfit(Math.min(100, takeProfit + 1))}
                  >
                    <Text className="block text-sm text-slate-300">+</Text>
                  </View>
                </View>
              </View>
            </View>
          </CardContent>
        </Card>

        {/* 监听与自动交易 */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <View className="flex flex-row items-center gap-2 mb-3">
              <Radio size={18} color="#8b5cf6" />
              <Text className="block text-sm font-bold text-slate-100">监听与执行</Text>
            </View>

            <View className="flex flex-col gap-3">
              <View className="flex flex-row items-center justify-between bg-slate-900 rounded-lg p-3">
                <View className="flex flex-col gap-1">
                  <Text className="block text-sm text-slate-100">行情监听</Text>
                  <Text className="block text-xs text-slate-500">
                    实时监控行情数据，触发条件时生成信号
                  </Text>
                </View>
                <Switch checked={monitorEnabled} onCheckedChange={setMonitorEnabled} />
              </View>

              <View className="flex flex-row items-center justify-between bg-slate-900 rounded-lg p-3">
                <View className="flex flex-col gap-1">
                  <Text className="block text-sm text-slate-100">自动交易</Text>
                  <Text className="block text-xs text-slate-500">
                    信号触发后自动执行买卖操作
                  </Text>
                </View>
                <Switch checked={autoTrade} onCheckedChange={setAutoTrade} />
              </View>

              {autoTrade && (
                <View className="flex flex-row items-center gap-2 bg-amber-500 bg-opacity-10 border border-amber-500 border-opacity-30 rounded-lg p-3">
                  <CircleAlert size={16} color="#f59e0b" />
                  <Text className="block text-xs text-amber-400 flex-1">
                    自动交易将根据配置的风控参数执行，请确保参数设置合理
                  </Text>
                </View>
              )}
            </View>
          </CardContent>
        </Card>

        {/* 策略预览摘要 */}
        {strategyName && selectedStock && selectedIndicators.length > 0 && (
          <Card className="bg-slate-800 border-emerald-500 border-opacity-30">
            <CardContent className="p-4">
              <Text className="block text-xs text-slate-400 mb-2">策略预览</Text>
              <View className="flex flex-col gap-2">
                <View className="flex flex-row items-center gap-2">
                  <Text className="block text-sm font-bold text-slate-100">{strategyName}</Text>
                  <Badge className="bg-emerald-500 bg-opacity-20 text-emerald-400 border-emerald-500 border-opacity-30">
                    自定义
                  </Badge>
                </View>
                <Text className="block text-xs text-slate-400">
                  标的: {stockInfo?.name}({selectedStock}) | 指标:{' '}
                  {selectedIndicators.join(', ')}
                </Text>
                <Text className="block text-xs text-slate-400">
                  买入条件: {buyConditions.length} 个 | 卖出条件: {sellConditions.length} 个
                </Text>
                <Text className="block text-xs text-slate-400">
                  风控: 仓位{positionSize}% / 止损{stopLoss}% / 止盈{takeProfit}%
                </Text>
                <View className="flex flex-row gap-2 mt-1">
                  {monitorEnabled && (
                    <Badge className="bg-purple-500 bg-opacity-20 text-purple-400 border-purple-500 border-opacity-30">
                      监听中
                    </Badge>
                  )}
                  {autoTrade && (
                    <Badge className="bg-amber-500 bg-opacity-20 text-amber-400 border-amber-500 border-opacity-30">
                      自动交易
                    </Badge>
                  )}
                </View>
              </View>
            </CardContent>
          </Card>
        )}

        {/* 保存按钮 */}
        <Button
          className="w-full bg-emerald-500 text-white h-12"
          onClick={handleSave}
          disabled={saving}
        >
          <Save size={18} color="#ffffff" />
          <Text className="text-base font-bold ml-2">
            {saving ? '保存中...' : editId ? '更新策略' : '创建策略'}
          </Text>
        </Button>
      </View>
    </ScrollView>
  )
}

export default StrategyCreatePage
