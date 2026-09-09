import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Network } from '@/network'
import { TrendingUp, TrendingDown, Play, Target, TriangleAlert, ChartBar, Globe, Database, CircleCheck, CircleAlert } from 'lucide-react-taro'
import { LineChart } from '@/components/chart/line-chart'

interface BacktestResult {
  symbol: string
  startDate: string
  endDate: string
  tradingDays: number
  initialCapital: number
  finalCapital: number
  totalReturn: number
  annualizedReturn: number
  benchmarkReturn: number
  maxDrawdown: number
  volatility: number
  sharpeRatio: number
  sortinoRatio: number
  totalTrades: number
  winTrades: number
  loseTrades: number
  winRate: number
  profitFactor: number
  avgWin: number
  avgLoss: number
  equityCurve: { date: string; value: number; drawdown: number }[]
  trades: { date: string; type: string; price: number; quantity: number; amount: number; reason: string }[]
  strategyName: string
  indicators: string[]
  meta?: {
    dataSource: 'tencent' | 'sina' | 'cache' | 'mock'
    realKline: boolean
    actualDays: number
    expectedDays: number
    insufficient: boolean
    fallbackReason?: string
  }
}

interface PortfolioBacktestResult {
  equityCurve: { date: string; value: number; cash: number; marketValue: number }[]
  trades: { id: string; date: string; time: string; type: string; symbol: string; name: string; price: number; quantity: number; amount: number; reason: string; strategyId: string }[]
  metrics: {
    totalReturn: number
    annualizedReturn: number
    maxDrawdown: number
    sharpeRatio: number
    winRate: number
    profitFactor: number
    tradeCount: number
    tradingDays: number
  }
  meta: {
    realKline: boolean
    dataSource: 'tencent' | 'sina' | 'cache' | 'mock'
    symbols: string[]
    dateRange: { start: string; end: string }
    initialCapital: number
    finalValue: number
    insufficient?: boolean
    fallbackReason?: string
  }
}

const STOCK_LIST = [
  { symbol: '600519', name: '贵州茅台' },
  { symbol: '300750', name: '宁德时代' },
  { symbol: '002594', name: '比亚迪' },
  { symbol: '601318', name: '中国平安' },
  { symbol: '000858', name: '五粮液' },
  { symbol: '600036', name: '招商银行' },
  { symbol: '000333', name: '美的集团' },
  { symbol: '600276', name: '恒瑞医药' },
]

export default function BacktestPage() {
  const [mode, setMode] = useState<'single' | 'portfolio'>('portfolio')
  const [symbol, setSymbol] = useState('600519')
  const [startDate, setStartDate] = useState('2026-08-01')
  const [endDate, setEndDate] = useState('2026-09-01')
  const [initialCapital, setInitialCapital] = useState('100000')
  const [indicators, setIndicators] = useState(['MA', 'MACD'])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<BacktestResult | null>(null)
  const [portfolioResult, setPortfolioResult] = useState<PortfolioBacktestResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // 收益曲线数据（净值基准，1.0 起）
  const equityPoints = useMemo(() => {
    if (mode === 'portfolio' && portfolioResult?.equityCurve?.length) {
      const initial = portfolioResult.meta.initialCapital
      if (initial <= 0) return []
      const trades = portfolioResult.trades || []
      return portfolioResult.equityCurve.map(p => {
        const dayTrade = trades.find(t => t.date === p.date)
        return {
          label: p.date.slice(5),
          value: p.value / initial,
          marker: dayTrade?.type as ('BUY' | 'SELL' | undefined),
        }
      })
    }
    if (!result?.equityCurve?.length || result.initialCapital <= 0) return []
    const trades = result.trades || []
    return result.equityCurve.map(p => {
      // 找当天是否有交易（用于标记买卖点，取当天第一笔）
      const dayTrade = trades.find(t => t.date === p.date)
      return {
        label: p.date.slice(5), // MM-DD
        value: p.value / result.initialCapital,
        marker: dayTrade?.type as ('BUY' | 'SELL' | undefined),
      }
    })
  }, [result, portfolioResult, mode])

  // 回撤曲线（百分比）
  const drawdownPoints = useMemo(() => {
    if (mode === 'portfolio' && portfolioResult?.equityCurve?.length) {
      let peak = portfolioResult.equityCurve[0].value
      return portfolioResult.equityCurve.map(p => {
        if (p.value > peak) peak = p.value
        const dd = peak > 0 ? ((peak - p.value) / peak) * 100 : 0
        return {
          label: p.date.slice(5),
          value: -dd,
        }
      })
    }
    if (!result?.equityCurve?.length) return []
    return result.equityCurve.map(p => ({
      label: p.date.slice(5),
      value: -p.drawdown, // 画在零轴下方更直观，用负数
    }))
  }, [result, portfolioResult, mode])

  const handleBacktest = async () => {
    if (mode === 'portfolio') {
      return handlePortfolioBacktest()
    }

    const capital = parseInt(initialCapital)
    if (!Number.isFinite(capital) || capital <= 0) {
      Taro.showToast({ title: '初始资金必须大于0', icon: 'none' })
      return
    }
    if (capital > 1e9) {
      Taro.showToast({ title: '初始资金不能超过10亿', icon: 'none' })
      return
    }
    const dateRe = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRe.test(startDate) || !dateRe.test(endDate)) {
      Taro.showToast({ title: '日期格式需为 YYYY-MM-DD', icon: 'none' })
      return
    }
    if (startDate >= endDate) {
      Taro.showToast({ title: '开始日期需早于结束日期', icon: 'none' })
      return
    }
    setLoading(true)
    setErrorMsg(null)
    try {
      const res = await Network.request({
        url: '/api/backtest/run',
        method: 'POST',
        data: {
          symbol,
          startDate,
          endDate,
          initialCapital: capital,
          indicators,
        },
      })
      console.log('回测结果:', res.data)
      if (res.data?.data) {
        setResult(res.data.data)
        setPortfolioResult(null)
        // 数据不足时给出额外提示
        if (res.data.data.meta?.insufficient) {
          Taro.showToast({
            title: `数据不完整：${res.data.data.meta.actualDays}/${res.data.data.meta.expectedDays}天`,
            icon: 'none',
            duration: 2500,
          })
        }
      } else {
        setErrorMsg(res.data?.message || res.data?.msg || '回测失败')
        Taro.showToast({ title: res.data?.message || res.data?.msg || '回测失败', icon: 'none' })
      }
    } catch (error: any) {
      console.error('回测失败:', error)
      const msg = error?.data?.message || error?.message || '回测失败'
      setErrorMsg(msg)
      Taro.showToast({ title: msg, icon: 'none', duration: 3000 })
    } finally {
      setLoading(false)
    }
  }

  const handlePortfolioBacktest = async () => {
    const capital = parseInt(initialCapital)
    if (!Number.isFinite(capital) || capital <= 0) {
      Taro.showToast({ title: '初始资金必须大于0', icon: 'none' })
      return
    }
    const dateRe = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRe.test(startDate) || !dateRe.test(endDate)) {
      Taro.showToast({ title: '日期格式需为 YYYY-MM-DD', icon: 'none' })
      return
    }
    if (startDate >= endDate) {
      Taro.showToast({ title: '开始日期需早于结束日期', icon: 'none' })
      return
    }
    setLoading(true)
    setErrorMsg(null)
    try {
      const res = await Network.request({
        url: '/api/backtest/portfolio',
        method: 'POST',
        data: {
          initialCapital: capital,
          startDate,
          endDate,
          autoTrade: true,
        },
      })
      console.log('全局组合回测结果:', res.data)
      if (res.data?.data) {
        setPortfolioResult(res.data.data)
        setResult(null)
        if (res.data.data.meta?.insufficient) {
          Taro.showToast({
            title: `部分标的K线数据不足，已标注于结果`,
            icon: 'none',
            duration: 2500,
          })
        }
      } else {
        setErrorMsg(res.data?.message || res.data?.msg || '回测失败')
        Taro.showToast({ title: res.data?.message || res.data?.msg || '回测失败', icon: 'none' })
      }
    } catch (error: any) {
      console.error('全局组合回测失败:', error)
      const msg = error?.data?.message || error?.message || '回测失败'
      setErrorMsg(msg)
      Taro.showToast({ title: msg, icon: 'none', duration: 3000 })
    } finally {
      setLoading(false)
    }
  }

  const toggleIndicator = (ind: string) => {
    if (indicators.includes(ind)) {
      setIndicators(indicators.filter(i => i !== ind))
    } else {
      setIndicators([...indicators, ind])
    }
  }

  return (
    <ScrollView scrollY className="h-full bg-slate-900">
      <View className="p-4 pb-20">
        {/* 模式切换 */}
        <View className="flex gap-2 mb-4">
          <Button
            variant={mode === 'portfolio' ? 'default' : 'outline'}
            className={`flex-1 ${mode === 'portfolio' ? 'bg-blue-500 text-white' : 'border-slate-700 text-slate-400'}`}
            onClick={() => setMode('portfolio')}
          >
            <Globe size={14} className="mr-1" color={mode === 'portfolio' ? '#ffffff' : '#94a3b8'} />
            <Text className="block text-xs">全局组合回测</Text>
          </Button>
          <Button
            variant={mode === 'single' ? 'default' : 'outline'}
            className={`flex-1 ${mode === 'single' ? 'bg-blue-500 text-white' : 'border-slate-700 text-slate-400'}`}
            onClick={() => setMode('single')}
          >
            <Text className="block text-xs">单标的回测</Text>
          </Button>
        </View>

        {/* 参数设置区 */}
        <Card className="bg-slate-800 border-slate-700 mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-100 text-base flex items-center gap-2">
              <ChartBar size={18} color="#3b82f6" />
              <Text className="block">{mode === 'portfolio' ? '全局组合回测参数' : '回测参数'}</Text>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 模式说明 */}
            {mode === 'portfolio' && (
              <View className="bg-blue-500 bg-opacity-10 border border-blue-500 border-opacity-20 rounded-lg p-3">
                <Text className="block text-xs text-blue-400">
                  全局组合回测将覆盖关注列表中所有已开启的股票，使用真实历史行情（新浪日K），共享资金池模拟交易。
                </Text>
              </View>
            )}

            {/* 股票选择 - 仅单标的模式 */}
            {mode === 'single' && (
              <View>
                <Text className="block text-xs text-slate-400 mb-2">回测标的</Text>
                <Select value={symbol} onValueChange={setSymbol}>
                  <SelectTrigger className="bg-slate-900 border-slate-700">
                    <SelectValue placeholder="选择股票" />
                  </SelectTrigger>
                  <SelectContent>
                    {STOCK_LIST.map(stock => (
                      <SelectItem key={stock.symbol} value={stock.symbol}>
                        <Text className="block">{stock.name} ({stock.symbol})</Text>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </View>
            )}

            {/* 时间范围 */}
            <View className="flex gap-3">
              <View className="flex-1">
                <Text className="block text-xs text-slate-400 mb-2">开始日期</Text>
                <Input
                  type="text"
                  value={startDate}
                  onInput={(e) => setStartDate(e.detail.value)}
                  placeholder="YYYY-MM-DD"
                  className="bg-slate-900 border-slate-700 text-slate-100"
                />
              </View>
              <View className="flex-1">
                <Text className="block text-xs text-slate-400 mb-2">结束日期</Text>
                <Input
                  type="text"
                  value={endDate}
                  onInput={(e) => setEndDate(e.detail.value)}
                  placeholder="YYYY-MM-DD"
                  className="bg-slate-900 border-slate-700 text-slate-100"
                />
              </View>
            </View>

            {/* 初始资金 */}
            <View>
              <Text className="block text-xs text-slate-400 mb-2">初始资金</Text>
              <Input
                type="number"
                value={initialCapital}
                onInput={(e) => setInitialCapital(e.detail.value)}
                placeholder="100000"
                className="bg-slate-900 border-slate-700 text-slate-100"
              />
            </View>

            {/* 技术指标 - 仅单标的模式 */}
            {mode === 'single' && (
              <View>
                <Text className="block text-xs text-slate-400 mb-2">技术指标</Text>
                <View className="flex flex-wrap gap-2">
                  {['MA', 'EMA', 'MACD', 'RSI', 'BOLL', 'KDJ'].map(ind => (
                    <Badge
                      key={ind}
                      variant={indicators.includes(ind) ? 'default' : 'outline'}
                      className={`cursor-pointer ${
                        indicators.includes(ind)
                          ? 'bg-emerald-500 bg-opacity-20 text-emerald-400 border-emerald-500 border-opacity-30'
                          : 'border-slate-600 text-slate-400'
                      }`}
                      onClick={() => toggleIndicator(ind)}
                    >
                      <Text className="block text-xs">{ind}</Text>
                    </Badge>
                  ))}
                </View>
              </View>
            )}

            {/* 开始回测按钮 */}
            <Button
              className="w-full bg-blue-500 text-white"
              onClick={handleBacktest}
              disabled={loading}
            >
              <Play size={16} className="mr-2" color="#ffffff" />
              <Text className="block">{loading ? '回测中...' : (mode === 'portfolio' ? '开始全局回测' : '开始回测')}</Text>
            </Button>
          </CardContent>
        </Card>

        {/* 错误提示（如 503 数据不足） */}
        {errorMsg && (
          <Card className="bg-red-500 bg-opacity-10 border-red-500 border-opacity-30 mb-4">
            <CardContent className="py-3">
              <View className="flex items-start gap-2">
                <TriangleAlert size={14} color="#f87171" className="mt-1 flex-shrink-0" />
                <View className="flex-1">
                  <Text className="block text-sm text-red-400 font-medium mb-1">回测失败</Text>
                  <Text className="block text-xs text-red-300">{errorMsg}</Text>
                  <Text className="block text-xs text-red-400 mt-2 opacity-70">
                    请检查股票代码是否正确，或扩大回测时间范围。
                  </Text>
                </View>
              </View>
            </CardContent>
          </Card>
        )}

        {/* 全局组合回测结果 */}
        {portfolioResult && (
          <>
            {/* 数据来源标记（动态：根据 meta.dataSource 区分 真实/缓存/兜底） */}
            <Card className={`mb-4 ${
              portfolioResult.meta.dataSource === 'mock'
                ? 'bg-amber-500 bg-opacity-10 border-amber-500 border-opacity-30'
                : portfolioResult.meta.dataSource === 'cache'
                ? 'bg-blue-500 bg-opacity-10 border-blue-500 border-opacity-30'
                : 'bg-emerald-500 bg-opacity-10 border-emerald-500 border-opacity-20'
            }`}
            >
              <CardContent className="py-3">
                <View className="flex items-center gap-2">
                  {portfolioResult.meta.dataSource === 'mock' ? (
                    <Badge variant="outline" className="border-amber-500 border-opacity-40 text-amber-400 bg-amber-500 bg-opacity-10">
                      <CircleAlert size={11} color="#fbbf24" className="mr-1" />
                      <Text className="block text-xs">模拟数据</Text>
                    </Badge>
                  ) : portfolioResult.meta.dataSource === 'cache' ? (
                    <Badge variant="outline" className="border-blue-500 border-opacity-40 text-blue-400 bg-blue-500 bg-opacity-10">
                      <Database size={11} color="#60a5fa" className="mr-1" />
                      <Text className="block text-xs">本地缓存</Text>
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-emerald-500 border-opacity-30 text-emerald-400 bg-emerald-500 bg-opacity-10">
                      <CircleCheck size={11} color="#34d399" className="mr-1" />
                      <Text className="block text-xs">真实行情</Text>
                    </Badge>
                  )}
                  <Text className={`block text-xs ${
                    portfolioResult.meta.dataSource === 'mock' ? 'text-amber-400' :
                    portfolioResult.meta.dataSource === 'cache' ? 'text-blue-400' : 'text-emerald-400'
                  }`}
                  >
                    {portfolioResult.meta.dataSource === 'tencent' ? '腾讯' :
                     portfolioResult.meta.dataSource === 'sina' ? '新浪' :
                     portfolioResult.meta.dataSource === 'cache' ? '本地缓存' : '合成数据'} |
                    {' '}{portfolioResult.meta.symbols.length}只标的 | {portfolioResult.metrics.tradingDays}个交易日
                    {portfolioResult.meta.insufficient && ' · 部分数据不足'}
                  </Text>
                </View>
              </CardContent>
            </Card>

            {/* 收益概览 */}
            <Card className="bg-slate-800 border-slate-700 mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-slate-100 text-base flex items-center gap-2">
                  <Globe size={16} color="#3b82f6" />
                  <Text className="block">组合收益概览</Text>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <View className="grid grid-cols-2 gap-4">
                  <View>
                    <Text className="block text-xs text-slate-400">组合收益</Text>
                    <View className="flex items-center gap-1">
                      {portfolioResult.metrics.totalReturn > 0 ? (
                        <TrendingUp size={14} color="#22c55e" />
                      ) : portfolioResult.metrics.totalReturn < 0 ? (
                        <TrendingDown size={14} color="#ef4444" />
                      ) : null}
                      <Text className={`block text-lg font-bold ${
                        portfolioResult.metrics.totalReturn > 0 ? 'text-green-500' : portfolioResult.metrics.totalReturn < 0 ? 'text-red-500' : 'text-slate-400'
                      }`}
                      >
                        {portfolioResult.metrics.totalReturn > 0 ? '+' : ''}{(portfolioResult.metrics.totalReturn * 100).toFixed(2)}%
                      </Text>
                    </View>
                  </View>
                  <View>
                    <Text className="block text-xs text-slate-400">年化收益</Text>
                    <Text className={`block text-lg font-bold ${
                      portfolioResult.metrics.annualizedReturn > 0 ? 'text-green-500' : 'text-red-500'
                    }`}
                    >
                      {portfolioResult.metrics.annualizedReturn > 0 ? '+' : ''}{(portfolioResult.metrics.annualizedReturn * 100).toFixed(2)}%
                    </Text>
                  </View>
                  <View>
                    <Text className="block text-xs text-slate-400">初始资金</Text>
                    <Text className="block text-base font-bold text-slate-100">
                      ¥{portfolioResult.meta.initialCapital.toLocaleString()}
                    </Text>
                  </View>
                  <View>
                    <Text className="block text-xs text-slate-400">最终净值</Text>
                    <Text className={`block text-base font-bold ${
                      portfolioResult.meta.finalValue >= portfolioResult.meta.initialCapital ? 'text-green-500' : 'text-red-500'
                    }`}
                    >
                      ¥{portfolioResult.meta.finalValue.toLocaleString()}
                    </Text>
                  </View>
                </View>
              </CardContent>
            </Card>

            {/* 风险指标 */}
            <Card className="bg-slate-800 border-slate-700 mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-slate-100 text-base flex items-center gap-2">
                  <TriangleAlert size={16} color="#f59e0b" />
                  <Text className="block">风险指标</Text>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <View className="grid grid-cols-2 gap-4">
                  <View>
                    <Text className="block text-xs text-slate-400">最大回撤</Text>
                    <Text className="block text-base font-bold text-red-500">
                      -{(portfolioResult.metrics.maxDrawdown * 100).toFixed(2)}%
                    </Text>
                  </View>
                  <View>
                    <Text className="block text-xs text-slate-400">夏普比率</Text>
                    <Text className={`block text-base font-bold ${
                      portfolioResult.metrics.sharpeRatio > 1 ? 'text-green-500' : portfolioResult.metrics.sharpeRatio > 0 ? 'text-amber-500' : 'text-red-500'
                    }`}
                    >
                      {portfolioResult.metrics.sharpeRatio}
                    </Text>
                  </View>
                  <View>
                    <Text className="block text-xs text-slate-400">交易天数</Text>
                    <Text className="block text-base font-bold text-slate-100">
                      {portfolioResult.metrics.tradingDays}
                    </Text>
                  </View>
                  <View>
                    <Text className="block text-xs text-slate-400">回测区间</Text>
                    <Text className="block text-xs font-bold text-slate-300">
                      {portfolioResult.meta.dateRange.start} ~ {portfolioResult.meta.dateRange.end}
                    </Text>
                  </View>
                </View>
              </CardContent>
            </Card>

            {/* 收益曲线 */}
            <Card className="bg-slate-800 border-slate-700 mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-100 text-base flex items-center gap-2">
                  <ChartBar size={16} color="#10b981" />
                  <Text className="block">组合净值曲线</Text>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <LineChart
                  data={equityPoints}
                  color={portfolioResult.metrics.totalReturn >= 0 ? '#ef4444' : '#22c55e'}
                  fillColors={
                    portfolioResult.metrics.totalReturn >= 0
                      ? ['rgba(239, 68, 68, 0.3)', 'rgba(239, 68, 68, 0)']
                      : ['rgba(34, 197, 94, 0.3)', 'rgba(34, 197, 94, 0)']
                  }
                  height={180}
                  formatValue={(v) => v.toFixed(3)}
                />
              </CardContent>
            </Card>

            {/* 回撤走势 */}
            <Card className="bg-slate-800 border-slate-700 mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-100 text-sm">回撤走势</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <LineChart
                  data={drawdownPoints}
                  color="#f97316"
                  fillColors={['rgba(249, 115, 22, 0.2)', 'rgba(249, 115, 22, 0)']}
                  height={90}
                  showZeroLine
                  formatValue={(v) => `${v.toFixed(1)}%`}
                  emptyText="暂无回撤数据"
                />
              </CardContent>
            </Card>

            {/* 交易统计 */}
            <Card className="bg-slate-800 border-slate-700 mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-slate-100 text-base flex items-center gap-2">
                  <Target size={16} color="#10b981" />
                  <Text className="block">交易统计</Text>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <View className="grid grid-cols-3 gap-4">
                  <View>
                    <Text className="block text-xs text-slate-400">总交易</Text>
                    <Text className="block text-lg font-bold text-slate-100">
                      {portfolioResult.metrics.tradeCount}
                    </Text>
                  </View>
                  <View>
                    <Text className="block text-xs text-slate-400">胜率</Text>
                    <Text className={`block text-lg font-bold ${
                      portfolioResult.metrics.winRate >= 50 ? 'text-green-500' : 'text-amber-500'
                    }`}
                    >
                      {(portfolioResult.metrics.winRate * 100).toFixed(1)}%
                    </Text>
                  </View>
                  <View>
                    <Text className="block text-xs text-slate-400">盈亏比</Text>
                    <Text className="block text-lg font-bold text-slate-100">
                      {portfolioResult.metrics.profitFactor}
                    </Text>
                  </View>
                </View>
              </CardContent>
            </Card>

            {/* 交易记录 */}
            {portfolioResult.trades.length > 0 && (
              <Card className="bg-slate-800 border-slate-700 mb-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-slate-100 text-base">交易记录</CardTitle>
                </CardHeader>
                <CardContent>
                  {portfolioResult.trades.slice(0, 20).map((trade, idx) => (
                    <View key={trade.id || idx} className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
                      <View className="flex items-center gap-2">
                        <Badge variant={trade.type === 'BUY' ? 'default' : 'destructive'} className="text-xs">
                          <Text className="block">{trade.type === 'BUY' ? '买' : '卖'}</Text>
                        </Badge>
                        <View>
                          <Text className="block text-sm text-slate-100">{trade.name}</Text>
                          <Text className="block text-xs text-slate-400">{trade.date}</Text>
                        </View>
                      </View>
                      <View className="text-right">
                        <Text className="block text-sm text-slate-100">¥{trade.price.toFixed(2)}</Text>
                        <Text className="block text-xs text-slate-400">{trade.quantity}股</Text>
                      </View>
                    </View>
                  ))}
                  {portfolioResult.trades.length > 20 && (
                    <Text className="block text-xs text-slate-500 text-center mt-2">
                      仅显示前20条，共{portfolioResult.trades.length}条记录
                    </Text>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 参与标的 */}
            <Card className="bg-slate-800 border-slate-700 mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-slate-100 text-base">参与标的</CardTitle>
              </CardHeader>
              <CardContent>
                <View className="flex flex-wrap gap-2">
                  {portfolioResult.meta.symbols.map(sym => (
                    <Badge key={sym} variant="outline" className="border-slate-600 text-slate-300">
                      <Text className="block text-xs">{sym}</Text>
                    </Badge>
                  ))}
                </View>
              </CardContent>
            </Card>
          </>
        )}

        {/* 单标的回测结果 */}
        {result && (
          <>
            {/* 数据来源标记（动态） */}
            <Card className={`mb-4 ${
              result.meta?.dataSource === 'mock'
                ? 'bg-amber-500 bg-opacity-10 border-amber-500 border-opacity-30'
                : result.meta?.dataSource === 'cache'
                ? 'bg-blue-500 bg-opacity-10 border-blue-500 border-opacity-30'
                : 'bg-emerald-500 bg-opacity-10 border-emerald-500 border-opacity-20'
            }`}
            >
              <CardContent className="py-3">
                <View className="flex items-center gap-2">
                  {result.meta?.dataSource === 'mock' ? (
                    <Badge variant="outline" className="border-amber-500 border-opacity-40 text-amber-400 bg-amber-500 bg-opacity-10">
                      <CircleAlert size={11} color="#fbbf24" className="mr-1" />
                      <Text className="block text-xs">模拟数据</Text>
                    </Badge>
                  ) : result.meta?.dataSource === 'cache' ? (
                    <Badge variant="outline" className="border-blue-500 border-opacity-40 text-blue-400 bg-blue-500 bg-opacity-10">
                      <Database size={11} color="#60a5fa" className="mr-1" />
                      <Text className="block text-xs">本地缓存</Text>
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-emerald-500 border-opacity-30 text-emerald-400 bg-emerald-500 bg-opacity-10">
                      <CircleCheck size={11} color="#34d399" className="mr-1" />
                      <Text className="block text-xs">真实行情</Text>
                    </Badge>
                  )}
                  <Text className={`block text-xs ${
                    result.meta?.dataSource === 'mock' ? 'text-amber-400' :
                    result.meta?.dataSource === 'cache' ? 'text-blue-400' : 'text-emerald-400'
                  }`}
                  >
                    {result.meta?.dataSource === 'tencent' ? '腾讯' :
                     result.meta?.dataSource === 'sina' ? '新浪' :
                     result.meta?.dataSource === 'cache' ? '本地缓存' :
                     result.meta?.dataSource === 'mock' ? '合成数据' : '数据源'} |
                    {' '}{result.symbol} {result.startDate}~{result.endDate} |
                    {' '}{result.tradingDays}个交易日
                    {result.meta?.insufficient && ' · 数据不足'}
                  </Text>
                </View>
              </CardContent>
            </Card>

            {/* 收益概览 */}
            <Card className="bg-slate-800 border-slate-700 mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-slate-100 text-base">收益概览</CardTitle>
              </CardHeader>
              <CardContent>
                <View className="grid grid-cols-2 gap-4">
                  <View>
                    <Text className="block text-xs text-slate-400">策略收益</Text>
                    <View className="flex items-center gap-1">
                      {result.totalReturn > 0 ? (
                        <TrendingUp size={14} color="#22c55e" />
                      ) : result.totalReturn < 0 ? (
                        <TrendingDown size={14} color="#ef4444" />
                      ) : null}
                      <Text className={`block text-lg font-bold ${
                        result.totalReturn > 0 ? 'text-green-500' : result.totalReturn < 0 ? 'text-red-500' : 'text-slate-400'
                      }`}
                      >
                        {result.totalReturn > 0 ? '+' : ''}{result.totalReturn}%
                      </Text>
                    </View>
                  </View>
                  <View>
                    <Text className="block text-xs text-slate-400">基准收益</Text>
                    <View className="flex items-center gap-1">
                      {result.benchmarkReturn > 0 ? (
                        <TrendingUp size={14} color="#3b82f6" />
                      ) : (
                        <TrendingDown size={14} color="#ef4444" />
                      )}
                      <Text className={`block text-lg font-bold ${
                        result.benchmarkReturn > 0 ? 'text-blue-400' : 'text-red-500'
                      }`}
                      >
                        {result.benchmarkReturn > 0 ? '+' : ''}{result.benchmarkReturn}%
                      </Text>
                    </View>
                  </View>
                  <View>
                    <Text className="block text-xs text-slate-400">最终资金</Text>
                    <Text className="block text-base font-bold text-slate-100">
                      ¥{result.finalCapital.toLocaleString()}
                    </Text>
                  </View>
                  <View>
                    <Text className="block text-xs text-slate-400">年化收益</Text>
                    <Text className={`block text-base font-bold ${
                      result.annualizedReturn > 0 ? 'text-green-500' : 'text-red-500'
                    }`}
                    >
                      {result.annualizedReturn > 0 ? '+' : ''}{result.annualizedReturn}%
                    </Text>
                  </View>
                </View>
              </CardContent>
            </Card>

            {/* 风险指标 */}
            <Card className="bg-slate-800 border-slate-700 mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-slate-100 text-base flex items-center gap-2">
                  <TriangleAlert size={16} color="#f59e0b" />
                  <Text className="block">风险指标</Text>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <View className="grid grid-cols-2 gap-4">
                  <View>
                    <Text className="block text-xs text-slate-400">最大回撤</Text>
                    <Text className="block text-base font-bold text-red-500">
                      -{result.maxDrawdown}%
                    </Text>
                  </View>
                  <View>
                    <Text className="block text-xs text-slate-400">波动率</Text>
                    <Text className="block text-base font-bold text-slate-100">
                      {result.volatility}%
                    </Text>
                  </View>
                  <View>
                    <Text className="block text-xs text-slate-400">夏普比率</Text>
                    <Text className={`block text-base font-bold ${
                      result.sharpeRatio > 1 ? 'text-green-500' : result.sharpeRatio > 0 ? 'text-amber-500' : 'text-red-500'
                    }`}
                    >
                      {result.sharpeRatio}
                    </Text>
                  </View>
                  <View>
                    <Text className="block text-xs text-slate-400">索提诺比率</Text>
                    <Text className="block text-base font-bold text-slate-100">
                      {result.sortinoRatio}
                    </Text>
                  </View>
                </View>
              </CardContent>
            </Card>

            {/* 收益曲线 */}
            <Card className="bg-slate-800 border-slate-700 mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-100 text-base flex items-center gap-2">
                  <ChartBar size={16} color="#10b981" />
                  <Text className="block">收益曲线</Text>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <LineChart
                  data={equityPoints}
                  color={result.totalReturn >= 0 ? '#ef4444' : '#22c55e'}
                  fillColors={
                    result.totalReturn >= 0
                      ? ['rgba(239, 68, 68, 0.3)', 'rgba(239, 68, 68, 0)']
                      : ['rgba(34, 197, 94, 0.3)', 'rgba(34, 197, 94, 0)']
                  }
                  height={180}
                  formatValue={(v) => v.toFixed(3)}
                />
                <View className="flex gap-4 mt-2 justify-center">
                  <View className="flex items-center gap-1">
                    <View className="w-2 h-2 rounded-full bg-red-500" />
                    <Text className="block text-xs text-slate-400">▲ 买入</Text>
                  </View>
                  <View className="flex items-center gap-1">
                    <View className="w-2 h-2 rounded-full bg-green-500" />
                    <Text className="block text-xs text-slate-400">▼ 卖出</Text>
                  </View>
                </View>
              </CardContent>
            </Card>

            {/* 回撤走势 */}
            <Card className="bg-slate-800 border-slate-700 mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-100 text-sm">回撤走势</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <LineChart
                  data={drawdownPoints}
                  color="#f97316"
                  fillColors={['rgba(249, 115, 22, 0.2)', 'rgba(249, 115, 22, 0)']}
                  height={90}
                  showZeroLine
                  formatValue={(v) => `${v.toFixed(1)}%`}
                  emptyText="暂无回撤数据"
                />
              </CardContent>
            </Card>

            {/* 交易统计 */}
            <Card className="bg-slate-800 border-slate-700 mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-slate-100 text-base flex items-center gap-2">
                  <Target size={16} color="#10b981" />
                  <Text className="block">交易统计</Text>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <View className="grid grid-cols-3 gap-4">
                  <View>
                    <Text className="block text-xs text-slate-400">总交易</Text>
                    <Text className="block text-lg font-bold text-slate-100">
                      {result.totalTrades}
                    </Text>
                  </View>
                  <View>
                    <Text className="block text-xs text-slate-400">胜率</Text>
                    <Text className={`block text-lg font-bold ${
                      result.winRate >= 50 ? 'text-green-500' : 'text-amber-500'
                    }`}
                    >
                      {result.winRate}%
                    </Text>
                  </View>
                  <View>
                    <Text className="block text-xs text-slate-400">盈亏比</Text>
                    <Text className="block text-lg font-bold text-slate-100">
                      {result.profitFactor}
                    </Text>
                  </View>
                  <View>
                    <Text className="block text-xs text-slate-400">盈利次数</Text>
                    <Text className="block text-base font-bold text-green-500">
                      {result.winTrades}
                    </Text>
                  </View>
                  <View>
                    <Text className="block text-xs text-slate-400">亏损次数</Text>
                    <Text className="block text-base font-bold text-red-500">
                      {result.loseTrades}
                    </Text>
                  </View>
                  <View>
                    <Text className="block text-xs text-slate-400">交易天数</Text>
                    <Text className="block text-base font-bold text-slate-100">
                      {result.tradingDays}
                    </Text>
                  </View>
                </View>
              </CardContent>
            </Card>

            {/* 交易记录 */}
            {result.trades.length > 0 && (
              <Card className="bg-slate-800 border-slate-700 mb-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-slate-100 text-base">交易记录</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollView scrollY className="max-h-60">
                    {result.trades.map((trade, idx) => (
                      <View key={idx}>
                        <View className="flex items-center justify-between py-2">
                          <View className="flex items-center gap-2">
                            <Badge
                              variant={trade.type === 'BUY' ? 'default' : 'destructive'}
                              className={trade.type === 'BUY' ? 'bg-green-500 bg-opacity-20 text-green-400' : 'bg-red-500 bg-opacity-20 text-red-400'}
                            >
                              <Text className="block text-xs">{trade.type === 'BUY' ? '买入' : '卖出'}</Text>
                            </Badge>
                            <Text className="block text-sm text-slate-300">{trade.date}</Text>
                          </View>
                          <View className="text-right">
                            <Text className="block text-sm text-slate-100">
                              ¥{trade.price} x {trade.quantity}
                            </Text>
                            <Text className="block text-xs text-slate-400">{trade.reason}</Text>
                          </View>
                        </View>
                        {idx < result.trades.length - 1 && <Separator className="bg-slate-700" />}
                      </View>
                    ))}
                  </ScrollView>
                </CardContent>
              </Card>
            )}

            {/* 收益曲线 */}
            <Card className="bg-slate-800 border-slate-700 mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-slate-100 text-base">收益曲线</CardTitle>
              </CardHeader>
              <CardContent>
                <View className="h-40 flex items-end justify-between gap-1">
                  {result.equityCurve
                    .filter((_, i) => i % Math.ceil(result.equityCurve.length / 30) === 0)
                    .map((point, idx, arr) => {
                      const min = Math.min(...arr.map(p => p.value))
                      const max = Math.max(...arr.map(p => p.value))
                      const range = max - min || 1
                      const height = ((point.value - min) / range) * 100
                      return (
                        <View
                          key={idx}
                          className="flex-1 bg-emerald-500 bg-opacity-60 rounded-t"
                          style={{ height: `${Math.max(height, 5)}%` }}
                        />
                      )
                    })}
                </View>
                <View className="flex justify-between mt-2">
                  <Text className="block text-xs text-slate-400">{result.startDate}</Text>
                  <Text className="block text-xs text-slate-400">{result.endDate}</Text>
                </View>
              </CardContent>
            </Card>
          </>
        )}
      </View>
    </ScrollView>
  )
}
