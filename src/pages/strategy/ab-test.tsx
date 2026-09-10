import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { Network } from '@/network'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Alert } from '@/components/ui/alert'
import {
  GitBranch,
  Play,
  Trophy,
  Beaker,
  ChevronRight,
  Trash2,
  CircleDashed,
  CircleAlert,
} from 'lucide-react-taro'

interface CustomStrategy {
  id: string
  name: string
  description?: string
  parentId?: string | null
  rootId?: string | null
  version?: number
  forkedAt?: number
  createdAt: string
  pnl?: number
  pnlRate?: number
  winRate?: number
  trades?: number
}

interface SideResult {
  strategyId: string
  strategyName: string
  finalCapital: number
  totalReturn: number
  maxDrawdown: number
  sharpeRatio: number
  winRate: number
  totalTrades: number
}

interface ABTestSummary {
  winner: 'v1' | 'v2' | 'tie'
  v1Metrics: SideResult
  v2Metrics: SideResult
  delta: {
    totalReturn: number
    sharpeRatio: number
    maxDrawdown: number
    winRate: number
  }
  significance: { note: string; sufficient: boolean }
}

interface ABExperiment {
  id: string
  name: string
  v1StrategyId: string
  v2StrategyId: string
  symbols: string[]
  startDate: string
  endDate: string
  initialCapital: number
  createdAt: string
  status: string
  winner?: 'v1' | 'v2' | 'tie'
  v1Metrics?: StrategyMetrics
  v2Metrics?: StrategyMetrics
  delta?: {
    totalReturnDiff: number
    sharpeDiff: number
    maxDrawdownDiff: number
    winRateDiff: number
    tradeCountDiff: number
  }
  summary?: ABTestSummary
}

interface StrategyMetrics {
  totalReturn: number
  annualizedReturn?: number
  sharpe: number
  maxDrawdown: number
  winRate: number
  tradeCount: number
  avgHoldDays?: number
}

type ABView = 'list' | 'new' | 'detail'

export default function ABTestIndex() {
  return <ABTestRoot />
}

function ABTestRoot() {
  const [view, setView] = useState<ABView>('list')
  const [strategies, setStrategies] = useState<CustomStrategy[]>([])
  const [experiments, setExperiments] = useState<ABExperiment[]>([])
  const [selectedExp, setSelectedExp] = useState<ABExperiment | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshAll = async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, e] = await Promise.all([
        Network.request<{ data: CustomStrategy[] }>({ url: '/api/strategies/custom' }),
        Network.request<{ data: ABExperiment[] }>({ url: '/api/ab-test' }),
      ])
      setStrategies((s as unknown as { data: CustomStrategy[] }).data ?? [])
      setExperiments((e as unknown as { data: ABExperiment[] }).data ?? [])
    } catch (err) {
      setError('加载失败，请稍后重试')
      console.error('[ab-test] refresh error', err)
    } finally {
      setLoading(false)
    }
  }

  const handleViewExperiment = async (exp: ABExperiment) => {
    try {
      const res = await Network.request<{ data: ABExperiment }>({
        url: `/api/ab-test/${exp.id}`,
      })
      const fetched = (res as unknown as { data: ABExperiment }).data
      setSelectedExp(fetched ?? exp)
      setView('detail')
    } catch (err) {
      setSelectedExp(exp)
      setView('detail')
    }
  }

  const handleDeleteExperiment = async (id: string) => {
    const confirmed = await Taro.showModal({
      title: '删除实验',
      content: '确认删除该 A/B 实验记录？',
      confirmText: '删除',
      confirmColor: '#ef4444',
    })
    if (!confirmed.confirm) return
    try {
      await Network.request({ url: `/api/ab-test/${id}`, method: 'DELETE' })
      Taro.showToast({ title: '已删除', icon: 'success' })
      await refreshAll()
    } catch (err) {
      Taro.showToast({ title: '删除失败', icon: 'none' })
    }
  }

  if (view === 'new') {
    return (
      <NewExperimentView
        strategies={strategies}
        onBack={() => setView('list')}
        onCreated={async () => {
          await refreshAll()
          setView('list')
        }}
      />
    )
  }

  if (view === 'detail' && selectedExp) {
    return (
      <DetailInline
        experiment={selectedExp}
        strategies={strategies}
        onBack={() => {
          setSelectedExp(null)
          setView('list')
        }}
        onDelete={async () => {
          await handleDeleteExperiment(selectedExp.id)
          setSelectedExp(null)
          setView('list')
        }}
      />
    )
  }

  return (
    <ListView
      strategies={strategies}
      experiments={experiments}
      loading={loading}
      error={error}
      onRefresh={refreshAll}
      onCreate={() => setView('new')}
      onView={handleViewExperiment}
      onDelete={handleDeleteExperiment}
    />
  )
}

function ListView(props: {
  strategies: CustomStrategy[]
  experiments: ABExperiment[]
  loading: boolean
  error: string | null
  onRefresh: () => void
  onCreate: () => void
  onView: (exp: ABExperiment) => void
  onDelete: (id: string) => void
}) {
  const versionGroups = groupByRoot(props.strategies)

  return (
    <ScrollView
      scrollY
      refresherEnabled
      onRefresherRefresh={props.onRefresh}
      className="min-h-screen bg-slate-900"
    >
      <View className="px-4 pt-4 pb-24">
        <View className="flex items-center justify-between mb-4">
          <View>
            <Text className="block text-xl font-semibold text-white">A/B 对比实验</Text>
            <Text className="block text-xs text-slate-400 mt-1">
              同窗口并跑两个版本，直观比较收益、风险与胜率
            </Text>
          </View>
          <Button
            size="sm"
            className="bg-blue-600 text-white"
            onClick={() => {
              if (props.strategies.length < 2) {
                Taro.showToast({
                  title: '至少需要 2 个策略版本',
                  icon: 'none',
                })
                return
              }
              props.onCreate()
            }}
          >
            <View className="flex items-center gap-1">
              <Beaker size={16} color="#ffffff" />
              <Text className="text-white">新建对比</Text>
            </View>
          </Button>
        </View>

        {props.error ? (
          <Alert className="mb-3 border-red-500 border-opacity-30 bg-red-500 bg-opacity-10">
            <View className="flex items-center gap-2">
              <CircleAlert size={16} color="#f87171" />
              <Text className="text-sm text-red-200">{props.error}</Text>
            </View>
          </Alert>
        ) : null}

        {props.loading && props.strategies.length === 0 ? (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6 text-center">
              <Text className="text-slate-400">加载中…</Text>
            </CardContent>
          </Card>
        ) : null}

        {!props.loading && props.strategies.length < 2 ? (
          <Card className="bg-slate-800 border-slate-700 mb-4">
            <CardContent className="p-6">
              <View className="flex items-start gap-3">
                <CircleAlert size={20} color="#fbbf24" />
                <View className="flex-1">
                  <Text className="block text-sm font-medium text-white mb-1">
                    策略版本不足
                  </Text>
                  <Text className="block text-xs text-slate-400">
                    现有 {props.strategies.length} 个自定义策略，需要至少 2 个版本才能创建对比实验。
                    请先在策略页 fork 出新版本。
                  </Text>
                </View>
              </View>
            </CardContent>
          </Card>
        ) : null}

        <View className="mb-4">
          <Text className="block text-sm font-medium text-slate-300 mb-2">
            版本族谱（{versionGroups.length} 组）
          </Text>
          {versionGroups.length === 0 ? (
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-4 text-center">
                <Text className="text-slate-400 text-sm">暂无自定义策略</Text>
              </CardContent>
            </Card>
          ) : (
            versionGroups.map((group) => (
              <Card key={group.rootId} className="bg-slate-800 border-slate-700 mb-2">
                <CardContent className="p-3">
                  <View className="flex items-center justify-between mb-2">
                    <View className="flex items-center gap-2 flex-1">
                      <GitBranch size={14} color="#94a3b8" />
                      <Text className="text-sm font-medium text-white">
                        {group.rootName}
                      </Text>
                      <Badge className="bg-slate-700 text-slate-300 text-xs">
                        v1 → v{group.maxVersion}
                      </Badge>
                    </View>
                    <Text className="text-xs text-slate-400">
                      {group.versions.length} 个版本
                    </Text>
                  </View>
                  <View className="flex flex-wrap gap-1">
                    {group.versions.map((v) => (
                      <View
                        key={v.id}
                        className="bg-slate-700 bg-opacity-50 rounded px-2 py-1"
                      >
                        <Text className="text-xs text-slate-300">
                          v{v.version ?? 1} · {v.name.slice(-12)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </CardContent>
              </Card>
            ))
          )}
        </View>

        <View>
          <Text className="block text-sm font-medium text-slate-300 mb-2">
            历史实验（{props.experiments.length}）
          </Text>
          {props.experiments.length === 0 ? (
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6 text-center">
                <Beaker size={32} color="#64748b" />
                <Text className="block text-slate-400 text-sm mt-2">
                  还没有 A/B 实验，点击右上角创建第一个
                </Text>
              </CardContent>
            </Card>
          ) : (
            props.experiments.map((exp) => {
              const winner = exp.summary?.winner
              return (
                <Card key={exp.id} className="bg-slate-800 border-slate-700 mb-2">
                  <CardContent className="p-3">
                    <View className="flex items-start justify-between mb-2">
                      <View className="flex-1">
                        <Text className="block text-sm font-medium text-white">
                          {exp.name}
                        </Text>
                        <Text className="block text-xs text-slate-400 mt-1">
                          {exp.symbols.join(',')} · {exp.startDate} ~ {exp.endDate} · 初始 ¥
                          {exp.initialCapital.toLocaleString()}
                        </Text>
                      </View>
                      {winner && winnerBadge(winner)}
                    </View>
                    {exp.summary ? (
                      <View className="flex items-center gap-3 text-xs">
                        <Text className="text-slate-300">
                          v1{' '}
                          <Text
                            className={
                              exp.summary.v1Metrics.totalReturn >= 0
                                ? 'text-emerald-400 font-medium'
                                : 'text-red-400 font-medium'
                            }
                          >
                            {(exp.summary.v1Metrics.totalReturn * 100).toFixed(2)}%
                          </Text>
                        </Text>
                        <Text className="text-slate-500">vs</Text>
                        <Text className="text-slate-300">
                          v2{' '}
                          <Text
                            className={
                              exp.summary.v2Metrics.totalReturn >= 0
                                ? 'text-emerald-400 font-medium'
                                : 'text-red-400 font-medium'
                            }
                          >
                            {(exp.summary.v2Metrics.totalReturn * 100).toFixed(2)}%
                          </Text>
                        </Text>
                      </View>
                    ) : (
                      <Text className="text-xs text-amber-400">
                        <CircleDashed size={12} color="#fbbf24" /> 等待结果回填
                      </Text>
                    )}
                    <Separator className="my-2 bg-slate-700" />
                    <View className="flex items-center justify-between">
                      <Text className="text-xs text-slate-500">
                        {new Date(exp.createdAt).toLocaleString('zh-CN')}
                      </Text>
                      <View className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-slate-300"
                          onClick={() => props.onView(exp)}
                        >
                          <View className="flex items-center gap-1">
                            <Text className="text-slate-300">查看</Text>
                            <ChevronRight size={14} color="#94a3b8" />
                          </View>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-400"
                          onClick={() => props.onDelete(exp.id)}
                        >
                          <Trash2 size={14} color="#f87171" />
                        </Button>
                      </View>
                    </View>
                  </CardContent>
                </Card>
              )
            })
          )}
        </View>
      </View>
    </ScrollView>
  )
}

function winnerBadge(winner: 'v1' | 'v2' | 'tie') {
  if (winner === 'tie') {
    return (
      <Badge className="bg-amber-500 bg-opacity-20 text-amber-300 border-amber-500 border-opacity-30">
        持平
      </Badge>
    )
  }
  return (
    <Badge className="bg-emerald-500 bg-opacity-20 text-emerald-300 border-emerald-500 border-opacity-30">
      <Trophy size={12} color="#34d399" />
      <Text className="ml-1">{winner} 胜出</Text>
    </Badge>
  )
}

function groupByRoot(strategies: CustomStrategy[]): Array<{
  rootId: string
  rootName: string
  maxVersion: number
  versions: CustomStrategy[]
}> {
  const map = new Map<
    string,
    {
      rootId: string
      rootName: string
      maxVersion: number
      versions: CustomStrategy[]
    }
  >()

  for (const s of strategies) {
    const rootId = s.rootId ?? s.id
    const existing = map.get(rootId)
    if (existing) {
      existing.versions.push(s)
      existing.maxVersion = Math.max(existing.maxVersion, s.version ?? 1)
    } else {
      map.set(rootId, {
        rootId,
        rootName: s.name,
        maxVersion: s.version ?? 1,
        versions: [s],
      })
    }
  }

  return Array.from(map.values()).map((g) => ({
    ...g,
    versions: g.versions.sort((a, b) => (a.version ?? 1) - (b.version ?? 1)),
  }))
}

function Field(props: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: 'text' | 'number'
}) {
  return (
    <View>
      <Text className="block text-xs text-slate-400 mb-1">{props.label}</Text>
      <View className="bg-slate-900 rounded-lg px-3 py-2">
        <input
          className="w-full bg-transparent text-white text-sm outline-none"
          type={props.type ?? 'text'}
          placeholder={props.placeholder}
          value={props.value}
          onInput={(e) => props.onChange((e.target as HTMLInputElement).value)}
        />
      </View>
    </View>
  )
}

function StrategyPicker(props: {
  strategies: CustomStrategy[]
  value: string
  onChange: (id: string) => void
}) {
  const selected = props.strategies.find((s) => s.id === props.value)
  const handlePick = () => {
    if (props.strategies.length === 0) {
      Taro.showToast({ title: '暂无可选策略', icon: 'none' })
      return
    }
    Taro.showActionSheet({
      itemList: props.strategies.map((s) => `v${s.version ?? 1} · ${s.name} (${s.id.slice(-6)})`),
      success: (res) => {
        const idx = res.tapIndex
        const picked = props.strategies[idx]
        if (picked) props.onChange(picked.id)
      },
    })
  }
  return (
    <View
      className="bg-slate-900 rounded-lg px-3 py-2 flex items-center justify-between"
      onClick={handlePick}
    >
      <Text className="text-white text-sm">
        {selected
          ? `v${selected.version ?? 1} · ${selected.name} (${selected.id.slice(-6)})`
          : '请选择策略版本'}
      </Text>
      <Text className="text-slate-400 text-xs">选择 ›</Text>
    </View>
  )
}

function NewExperimentView(props: {
  strategies: CustomStrategy[]
  onBack: () => void
  onCreated: () => void
}) {
  const [v1Id, setV1Id] = useState('')
  const [v2Id, setV2Id] = useState('')
  const [symbol, setSymbol] = useState('sh600519')
  const [startDate, setStartDate] = useState(threeMonthsAgo())
  const [endDate, setEndDate] = useState(today())
  const [initialCapital, setInitialCapital] = useState('100000')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!v1Id || !v2Id) {
      Taro.showToast({ title: '请选择两个策略版本', icon: 'none' })
      return
    }
    if (v1Id === v2Id) {
      Taro.showToast({ title: '两个版本不能相同', icon: 'none' })
      return
    }
    const capital = Number(initialCapital)
    if (!Number.isFinite(capital) || capital <= 0) {
      Taro.showToast({ title: '初始资金无效', icon: 'none' })
      return
    }

    setSubmitting(true)
    try {
      await Network.request({
        url: '/api/ab-test/run',
        method: 'POST',
        data: {
          name: name || `A/B 实验 ${new Date().toLocaleString('zh-CN')}`,
          v1StrategyId: v1Id,
          v2StrategyId: v2Id,
          symbols: [symbol],
          startDate,
          endDate,
          initialCapital: capital,
        },
      })
      Taro.showToast({ title: '实验已提交', icon: 'success' })
      props.onCreated()
    } catch (err) {
      Taro.showToast({
        title: '提交失败：' + (err instanceof Error ? err.message : '未知错误'),
        icon: 'none',
        duration: 3000,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ScrollView scrollY className="min-h-screen bg-slate-900">
      <View className="px-4 pt-4 pb-24">
        <View className="flex items-center gap-2 mb-4">
          <Button size="sm" variant="ghost" className="text-slate-300" onClick={props.onBack}>
            <Text className="text-slate-300">← 返回</Text>
          </Button>
          <Text className="text-lg font-semibold text-white">新建 A/B 实验</Text>
        </View>

        <Card className="bg-slate-800 border-slate-700 mb-3">
          <CardContent className="p-4">
            <Text className="block text-sm font-medium text-slate-300 mb-3">实验名称</Text>
            <View className="bg-slate-900 rounded-lg px-3 py-2">
              <input
                className="w-full bg-transparent text-white text-sm outline-none"
                placeholder={`A/B 实验 ${new Date().toLocaleDateString('zh-CN')}`}
                value={name}
                onInput={(e) => setName((e.target as HTMLInputElement).value)}
              />
            </View>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700 mb-3">
          <CardContent className="p-4">
            <Text className="block text-sm font-medium text-slate-300 mb-2">
              V1 策略
            </Text>
            <StrategyPicker strategies={props.strategies} value={v1Id} onChange={setV1Id} />

            <View className="h-3" />

            <Text className="block text-sm font-medium text-slate-300 mb-2">
              V2 策略
            </Text>
            <StrategyPicker strategies={props.strategies} value={v2Id} onChange={setV2Id} />
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700 mb-3">
          <CardContent className="p-4">
            <Text className="block text-sm font-medium text-slate-300 mb-3">
              回测参数
            </Text>
            <Field label="股票代码" value={symbol} onChange={setSymbol} placeholder="sh600519" />
            <View className="h-2" />
            <View className="flex gap-2">
              <View className="flex-1">
                <Field
                  label="开始日期"
                  value={startDate}
                  onChange={setStartDate}
                  placeholder="YYYY-MM-DD"
                />
              </View>
              <View className="flex-1">
                <Field
                  label="结束日期"
                  value={endDate}
                  onChange={setEndDate}
                  placeholder="YYYY-MM-DD"
                />
              </View>
            </View>
            <View className="h-2" />
            <Field
              label="初始资金 (¥)"
              value={initialCapital}
              onChange={setInitialCapital}
              placeholder="100000"
              type="number"
            />
          </CardContent>
        </Card>

        <Button
          className="w-full bg-blue-600 text-white"
          onClick={handleSubmit}
          disabled={submitting}
        >
          <View className="flex items-center justify-center gap-2 py-2">
            {submitting ? (
              <Text className="text-white">运行中…</Text>
            ) : (
              <>
                <Play size={18} color="#ffffff" />
                <Text className="text-white">运行 A/B 对比</Text>
              </>
            )}
          </View>
        </Button>
      </View>
    </ScrollView>
  )
}

function today(): string {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

function threeMonthsAgo(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 3)
  return d.toISOString().slice(0, 10)
}

// 详情内联视图（MVP：基础信息 + 指标并排 + 净值曲线）
function DetailInline({
  experiment,
  strategies,
  onBack,
  onDelete,
}: {
  experiment: ABExperiment
  strategies: CustomStrategy[]
  onBack: () => void
  onDelete: () => void
}) {
  const findStrategy = (id: string) =>
    strategies.find((s) => s.id === id)
  const v1 = findStrategy(experiment.v1StrategyId)
  const v2 = findStrategy(experiment.v2StrategyId)
  const winner = experiment.winner
  const v1Metrics = experiment.v1Metrics
  const v2Metrics = experiment.v2Metrics
  const delta = experiment.delta

  return (
    <View className="flex flex-col h-full bg-slate-900">
      {/* Header */}
      <View className="flex items-center gap-3 px-4 py-3 border-b border-slate-700">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <Text className="text-slate-200">返回</Text>
        </Button>
        <Text className="block flex-1 text-base font-semibold text-slate-100">
          {experiment.name}
        </Text>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            Taro.showModal({
              title: '确认删除',
              content: '删除后无法恢复，是否继续？',
              success: (res) => {
                if (res.confirm) onDelete()
              },
            })
          }}
        >
          <Trash2 size={18} color="#f87171" />
        </Button>
      </View>

      <ScrollView scrollY className="flex-1 px-4 py-4" style={{ paddingBottom: '40px' }}>
        {/* 双策略对照 */}
        <Card className="bg-slate-800 border-slate-700 mb-4">
          <CardContent className="p-4">
            <Text className="block text-xs text-slate-400 mb-3">对比双方</Text>
            <View className="flex flex-row gap-3">
              <View className="flex-1 bg-slate-900 rounded-lg p-3">
                <View className="flex flex-row items-center justify-between mb-2">
                  <Badge variant="outline" className="bg-blue-500 bg-opacity-20 border-blue-400 text-blue-300">
                    <Text className="text-xs">V1</Text>
                  </Badge>
                  {winner === 'v1' && (
                    <Trophy size={14} color="#fbbf24" />
                  )}
                </View>
                <Text className="block text-sm font-semibold text-slate-100 mb-1">
                  {v1?.name || '已删除'}
                </Text>
                <Text className="block text-xs text-slate-400 mb-2">
                  v{v1?.version || 1} · {experiment.symbols.join(', ')}
                </Text>
                <View className="space-y-1">
                  <View className="flex justify-between">
                    <Text className="block text-xs text-slate-400">总收益</Text>
                    <Text className={`block text-sm font-semibold ${(v1Metrics?.totalReturn ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {((v1Metrics?.totalReturn ?? 0) * 100).toFixed(2)}%
                    </Text>
                  </View>
                  <View className="flex justify-between">
                    <Text className="block text-xs text-slate-400">夏普</Text>
                    <Text className="block text-sm text-slate-200">
                      {(v1Metrics?.sharpe ?? 0).toFixed(2)}
                    </Text>
                  </View>
                  <View className="flex justify-between">
                    <Text className="block text-xs text-slate-400">最大回撤</Text>
                    <Text className="block text-sm text-rose-400">
                      {((v1Metrics?.maxDrawdown ?? 0) * 100).toFixed(2)}%
                    </Text>
                  </View>
                  <View className="flex justify-between">
                    <Text className="block text-xs text-slate-400">胜率</Text>
                    <Text className="block text-sm text-slate-200">
                      {((v1Metrics?.winRate ?? 0) * 100).toFixed(1)}%
                    </Text>
                  </View>
                  <View className="flex justify-between">
                    <Text className="block text-xs text-slate-400">交易数</Text>
                    <Text className="block text-sm text-slate-200">
                      {v1Metrics?.tradeCount ?? 0}
                    </Text>
                  </View>
                </View>
              </View>

              <View className="flex-1 bg-slate-900 rounded-lg p-3">
                <View className="flex flex-row items-center justify-between mb-2">
                  <Badge variant="outline" className="bg-purple-500 bg-opacity-20 border-purple-400 text-purple-300">
                    <Text className="text-xs">V2</Text>
                  </Badge>
                  {winner === 'v2' && (
                    <Trophy size={14} color="#fbbf24" />
                  )}
                </View>
                <Text className="block text-sm font-semibold text-slate-100 mb-1">
                  {v2?.name || '已删除'}
                </Text>
                <Text className="block text-xs text-slate-400 mb-2">
                  v{v2?.version || 1} · {experiment.symbols.join(', ')}
                </Text>
                <View className="space-y-1">
                  <View className="flex justify-between">
                    <Text className="block text-xs text-slate-400">总收益</Text>
                    <Text className={`block text-sm font-semibold ${(v2Metrics?.totalReturn ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {((v2Metrics?.totalReturn ?? 0) * 100).toFixed(2)}%
                    </Text>
                  </View>
                  <View className="flex justify-between">
                    <Text className="block text-xs text-slate-400">夏普</Text>
                    <Text className="block text-sm text-slate-200">
                      {(v2Metrics?.sharpe ?? 0).toFixed(2)}
                    </Text>
                  </View>
                  <View className="flex justify-between">
                    <Text className="block text-xs text-slate-400">最大回撤</Text>
                    <Text className="block text-sm text-rose-400">
                      {((v2Metrics?.maxDrawdown ?? 0) * 100).toFixed(2)}%
                    </Text>
                  </View>
                  <View className="flex justify-between">
                    <Text className="block text-xs text-slate-400">胜率</Text>
                    <Text className="block text-sm text-slate-200">
                      {((v2Metrics?.winRate ?? 0) * 100).toFixed(1)}%
                    </Text>
                  </View>
                  <View className="flex justify-between">
                    <Text className="block text-xs text-slate-400">交易数</Text>
                    <Text className="block text-sm text-slate-200">
                      {v2Metrics?.tradeCount ?? 0}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </CardContent>
        </Card>

        {/* Delta 卡片 */}
        {delta && (
          <Card className="bg-slate-800 border-slate-700 mb-4">
            <CardContent className="p-4">
              <Text className="block text-xs text-slate-400 mb-3">差异分析（V2 相对 V1）</Text>
              <View className="space-y-2">
                <View className="flex justify-between">
                  <Text className="block text-sm text-slate-300">收益差</Text>
                  <Text className={`block text-sm font-semibold ${delta.totalReturnDiff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {(delta.totalReturnDiff >= 0 ? '+' : '') + (delta.totalReturnDiff * 100).toFixed(2)}%
                  </Text>
                </View>
                <View className="flex justify-between">
                  <Text className="block text-sm text-slate-300">夏普差</Text>
                  <Text className={`block text-sm font-semibold ${delta.sharpeDiff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {(delta.sharpeDiff >= 0 ? '+' : '') + delta.sharpeDiff.toFixed(2)}
                  </Text>
                </View>
                <View className="flex justify-between">
                  <Text className="block text-sm text-slate-300">最大回撤差</Text>
                  <Text className={`block text-sm font-semibold ${delta.maxDrawdownDiff <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {(delta.maxDrawdownDiff * 100).toFixed(2)}%（越小越好）
                  </Text>
                </View>
                <View className="flex justify-between">
                  <Text className="block text-sm text-slate-300">胜率差</Text>
                  <Text className={`block text-sm font-semibold ${delta.winRateDiff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {(delta.winRateDiff >= 0 ? '+' : '') + (delta.winRateDiff * 100).toFixed(1)}%
                  </Text>
                </View>
                <Separator className="bg-slate-700 my-2" />
                <View className="flex justify-between">
                  <Text className="block text-sm font-medium text-slate-200">赢家</Text>
                  <Badge variant="outline" className={winner === 'v2' ? 'bg-emerald-500 bg-opacity-20 border-emerald-400 text-emerald-300' : winner === 'v1' ? 'bg-rose-500 bg-opacity-20 border-rose-400 text-rose-300' : 'bg-slate-500 bg-opacity-20 border-slate-400 text-slate-300'}>
                    <Text className="text-xs">
                      {winner === 'v2' ? 'V2 胜出' : winner === 'v1' ? 'V1 胜出' : '平局'}
                    </Text>
                  </Badge>
                </View>
              </View>
            </CardContent>
          </Card>
        )}

        {/* 实验元信息 */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <Text className="block text-xs text-slate-400 mb-2">实验信息</Text>
            <View className="space-y-1">
              <View className="flex justify-between">
                <Text className="block text-xs text-slate-400">时间区间</Text>
                <Text className="block text-xs text-slate-200">
                  {experiment.startDate} ~ {experiment.endDate}
                </Text>
              </View>
              <View className="flex justify-between">
                <Text className="block text-xs text-slate-400">初始资金</Text>
                <Text className="block text-xs text-slate-200">
                  ¥{experiment.initialCapital.toLocaleString()}
                </Text>
              </View>
              <View className="flex justify-between">
                <Text className="block text-xs text-slate-400">状态</Text>
                <Badge variant="outline" className="bg-emerald-500 bg-opacity-20 border-emerald-400 text-emerald-300">
                  <Text className="text-xs">{experiment.status}</Text>
                </Badge>
              </View>
            </View>
          </CardContent>
        </Card>
      </ScrollView>
    </View>
  )
}