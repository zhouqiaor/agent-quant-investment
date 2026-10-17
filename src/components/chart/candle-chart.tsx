import { View, Text, Image } from '@tarojs/components'
import { useMemo } from 'react'
import type { IndicatorBundle } from '@/lib/indicators/types'
import { MA_COLORS } from '@/lib/indicators/types'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { MacdChart } from './macd-chart'
import { KdjChart } from './kdj-chart'

/**
 * 单个图表的兜底 UI：灰色背景占位 + "图表加载失败，点此重试"
 * 点击整块区域即可触发 reset，重新渲染图表。
 */
function ChartErrorFallback({
  height,
  reset,
}: {
  height: number
  reset: () => void
}) {
  return (
    <View
      className="w-full flex items-center justify-center bg-slate-800 bg-opacity-60 rounded-lg"
      style={{ height: `${height + 20}px` }}
      onClick={reset}
    >
      <Text className="block text-sm text-slate-400">
        图表加载失败，点此重试
      </Text>
    </View>
  )
}

export interface Candle {
  date: string
  open: number
  close: number
  high: number
  low: number
  volume?: number
}

interface CandleChartProps {
  data: Candle[]
  /** 成本价（可选，画水平参考线） */
  costPrice?: number
  /** 当前价标注（可选） */
  currentPrice?: number
  /** 图表高度 */
  height?: number
  /** 红涨绿跌还是绿涨红跌（国内习惯红涨绿跌） */
  redUp?: boolean
  /** 空态文案 */
  emptyText?: string
  /** 周期切换可选值 */
  periods?: { label: string; value: string }[]
  /** 当前周期 */
  period?: string
  /** 周期切换回调 */
  onPeriodChange?: (p: string) => void
  /** 技术指标（可选，含 MA/MACD/BOLL/KDJ） */
  indicators?: IndicatorBundle
  /** 是否显示 MA 叠加（默认 true） */
  showMa?: boolean
  /** 是否显示 BOLL 叠加（默认 true） */
  showBoll?: boolean
  /** 是否显示 MACD 副图（默认 true） */
  showMacd?: boolean
  /** 是否显示 KDJ 副图（默认 true） */
  showKdj?: boolean
  /** 是否显示信号标记（默认 true） */
  showSignals?: boolean
  /** MACD 副图高度 */
  macdHeight?: number
  /** KDJ 副图高度 */
  kdjHeight?: number
}

/**
 * 轻量 K 线图（SVG，零依赖）
 * 特性：蜡烛实体 + 影线 + 成本参考线 + 当前价标注 + 周期切换
 * 叠加：MA5/10/20/60 + BOLL 上下轨 + 信号三角标记
 * 副图：MACD + KDJ
 */
export function CandleChart({
  data,
  costPrice,
  currentPrice,
  height = 200,
  redUp = true,
  emptyText = '暂无K线数据',
  periods,
  period,
  onPeriodChange,
  indicators,
  showMa = true,
  showBoll = true,
  showMacd = true,
  showKdj = true,
  showSignals = true,
  macdHeight = 80,
  kdjHeight = 60,
}: CandleChartProps) {
  const valid = data && data.length >= 2

  const { svgContent, displayIdx } = useMemo(() => {
    const W = 640
    const up = redUp ? '#ef4444' : '#22c55e'
    const down = redUp ? '#22c55e' : '#ef4444'
    if (!valid) {
      return { svgContent: '', displayIdx: null }
    }

    const padT = 10
    const padB = 16
    const padL = 4
    const padR = 4
    const chartH = height - padT - padB
    const chartW = W - padL - padR
    const n = data.length
    const candleW = (chartW / n) * 0.65
    const step = chartW / n

    // 价格范围：含 candles / costPrice / currentPrice / BOLL / MA
    const highs = data.map(d => d.high)
    const lows = data.map(d => d.low)
    let maxV = Math.max(...highs)
    let minV = Math.min(...lows)
    if (costPrice != null) {
      maxV = Math.max(maxV, costPrice)
      minV = Math.min(minV, costPrice)
    }
    if (currentPrice != null) {
      maxV = Math.max(maxV, currentPrice)
      minV = Math.min(minV, currentPrice)
    }
    // BOLL 上下轨也纳入范围
    if (showBoll && indicators) {
      for (const arr of [indicators.boll.upper, indicators.boll.lower, indicators.boll.mid]) {
        for (const v of arr) {
          if (v === null) continue
          if (v > maxV) maxV = v
          if (v < minV) minV = v
        }
      }
    }
    // MA 线纳入范围
    if (showMa && indicators) {
      for (const maKey of Object.keys(indicators.ma)) {
        for (const v of indicators.ma[maKey]) {
          if (v === null) continue
          if (v > maxV) maxV = v
          if (v < minV) minV = v
        }
      }
    }
    const pad = (maxV - minV) * 0.08
    maxV += pad
    minV -= pad
    const range = maxV - minV || 1

    const yOf = (v: number) => padT + chartH - ((v - minV) / range) * chartH
    const xOf = (i: number) => padL + i * step + step / 2

    const candles = data.map((d, i) => {
      const x = xOf(i)
      const isUp = d.close >= d.open
      const color = isUp ? up : down
      const topY = yOf(Math.max(d.open, d.close))
      const botY = yOf(Math.min(d.open, d.close))
      const highY = yOf(d.high)
      const lowY = yOf(d.low)
      return { x, topY, botY, highY, lowY, candleW, color, isUp }
    })

    const idx = n - 1

    const shapes: string[] = []

    // 网格线（3 条）
    for (let i = 1; i <= 2; i++) {
      const y = padT + (chartH / 3) * i
      shapes.push(`<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="#1e293b" stroke-width="1"/>`)
    }

    // MA 叠加（在 K 线之前绘制，避免覆盖蜡烛）
    if (showMa && indicators) {
      for (const maPeriod of Object.keys(indicators.ma).sort((a, b) => Number(a) - Number(b))) {
        const series = indicators.ma[maPeriod]
        const color = MA_COLORS[maPeriod] ?? '#94a3b8'
        let path = ''
        let started = false
        for (let i = 0; i < n; i++) {
          const v = series[i]
          if (v === null) continue
          const x = xOf(i).toFixed(1)
          const y = yOf(v).toFixed(1)
          path += started ? ` L ${x} ${y}` : `M ${x} ${y}`
          started = true
        }
        if (path) {
          shapes.push(`<path d="${path}" stroke="${color}" stroke-width="1" fill="none" opacity="0.85"/>`)
        }
      }
    }

    // BOLL 叠加
    if (showBoll && indicators) {
      const drawBoll = (arr: (number | null)[], color: string, dash: string) => {
        let path = ''
        let started = false
        for (let i = 0; i < n; i++) {
          const v = arr[i]
          if (v === null) continue
          const x = xOf(i).toFixed(1)
          const y = yOf(v).toFixed(1)
          path += started ? ` L ${x} ${y}` : `M ${x} ${y}`
          started = true
        }
        if (path) {
          shapes.push(`<path d="${path}" stroke="${color}" stroke-width="1" fill="none" stroke-dasharray="${dash}" opacity="0.6"/>`)
        }
      }
      drawBoll(indicators.boll.upper, '#a78bfa', '4,2')   // 紫 上轨
      drawBoll(indicators.boll.mid, '#94a3b8', '2,2')     // 灰 中轨
      drawBoll(indicators.boll.lower, '#a78bfa', '4,2')   // 紫 下轨
    }

    // 影线
    for (const c of candles) {
      shapes.push(`<line x1="${c.x.toFixed(1)}" y1="${c.highY.toFixed(1)}" x2="${c.x.toFixed(1)}" y2="${c.lowY.toFixed(1)}" stroke="${c.color}" stroke-width="1"/>`)
    }

    // 实体
    for (const c of candles) {
      const x = (c.x - c.candleW / 2).toFixed(1)
      shapes.push(`<rect x="${x}" y="${c.topY.toFixed(1)}" width="${c.candleW.toFixed(1)}" height="${Math.max(c.botY - c.topY, 1).toFixed(1)}" fill="${c.isUp ? 'none' : c.color}" stroke="${c.color}" stroke-width="1"/>`)
    }

    // 成本价线
    if (costPrice != null) {
      const y = yOf(costPrice)
      shapes.push(`<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="6,4"/>`)
      shapes.push(`<rect x="${W - padR - 42}" y="${(y - 9).toFixed(1)}" width="42" height="18" fill="#f59e0b" rx="2"/>`)
      shapes.push(`<text x="${W - padR - 38}" y="${(y + 4).toFixed(1)}" font-size="11" fill="#fff" font-family="sans-serif">成本 ${costPrice.toFixed(2)}</text>`)
    }

    // 当前价标注
    if (currentPrice != null) {
      const y = yOf(currentPrice)
      const c = currentPrice >= (data[0].open ?? 0) ? up : down
      shapes.push(`<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="${c}" stroke-width="1" stroke-dasharray="3,3"/>`)
    }

    // 信号三角标记（最新一日的显著信号）
    if (showSignals && indicators?.signals?.length) {
      const last = n - 1
      const recent = indicators.signals.filter((s) => s.index === last)
      for (const s of recent) {
        const x = xOf(last)
        // 三角位置：底部上方 4px；颜色按信号类型
        let color = '#fbbf24'
        let label = ''
        switch (s.type) {
          case 'macd_golden':
            color = '#22c55e'; label = 'MACD金叉'; break
          case 'macd_death':
            color = '#ef4444'; label = 'MACD死叉'; break
          case 'boll_upper_break':
            color = '#a855f7'; label = 'BOLL突破'; break
          case 'boll_lower_break':
            color = '#a855f7'; label = 'BOLL跌破'; break
          case 'kdj_overbought':
            color = '#f97316'; label = 'KDJ超买'; break
          case 'kdj_oversold':
            color = '#3b82f6'; label = 'KDJ超卖'; break
        }
        const ty = padT + 4
        shapes.push(`<polygon points="${x.toFixed(1)},${ty} ${(x - 4).toFixed(1)},${(ty + 8).toFixed(1)} ${(x + 4).toFixed(1)},${(ty + 8).toFixed(1)}" fill="${color}"/>`)
        if (label) {
          shapes.push(`<text x="${x.toFixed(1)}" y="${(ty + 22).toFixed(1)}" font-size="9" fill="${color}" text-anchor="middle" font-family="sans-serif">${label}</text>`)
        }
      }
    }

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${height}" width="${W}" height="${height}">
  ${shapes.join('')}
  <!-- 最高/最低价标注 -->
  <text x="6" y="${(padT + 12).toFixed(1)}" font-size="10" fill="#64748b" font-family="sans-serif">${maxV.toFixed(2)}</text>
  <text x="6" y="${(height - padB - 2).toFixed(1)}" font-size="10" fill="#64748b" font-family="sans-serif">${minV.toFixed(2)}</text>
</svg>`

    return { svgContent: svg, displayIdx: idx }
  }, [data, valid, height, redUp, costPrice, currentPrice, indicators, showMa, showBoll, showSignals])

  if (!valid) {
    return (
      <View
        className="w-full flex items-center justify-center bg-slate-800 bg-opacity-40 rounded-lg"
        style={{ height: `${height + 20}px` }}
      >
        <Text className="block text-sm text-slate-500">{emptyText}</Text>
      </View>
    )
  }

  const svgDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}`
  const display = data[displayIdx ?? data.length - 1]

  return (
    <ErrorBoundary
      fallback={(_err, reset) => <ChartErrorFallback height={height} reset={reset} />}
    >
      <View className="w-full">
        {/* 顶部 OHLC 信息 */}
        <View className="flex justify-between items-center mb-2 px-1">
          <View className="flex gap-3">
            <Text className="block text-xs text-slate-400">
              开 <Text className="text-slate-200">{display.open.toFixed(2)}</Text>
            </Text>
            <Text className="block text-xs text-slate-400">
              高 <Text className="text-red-400">{display.high.toFixed(2)}</Text>
            </Text>
            <Text className="block text-xs text-slate-400">
              低 <Text className="text-green-400">{display.low.toFixed(2)}</Text>
            </Text>
            <Text className="block text-xs text-slate-400">
              收 <Text className={display.close >= display.open ? 'text-red-400' : 'text-green-400'}>{display.close.toFixed(2)}</Text>
            </Text>
          </View>
          <Text className="block text-xs text-slate-500">{display.date}</Text>
        </View>

        {/* 周期切换 */}
        {periods && period && onPeriodChange && (
          <View className="flex justify-end gap-1 mb-2">
            {periods.map(p => (
              <View
                key={p.value}
                className={`px-2 py-1 rounded text-xs ${
                  period === p.value
                    ? 'bg-slate-700 text-slate-100'
                    : 'bg-slate-800 text-slate-400'
                }`}
                onClick={() => onPeriodChange(p.value)}
              >
                <Text className="block">{p.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* K线主体 */}
        <View className="w-full overflow-hidden rounded-lg bg-slate-900 bg-opacity-50">
          <Image
            src={svgDataUrl}
            className="w-full block"
            style={{ height: `${height}px` }}
            mode="widthFix"
          />
        </View>

        {/* MACD 副图 */}
        {showMacd && indicators?.macd && (
          <MacdChart data={indicators.macd} height={macdHeight} redUp={redUp} />
        )}

        {/* KDJ 副图 */}
        {showKdj && indicators?.kdj && (
          <KdjChart data={indicators.kdj} height={kdjHeight} />
        )}
      </View>
    </ErrorBoundary>
  )
}