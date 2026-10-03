import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import { Network } from '@/network'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Zap } from 'lucide-react-taro'

interface PresetItem {
  key: string
  scenario: { name: string; description: string }
}

interface ScenarioResult {
  label: string
  month: string
  initialCash: number
  finalEquity: number
  totalPnl: number
  totalReturnPct: number
  risk: { sharpe: number; sortino: number; maxDD: number; calmar: number }
  realizedPnl: number
  totalTrades: number
  positionCount: number
}

interface ScenarioComparison {
  month: string
  strategy: string
  baseline: ScenarioResult
  scenarios: {
    scenario: { name: string; description: string }
    result: ScenarioResult
    deltaVsBaseline: { totalReturn: number; sharpe: number; maxDD: number }
  }[]
}

function fmtPctRaw(v: number) {
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
}

function pnlColor(v: number) {
  if (v > 0.01) return 'text-emerald-500'
  if (v < -0.01) return 'text-rose-500'
  return 'text-slate-500'
}

export function StressPanel() {
  const [months, setMonths] = useState<string[]>([])
  const [presets, setPresets] = useState<PresetItem[]>([])
  const [month, setMonth] = useState('2026-03')
  const [strategy, setStrategy] = useState('ma_cross')
  const [selected, setSelected] = useState<string[]>(['tech_crash_march'])
  const [result, setResult] = useState<ScenarioComparison | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const [m, p] = await Promise.all([
          Network.request<{ data: string[] }>({ url: '/api/scenarios/months' }),
          Network.request<{ data: PresetItem[] }>({ url: '/api/scenarios/presets' }),
        ])
        setMonths(m.data.data ?? [])
        setPresets(p.data.data ?? [])
      } catch (e) {
        setError((e as Error).message)
      }
    })()
  }, [])

  const toggle = (key: string) => {
    setSelected((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]))
  }

  const runStress = async () => {
    if (selected.length === 0) {
      setError('至少选 1 个预设场景')
      return
    }
    setError(null)
    setLoading(true)
    setResult(null)
    try {
      const scenarios = presets.filter((p) => selected.includes(p.key)).map((p) => ({
        name: p.scenario.name,
        description: p.scenario.description,
        shocks: (p as any).scenario.shocks,
      }))
      const res = await Network.request<{ data: ScenarioComparison }>({
        url: '/api/scenarios/run',
        method: 'POST',
        data: { month, strategy, scenarios },
      })
      setResult(res.data.data ?? null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle>
              <Text className="text-base font-semibold flex items-center gap-1.5">
                <Zap size={16} color="#f59e0b" />
                压力测试：场景冲击对比
              </Text>
            </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <Text className="block text-xs text-muted-foreground leading-relaxed">
            选定月份和策略后，选择若干冲击场景。后端会用相同 seed 对「无冲击 baseline」与「加入冲击」分别跑完整月回放，并对比总收益、Sharpe、MaxDD。
          </Text>
          <View className="grid grid-cols-2 gap-2">
            <View>
              <Text className="block text-xs text-muted-foreground mb-1">月份</Text>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择月份" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
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
                  <SelectItem value="ma_cross">均线交叉</SelectItem>
                  <SelectItem value="momentum">动量</SelectItem>
                  <SelectItem value="reversal">反转</SelectItem>
                  <SelectItem value="breakout">突破</SelectItem>
                  <SelectItem value="trend_follow">趋势跟随</SelectItem>
                </SelectContent>
              </Select>
            </View>
          </View>
          <View>
            <Text className="block text-xs text-muted-foreground mb-2">预设场景（点击切换）</Text>
            <View className="space-y-2">
              {presets.map((p) => {
                const on = selected.includes(p.key)
                return (
                  <View
                    key={p.key}
                    onClick={() => toggle(p.key)}
                    className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer ${on ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-white'}`}
                  >
                    <View className={`w-4 h-4 mt-1 rounded border flex items-center justify-center ${on ? 'bg-amber-500 border-amber-500' : 'bg-white border-slate-300'}`}>
                      {on ? <Text className="text-white text-xs">✓</Text> : null}
                    </View>
                    <View className="flex-1">
                      <Text className="block text-sm font-medium">{p.scenario.name}</Text>
                      <Text className="block text-xs text-muted-foreground mt-1">{p.scenario.description}</Text>
                    </View>
                  </View>
                )
              })}
            </View>
          </View>
          <Button onClick={runStress} disabled={loading} className="w-full">
            {loading ? '正在并行回放 baseline + ' + selected.length + ' 个场景…' : '运行压力测试'}
          </Button>
          {error && <Text className="block text-xs text-rose-500">{error}</Text>}
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="p-4 space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      ) : null}

      {result ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>
                <Text className="text-base font-semibold">Baseline（无冲击）</Text>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <View className="grid grid-cols-4 gap-3">
                <View>
                  <Text className="block text-xs text-muted-foreground">总收益</Text>
                  <Text className={`block text-lg font-semibold mt-1 font-mono ${pnlColor(result.baseline.totalReturnPct / 100)}`}>
                    {fmtPctRaw(result.baseline.totalReturnPct)}
                  </Text>
                </View>
                <View>
                  <Text className="block text-xs text-muted-foreground">Sharpe</Text>
                  <Text className="block text-lg font-semibold mt-1 font-mono">{result.baseline.risk.sharpe.toFixed(2)}</Text>
                </View>
                <View>
                  <Text className="block text-xs text-muted-foreground">MaxDD</Text>
                  <Text className="block text-lg font-semibold mt-1 font-mono text-rose-500">
                    {(result.baseline.risk.maxDD).toFixed(2)}%
                  </Text>
                </View>
                <View>
                  <Text className="block text-xs text-muted-foreground">成交笔数</Text>
                  <Text className="block text-lg font-semibold mt-1 font-mono">{result.baseline.totalTrades}</Text>
                </View>
              </View>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <Text className="text-base font-semibold">冲击对比</Text>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-96">
                <View className="p-3 space-y-2">
                  {result.scenarios.map((sc) => (
                    <View key={sc.scenario.name} className="p-3 rounded-lg border border-slate-200 bg-white">
                      <View className="flex items-center justify-between">
                          <Text className="text-sm font-medium">{sc.scenario.name}</Text>
                          <Badge variant={sc.deltaVsBaseline.totalReturn >= 0 ? 'secondary' : 'destructive'}>
                            Δ收益 {sc.deltaVsBaseline.totalReturn >= 0 ? '+' : ''}{sc.deltaVsBaseline.totalReturn.toFixed(2)}%
                          </Badge>
                        </View>
                      <Text className="block text-xs text-muted-foreground mt-1 mb-2">{sc.scenario.description}</Text>
                      <View className="grid grid-cols-4 gap-2 text-xs">
                        <View>
                          <Text className="text-muted-foreground block">收益</Text>
                          <Text className={`font-mono ${pnlColor(sc.result.totalReturnPct / 100)}`}>{fmtPctRaw(sc.result.totalReturnPct)}</Text>
                          <Text className={`font-mono ${pnlColor(sc.deltaVsBaseline.totalReturn / 100)}`}>Δ {sc.deltaVsBaseline.totalReturn >= 0 ? '+' : ''}{sc.deltaVsBaseline.totalReturn.toFixed(2)}</Text>
                        </View>
                        <View>
                          <Text className="text-muted-foreground block">Sharpe</Text>
                          <Text className="font-mono">{sc.result.risk.sharpe.toFixed(2)}</Text>
                          <Text className={`font-mono ${pnlColor(sc.deltaVsBaseline.sharpe)}`}>Δ {sc.deltaVsBaseline.sharpe >= 0 ? '+' : ''}{sc.deltaVsBaseline.sharpe.toFixed(2)}</Text>
                        </View>
                        <View>
                          <Text className="text-muted-foreground block">MaxDD</Text>
                          <Text className="font-mono text-rose-500">{sc.result.risk.maxDD.toFixed(2)}%</Text>
                          <Text className="font-mono">{sc.deltaVsBaseline.maxDD >= 0 ? '+' : ''}{sc.deltaVsBaseline.maxDD.toFixed(2)}</Text>
                        </View>
                        <View>
                          <Text className="text-muted-foreground block">成交</Text>
                          <Text className="font-mono">{sc.result.totalTrades}</Text>
                          <Text className="font-mono text-muted-foreground">Δ {sc.result.totalTrades - result.baseline.totalTrades >= 0 ? '+' : ''}{sc.result.totalTrades - result.baseline.totalTrades}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      ) : null}
    </View>
  )
}