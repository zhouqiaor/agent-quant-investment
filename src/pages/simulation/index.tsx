import { useEffect, useRef, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Network } from '@/network'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Play, Pause, Square, RefreshCw, ChartBar, Activity, TrendingUp, TrendingDown, Wallet, Layers, ListOrdered } from 'lucide-react-taro'

interface RunSummary {
  runId: string
  month: string
  accountCount: number
  aggregateReturn: number
  winRate: number
  sharpe: number
  maxDrawdown: number
  calmar: number
  industryStats: { industry: string; accounts: number; avgReturn: number; winRate: number }[]
  strategyStats: { strategy: string; accounts: number; avgReturn: number; winRate: number }[]
}

interface YearReport {
  runCount: number
  summaries: RunSummary[]
}

function fmtPct(v: number) {
  return `${(v * 100).toFixed(2)}%`
}
function fmtColor(v: number) {
  if (v > 0.02) return 'text-emerald-500'
  if (v < -0.02) return 'text-rose-500'
  return 'text-slate-500'
}

function MonthBadge({ month }: { month: string }) {
  const m = Number(month.split('-')[1])
  const replay = m <= 9 || (m === 10 && new Date().getMonth() + 1 >= 10)
  return replay ? (
    <Badge className="bg-blue-500 bg-opacity-15 text-blue-600 border-blue-500 border-opacity-30 text-xs">回放</Badge>
  ) : (
    <Badge className="bg-violet-500 bg-opacity-15 text-violet-600 border-violet-500 border-opacity-30 text-xs">前瞻</Badge>
  )
}

function KPICard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <Text className="block text-xs text-muted-foreground">{label}</Text>
        <Text className="block text-2xl font-semibold mt-1">{value}</Text>
        {sub ? <Text className="block text-xs text-muted-foreground mt-1">{sub}</Text> : null}
      </CardContent>
    </Card>
  )
}

function MonthTable({ runs }: { runs: RunSummary[] }) {
  return (
    <Card>
      <CardContent className="p-0">
        <ScrollArea className="h-[420px]">
          <View className="p-4">
            {runs.map((r) => (
              <View key={r.runId} className="grid grid-cols-12 items-center gap-2 py-2 border-b border-slate-100 last:border-b-0">
                <View className="col-span-2 flex items-center gap-1.5">
                  <Text className="text-sm font-medium">{r.month}</Text>
                  <MonthBadge month={r.month} />
                </View>
                <Text className="col-span-1 text-xs text-muted-foreground">{r.accountCount}账户</Text>
                <Text className={`col-span-2 text-sm font-semibold ${fmtColor(r.aggregateReturn / r.accountCount)}`}>
                  {fmtPct(r.aggregateReturn / r.accountCount)}
                </Text>
                <Text className="col-span-1 text-xs text-muted-foreground">胜率</Text>
                <Text className="col-span-1 text-sm">{fmtPct(r.winRate)}</Text>
                <Text className="col-span-1 text-xs text-muted-foreground">Sharpe</Text>
                <Text className="col-span-1 text-sm">{r.sharpe.toFixed(2)}</Text>
                <Text className="col-span-1 text-xs text-muted-foreground">MaxDD</Text>
                <Text className="col-span-1 text-sm text-rose-500">{fmtPct(r.maxDrawdown)}</Text>
                <Text className="col-span-1 text-xs text-muted-foreground">Calmar</Text>
                <Text className="col-span-1 text-sm">{r.calmar.toFixed(2)}</Text>
              </View>
            ))}
          </View>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

function HeatGrid({ runs, dim }: { runs: RunSummary[]; dim: 'industryStats' | 'strategyStats' }) {
  const codes = Array.from(new Set(runs.flatMap((r) => r[dim].map((s) => ('industry' in s ? s.industry : (s as any).strategy)))))
  const months = runs.map((r) => r.month)
  return (
    <Card>
      <CardContent className="p-4">
        <ScrollArea className="h-[360px]">
          <View className="min-w-max">
            <View className="grid sticky top-0 z-10 bg-white border-b" style={{ gridTemplateColumns: `80px repeat(${months.length}, 56px)` }}>
              <Text className="p-2 text-xs text-muted-foreground">维度</Text>
              {months.map((m) => (
                <Text key={m} className="p-2 text-xs text-center text-muted-foreground">
                  {m.slice(5)}
                </Text>
              ))}
            </View>
            {codes.map((code) => {
                const cells = months.map((m) => {
                  const r = runs.find((rr) => rr.month === m)
                  const stat = r?.[dim].find((s: any) => (s.industry ?? s.strategy) === code)
                  return stat?.avgReturn ?? null
                })
                return (
                  <View key={code} className="grid border-b" style={{ gridTemplateColumns: `80px repeat(${months.length}, 56px)` }}>
                    <Text className="p-2 text-xs font-medium">{code}</Text>
                    {cells.map((v, i) => {
                      const bg = v === null ? '#f1f5f9' : v > 0.05 ? '#10b981' : v > 0.02 ? '#6ee7b7' : v > 0 ? '#a7f3d0' : v > -0.02 ? '#fecaca' : v > -0.05 ? '#f87171' : '#dc2626'
                      return (
                        <View key={i} className="p-1">
                          <View className="rounded text-center text-xs font-mono py-1" style={{ backgroundColor: bg, color: v === null ? '#94a3b8' : '#fff' }}>
                            <Text>{v === null ? '-' : `${(v * 100).toFixed(0)}%`}</Text>
                          </View>
                        </View>
                      )
                    })}
                  </View>
                )
              })}
          </View>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

/* ====================================================================== */
/* Live 实时盯盘面板                                                       */
/* ====================================================================== */

const STRATEGY_OPTIONS = [
  { value: 'ma_cross', label: '均线交叉' },
  { value: 'momentum', label: '动量' },
  { value: 'reversal', label: '反转' },
  { value: 'breakout', label: '突破' },
  { value: 'trend_follow', label: '趋势跟随' },
]

const MONTH_OPTIONS = [
  { value: '2026-01', label: '2026-01 年初杀跌' },
  { value: '2026-02', label: '2026-02 春节反弹' },
  { value: '2026-03', label: '2026-03 两会行情' },
  { value: '2026-04', label: '2026-04 财报季' },
  { value: '2026-05', label: '2026-05 红五月' },
  { value: '2026-06', label: '2026-06 震荡市' },
  { value: '2026-07', label: '2026-07 中报预热' },
  { value: '2026-08', label: '2026-08 政策预期' },
  { value: '2026-09', label: '2026-09 金九银十' },
  { value: '2026-10', label: '2026-10 调整月' },
  { value: '2026-11', label: '2026-11 估值修复' },
  { value: '2026-12', label: '2026-12 跨年布局' },
]

interface LivePosition {
  symbol: string
  qty: number
  avgCost: number
  currentPrice: number
  marketValue: number
  unrealizedPnl: number
  unrealizedPnlPct: number
}

interface LiveOrder {
  id: string
  side: 'BUY' | 'SELL'
  symbol: string
  quantity: number
  price: number
  amount: number
  fee: number
  realizedPnl: number | null
  reason: string
  ts: number
}

interface LiveState {
  runId: string
  status: 'idle' | 'running' | 'paused' | 'finished' | 'errored'
  month: string
  strategy: string
  initialCash: number
  startedAt: number
  currentTick: number
  totalTicks: number
  feedStatus: string | null
  portfolio: {
    cash: number
    initialCash: number
    positions: LivePosition[]
    realizedPnl: number
    unrealizedPnl: number
    totalPnl: number
    totalPnlPct: number
    equity: number
    equityCurve: { ts: number; equity: number }[]
  }
  recentOrders: LiveOrder[]
  lastError: string | null
}

function fmtMoney(v: number) {
  return v.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

function fmtPrice(v: number) {
  return v.toFixed(2)
}

function pnlColor(v: number) {
  if (v > 0.01) return 'text-emerald-500'
  if (v < -0.01) return 'text-rose-500'
  return 'text-slate-500'
}

function LivePanel() {
  const [month, setMonth] = useState('2026-03')
  const [strategy, setStrategy] = useState('ma_cross')
  const [tickMs, setTickMs] = useState('500')
  const [runId, setRunId] = useState<string | null>(null)
  const [state, setState] = useState<LiveState | null>(null)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  const startPolling = (id: string) => {
    stopPolling()
    const isMiniapp = ([Taro.ENV_TYPE.WEAPP, Taro.ENV_TYPE.TT] as string[]).includes(Taro.getEnv() as string)
    const handle = isMiniapp ? (Taro as any).setInterval : setInterval
    pollRef.current = handle(async () => {
      try {
        const res: any = await Network.request({ url: `/api/live/${id}/state` })
        const data = res?.data?.data
        if (data) {
          setState(data as LiveState)
          if (data.status === 'finished' || data.status === 'errored') stopPolling()
        }
      } catch (e) {
        // 网络抖动不打断轮询
      }
    }, 2000)
  }

  useEffect(() => {
    return () => stopPolling()
  }, [])

  const handleStart = async () => {
    setError(null)
    setStarting(true)
    try {
      const res: any = await Network.request({
        url: '/api/live/start',
        method: 'POST',
        data: { month, strategy, tickMs: Number(tickMs), initialCash: 1_000_000 },
      })
      const data = res?.data?.data
      if (res?.data?.code === 200 && data?.runId) {
        setRunId(data.runId)
        startPolling(data.runId)
      } else {
        setError(res?.data?.msg ?? '启动失败')
      }
    } catch (e: any) {
      setError(e?.message ?? '网络错误')
    } finally {
      setStarting(false)
    }
  }

  const handlePause = async () => {
    if (!runId) return
    await Network.request({ url: `/api/live/${runId}/pause`, method: 'POST' })
  }

  const handleResume = async () => {
    if (!runId) return
    await Network.request({ url: `/api/live/${runId}/resume`, method: 'POST' })
  }

  const handleStop = async () => {
    if (!runId) return
    await Network.request({ url: `/api/live/${runId}/stop`, method: 'POST' })
    stopPolling()
    setRunId(null)
    setState(null)
  }

  const isRunning = state?.status === 'running'
  const isPaused = state?.status === 'paused'
  const isFinished = state?.status === 'finished' || state?.status === 'errored'

  return (
    <View className="space-y-3">
      {/* 控制栏 */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <View className="flex items-center gap-2">
            <Text className="block text-sm font-medium">实时仿真控制台</Text>
            <Text className="text-xs text-muted-foreground ml-auto">2 秒轮询</Text>
          </View>

          <View className="grid grid-cols-2 gap-2">
            <View>
              <Text className="block text-xs text-muted-foreground mb-1">月份</Text>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择月份" />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_OPTIONS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </View>
            <View>
              <Text className="block text-xs text-muted-foreground mb-1">策略</Text>
              <Select value={strategy} onValueChange={setStrategy}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择策略" />
                </SelectTrigger>
                <SelectContent>
                  {STRATEGY_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </View>
          </View>

          <View className="grid grid-cols-2 gap-2">
            <View>
              <Text className="block text-xs text-muted-foreground mb-1">Tick 间隔 (ms)</Text>
              <Select value={tickMs} onValueChange={setTickMs}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="tickMs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="200">200ms（演示）</SelectItem>
                  <SelectItem value="500">500ms</SelectItem>
                  <SelectItem value="1000">1000ms</SelectItem>
                  <SelectItem value="2000">2000ms</SelectItem>
                </SelectContent>
              </Select>
            </View>
            <View>
              <Text className="block text-xs text-muted-foreground mb-1">状态</Text>
              <View className="h-10 flex items-center px-3 rounded-md border bg-slate-50">
                <Text className="text-sm font-mono">
                  {state?.status ?? '未启动'}
                  {state?.currentTick != null && state?.totalTicks != null
                    ? `  ${state.currentTick}/${state.totalTicks}`
                    : ''}
                </Text>
              </View>
            </View>
          </View>

          <View className="flex gap-2">
            {!runId || isFinished ? (
              <Button className="flex-1" onClick={handleStart} disabled={starting}>
                <Play size={14} color="white" />
                <Text className="ml-1 text-white">{starting ? '启动中…' : '启动'}</Text>
              </Button>
            ) : (
              <>
                {isRunning ? (
                  <Button className="flex-1" variant="outline" onClick={handlePause}>
                    <Pause size={14} color="#64748b" />
                    <Text className="ml-1">暂停</Text>
                  </Button>
                ) : isPaused ? (
                  <Button className="flex-1" onClick={handleResume}>
                    <Play size={14} color="white" />
                    <Text className="ml-1 text-white">恢复</Text>
                  </Button>
                ) : null}
                <Button className="flex-1" variant="destructive" onClick={handleStop}>
                  <Square size={14} color="white" />
                  <Text className="ml-1 text-white">停止</Text>
                </Button>
              </>
            )}
          </View>

          {error && (
            <View className="bg-rose-50 border border-rose-200 rounded p-2">
              <Text className="text-xs text-rose-600">⚠ {error}</Text>
            </View>
          )}
        </CardContent>
      </Card>

      {/* P&L 卡片 */}
      {state ? (
        <View className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-3">
              <View className="flex items-center justify-between">
                <Text className="text-xs text-muted-foreground">累计 P&L</Text>
                {state.portfolio.totalPnl >= 0 ? (
                  <TrendingUp size={14} color="#10b981" />
                ) : (
                  <TrendingDown size={14} color="#f43f5e" />
                )}
              </View>
              <Text className={`block text-xl font-semibold mt-1 ${pnlColor(state.portfolio.totalPnl)}`}>
                {state.portfolio.totalPnl >= 0 ? '+' : ''}{fmtMoney(state.portfolio.totalPnl)}
              </Text>
              <Text className={`block text-xs mt-1 ${pnlColor(state.portfolio.totalPnlPct / 100)}`}>
                {state.portfolio.totalPnlPct >= 0 ? '+' : ''}{state.portfolio.totalPnlPct.toFixed(2)}%
              </Text>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <View className="flex items-center justify-between">
                <Text className="text-xs text-muted-foreground">当前权益</Text>
                <Wallet size={14} color="#64748b" />
              </View>
              <Text className="block text-xl font-semibold mt-1 font-mono">
                {fmtMoney(state.portfolio.equity)}
              </Text>
              <Text className="block text-xs text-muted-foreground mt-1">
                现金 {fmtMoney(state.portfolio.cash)}
              </Text>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <Text className="text-xs text-muted-foreground">已实现 / 未实现</Text>
              <Text className={`block text-sm font-medium mt-1 ${pnlColor(state.portfolio.realizedPnl)}`}>
                R: {state.portfolio.realizedPnl >= 0 ? '+' : ''}{fmtMoney(state.portfolio.realizedPnl)}
              </Text>
              <Text className={`block text-sm font-medium ${pnlColor(state.portfolio.unrealizedPnl)}`}>
                U: {state.portfolio.unrealizedPnl >= 0 ? '+' : ''}{fmtMoney(state.portfolio.unrealizedPnl)}
              </Text>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <Text className="text-xs text-muted-foreground">订单 / 持仓</Text>
              <Text className="block text-xl font-semibold mt-1">
                {state.recentOrders.length} / {state.portfolio.positions.length}
              </Text>
              <Text className="block text-xs text-muted-foreground mt-1">最近订单 / 当前持仓</Text>
            </CardContent>
          </Card>
        </View>
      ) : (
        <Card>
          <CardContent className="p-6">
            <Text className="block text-center text-sm text-muted-foreground">
              点击启动按钮开始一次实时仿真
            </Text>
          </CardContent>
        </Card>
      )}

      {/* 持仓列表 */}
      {state && state.portfolio.positions.length > 0 && (
        <Card>
          <CardHeader>
            <View className="flex items-center gap-2">
              <Layers size={14} color="#64748b" />
              <CardTitle>当前持仓（{state.portfolio.positions.length}）</CardTitle>
            </View>
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea className="h-[200px]">
              <View className="space-y-1">
                {state.portfolio.positions.map((p) => (
                  <View key={p.symbol} className="grid grid-cols-12 items-center gap-1 py-2 border-b border-slate-100 last:border-b-0">
                    <Text className="col-span-3 text-sm font-medium">{p.symbol}</Text>
                    <Text className="col-span-2 text-xs text-right text-muted-foreground">{p.qty}股</Text>
                    <Text className="col-span-2 text-xs text-right font-mono">{fmtPrice(p.avgCost)}</Text>
                    <Text className="col-span-2 text-xs text-right font-mono">{fmtPrice(p.currentPrice)}</Text>
                    <Text className={`col-span-3 text-xs text-right font-mono ${pnlColor(p.unrealizedPnl)}`}>
                      {p.unrealizedPnl >= 0 ? '+' : ''}{fmtMoney(p.unrealizedPnl)}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* 订单流 */}
      {state && state.recentOrders.length > 0 && (
        <Card>
          <CardHeader>
            <View className="flex items-center gap-2">
              <ListOrdered size={14} color="#64748b" />
              <CardTitle>最近订单（最新 {state.recentOrders.length} 笔）</CardTitle>
            </View>
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea className="h-[240px]">
              <View className="space-y-1">
                {state.recentOrders.map((o) => (
                  <View key={o.id} className="grid grid-cols-12 items-center gap-1 py-2 border-b border-slate-100 last:border-b-0">
                    <View className="col-span-2">
                      <Text className={`text-xs font-medium ${o.side === 'BUY' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {o.side === 'BUY' ? '买' : '卖'}
                      </Text>
                    </View>
                    <Text className="col-span-3 text-sm">{o.symbol}</Text>
                    <Text className="col-span-2 text-xs text-right text-muted-foreground">{o.quantity}股</Text>
                    <Text className="col-span-2 text-xs text-right font-mono">{fmtPrice(o.price)}</Text>
                    <Text className={`col-span-3 text-right text-xs ${o.realizedPnl != null ? pnlColor(o.realizedPnl) : 'text-slate-500'}`}>
                      {o.realizedPnl != null ? `${o.realizedPnl >= 0 ? '+' : ''}${fmtMoney(o.realizedPnl)}` : '—'}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </View>
  )
}

export default function SimulationPage() {
  const [report, setReport] = useState<YearReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      console.log('[simulation] GET /api/simulation/year-report')
      const res = await Network.request<{ data: YearReport }>({ url: '/api/simulation/year-report' })
      setReport(res.data.data)
    } catch (e: any) {
      console.error('[simulation] load error:', e)
      setError(e?.message ?? '加载失败')
    } finally {
      setLoading(false)
    }
  }

  if (loading && !report) {
    return (
      <View className="p-4 space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </View>
    )
  }

  if (error) {
    return (
      <View className="p-6">
        <Card>
          <CardContent className="p-6">
            <Text className="block text-base font-medium mb-2">加载失败</Text>
            <Text className="block text-sm text-muted-foreground">{error}</Text>
            <View className="mt-4" onClick={load}>
              <Text className="text-blue-600">点击重试</Text>
            </View>
          </CardContent>
        </Card>
      </View>
    )
  }

  if (!report) {
    return (
      <View className="p-6">
        <Card>
          <CardContent className="p-6 items-center">
            <Text className="block text-sm text-muted-foreground mb-3">暂无仿真数据</Text>
            <View className="flex items-center gap-1.5" onClick={load}>
              <RefreshCw size={14} color="#3b82f6" />
              <Text className="text-blue-600 text-sm">点击加载年度汇总</Text>
            </View>
          </CardContent>
        </Card>
      </View>
    )
  }

  const runs = report.summaries
  const replayRuns = runs.filter((r) => Number(r.month.split('-')[1]) <= 9)
  const futureRuns = runs.filter((r) => Number(r.month.split('-')[1]) > 9)
  const totalRet = runs.reduce((s, r) => s + r.aggregateReturn, 0)
  const avgRet = totalRet / runs.reduce((s, r) => s + r.accountCount, 0)
  const avgWR = runs.reduce((s, r) => s + r.winRate, 0) / runs.length
  const replayAvg = replayRuns.length ? replayRuns.reduce((s, r) => s + r.aggregateReturn, 0) / replayRuns.reduce((s, r) => s + r.accountCount, 0) : 0
  const futureAvg = futureRuns.length ? futureRuns.reduce((s, r) => s + r.aggregateReturn, 0) / futureRuns.reduce((s, r) => s + r.accountCount, 0) : 0
  const topIndustry = runs[0]?.industryStats[0]
  const topStrategy = runs[0]?.strategyStats[0]

  return (
    <View className="min-h-screen pb-6">
      <View className="p-4">
        <View className="flex items-center justify-between mb-3">
          <Text className="block text-xl font-bold">100账户实时仿真</Text>
          <View className="flex items-center gap-1.5" onClick={load}>
            <RefreshCw size={16} color="#64748b" />
            <Text className="text-xs text-muted-foreground">刷新</Text>
          </View>
        </View>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="overview">总览</TabsTrigger>
            <TabsTrigger value="monthly">月度</TabsTrigger>
            <TabsTrigger value="heat">热力</TabsTrigger>
            <TabsTrigger value="trajectory">轨迹</TabsTrigger>
            <TabsTrigger value="live">实时</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-3 space-y-3">
            <View className="grid grid-cols-2 gap-3">
              <KPICard label="总账户数" value={runs.reduce((s, r) => s + r.accountCount, 0).toLocaleString()} />
              <KPICard label="总 run 数" value={runs.length.toString()} sub={`回放 ${replayRuns.length} + 前瞻 ${futureRuns.length}`} />
              <KPICard label="累计加权收益" value={fmtPct(totalRet)} sub={`平均单账户 ${fmtPct(avgRet)}`} />
              <KPICard label="平均月胜率" value={fmtPct(avgWR)} />
              <KPICard label="回放平均收益" value={fmtPct(replayAvg)} sub="01-09 月" />
              <KPICard label="前瞻平均收益" value={fmtPct(futureAvg)} sub="10-12 月" />
              <KPICard label="最佳行业" value={topIndustry?.industry ?? '-'} sub={topIndustry ? fmtPct(topIndustry.avgReturn) : ''} />
              <KPICard label="最佳策略" value={topStrategy?.strategy ?? '-'} sub={topStrategy ? fmtPct(topStrategy.avgReturn) : ''} />
            </View>
            <Card>
              <CardHeader><CardTitle>概览说明</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <Text className="block text-sm text-muted-foreground leading-relaxed">
                  本页汇总 2026 全年 12 个月的仿真迭代结果，包含历史回放（01-09 月）与前瞻模拟（10-12 月）。
                  数据通过 {runs.length} 次月度回放 + 月间调优回路生成，账户分配由 industryWeights / strategyWeights 加权抽样驱动。
                </Text>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="monthly" className="mt-3 space-y-3">
            <Text className="block text-sm text-muted-foreground mb-2">
              月度表现：累计收益、胜率、Sharpe、MaxDD、Calmar
            </Text>
            <MonthTable runs={runs} />
          </TabsContent>

          <TabsContent value="heat" className="mt-3 space-y-3">
            <View className="flex items-center gap-2 mb-2">
              <ChartBar size={14} color="#64748b" />
              <Text className="text-sm text-muted-foreground">行业平均收益热力（{runs.length} 月 × {runs[0]?.industryStats.length ?? 0} 行业）</Text>
            </View>
            <HeatGrid runs={runs} dim="industryStats" />
            <View className="flex items-center gap-2 mb-2 mt-3">
              <Activity size={14} color="#64748b" />
              <Text className="text-sm text-muted-foreground">策略平均收益热力（{runs.length} 月 × {runs[0]?.strategyStats.length ?? 0} 策略）</Text>
            </View>
            <HeatGrid runs={runs} dim="strategyStats" />
          </TabsContent>

          <TabsContent value="trajectory" className="mt-3 space-y-3">
            <Card>
              <CardHeader>
                <CardTitle>调优轨迹（每月 Top 3 行业）</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ScrollArea className="h-[420px]">
                  <View className="space-y-1">
                    {runs.map((r) => (
                      <View key={r.runId} className="flex items-center gap-2 py-2 border-b border-slate-100">
                        <Text className="text-sm font-medium w-20">{r.month}</Text>
                        <View className="flex-1 flex gap-1.5">
                          {r.industryStats.slice(0, 3).map((s) => (
                            <View key={s.industry} className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100">
                              <Text className="text-xs">{s.industry}</Text>
                              <Text className={`text-xs font-mono ${fmtColor(s.avgReturn)}`}>{fmtPct(s.avgReturn)}</Text>
                            </View>
                          ))}
                        </View>
                        <MonthBadge month={r.month} />
                      </View>
                    ))}
                  </View>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="live" className="mt-3 space-y-3">
            <LivePanel />
          </TabsContent>
        </Tabs>
      </View>
    </View>
  )
}