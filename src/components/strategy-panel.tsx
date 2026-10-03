import { useEffect, useMemo, useState } from 'react'
import { View, Text } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Beaker, Loader, Search, FileChartColumn } from 'lucide-react-taro'
import { Strategies, type StrategyTemplate, type TryoutResult, type GridSearchResult } from '@/services/strategies'

interface StrategyPanelProps {
  month?: string
}

const MONTH_OPTIONS = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12']

export function StrategyPanel({ month: monthProp }: StrategyPanelProps) {
  const [month, setMonth] = useState<string>(monthProp ?? '2026-09')
  const [templates, setTemplates] = useState<StrategyTemplate[]>([])
  const [activeCode, setActiveCode] = useState<string>('ma_cross')
  const [params, setParams] = useState<Record<string, number>>({})
  const [tryoutResult, setTryoutResult] = useState<TryoutResult | null>(null)
  const [gridResult, setGridResult] = useState<GridSearchResult | null>(null)
  const [running, setRunning] = useState(false)
  const [griding, setGriding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Strategies.listTemplates()
      .then((data) => {
        setTemplates(data)
        const ma = data.find((t) => t.code === 'ma_cross')
        if (ma) setParams({ ...ma.params })
      })
      .catch((e) => setError(String(e)))
  }, [])

  const activeTemplate = useMemo(
    () => templates.find((t) => t.code === activeCode),
    [templates, activeCode],
  )

  useEffect(() => {
    if (activeTemplate) setParams({ ...activeTemplate.params })
    setTryoutResult(null)
    setGridResult(null)
  }, [activeCode, activeTemplate])

  const handleTryout = async () => {
    setRunning(true)
    setError(null)
    setGridResult(null)
    try {
      const r = await Strategies.tryout({
        month,
        strategy: activeCode,
        params,
      })
      setTryoutResult(r)
    } catch (e) {
      setError(String(e))
    } finally {
      setRunning(false)
    }
  }

  const handleGridSearch = async () => {
    if (!activeTemplate) return
    const ranges: Record<string, { min: number; max: number; step: number }> = {}
    for (const meta of activeTemplate.paramMeta) {
      ranges[meta.key] = { min: meta.min, max: meta.max, step: meta.step }
    }
    setGriding(true)
    setError(null)
    setTryoutResult(null)
    try {
      const r = await Strategies.gridSearch({
        month,
        strategy: activeCode,
        params: ranges,
      })
      setGridResult(r)
    } catch (e) {
      setError(String(e))
    } finally {
      setGriding(false)
    }
  }

  const applyPreset = (preset: { params: Record<string, number> }) => {
    setParams({ ...params, ...preset.params })
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-4">
          <Text className="block text-red-700 text-sm">{error}</Text>
        </CardContent>
      </Card>
    )
  }

  return (
    <View className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <Text className="block text-base font-semibold text-slate-900 mb-3">策略模板</Text>
          <View className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <Button
                key={t.code}
                size="sm"
                variant={t.code === activeCode ? 'default' : 'outline'}
                onClick={() => setActiveCode(t.code)}
              >
                {t.name}
              </Button>
            ))}
          </View>
          {activeTemplate && (
            <Text className="block text-sm text-slate-600 mt-3">{activeTemplate.shortDesc}</Text>
          )}
        </CardContent>
      </Card>

      {activeTemplate && (
        <Card>
          <CardContent className="p-4">
            <View className="flex items-center justify-between mb-3">
              <Text className="block text-base font-semibold text-slate-900">{activeTemplate.name} · 参数调节</Text>
              <Badge variant="secondary">月份 {month}</Badge>
            </View>

            <View className="mb-3 space-y-2">
              <Text className="block text-xs text-slate-500">选择月份</Text>
              <View className="flex flex-wrap gap-1">
                {MONTH_OPTIONS.map((m) => (
                  <Button key={m} size="sm" variant={m === month ? 'default' : 'outline'} onClick={() => setMonth(m)}>
                    {m.replace('2026-', '')}
                  </Button>
                ))}
              </View>
            </View>

            {activeTemplate.presets.length > 0 && (
              <View className="mb-4 space-y-2">
                <Text className="block text-xs text-slate-500">预设模板</Text>
                <View className="flex flex-wrap gap-2">
                  {activeTemplate.presets.map((p) => (
                    <Button key={p.key} size="sm" variant="ghost" onClick={() => applyPreset(p)}>
                      {p.name}
                    </Button>
                  ))}
                </View>
              </View>
            )}

            <View className="space-y-3">
              {activeTemplate.paramMeta.map((meta) => (
                <ParamSlider
                  key={meta.key}
                  label={meta.label}
                  help={meta.help}
                  value={params[meta.key] ?? meta.min}
                  min={meta.min}
                  max={meta.max}
                  step={meta.step}
                  onChange={(v) => setParams({ ...params, [meta.key]: v })}
                />
              ))}
            </View>

            <View className="flex gap-2 mt-4">
              <Button onClick={handleTryout} disabled={running} className="flex-1">
                {running ? <Loader className="mr-1 animate-spin" size={14} color="#ffffff" /> : <Beaker className="mr-1" size={14} color="#ffffff" />}
                <Text>试跑一次</Text>
              </Button>
              <Button onClick={handleGridSearch} disabled={griding} variant="outline" className="flex-1">
                {griding ? <Loader className="mr-1 animate-spin" size={14} color="#0f172a" /> : <Search className="mr-1" size={14} color="#0f172a" />}
                <Text>网格扫描</Text>
              </Button>
            </View>
          </CardContent>
        </Card>
      )}

      {tryoutResult && <TryoutResultCard result={tryoutResult} />}

      {gridResult && <GridSearchResultCard result={gridResult} />}
    </View>
  )
}

function ParamSlider({
  label,
  help,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  help: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0
  return (
    <View className="space-y-2">
      <View className="flex items-center justify-between">
        <Text className="block text-sm font-medium text-slate-700">{label}</Text>
        <Text className="block text-sm font-semibold text-blue-600">{value.toFixed(Math.abs(step) < 0.01 ? 3 : 2)}</Text>
      </View>
      <View className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
        <View className="h-full bg-blue-500" style={{ width: `${pct}%` }} />
      </View>
      <View className="flex items-center gap-2">
        <Text className="block text-xs text-slate-500">{min.toFixed(2)}</Text>
        <View className="flex-1 h-6 flex items-center">
          <View
            style={{ width: '100%' }}
            className="relative"
            onClick={(e) => {
              // 简化：tap 时按 step 递增
              onChange(Math.min(max, value + step))
              void e
            }}
          >
            <View className="w-full h-6" />
          </View>
        </View>
        <Text className="block text-xs text-slate-500">{max.toFixed(2)}</Text>
      </View>
      <View className="flex flex-wrap gap-1">
        {[0, 0.25, 0.5, 0.75, 1].map((p) => {
          const v = min + p * (max - min)
          return (
            <Button key={p} size="sm" variant="ghost" onClick={() => onChange(Number(v.toFixed(4)))}>
              {v.toFixed(2)}
            </Button>
          )
        })}
      </View>
      <Text className="block text-xs text-slate-500">{help}</Text>
    </View>
  )
}

function TryoutResultCard({ result }: { result: TryoutResult }) {
  const pnlColor = result.totalReturnPct >= 0 ? 'text-emerald-600' : 'text-rose-600'
  return (
    <Card>
      <CardContent className="p-4">
        <View className="flex items-center gap-2 mb-3">
          <Beaker size={16} color="#2563eb" />
          <Text className="block text-base font-semibold text-slate-900">试跑结果</Text>
        </View>
        <View className="grid grid-cols-2 gap-3">
          <MetricItem label="总收益" value={`${result.totalReturnPct.toFixed(2)}%`} valueClass={pnlColor} />
          <MetricItem label="最终权益" value={result.finalEquity.toFixed(0)} />
          <MetricItem label="交易次数" value={result.totalTrades.toString()} />
          <MetricItem label="持仓数量" value={result.positionCount.toString()} />
          <MetricItem label="Sharpe" value={result.risk.sharpe.toFixed(2)} />
          <MetricItem label="Sortino" value={result.risk.sortino.toFixed(2)} />
          <MetricItem label="MaxDD" value={`${result.risk.maxDD.toFixed(2)}%`} valueClass="text-rose-600" />
          <MetricItem label="Calmar" value={result.risk.calmar.toFixed(2)} />
        </View>
      </CardContent>
    </Card>
  )
}

function GridSearchResultCard({ result }: { result: GridSearchResult }) {
  return (
    <Card>
      <CardContent className="p-4">
        <View className="flex items-center gap-2 mb-3">
          <FileChartColumn size={16} color="#16a34a" />
          <Text className="block text-base font-semibold text-slate-900">网格扫描 · {result.total} 组合 · {result.totalDuration}ms</Text>
        </View>
        <Text className="block text-sm font-medium text-slate-700 mb-2">TOP-5</Text>
        <View className="space-y-2">
          {result.top5.map((r, i) => (
            <View key={i} className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <Text className="block text-xs text-slate-600">{formatParams(r.params)}</Text>
              <View className="flex gap-3 mt-1">
                <Text className="block text-sm font-semibold text-emerald-700">收益 {r.totalReturnPct.toFixed(2)}%</Text>
                <Text className="block text-sm text-slate-600">Sharpe {r.sharpe.toFixed(2)}</Text>
              </View>
            </View>
          ))}
        </View>
        <Text className="block text-sm font-medium text-slate-700 mt-4 mb-2">BOTTOM-5</Text>
        <View className="space-y-2">
          {result.bottom5.map((r, i) => (
            <View key={i} className="bg-rose-50 border border-rose-200 rounded-lg p-3">
              <Text className="block text-xs text-slate-600">{formatParams(r.params)}</Text>
              <View className="flex gap-3 mt-1">
                <Text className="block text-sm font-semibold text-rose-700">收益 {r.totalReturnPct.toFixed(2)}%</Text>
                <Text className="block text-sm text-slate-600">Sharpe {r.sharpe.toFixed(2)}</Text>
              </View>
            </View>
          ))}
        </View>
      </CardContent>
    </Card>
  )
}

function MetricItem({
  label,
  value,
  valueClass = 'text-slate-900',
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <View className="bg-slate-50 rounded-lg p-3">
      <Text className="block text-xs text-slate-500 mb-1">{label}</Text>
      <Text className={`block text-lg font-semibold ${valueClass}`}>{value}</Text>
    </View>
  )
}

function formatParams(params: Record<string, number>): string {
  return Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join('  ·  ')
}