import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { Network } from '@/network'
import { Card, CardContent } from '@/components/ui/card'
import { CandleChart } from '@/components/chart/candle-chart'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { TrendingUp, TrendingDown, DollarSign, ChartPie } from 'lucide-react-taro'

interface PositionDetail {
  symbol: string
  name: string
  quantity: number
  avgCost: number
  currentPrice: number
  marketValue: number
  pnl: number
  pnlRate: number
  availableQty?: number
}

export default function PositionPage() {
  const router = useRouter()
  const symbol = router.params.symbol || '600519'
  const name = router.params.name || ''
  const [position, setPosition] = useState<PositionDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [showSellSheet, setShowSellSheet] = useState(false)
  const [sellQty, setSellQty] = useState('')
  const [sellPrice, setSellPrice] = useState('')
  const [showBuySheet, setShowBuySheet] = useState(false)
  const [buyQty, setBuyQty] = useState('')
  const [buyPrice, setBuyPrice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [kline, setKline] = useState<any[]>([])
  const [klinePeriod, setKlinePeriod] = useState<'30' | '60' | '120'>('30')

  const loadKline = useCallback(async () => {
    try {
      const res = await Network.request({
        url: '/api/stock/kline',
        data: { symbol, period: 'daily', limit: klinePeriod },
      })
      const list = res.data?.data || []
      // 最近 N 根
      setKline(list.slice(-parseInt(klinePeriod)))
    } catch (e) {
      console.error('[position] kline error', e)
      setKline([])
    }
  }, [symbol, klinePeriod])

  const loadPosition = useCallback(async () => {
    setLoading(true)
    try {
      const res = await Network.request({
        url: `/api/paper-trading/position/${encodeURIComponent(symbol)}`,
      })
      setPosition(res.data?.data ?? null)
    } catch (e) {
      console.error('[position] load error', e)
    } finally {
      setLoading(false)
    }
  }, [symbol])

  useEffect(() => {
    loadPosition()
    loadKline()
  }, [loadPosition, loadKline])

  const fmtMoney = (n: number) => (n >= 0 ? '' : '-') + '¥' + Math.abs(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtPct = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%'

  const handleBuy = async () => {
    const qty = parseInt(buyQty)
    const price = parseFloat(buyPrice)
    if (!qty || qty <= 0) return Taro.showToast({ title: '请输入数量', icon: 'none' })
    if (!price || price <= 0) return Taro.showToast({ title: '请输入价格', icon: 'none' })
    setSubmitting(true)
    try {
      const res = await Network.request({
        url: '/api/paper-trading/manual/buy',
        method: 'POST',
        data: { symbol, name: position?.name || name, price, quantity: qty, reason: '手动买入' },
      })
      if (res.data?.code === 200) {
        Taro.showToast({ title: '买入成功', icon: 'success' })
        setShowBuySheet(false)
        setBuyQty('')
        setBuyPrice('')
        loadPosition()
      } else {
        Taro.showToast({ title: res.data?.msg || '买入失败', icon: 'none' })
      }
    } catch (e) {
      Taro.showToast({ title: '买入失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleSell = async () => {
    const qty = sellQty === '' ? position?.quantity || 0 : parseInt(sellQty)
    const price = parseFloat(sellPrice)
    if (!qty || qty <= 0) return Taro.showToast({ title: '请输入数量', icon: 'none' })
    if (!price || price <= 0) return Taro.showToast({ title: '请输入价格', icon: 'none' })
    if (position && qty > position.quantity) {
      return Taro.showToast({ title: '超出持仓数量', icon: 'none' })
    }
    setSubmitting(true)
    try {
      const res = await Network.request({
        url: '/api/paper-trading/manual/sell',
        method: 'POST',
        data: { symbol, price, quantity: qty, reason: '手动卖出' },
      })
      if (res.data?.code === 200) {
        Taro.showToast({ title: '卖出成功', icon: 'success' })
        setShowSellSheet(false)
        setSellQty('')
        setSellPrice('')
        loadPosition()
      } else {
        Taro.showToast({ title: res.data?.msg || '卖出失败', icon: 'none' })
      }
    } catch (e) {
      Taro.showToast({ title: '卖出失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const isProfit = (position?.pnl ?? 0) >= 0

  if (!position && !loading) {
    return (
      <View className="flex flex-col items-center justify-center h-full bg-slate-900">
        <Text className="block text-slate-500 text-sm">暂无该持仓</Text>
      </View>
    )
  }

  return (
    <View className="flex flex-col h-full bg-slate-900">
      <ScrollView scrollY className="flex-1 px-4 py-4 smooth-scroll">
        {/* 头部：价格与盈亏 */}
        <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 rounded-2xl mb-4">
          <CardContent className="p-5">
            <View className="flex flex-row items-center justify-between">
              <View>
                <Text className="block text-lg font-bold text-white">{position?.name || name}</Text>
                <Text className="block text-xs text-slate-400 mt-1 tabular-nums">{symbol}</Text>
              </View>
              <Badge className={isProfit ? 'bg-emerald-500 bg-opacity-20 text-emerald-400' : 'bg-red-500 bg-opacity-20 text-red-400'}>
                {isProfit ? '盈利中' : '亏损中'}
              </Badge>
            </View>

            <View className="mt-5">
              <Text className="block text-xs text-slate-400">浮动盈亏</Text>
              <View className="flex flex-row items-baseline gap-2 mt-1">
                <Text className={`block text-3xl font-bold tabular-nums ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                  {fmtMoney(position?.pnl ?? 0)}
                </Text>
                <Text className={`block text-base font-semibold tabular-nums ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                  {fmtPct(position?.pnlRate ?? 0)}
                </Text>
              </View>
            </View>

            <Separator className="my-4 bg-slate-700" />

            <View className="grid grid-cols-2 gap-3">
              <View className="flex flex-row items-center gap-2">
                <DollarSign size={14} color="#94a3b8" />
                <View>
                  <Text className="block text-xs text-slate-400">当前价</Text>
                  <Text className="block text-sm font-medium text-white tabular-nums mt-1">¥{position?.currentPrice?.toFixed(2) || '--'}</Text>
                </View>
              </View>
              <View className="flex flex-row items-center gap-2">
                <ChartPie size={14} color="#94a3b8" />
                <View>
                  <Text className="block text-xs text-slate-400">成本价</Text>
                  <Text className="block text-sm font-medium text-white tabular-nums mt-1">¥{position?.avgCost?.toFixed(2) || '--'}</Text>
                </View>
              </View>
              <View className="flex flex-row items-center gap-2">
                {isProfit ? <TrendingUp size={14} color="#34d399" /> : <TrendingDown size={14} color="#f87171" />}
                <View>
                  <Text className="block text-xs text-slate-400">市值</Text>
                  <Text className="block text-sm font-medium text-white tabular-nums mt-1">{fmtMoney(position?.marketValue ?? 0)}</Text>
                </View>
              </View>
              <View className="flex flex-row items-center gap-2">
                <ChartPie size={14} color="#94a3b8" />
                <View>
                  <Text className="block text-xs text-slate-400">持仓</Text>
                  <Text className="block text-sm font-medium text-white tabular-nums mt-1">{position?.quantity || 0} 股</Text>
                </View>
              </View>
            </View>
          </CardContent>
        </Card>

        {/* K线图 */}
        <Card className="bg-slate-800 border-slate-700 rounded-2xl mb-4">
          <CardContent className="p-4">
            <View className="flex flex-row items-center justify-between mb-3">
              <Text className="block text-sm font-medium text-white">日K走势</Text>
              <View className="flex flex-row gap-1">
                {(['30', '60', '120'] as const).map((p) => (
                  <Badge
                    key={p}
                    className={`${klinePeriod === p
                      ? 'bg-emerald-500 text-white border-emerald-500'
                      : 'bg-slate-700 text-slate-400 border-slate-600'}`}
                    onClick={() => setKlinePeriod(p)}
                  >
                    {p}日
                  </Badge>
                ))}
              </View>
            </View>
            {kline.length > 0 ? (
              <CandleChart
                // @ts-expect-error 数据字段类型兼容
                data={kline.map((k: any) => ({
                  time: k.date?.slice(5) || k.day?.slice(5) || '',
                  open: parseFloat(k.open),
                  high: parseFloat(k.high),
                  low: parseFloat(k.low),
                  close: parseFloat(k.close),
                }))}
                costPrice={position?.avgCost}
                height={220}
              />
            ) : (
              <View className="flex items-center justify-center h-48">
                <Text className="block text-xs text-slate-500">暂无K线数据</Text>
              </View>
            )}
          </CardContent>
        </Card>

        {/* 操作按钮 */}
        <View className="flex flex-row gap-3 mb-4">
          <Button
            className="flex-1 h-10 bg-emerald-500 text-white"
            onClick={() => {
              setBuyPrice(String(position?.currentPrice || ''))
              setShowBuySheet(true)
            }}
          >
            <Text className="text-sm font-medium">买入</Text>
          </Button>
          <Button
            className="flex-1 h-10 bg-red-500 text-white"
            onClick={() => {
              setSellPrice(String(position?.currentPrice || ''))
              setShowSellSheet(true)
            }}
          >
            <Text className="text-sm font-medium">卖出</Text>
          </Button>
        </View>

        {/* 交易记录入口 */}
        <Card
          className="bg-slate-800 border-slate-700 rounded-xl"
          onClick={() => Taro.navigateTo({ url: `/pages/trades/index?symbol=${symbol}` })}
        >
          <CardContent className="p-4">
            <View className="flex flex-row items-center justify-between">
              <Text className="block text-sm font-medium text-white">查看交易记录</Text>
              <Text className="block text-xs text-slate-400">→</Text>
            </View>
          </CardContent>
        </Card>
      </ScrollView>

      {/* 买入弹层 */}
      {showBuySheet && (
        <View className="fixed inset-0 bg-black bg-opacity-60 z-50 flex flex-col justify-end" onClick={() => setShowBuySheet(false)}>
          <View className="bg-slate-800 rounded-t-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <Text className="block text-lg font-bold text-white mb-4">手动买入</Text>
            <View className="bg-slate-900 rounded-xl px-4 py-3 mb-3">
              <Text className="block text-xs text-slate-400 mb-1">买入价格（元）</Text>
              <input
                className="w-full bg-transparent text-white text-base font-medium outline-none tabular-nums"
                placeholder="请输入价格"
                value={buyPrice}
                onInput={(e: any) => setBuyPrice(e.target.value)}
                type="number"
                step="0.01"
              />
            </View>
            <View className="bg-slate-900 rounded-xl px-4 py-3 mb-4">
              <Text className="block text-xs text-slate-400 mb-1">买入数量（股）</Text>
              <input
                className="w-full bg-transparent text-white text-base font-medium outline-none tabular-nums"
                placeholder="请输入数量"
                value={buyQty}
                onInput={(e: any) => setBuyQty(e.target.value)}
                type="number"
              />
            </View>
            <Button
              className="w-full h-11 bg-emerald-500 text-white"
              onClick={handleBuy}
              disabled={submitting}
            >
              <Text className="text-sm font-medium">{submitting ? '提交中...' : '确认买入'}</Text>
            </Button>
          </View>
        </View>
      )}

      {/* 卖出弹层 */}
      {showSellSheet && (
        <View className="fixed inset-0 bg-black bg-opacity-60 z-50 flex flex-col justify-end" onClick={() => setShowSellSheet(false)}>
          <View className="bg-slate-800 rounded-t-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <Text className="block text-lg font-bold text-white mb-2">手动卖出</Text>
            <Text className="block text-xs text-slate-400 mb-4">可卖 {position?.quantity || 0} 股</Text>
            <View className="bg-slate-900 rounded-xl px-4 py-3 mb-3">
              <Text className="block text-xs text-slate-400 mb-1">卖出价格（元）</Text>
              <input
                className="w-full bg-transparent text-white text-base font-medium outline-none tabular-nums"
                placeholder="请输入价格"
                value={sellPrice}
                onInput={(e: any) => setSellPrice(e.target.value)}
                type="number"
                step="0.01"
              />
            </View>
            <View className="bg-slate-900 rounded-xl px-4 py-3 mb-4">
              <Text className="block text-xs text-slate-400 mb-1">卖出数量（留空全部卖出）</Text>
              <input
                className="w-full bg-transparent text-white text-base font-medium outline-none tabular-nums"
                placeholder={`可卖 ${position?.quantity || 0} 股`}
                value={sellQty}
                onInput={(e: any) => setSellQty(e.target.value)}
                type="number"
              />
            </View>
            <Button
              className="w-full h-11 bg-red-500 text-white"
              onClick={handleSell}
              disabled={submitting}
            >
              <Text className="text-sm font-medium">{submitting ? '提交中...' : '确认卖出'}</Text>
            </Button>
          </View>
        </View>
      )}
    </View>
  )
}
