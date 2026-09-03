import { View, Text, Image } from '@tarojs/components'
import { useMemo } from 'react'

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
}

/**
 * 轻量 K 线图（SVG，零依赖）
 * 特性：蜡烛实体 + 影线 + 成本参考线 + 当前价标注 + 周期切换
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

    // 价格范围，含成本价
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
    const pad = (maxV - minV) * 0.08
    maxV += pad
    minV -= pad
    const range = maxV - minV || 1

    const yOf = (v: number) => padT + chartH - ((v - minV) / range) * chartH

    const candles = data.map((d, i) => {
      const x = padL + i * step + step / 2
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

    // 十字光标（hover）：暂未开放交互

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${height}" width="${W}" height="${height}">
  ${shapes.join('')}
  <!-- 最高/最低价标注 -->
  <text x="6" y="${(padT + 12).toFixed(1)}" font-size="10" fill="#64748b" font-family="sans-serif">${maxV.toFixed(2)}</text>
  <text x="6" y="${(height - padB - 2).toFixed(1)}" font-size="10" fill="#64748b" font-family="sans-serif">${minV.toFixed(2)}</text>
</svg>`

    return { svgContent: svg, displayIdx: idx }
  }, [data, valid, height, redUp, costPrice, currentPrice])

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
    </View>
  )
}
