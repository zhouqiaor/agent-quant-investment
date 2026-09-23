import { View, Text, ScrollView, Image } from '@tarojs/components'
import { useEffect, useMemo, useState } from 'react'
import Taro from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { useAnimatedNumber } from '@/lib/use-animated-number'
import { Network } from '@/network'
import { usePortfolioStore } from '@/stores/portfolio'
import {
  buildPnlBars,
  calcPositionPct,
  withStrategyNames,
} from '@/lib/portfolio'

interface StrategyOption {
  id: string
  name: string
}

/**
 * 构造策略 PnL 水平条形图的 SVG 字符串。
 * 与 candle-chart 一致：SVG → data URL → <Image>，兼容 H5 + 小程序。
 *
 * 配色沿用项目约定：正收益绿、负收益红。
 */
function buildPnlSvg(
  rows: Array<{ name: string; pnl: number; widthPct: number; positive: boolean }>,
): string {
  const W = 320
  const labelW = 78
  const valueW = 58
  const barX = labelW + 4
  const barMaxW = W - barX - valueW
  const rowH = 34
  const padT = 8
  const H = padT * 2 + rows.length * rowH
  const green = '#22c55e'
  const red = '#ef4444'

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`,
  ]

  rows.forEach((r, i) => {
    const y = padT + i * rowH
    const cy = y + rowH / 2
    // 轨道
    parts.push(
      `<rect x="${barX}" y="${cy - 7}" width="${barMaxW}" height="14" rx="3" fill="#1e293b"/>`,
    )
    // 标签（截断，避免侵入条形区）
    const label = r.name.length > 6 ? `${r.name.slice(0, 6)}…` : r.name
    parts.push(
      `<text x="${labelW}" y="${cy + 4}" font-size="10" fill="#cbd5e1" text-anchor="end" font-family="sans-serif">${label}</text>`,
    )
    if (r.widthPct > 0) {
      const bw = Math.max(2, (r.widthPct / 100) * barMaxW)
      parts.push(
        `<rect x="${barX}" y="${cy - 7}" width="${bw.toFixed(1)}" height="14" rx="3" fill="${r.positive ? green : red}"/>`,
      )
    }
    const val = `${r.pnl >= 0 ? '+' : ''}${r.pnl.toFixed(0)}`
    parts.push(
      `<text x="${barX + barMaxW + 4}" y="${cy + 4}" font-size="10" fill="${r.positive ? green : red}" font-family="sans-serif">${val}</text>`,
    )
  })

  parts.push('</svg>')
  return parts.join('')
}

const PortfolioPage = () => {
  const summary = usePortfolioStore((s) => s.summary)
  const loading = usePortfolioStore((s) => s.loading)
  const loadSummary = usePortfolioStore((s) => s.loadSummary)
  const toggleStrategy = usePortfolioStore((s) => s.toggleStrategy)
  const [nameMap, setNameMap] = useState<Record<string, string>>({})

  useEffect(() => {
    loadSummary()
    // 策略名来自既有 /api/strategies（summary 只含 strategyId）
    Network.request({ url: '/api/strategies' })
      .then((res) => {
        const list = (res.data?.data ?? []) as StrategyOption[]
        const map: Record<string, string> = {}
        list.forEach((s) => {
          map[s.id] = s.name
        })
        setNameMap(map)
      })
      .catch((e) => console.error('load strategy names error:', e))
  }, [])

  const animatedTotalValue = useAnimatedNumber(summary?.totalValue ?? 0)
  const animatedCash = useAnimatedNumber(summary?.cash ?? 0)
  const positionPct = calcPositionPct(summary?.totalValue ?? 0, summary?.cash ?? 0)
  const animatedPositionPct = useAnimatedNumber(positionPct)

  const namedStrategies = useMemo(
    () => withStrategyNames(summary?.strategies ?? [], nameMap),
    [summary, nameMap],
  )

  const chartSvgUrl = useMemo(() => {
    const bars = buildPnlBars(summary?.strategies ?? [])
    const named = withStrategyNames(bars, nameMap)
    const svg = buildPnlSvg(named)
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
  }, [summary, nameMap])

  const hasRunning = namedStrategies.some((s) => s.running)

  const goStrategy = () => {
    // 策略页是 tabBar 页面，必须用 switchTab（H5/小程序一致）
    Taro.switchTab({ url: '/pages/strategy/index' })
  }

  return (
    <View className="flex flex-col h-full bg-slate-900">
      <ScrollView scrollY className="flex-1 smooth-scroll hide-scrollbar">
        <View className="px-4 pb-20 gap-3 flex flex-col">
          {/* 顶部：总资产卡片 */}
          <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 mt-3">
            <CardContent className="p-4">
              <View className="flex flex-col gap-2">
                <Text className="block text-xs text-slate-400">总资产</Text>
                {loading && !summary ? (
                  <Skeleton className="h-8 w-40 bg-slate-700" />
                ) : (
                  <Text className="block text-3xl font-bold text-slate-100 tabular-nums">
                    ¥
                    {animatedTotalValue.toLocaleString('zh-CN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </Text>
                )}
                <Separator className="my-2 bg-slate-700" />
                <View className="flex flex-row gap-4">
                  <View className="flex-1">
                    <Text className="block text-xs text-slate-400">可用现金</Text>
                    <Text className="block text-base font-semibold tabular-nums mt-1 text-slate-100">
                      ¥
                      {animatedCash.toLocaleString('zh-CN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="block text-xs text-slate-400">仓位占比</Text>
                    <Text className="block text-base font-semibold tabular-nums mt-1 text-emerald-400">
                      {animatedPositionPct.toFixed(1)}%
                    </Text>
                  </View>
                </View>
              </View>
            </CardContent>
          </Card>

          {loading && !summary ? (
            <View className="flex flex-col gap-3">
              <Skeleton className="h-44 w-full bg-slate-800" />
              <Skeleton className="h-64 w-full bg-slate-800" />
            </View>
          ) : !hasRunning ? (
            /* 空态 */
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6">
                <View className="flex flex-col items-center gap-3 py-6">
                  <Text className="block text-sm text-slate-300">
                    还没有运行中的策略 · 去策略页开启
                  </Text>
                  <Button
                    className="bg-emerald-500 text-white"
                    onClick={goStrategy}
                  >
                    <Text className="text-sm font-medium">前往策略页</Text>
                  </Button>
                </View>
              </CardContent>
            </Card>
          ) : (
            <View className="flex flex-col md:flex-row gap-3">
              {/* 左：策略 PnL 贡献 */}
              <Card className="bg-slate-800 border-slate-700 md:flex-1">
                <CardContent className="p-4">
                  <Text className="block text-sm font-semibold text-slate-100 mb-3">
                    策略 PnL 贡献
                  </Text>
                  <Image
                    src={chartSvgUrl}
                    className="w-full block"
                    mode="widthFix"
                  />
                </CardContent>
              </Card>

              {/* 右：策略矩阵 */}
              <Card className="bg-slate-800 border-slate-700 md:flex-[1.4]">
                <CardContent className="p-4">
                  <Text className="block text-sm font-semibold text-slate-100 mb-3">
                    策略矩阵
                  </Text>
                  <View className="flex flex-col gap-1">
                    {/* 表头 */}
                    <View className="flex flex-row items-center gap-2 px-1 pb-2">
                      <Text className="flex-1 block text-xs text-slate-500">
                        策略
                      </Text>
                      <Text className="w-12 text-center block text-xs text-slate-500">
                        开关
                      </Text>
                      <Text className="w-14 text-right block text-xs text-slate-500">
                        仓位上限
                      </Text>
                      <Text className="w-16 text-right block text-xs text-slate-500">
                        PnL
                      </Text>
                      <Text className="w-12 text-right block text-xs text-slate-500">
                        胜率
                      </Text>
                    </View>
                    {namedStrategies.map((s) => (
                      <View
                        key={s.strategyId}
                        className="flex flex-row items-center gap-2 px-1 py-2 rounded-lg bg-slate-900 bg-opacity-50"
                      >
                        <View className="flex-1 flex flex-col">
                          <Text
                            className={`block text-xs font-medium ${
                              s.running ? 'text-slate-100' : 'text-slate-400'
                            }`}
                          >
                            {s.name}
                          </Text>
                          <Text className="block text-[10px] text-slate-500 mt-1">
                            {s.trades} 笔交易
                          </Text>
                        </View>
                        <View className="w-12 flex items-center justify-center">
                          <Switch
                            checked={s.running}
                            onCheckedChange={(checked) =>
                              toggleStrategy(s.strategyId, checked)
                            }
                          />
                        </View>
                        <Text className="w-14 text-right block text-xs text-slate-300 tabular-nums">
                          {(s.maxPositionPct * 100).toFixed(0)}%
                        </Text>
                        <Text
                          className={`w-16 text-right block text-xs tabular-nums ${
                            s.pnl >= 0 ? 'text-green-500' : 'text-red-500'
                          }`}
                        >
                          {s.pnl >= 0 ? '+' : ''}
                          {s.pnl.toFixed(0)}
                        </Text>
                        <Text className="w-12 text-right block text-xs text-slate-300 tabular-nums">
                          {typeof s.winRate === 'number'
                            ? `${s.winRate.toFixed(0)}%`
                            : '—'}
                        </Text>
                      </View>
                    ))}
                  </View>
                </CardContent>
              </Card>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}

export default PortfolioPage
