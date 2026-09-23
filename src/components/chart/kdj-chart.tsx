import { View, Image, Text } from '@tarojs/components'
import { useMemo } from 'react'
import type { KdjResult } from '@/lib/indicators/types'
import { ErrorBoundary } from '@/components/ui/error-boundary'

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
      style={{ height: `${height}px` }}
      onClick={reset}
    >
      <Text className="block text-sm text-slate-400">
        图表加载失败，点此重试
      </Text>
    </View>
  )
}

interface KdjChartProps {
  data: KdjResult
  width?: number
  height?: number
}

/**
 * KDJ 副图（K/D/J 三线 + 超买超卖参考线）
 * 数据：data.k / data.d / data.j，长度与 closes 对齐
 */
export function KdjChart({ data, width = 640, height = 60 }: KdjChartProps) {
  const svgContent = useMemo(() => {
    const validK = data.k.filter((v): v is number => v !== null)
    if (validK.length < 2) return ''
    const n = data.k.length
    const padT = 4
    const padB = 4
    const padL = 4
    const padR = 4
    const chartH = height - padT - padB
    const chartW = width - padL - padR
    const step = chartW / n
    const xOf = (i: number) => padL + i * step + step / 2

    // KDJ 范围：[-20, 120] 固定（或按实际 min/max 缩放）
    // 这里用 0~100 作为默认范围，超出此范围的值按边缘绘制
    const minV = 0
    const maxV = 100
    const range = maxV - minV
    const yOf = (v: number) => padT + chartH - ((Math.max(minV, Math.min(maxV, v)) - minV) / range) * chartH

    const shapes: string[] = []

    // 20 / 80 参考线（超卖/超买区域）
    const y20 = yOf(20).toFixed(1)
    const y80 = yOf(80).toFixed(1)
    shapes.push(`<line x1="${padL}" y1="${y20}" x2="${width - padR}" y2="${y20}" stroke="#475569" stroke-width="0.5" stroke-dasharray="2,2"/>`)
    shapes.push(`<line x1="${padL}" y1="${y80}" x2="${width - padR}" y2="${y80}" stroke="#475569" stroke-width="0.5" stroke-dasharray="2,2"/>`)

    // K/D/J 折线
    const buildPath = (arr: (number | null)[]) => {
      let p = ''
      let started = false
      for (let i = 0; i < n; i++) {
        const v = arr[i]
        if (v === null) continue
        const x = xOf(i).toFixed(1)
        const y = yOf(v).toFixed(1)
        p += started ? ` L ${x} ${y}` : `M ${x} ${y}`
        started = true
      }
      return p
    }

    const kPath = buildPath(data.k)
    const dPath = buildPath(data.d)
    const jPath = buildPath(data.j)

    if (kPath) shapes.push(`<path d="${kPath}" stroke="#3b82f6" stroke-width="1" fill="none"/>`)
    if (dPath) shapes.push(`<path d="${dPath}" stroke="#f97316" stroke-width="1" fill="none"/>`)
    if (jPath) shapes.push(`<path d="${jPath}" stroke="#a855f7" stroke-width="1" fill="none"/>`)

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${shapes.join('')}</svg>`
  }, [data, width, height])

  if (!svgContent) return null

  const svgDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}`
  return (
    <ErrorBoundary
      fallback={(_err, reset) => <ChartErrorFallback height={height} reset={reset} />}
    >
      <View className="w-full overflow-hidden bg-slate-900 bg-opacity-30" style={{ height: `${height}px` }}>
        <Image src={svgDataUrl} className="w-full block" style={{ height: `${height}px` }} mode="widthFix" />
      </View>
    </ErrorBoundary>
  )
}