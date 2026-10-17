/**
 * VirtualList —— Taro 4 兼容的固定行高虚拟列表
 *
 * 设计动机：
 *   - 市场页 5553 只股票全量 `.map()` 会导致 DOM 节点爆掉、首屏卡顿
 *   - Taro 4 的 `@tarojs/components` 没有导出内置 `<VirtualList />`，需要手写
 *   - 仅渲染视口 + overscan 的可见行，靠 absolute positioning + 虚拟 scroll 容器
 *     把可见区外的节点留给 React 跳过更新
 *
 * 跨端：
 *   - H5 端：基于原生 ScrollView / overflow scroll
 *   - 微信/抖音小程序：基于原生 scroll-view 组件（onScroll 事件 + scrollTop scrollHeight）
 *
 * 性能：
 *   - scrollTop 通过 rAF 节流后写 state，避免每个滚动事件触发 60+ 次 setState
 *   - onReachEnd 在触底后单次触发，回到顶部后再次允许触发
 *   - 容器高度可传 `number`（px）或 `string`（'100%' / 'calc(...)'），父容器需明确高度
 */
import * as React from 'react'
import { ScrollView, View, type ScrollViewProps } from '@tarojs/components'

/** VirtualList 的 props */
export interface VirtualListProps<T> {
  /** 数据源 */
  data: T[]
  /** 单行固定高度（px），单一 type 系统下的所有数据共享同一高度 */
  itemHeight: number
  /** 容器高度。可以是 px 数字，也可以是 CSS 字符串（如 '100%' / 'calc(100vh - 200px)'） */
  height: number | string
  /** 渲染单行 */
  renderItem: (item: T, index: number) => React.ReactNode
  /** 触底回调（距底 endThreshold px 内触发） */
  onReachEnd?: () => void
  /** 预渲染上下额外的行数（默认 5） */
  overscan?: number
  /** 距底多少 px 视为触底（默认 200） */
  endThreshold?: number
  /** 透传给最外层容器的 className */
  className?: string
  /** 透传给最外层容器的内联样式 */
  style?: React.CSSProperties
  /** 自定义每行的 key（默认 index） */
  itemKey?: (item: T, index: number) => string | number
  /** 滚动事件回调（节流后） */
  onScroll?: (info: { scrollTop: number; scrollHeight: number; visibleStart: number; visibleEnd: number }) => void
  /** 透传给 ScrollView 的其他属性（scrollY / refresherEnabled 等） */
  scrollViewProps?: Omit<ScrollViewProps, 'scrollY' | 'onScroll' | 'style' | 'className' | 'children' | 'lowerThreshold'>
}

/**
 * 计算可见区间的纯函数（可独立单测）
 *
 * @param scrollTop 当前滚动位置
 * @param height    视口高度（px）
 * @param itemHeight 单行高度（px）
 * @param total     数据总数
 * @param overscan  上下预渲染行数
 */
export interface VisibleRange {
  start: number
  end: number // exclusive
  /** 实际能装下的最大可见行数（= floor(height / itemHeight)） */
  visibleCount: number
}

export function computeVisibleRange(
  scrollTop: number,
  height: number,
  itemHeight: number,
  total: number,
  overscan: number,
): VisibleRange {
  if (itemHeight <= 0 || total <= 0) return { start: 0, end: 0, visibleCount: 0 }
  const safeScroll = Math.max(0, scrollTop)
  const visibleCount = Math.max(1, Math.ceil(height / itemHeight))
  const rawStart = Math.floor(safeScroll / itemHeight) - overscan
  const rawEnd = Math.floor((safeScroll + height) / itemHeight) + overscan
  const start = Math.max(0, rawStart)
  const end = Math.min(total, rawEnd + 1) // exclusive
  return { start, end, visibleCount }
}

/** 把高度规格转为像素（用于 reserveScroll 计算 scrollHeight-like 兜底） */
export function resolveHeightPx(height: number | string): number {
  if (typeof height === 'number') return Math.max(0, height)
  // 对 '100%' 之类无法在静态期求解的 CSS 值返回 0，
  // 调用方应当用 number 表达具体像素，或手动注入 height 数字。
  const m = /(-?\d+(?:\.\d+)?)px/.exec(height)
  return m ? Math.max(0, parseFloat(m[1])) : 0
}

interface ScrollDetailLike {
  scrollTop: number
  scrollHeight: number
  scrollWidth: number
  deltaX: number
  deltaY: number
}

/**
 * VirtualList —— 函数式组件
 *
 * 注意：
 *  - 用 `function` 声明 + 内部用 `React.use*`，避免 forwardRef 在 Taro 类型推断上的兼容噪声
 *  - props.className / style 会合并到最外层 ScrollView 容器上
 */
export function VirtualList<T>(props: VirtualListProps<T>): React.ReactElement {
  const {
    data,
    itemHeight,
    height,
    renderItem,
    onReachEnd,
    overscan = 5,
    endThreshold = 200,
    className,
    style,
    itemKey,
    onScroll: onScrollExternal,
    scrollViewProps,
  } = props

  const dataLen = data.length
  const totalScrollHeight = Math.max(0, dataLen * itemHeight)
  const resolvedHeightPx = resolveHeightPx(height)

  // 节流后的 scrollTop —— 用 ref 读最新值，避免 setState 在频繁滚动时堆积
  const scrollTopRef = React.useRef(0)
  // 写入节流后的滚动位置（state 触发重渲染）
  const [scrollTopState, setScrollTopState] = React.useState(0)
  // 触底冷却标记：触底后置 true，回到顶部（scrollTop < endThreshold）时重置
  const reachEndFiredRef = React.useRef(false)
  // rAF 节流
  const rafIdRef = React.useRef<number | null>(null)

  // 卸载时取消未触发的 rAF
  React.useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        const cancel =
          typeof globalThis !== 'undefined' &&
          typeof (globalThis as { cancelAnimationFrame?: (id: number) => void }).cancelAnimationFrame === 'function'
            ? (globalThis as { cancelAnimationFrame: (id: number) => void }).cancelAnimationFrame
            : null
        if (cancel) cancel(rafIdRef.current)
      }
    }
  }, [])

  // 计算可见区间
  const { start, end, visibleCount } = computeVisibleRange(
    scrollTopState,
    resolvedHeightPx,
    itemHeight,
    dataLen,
    overscan,
  )

  // 触发 onScroll（节流后的最新位置）
  React.useEffect(() => {
    onScrollExternal?.({
      scrollTop: scrollTopState,
      scrollHeight: totalScrollHeight,
      visibleStart: start,
      visibleEnd: end,
    })
    // 仅在关键状态变化时通知调用方
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollTopState, start, end])

  // 触底检测（在 visible scroll height 已知的情况下处理；用 scrollHeight 事件拿到真实高度）
  const lastScrollHeightRef = React.useRef(0)
  React.useEffect(() => {
    const scrollH = lastScrollHeightRef.current
    if (!onReachEnd) return
    if (scrollH <= 0) return
    const distanceFromBottom = scrollH - scrollTopState - resolvedHeightPx
    if (distanceFromBottom <= endThreshold && !reachEndFiredRef.current) {
      reachEndFiredRef.current = true
      onReachEnd()
    }
    // 滚回顶部，回收触底触发器
    if (scrollTopState <= endThreshold && reachEndFiredRef.current) {
      reachEndFiredRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollTopState, resolvedHeightPx, endThreshold])

  // 滚动事件处理器（H5 Taro 事件 detail / 小程序端 detail）
  const handleScroll = React.useCallback(
    (e: { detail: ScrollDetailLike } | ScrollDetailLike) => {
      // 兼容 H5（事件形态）与 小程序（直接 detail）
      const detail: ScrollDetailLike =
        'detail' in (e as { detail?: ScrollDetailLike })
          ? (e as { detail: ScrollDetailLike }).detail
          : (e as ScrollDetailLike)
      const top = Number(detail?.scrollTop ?? 0) || 0
      const sH = Number(detail?.scrollHeight ?? 0) || 0
      lastScrollHeightRef.current = sH
      scrollTopRef.current = top
      // rAF 节流：每个动画帧最多 setState 一次
      if (rafIdRef.current !== null) return
      const req =
        typeof globalThis !== 'undefined' &&
        typeof (globalThis as { requestAnimationFrame?: (cb: () => void) => number }).requestAnimationFrame === 'function'
          ? (globalThis as { requestAnimationFrame: (cb: () => void) => number }).requestAnimationFrame
          : null
      if (req) {
        rafIdRef.current = req(() => {
          rafIdRef.current = null
          setScrollTopState(scrollTopRef.current)
        })
      } else {
        // 极端环境下 rAF 不可用（H5 必定可用），直接写 state
        setScrollTopState(top)
      }
    },
    [],
  )

  const containerStyle: React.CSSProperties = {
    height: typeof height === 'number' ? `${height}px` : height,
    overflow: 'hidden',
    position: 'relative',
    ...style,
  }

  const phantomStyle: React.CSSProperties = {
    position: 'relative',
    height: `${totalScrollHeight}px`,
    width: '100%',
  }

  const items: React.ReactNode[] = []
  if (dataLen > 0 && itemHeight > 0) {
    for (let i = start; i < end; i++) {
      const item = data[i]
      const key = itemKey ? itemKey(item, i) : i
      items.push(
        <View
          key={key}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: `${itemHeight}px`,
            transform: `translateY(${i * itemHeight}px)`,
            WebkitTransform: `translateY(${i * itemHeight}px)`,
          }}
        >
          {renderItem(item, i)}
        </View>,
      )
    }
  }

  // visibleCount 用于渲染调试 / 留给上层做性能观察
  void visibleCount

  return (
    <ScrollView
      scrollY
      className={className}
      style={containerStyle}
      lowerThreshold={endThreshold}
      onScroll={handleScroll as unknown as ScrollViewProps['onScroll']}
      {...scrollViewProps}
    >
      <View style={phantomStyle}>{items}</View>
    </ScrollView>
  )
}

export default VirtualList
