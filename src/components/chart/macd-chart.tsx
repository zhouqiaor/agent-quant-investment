import { View, Image } from '@tarojs/components'
import { useMemo } from 'react'
import type { MacdResult } from '@/lib/indicators/types'

interface MacdChartProps {
  data: MacdResult
  /** 总宽度（同 CandleChart 的 W） */
  width?: number
  /** 图表高度 */
  height?: number
  /** 红涨绿跌 */
  redUp?: boolean
}

/**
 * MACD 副图（DIF/DEA 折线 + HIST 柱状）
 * 数据：data.dif / data.dea / data.hist，长度与 closes 对齐
 */
export function MacdChart({ data, width = 640, height = 80, redUp = true }: MacdChartProps) {
  const svgContent = useMemo(() => {
    const validDif = data.dif.filter((v): v is number => v !== null)
    if (validDif.length < 2) return ''
    const up = redUp ? '#ef4444' : '#22c55e'
    const down = redUp ? '#22c55e' : '#ef4444'

    const n = data.dif.length
    const padT = 6
    const padB = 4
    const padL = 4
    const padR = 4
    const chartH = height - padT - padB
    const chartW = width - padL - padR
    const step = chartW / n
    const xOf = (i: number) => padL + i * step + step / 2

    // 计算 0 线位置（hist 围绕 0）
    let maxAbs = 0
    for (const v of data.hist) {
      if (v === null) continue
      if (Math.abs(v) > maxAbs) maxAbs = Math.abs(v)
    }
    if (maxAbs === 0) maxAbs = 1
    const range = maxAbs * 2
    const yOf = (v: number) => padT + chartH - ((v + maxAbs) / range) * chartH
    const yZero = yOf(0)

    const shapes: string[] = []

    // 0 线
    shapes.push(`<line x1="${padL}" y1="${yZero.toFixed(1)}" x2="${width - padR}" y2="${yZero.toFixed(1)}" stroke="#475569" stroke-width="0.5" stroke-dasharray="2,2"/>`)

    // HIST 柱
    const barW = step * 0.5
    for (let i = 0; i < n; i++) {
      const h = data.hist[i]
      if (h === null) continue
      const x = xOf(i) - barW / 2
      const y = h >= 0 ? yOf(h) : yZero
      const heightBar = Math.max(Math.abs(yOf(h) - yZero), 1)
      const color = h >= 0 ? up : down
      shapes.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${heightBar.toFixed(1)}" fill="${color}" opacity="0.6"/>`)
    }

    // DIF 折线
    let pathDif = ''
    let started = false
    for (let i = 0; i < n; i++) {
      const v = data.dif[i]
      if (v === null) continue
      const x = xOf(i).toFixed(1)
      const y = yOf(v).toFixed(1)
      pathDif += started ? ` L ${x} ${y}` : `M ${x} ${y}`
      started = true
    }
    if (pathDif) {
      shapes.push(`<path d="${pathDif}" stroke="#f59e0b" stroke-width="1" fill="none"/>`)
    }

    // DEA 折线
    let pathDea = ''
    let startedDea = false
    for (let i = 0; i < n; i++) {
      const v = data.dea[i]
      if (v === null) continue
      const x = xOf(i).toFixed(1)
      const y = yOf(v).toFixed(1)
      pathDea += startedDea ? ` L ${x} ${y}` : `M ${x} ${y}`
      startedDea = true
    }
    if (pathDea) {
      shapes.push(`<path d="${pathDea}" stroke="#3b82f6" stroke-width="1" fill="none"/>`)
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${shapes.join('')}</svg>`
  }, [data, width, height, redUp])

  if (!svgContent) return null

  const svgDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}`
  return (
    <View className="w-full overflow-hidden bg-slate-900 bg-opacity-30" style={{ height: `${height}px` }}>
      <Image src={svgDataUrl} className="w-full block" style={{ height: `${height}px` }} mode="widthFix" />
    </View>
  )
}