import { View, Text, Image } from '@tarojs/components'
import { useMemo } from 'react'

export interface LinePoint {
  /** x 轴标签（如日期） */
  label: string
  /** 主值 */
  value: number
  /** 副值（可选，用于对比基准） */
  secondaryValue?: number
  /** 标记点类型（可选，绘制买卖点） */
  marker?: 'BUY' | 'SELL'
}

interface LineChartProps {
  data: LinePoint[]
  /** 主线条颜色（Tailwind 色值十六进制） */
  color?: string
  /** 副线条颜色 */
  secondaryColor?: string
  /** 填充渐变起止色（[上, 下]） */
  fillColors?: [string, string]
  /** 图表高度（px，会转 rpx） */
  height?: number
  /** 是否显示 y 轴基准线（0 线） */
  showZeroLine?: boolean
  /** y 轴单位（展示在顶部） */
  unit?: string
  /** 格式化数值 */
  formatValue?: (v: number) => string
  /** 空态文案 */
  emptyText?: string
}

/**
 * 轻量 SVG 折线图（零依赖，~120 行）
 * 特性：主折线 + 填充渐变 + 副线（可选）+ 买卖标记点（可选）+ 首尾数值标注
 * 适配：H5 用原生 SVG；小程序端 Image 兜底（同图标库原理）
 */
export function LineChart({
  data,
  color = '#10b981',
  secondaryColor = '#3b82f6',
  fillColors = ['rgba(16, 185, 129, 0.25)', 'rgba(16, 185, 129, 0)'],
  height = 160,
  showZeroLine = false,
  unit = '',
  formatValue = (v) => v.toFixed(2),
  emptyText = '暂无数据',
}: LineChartProps) {
  const valid = data && data.length > 1

  const { pathD, areaD, secondaryD, min, max, points, width } = useMemo(() => {
    if (!valid) return { pathD: '', areaD: '', secondaryD: '', min: 0, max: 1, points: [], width: 0 }
    const W = 600
    const H = height
    const padT = 8
    const padB = 8
    const padL = 4
    const padR = 4
    const chartH = H - padT - padB
    const chartW = W - padL - padR

    const values = data.map(d => d.value)
    const hasSecondary = data.some(d => d.secondaryValue != null)
    const allValues = hasSecondary
      ? [...values, ...data.map(d => d.secondaryValue!)]
      : values
    let minV = Math.min(...allValues)
    let maxV = Math.max(...allValues)
    if (showZeroLine) {
      minV = Math.min(minV, 0)
      maxV = Math.max(maxV, 0)
    }
    if (minV === maxV) {
      minV = minV - 1
      maxV = maxV + 1
    }
    const range = maxV - minV

    const n = data.length
    const xStep = n > 1 ? chartW / (n - 1) : 0

    const pts = data.map((d, i) => {
      const x = padL + i * xStep
      const y = padT + chartH - ((d.value - minV) / range) * chartH
      const sy = d.secondaryValue != null
        ? padT + chartH - ((d.secondaryValue - minV) / range) * chartH
        : y
      return { x, y, sy, label: d.label, value: d.value, marker: d.marker }
    })

    // 主折线
    const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
    // 填充区域
    const area = `${path} L${pts[pts.length - 1].x.toFixed(2)},${padT + chartH} L${pts[0].x.toFixed(2)},${padT + chartH} Z`
    // 副线
    const sec = hasSecondary
      ? pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.sy.toFixed(2)}`).join(' ')
      : ''

    return { pathD: path, areaD: area, secondaryD: sec, min: minV, max: maxV, points: pts, width: W }
  }, [data, valid, height, showZeroLine])

  if (!valid) {
    return (
      <View
        className="w-full flex items-center justify-center bg-slate-800 bg-opacity-40 rounded-lg"
        style={{ height: `${height}px` }}
      >
        <Text className="block text-sm text-slate-500">{emptyText}</Text>
      </View>
    )
  }

  const first = points[0]
  const last = points[points.length - 1]
  const midIdx = Math.floor(points.length / 2)
  const mid = points[midIdx]
  const zeroY = showZeroLine
    ? (() => {
        const chartH = height - 16
        const range = max - min
        return 8 + chartH - ((0 - min) / range) * chartH
      })()
    : 0

  const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <linearGradient id="fillGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${fillColors[0]}" />
      <stop offset="100%" stop-color="${fillColors[1]}" />
    </linearGradient>
  </defs>
  <!-- 零轴 -->
  ${showZeroLine ? `<line x1="4" y1="${zeroY.toFixed(2)}" x2="${width - 4}" y2="${zeroY.toFixed(2)}" stroke="#334155" stroke-width="1" stroke-dasharray="4,4"/>` : ''}
  <!-- 底部边线 -->
  <line x1="4" y1="${height - 8}" x2="${width - 4}" y2="${height - 8}" stroke="#1e293b" stroke-width="1"/>
  <!-- 填充区域 -->
  <path d="${areaD}" fill="url(#fillGrad)"/>
  <!-- 主折线 -->
  <path d="${pathD}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
  <!-- 副线 -->
  ${secondaryD ? `<path d="${secondaryD}" fill="none" stroke="${secondaryColor}" stroke-width="1.5" stroke-dasharray="5,3"/>` : ''}
  <!-- 起止点 -->
  <circle cx="${first.x.toFixed(2)}" cy="${first.y.toFixed(2)}" r="3" fill="${color}"/>
  <circle cx="${last.x.toFixed(2)}" cy="${last.y.toFixed(2)}" r="3.5" fill="${color}"/>
  <!-- 买卖标记点 -->
  ${points.filter(p => p.marker).map((p) => {
    if (p.marker === 'BUY') {
      return `<polygon points="${p.x},${p.y - 6} ${p.x - 5},${p.y + 2} ${p.x + 5},${p.y + 2}" fill="#ef4444"/>`
    }
    return `<polygon points="${p.x},${p.y + 6} ${p.x - 5},${p.y - 2} ${p.x + 5},${p.y - 2}" fill="#22c55e"/>`
  }).join('')}
</svg>`

  const svgDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}`

  return (
    <View className="w-full">
      {/* 顶部数值 */}
      <View className="flex justify-between items-center mb-2 px-1">
        <View>
          <Text className="block text-xs text-slate-400">{data[0].label}</Text>
          <Text className="block text-base font-bold" style={{ color }}>
            {unit}{formatValue(data[0].value)}
          </Text>
        </View>
        <View className="text-right">
          <Text className="block text-xs text-slate-400">{data[data.length - 1].label}</Text>
          <Text className="block text-base font-bold" style={{ color }}>
            {unit}{formatValue(data[data.length - 1].value)}
          </Text>
        </View>
      </View>
      {/* 图表主体 */}
      <View className="w-full overflow-hidden rounded-lg">
        <Image
          src={svgDataUrl}
          className="w-full block"
          style={{ height: `${height}px` }}
          mode="widthFix"
        />
      </View>
      {/* x 轴标签（首/中/末） */}
      <View className="flex justify-between mt-2 px-1">
        <Text className="block text-xs text-slate-500">{data[0].label}</Text>
        <Text className="block text-xs text-slate-500">{mid.label}</Text>
        <Text className="block text-xs text-slate-500">{data[data.length - 1].label}</Text>
      </View>
    </View>
  )
}
