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
import { TrendingUp, TrendingDown, Play, Target, TriangleAlert, ChartBar } from 'lucide-react-taro'
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
  const [symbol, setSymbol] = useState('600519')
  const [startDate, setStartDate] = useState('2024-01-01')
  const [endDate, setEndDate] = useState('2024-06-30')
  const [initialCapital, setInitialCapital] = useState('100000')
  const [indicators, setIndicators] = useState(['MA', 'MACD'])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<BacktestResult | null>(null)

  // 收益曲线数据（净值基准，1.0 起）
  const equityPoints = useMemo(() => {
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
  }, [result])

  // 回撤曲线（百分比）
  const drawdownPoints = useMemo(() => {
    if (!result?.equityCurve?.length) return []
    return result.equityCurve.map(p => ({
      label: p.date.slice(5),
      value: -p.drawdown, // 画在零轴下方更直观，用负数
    }))
  }, [result])

  const handleBacktest = async () => {
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
      } else {
        Taro.showToast({ title: res.data?.message || res.data?.msg || '回测失败', icon: 'none' })
      }
    } catch (error: any) {
      console.error('回测失败:', error)
      Taro.showToast({ title: error?.data?.message || error?.message || '回测失败', icon: 'none' })
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
        {/* 参数设置区 */}
        <Card className="bg-slate-800 border-slate-700 mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-100 text-base flex items-center gap-2">
              <ChartBar size={18} color="#3b82f6" />
              <Text className="block">回测参数</Text>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 股票选择 */}
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

            {/* 技术指标 */}
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

            {/* 开始回测按钮 */}
            <Button
              className="w-full bg-blue-500 text-white"
              onClick={handleBacktest}
              disabled={loading}
            >
              <Play size={16} className="mr-2" color="#ffffff" />
              <Text className="block">{loading ? '回测中...' : '开始回测'}</Text>
            </Button>
          </CardContent>
        </Card>

        {/* 回测结果 */}
        {result && (
          <>
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
