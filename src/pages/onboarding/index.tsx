import { View, Text, ScrollView } from '@tarojs/components'
import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { Network } from '@/network'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Wallet,
  Search,
  Plus,
  Trash2,
  Eye,
  Brain,
  Zap,
  ArrowRight,
  CircleCheck,
  TrendingUp,
} from 'lucide-react-taro'

interface StockItem {
  symbol: string
  name: string
  isCustom?: boolean
}

interface WatchItem {
  symbol: string
  name: string
  enabled: boolean
}

interface StrategyItem {
  id: string
  name: string
  type?: string
  description?: string
}

const QUICK_AMOUNTS = [50000, 100000, 300000, 500000]

const OnboardingPage = () => {
  const [step, setStep] = useState(1)
  const [capital, setCapital] = useState('100000')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<StockItem[]>([])
  const [watchlist, setWatchlist] = useState<WatchItem[]>([])
  const [strategies, setStrategies] = useState<StrategyItem[]>([])
  const [selectedStrategyId, setSelectedStrategyId] = useState('')
  const [autoTrade, setAutoTrade] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadWatchlist()
    loadStrategies()
  }, [])

  const loadWatchlist = async () => {
    try {
      const res = await Network.request({ url: '/api/stock/watchlist' })
      const list = res.data?.data
      if (Array.isArray(list)) setWatchlist(list)
    } catch (e) {
      console.error('loadWatchlist error:', e)
    }
  }

  const loadStrategies = async () => {
    try {
      const [builtinRes, customRes] = await Promise.all([
        Network.request({ url: '/api/strategies' }),
        Network.request({ url: '/api/strategies/custom' }),
      ])
      const builtin = builtinRes.data?.data || []
      const custom = customRes.data?.data || []
      const all = [...builtin, ...custom]
      setStrategies(all)
      if (all.length > 0) setSelectedStrategyId(all[0].id)
    } catch (e) {
      console.error('loadStrategies error:', e)
    }
  }

  const searchStocks = async (q: string) => {
    if (!q.trim()) {
      setResults([])
      return
    }
    try {
      const res = await Network.request({ url: `/api/stock/search?q=${encodeURIComponent(q.trim())}` })
      const data = res.data?.data
      setResults(Array.isArray(data) ? data.slice(0, 6) : [])
    } catch (e) {
      console.error('searchStocks error:', e)
    }
  }

  const addWatch = async (symbol: string, name?: string) => {
    try {
      await Network.request({
        url: '/api/stock/watchlist',
        method: 'POST',
        data: { symbol, name },
      })
      Taro.showToast({ title: '已添加关注', icon: 'none' })
      setQuery('')
      setResults([])
      loadWatchlist()
    } catch (e: any) {
      const msg = e?.data?.msg || e?.message || '添加失败'
      Taro.showToast({ title: msg, icon: 'none' })
    }
  }

  const addCustomStock = async (symbol: string) => {
    try {
      await Network.request({
        url: '/api/stock/custom',
        method: 'POST',
        data: { symbol },
      })
      await addWatch(symbol)
    } catch (e: any) {
      const msg = e?.data?.msg || e?.message || '添加失败'
      Taro.showToast({ title: msg, icon: 'none' })
    }
  }

  const toggleWatch = async (symbol: string, enabled: boolean) => {
    try {
      await Network.request({
        url: '/api/stock/watchlist/toggle',
        method: 'PUT',
        data: { symbol, enabled },
      })
      loadWatchlist()
    } catch (e) {
      console.error('toggleWatch error:', e)
    }
  }

  const removeWatch = async (symbol: string) => {
    try {
      await Network.request({ url: `/api/stock/watchlist/${symbol}`, method: 'DELETE' })
      loadWatchlist()
    } catch (e) {
      console.error('removeWatch error:', e)
    }
  }

  const finishSetup = async () => {
    const amount = Number(capital)
    if (!Number.isFinite(amount) || amount <= 0) {
      Taro.showToast({ title: '请输入有效的投入金额', icon: 'none' })
      return
    }
    const enabledSymbols = watchlist.filter((w) => w.enabled).map((w) => w.symbol)
    if (enabledSymbols.length === 0) {
      Taro.showToast({ title: '请至少开启一只股票的投资', icon: 'none' })
      return
    }
    try {
      setSubmitting(true)
      await Network.request({
        url: '/api/beta/start',
        method: 'POST',
        data: {
          initialCapital: amount,
          watchSymbols: enabledSymbols,
          strategyId: selectedStrategyId || null,
          autoTrade,
        },
      })
      // 启动策略监控引擎（信号来源）
      if (selectedStrategyId) {
        try {
          await Network.request({ url: `/api/strategies/${selectedStrategyId}/start`, method: 'POST' })
        } catch (e) {
          console.error('start strategy monitor error:', e)
        }
      }
      Taro.showToast({ title: '内测投资已开启', icon: 'success' })
      setTimeout(() => {
        Taro.switchTab({ url: '/pages/index/index' })
      }, 800)
    } catch (e: any) {
      const msg = e?.data?.message || e?.data?.msg || e?.message || '开启失败'
      Taro.showToast({ title: msg, icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const formatMoney = (val: number) => {
    if (val >= 10000) return `${(val / 10000).toFixed(1)}万`
    return String(val)
  }

  return (
    <ScrollView scrollY className="h-full bg-slate-900 smooth-scroll hide-scrollbar">
      <View className="px-4 pb-10 pt-5 flex flex-col gap-4">
        {/* 标题与步骤条 */}
        <View className="flex flex-col gap-2">
          <Text className="block text-xl font-bold text-slate-100">开启内测投资体验</Text>
          <Text className="block text-xs text-slate-500">三步从零开始：投入金额 → 关注股票 → 配置策略</Text>
          <View className="flex flex-row items-center gap-2 mt-2">
            {[1, 2, 3].map((s) => (
              <View
                key={s}
                className={`h-1 flex-1 rounded-full ${s <= step ? 'bg-emerald-500' : 'bg-slate-700'}`}
              />
            ))}
          </View>
        </View>

        {/* 步骤1：投入金额 */}
        {step === 1 && (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-5 flex flex-col gap-4">
              <View className="flex flex-row items-center gap-2">
                <Wallet size={18} color="#10b981" />
                <Text className="block text-sm font-semibold text-slate-100">设定投入金额</Text>
              </View>
              <View className="bg-slate-900 rounded-xl px-4 py-3">
                <Input
                  type="digit"
                  value={capital}
                  onInput={(e) => setCapital(e.detail.value)}
                  placeholder="请输入投入金额（元）"
                  style={{ width: '100%', backgroundColor: 'transparent', color: '#f1f5f9', fontSize: '18px' }}
                />
              </View>
              <View className="flex flex-row flex-wrap gap-2">
                {QUICK_AMOUNTS.map((amount) => (
                  <View
                    key={amount}
                    onClick={() => setCapital(String(amount))}
                    className={`px-3 py-2 rounded-full border ${
                      Number(capital) === amount
                        ? 'border-emerald-500 bg-emerald-500 bg-opacity-10'
                        : 'border-slate-600 bg-slate-900'
                    }`}
                  >
                    <Text className={`block text-xs ${Number(capital) === amount ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {formatMoney(amount)}
                    </Text>
                  </View>
                ))}
              </View>
              <Button
                className="w-full bg-emerald-500 text-slate-900 rounded-xl"
                onClick={() => {
                  const amount = Number(capital)
                  if (!Number.isFinite(amount) || amount <= 0) {
                    Taro.showToast({ title: '请输入有效金额', icon: 'none' })
                    return
                  }
                  setStep(2)
                }}
              >
                <View className="flex flex-row items-center gap-1">
                  <Text className="block text-sm font-semibold">下一步：关注股票</Text>
                  <ArrowRight size={14} color="#0f172a" />
                </View>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 步骤2：关注股票 */}
        {step === 2 && (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-5 flex flex-col gap-4">
              <View className="flex flex-row items-center justify-between">
                <View className="flex flex-row items-center gap-2">
                  <Eye size={18} color="#10b981" />
                  <Text className="block text-sm font-semibold text-slate-100">选择关注的股票</Text>
                </View>
                <Badge variant="secondary" className="bg-slate-700 text-slate-300">
                  <Text className="block text-xs">{watchlist.length} 只</Text>
                </Badge>
              </View>

              {/* 搜索框 */}
              <View className="bg-slate-900 rounded-xl px-4 py-3 flex flex-row items-center gap-2">
                <Search size={16} color="#64748b" />
                <Input
                  value={query}
                  onInput={(e) => {
                    setQuery(e.detail.value)
                    searchStocks(e.detail.value)
                  }}
                  placeholder="搜索代码/名称，如 600519 或输入自定义代码"
                  style={{ flex: 1, backgroundColor: 'transparent', color: '#f1f5f9', fontSize: '13px' }}
                />
                {/^[036][0-9]{5}$/.test(query.trim()) && (
                  <View onClick={() => addCustomStock(query.trim())} className="flex flex-row items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500 bg-opacity-10">
                    <Plus size={12} color="#10b981" />
                    <Text className="block text-xs text-emerald-400">自定义</Text>
                  </View>
                )}
              </View>

              {/* 搜索结果 */}
              {results.length > 0 && (
                <View className="flex flex-col gap-2">
                  {results.map((item) => (
                    <View
                      key={item.symbol}
                      onClick={() => addWatch(item.symbol, item.name)}
                      className="flex flex-row items-center justify-between bg-slate-900 rounded-lg px-3 py-2"
                    >
                      <View className="flex flex-row items-center gap-2">
                        <Text className="block text-xs text-slate-300">{item.name}</Text>
                        <Text className="block text-xs text-slate-500">{item.symbol}</Text>
                        {item.isCustom && (
                          <Badge className="bg-emerald-500 bg-opacity-20 text-emerald-400">
                            <Text className="block text-[10px]">自定义</Text>
                          </Badge>
                        )}
                      </View>
                      <Plus size={14} color="#10b981" />
                    </View>
                  ))}
                </View>
              )}

              {/* 关注列表 */}
              {watchlist.length === 0 ? (
                <View className="bg-slate-900 rounded-lg p-4">
                  <Text className="block text-xs text-slate-500 text-center">
                    还没有关注的股票，搜索添加一只开始吧
                  </Text>
                </View>
              ) : (
                <View className="flex flex-col gap-2">
                  {watchlist.map((item) => (
                    <View key={item.symbol} className="flex flex-row items-center justify-between bg-slate-900 rounded-lg px-3 py-2">
                      <View className="flex flex-row items-center gap-2">
                        <Text className="block text-sm text-slate-100">{item.name}</Text>
                        <Text className="block text-xs text-slate-500">{item.symbol}</Text>
                      </View>
                      <View className="flex flex-row items-center gap-3">
                        <View className="flex flex-row items-center gap-1.5">
                          <Text className="block text-xs text-slate-400">参与投资</Text>
                          <Switch
                            checked={item.enabled}
                            onCheckedChange={(val: boolean) => toggleWatch(item.symbol, val)}
                          />
                        </View>
                        <View onClick={() => removeWatch(item.symbol)}>
                          <Trash2 size={14} color="#ef4444" />
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              <View className="flex flex-row gap-2">
                <Button variant="outline" className="flex-1 bg-slate-900 border-slate-600 text-slate-300 rounded-xl" onClick={() => setStep(1)}>
                  <Text className="block text-sm">上一步</Text>
                </Button>
                <Button
                  className="flex-1 bg-emerald-500 text-slate-900 rounded-xl"
                  onClick={() => {
                    if (watchlist.length === 0) {
                      Taro.showToast({ title: '至少关注一只股票', icon: 'none' })
                      return
                    }
                    setStep(3)
                  }}
                >
                  <View className="flex flex-row items-center gap-1">
                    <Text className="block text-sm font-semibold">下一步：配置策略</Text>
                    <ArrowRight size={14} color="#0f172a" />
                  </View>
                </Button>
              </View>
            </CardContent>
          </Card>
        )}

        {/* 步骤3：配置策略 */}
        {step === 3 && (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-5 flex flex-col gap-4">
              <View className="flex flex-row items-center gap-2">
                <Brain size={18} color="#10b981" />
                <Text className="block text-sm font-semibold text-slate-100">选择交易策略</Text>
              </View>

              <View className="flex flex-col gap-2">
                {strategies.map((s) => (
                  <View
                    key={s.id}
                    onClick={() => setSelectedStrategyId(s.id)}
                    className={`rounded-lg px-3 py-2 border ${
                      selectedStrategyId === s.id
                        ? 'border-emerald-500 bg-emerald-500 bg-opacity-10'
                        : 'border-slate-700 bg-slate-900'
                    }`}
                  >
                    <View className="flex flex-row items-center justify-between">
                      <View className="flex flex-row items-center gap-2">
                        {selectedStrategyId === s.id && <CircleCheck size={14} color="#10b981" />}
                        <Text className="block text-sm text-slate-100">{s.name}</Text>
                      </View>
                      {s.type && (
                        <Badge variant="secondary" className="bg-slate-700 text-slate-400">
                          <Text className="block text-[10px]">{s.type}</Text>
                        </Badge>
                      )}
                    </View>
                    {s.description && (
                      <Text className="block text-xs text-slate-500 mt-1">{s.description}</Text>
                    )}
                  </View>
                ))}
              </View>

              <View className="flex flex-row items-center justify-between bg-slate-900 rounded-lg px-3 py-3">
                <View className="flex flex-row items-center gap-2">
                  <Zap size={14} color="#facc15" />
                  <View className="flex flex-col gap-0.5">
                    <Text className="block text-sm text-slate-100">自动交易</Text>
                    <Text className="block text-xs text-slate-500">信号触发后自动模拟买入/卖出</Text>
                  </View>
                </View>
                <Switch checked={autoTrade} onCheckedChange={(val: boolean) => setAutoTrade(val)} />
              </View>

              <View className="flex flex-row gap-2">
                <Button variant="outline" className="flex-1 bg-slate-900 border-slate-600 text-slate-300 rounded-xl" onClick={() => setStep(2)}>
                  <Text className="block text-sm">上一步</Text>
                </Button>
                <Button
                  className="flex-1 bg-emerald-500 text-slate-900 rounded-xl"
                  disabled={submitting}
                  onClick={finishSetup}
                >
                  <View className="flex flex-row items-center gap-1">
                    <TrendingUp size={14} color="#0f172a" />
                    <Text className="block text-sm font-semibold">{submitting ? '开启中...' : '开启投资'}</Text>
                  </View>
                </Button>
              </View>
            </CardContent>
          </Card>
        )}
      </View>
    </ScrollView>
  )
}

export default OnboardingPage
