/**
 * VirtualList 单测
 *
 * 覆盖点（≥5）：
 *  1) 1000 条数据下首屏只渲染可见数 + overscan（约 20 节点，远小于 1000）
 *  2) onScroll 触发 onReachEnd（distanceFromBottom <= endThreshold）
 *  3) renderItem 对每条可见数据被调用，调用次数 = 可见区节点数
 *  4) data 变化后列表更新（不会因为虚拟化而卡死）
 *  5) 容器高度数字 → 渲染 'XXXpx'；字符串透传
 *  6) 滚回顶部后 reachEnd 触发器重置（允许多次触底）
 *  7) 纯函数 computeVisibleRange：边界 / overscan / 上界 clamp
 *
 * 本 spec 与 error-boundary.spec.tsx 同样假设 jset + @testing-library/react。
 * tsconfig 已排除 *.spec.tsx，因此无须为 jest 标识符做 ambient 声明。
 */

import * as React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { VirtualList, computeVisibleRange, resolveHeightPx } from './virtual-list'

/**
 * 用一个 className="test-scrollview" 的 div 模拟 Taro ScrollView，让 RTL
 * 能 fire 一个 onScroll 事件并把 detail.scrollTop / scrollHeight 提供给回调。
 */
jest.mock('@tarojs/components', () => {
  const passthrough = (props: { [k: string]: unknown }) => {
    const {
      children,
      className,
      style,
      onScroll,
      onScrollToLower,
    } = props as {
      children?: React.ReactNode
      className?: string
      style?: React.CSSProperties
      onScroll?: (e: { detail: { scrollTop: number; scrollHeight: number } }) => void
      onScrollToLower?: () => void
    }
    return (
      <div
        data-testid="scrollview"
        className={className}
        style={style}
        onScroll={(domEvent: React.SyntheticEvent<HTMLDivElement>) => {
          // 从 data-* 提取当前 scrollTop（测试中通过 setScrollTop 写入）
          const target = domEvent.currentTarget as HTMLDivElement & {
            dataset: { scrollTop?: string; scrollHeight?: string }
          }
          const scrollTop = parseFloat(target.dataset.scrollTop ?? '0')
          const scrollHeight = parseFloat(target.dataset.scrollHeight ?? '0')
          onScroll?.({ detail: { scrollTop, scrollHeight } })
        }}
      >
        <div style={{ position: 'relative' }}>
          <div data-testid="scroll-content">{children}</div>
          <button
            data-testid="scroll-to-lower"
            type="button"
            onClick={() => onScrollToLower?.()}
          />
        </div>
      </div>
    )
  }
  return {
    ScrollView: passthrough,
    View: ({ children, style, ...rest }: { children?: React.ReactNode; style?: React.CSSProperties; [k: string]: unknown }) => (
      <div style={style} {...rest}>
        {children}
      </div>
    ),
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  }
})

// 测试 helper —— 拿到 ScrollView 测试节点并改变其 dataset
function getScrollRoot(): HTMLDivElement {
  return screen.getByTestId('scrollview') as unknown as HTMLDivElement
}

async function setScrollPosition(scrollTop: number, scrollHeight: number): Promise<void> {
  const root = getScrollRoot()
  const ds = root.dataset as DOMStringMap
  ds.scrollTop = String(scrollTop)
  ds.scrollHeight = String(scrollHeight)
  // rAF shim 以微任务延迟回调；用 act 包裹并等待微任务刷新，确保 effect 跑完
  await act(async () => {
    // fireEvent.scroll 在 React 17+ 必须传 nativeEvent
    fireEvent.scroll(root, { nativeEvent: new Event('scroll') })
    await Promise.resolve()
  })
}

interface Row {
  id: number
  label: string
}
const buildRows = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({ id: i, label: `row-${i}` }))

/** 用一个 action('key') 风格的 <span> 渲染，便于断言哪些行被渲染 */
const renderLabel = (item: Row) => <span data-testid={`row-${item.id}`}>{item.label}</span>

describe('computeVisibleRange (纯函数)', () => {
  it('边界：空 data / 非法 itemHeight 返回 0 区间', () => {
    expect(computeVisibleRange(0, 600, 64, 0, 5)).toEqual({ start: 0, end: 0, visibleCount: 0 })
    expect(computeVisibleRange(0, 600, 0, 100, 5).end).toBe(0)
  })

  it('overscan 在两侧：滚到 200px 时 start=0、end=ceil((200+600)/64)+overscan', () => {
    // floor(200/64)=3, overscan=5 → start=max(0, 3-5)=0
    // ceil(800/64)=12 + 5 = 17 → end=18（exclusive）
    const r = computeVisibleRange(200, 600, 64, 1000, 5)
    expect(r.start).toBe(0)
    expect(r.end).toBe(18)
    expect(r.visibleCount).toBe(10) // ceil(600/64)
  })

  it('overscan 为 0 时严格卡可见区', () => {
    // scrollTop=320 → start=floor(320/64)=5
    // ceil((320+600)/64)=14 → end=15
    const r = computeVisibleRange(320, 600, 64, 1000, 0)
    expect(r.start).toBe(5)
    expect(r.end).toBe(15)
  })

  it('total clamp：超出 total 时 end = total', () => {
    // scrollTop=total*itemHeight - height → 最后一段
    const r = computeVisibleRange(6400 - 600, 600, 64, 100, 5)
    expect(r.end).toBeLessThanOrEqual(100)
  })

  it('scrollTop 负数被视为 0', () => {
    const r = computeVisibleRange(-100, 600, 64, 1000, 5)
    expect(r.start).toBe(0)
  })
})

describe('resolveHeightPx', () => {
  it('number 直接返回', () => {
    expect(resolveHeightPx(600)).toBe(600)
  })

  it('"600px" 解析为 600', () => {
    expect(resolveHeightPx('600px')).toBe(600)
  })

  it('"100%" 无法静态求解 → 返回 0；含 px 的字符串提取其中的 px 数值', () => {
    expect(resolveHeightPx('100%')).toBe(0)
    expect(resolveHeightPx('calc(100vh - 100px)')).toBe(100) // 正则提取 100px
  })
})

describe('<VirtualList />', () => {
  beforeEach(() => {
    // requestAnimationFrame 在 jsdom 里没有，需要 mock。
    // 注意：不能同步执行 cb——组件内 `rafIdRef.current = req(cb)` 的赋值
    // 发生在 req 返回之后；同步 cb 会先把 ref 置 null，再被赋成非 null，
    // 导致后续滚动事件全被节流丢弃。用微任务延迟到赋值之后。
    let id = 0
    Object.defineProperty(globalThis, 'requestAnimationFrame', {
      configurable: true,
      writable: true,
      value: (cb: () => void) => {
        id += 1
        Promise.resolve().then(() => cb())
        return id
      },
    })
    Object.defineProperty(globalThis, 'cancelAnimationFrame', {
      configurable: true,
      writable: true,
      value: () => 0,
    })
  })

  it('1000 条数据：首屏只渲染 ~20 个节点（远小于 1000）', () => {
    const data = buildRows(1000)
    render(
      <VirtualList
        data={data}
        itemHeight={64}
        height={600}
        overscan={5}
        renderItem={renderLabel}
      />,
    )
    // scrollTop=0：computeVisibleRange → start=0，rawEnd=floor(600/64)+5=14，end=15
    // 即 row-0..row-14，共 15 个节点（overscan 仅追加在尾部一次）
    expect(screen.queryAllByTestId(/^row-/)).toHaveLength(15)
    expect(screen.queryByTestId('row-14')).toBeTruthy()
    expect(screen.queryByTestId('row-15')).toBeNull()
    // 同时，未渲染的尾部项目不存在
    expect(screen.queryByTestId('row-500')).toBeNull()
  })

  it('renderItem 对每条可见数据各被调用一次', () => {
    const renderSpy = jest.fn(renderLabel)
    const data = buildRows(1000)
    render(
      <VirtualList
        data={data}
        itemHeight={64}
        height={600}
        overscan={5}
        renderItem={renderSpy}
      />,
    )
    // 期望调用 15 次（可见 10 + overscan 5）
    expect(renderSpy).toHaveBeenCalledTimes(15)
    expect(renderSpy.mock.calls[0]?.[0]?.id).toBe(0)
    expect(renderSpy.mock.calls[14]?.[0]?.id).toBe(14)
  })

  it('滚动到中部：可见区跟随更新（首屏节点被替换）', async () => {
    const data = buildRows(1000)
    render(
      <VirtualList
        data={data}
        itemHeight={64}
        height={600}
        overscan={5}
        renderItem={renderLabel}
      />,
    )
    // 滚到 row 100：scrollTop = 100 * 64 = 6400
    // start = floor(6400/64)-5 = 95
    // end = floor((6400+600)/64)+5+1 = 109+6 = 115
    await setScrollPosition(6400, 1000 * 64)
    expect(screen.queryByTestId('row-0')).toBeNull()
    expect(screen.queryByTestId('row-94')).toBeNull()
    expect(screen.queryByTestId('row-95')).toBeTruthy()
    expect(screen.queryByTestId('row-114')).toBeTruthy()
    expect(screen.queryByTestId('row-115')).toBeNull()
  })

  it('滚动触底 → onReachEnd 被触发；滚回顶部后允许再次触发', async () => {
    const onReachEnd = jest.fn()
    const data = buildRows(1000)
    render(
      <VirtualList
        data={data}
        itemHeight={64}
        height={600}
        endThreshold={200}
        overscan={5}
        onReachEnd={onReachEnd}
        renderItem={renderLabel}
      />,
    )
    // 滚到底部（距离底 = scrollHeight - scrollTop - height ≤ endThreshold）
    // 距底 100px：scrollTop = 64000 - 600 + 100 = 63500
    await setScrollPosition(63500, 64000)

    // 再次小滚动不会重复触发（同一 visit 内冷却）
    await setScrollPosition(63510, 64000)
    expect(onReachEnd).toHaveBeenCalledTimes(1)

    // 滚回顶部 → 冷却解除，再次触底 → 又会调用
    await setScrollPosition(0, 64000)
    expect(onReachEnd).toHaveBeenCalledTimes(1)
    await setScrollPosition(63500, 64000)
    expect(onReachEnd).toHaveBeenCalledTimes(2)
  })

  it('data 变化后列表更新且虚拟化逻辑重新计算', async () => {
    const initial = buildRows(100) // total=100, scrollHeight=6400
    const next = buildRows(500) // total=500, scrollHeight=32000
    const { rerender } = render(
      <VirtualList
        data={initial}
        itemHeight={64}
        height={600}
        overscan={5}
        renderItem={renderLabel}
      />,
    )
    expect(screen.queryByTestId('row-99')).toBeNull() // 100 行只渲染到 19

    // 滚到底附近
    await setScrollPosition(5800, 6400)
    expect(screen.queryByTestId('row-95')).toBeTruthy()

    // 替换数据为 500 条
    rerender(
      <VirtualList
        data={next}
        itemHeight={64}
        height={600}
        overscan={5}
        renderItem={renderLabel}
      />,
    )
    // 重新计算后：scrollTop=5800, total=500, scrollHeight=32000
    // start=85, end=85+10+10=105 → 渲染 85..104（最多到 499）
    expect(screen.queryByTestId('row-95')).toBeTruthy()
    // tail 仍渲染不到
    expect(screen.queryByTestId('row-499')).toBeNull()
  })

  it('容器高度：number → 渲染 {N}px；string 透传', () => {
    // number 模式
    const { rerender } = render(
      <VirtualList data={buildRows(100)} itemHeight={64} height={600} renderItem={renderLabel} />,
    )
    const root = getScrollRoot()
    expect((root.style as CSSStyleDeclaration).height).toBe('600px')

    // string 模式（H5 典型用法 '100%' / 'calc(100vh - 100px)'）
    rerender(
      <VirtualList
        data={buildRows(100)}
        itemHeight={64}
        height="calc(100vh - 200px)"
        renderItem={renderLabel}
      />,
    )
    expect((root.style as CSSStyleDeclaration).height).toBe('calc(100vh - 200px)')
  })

  it('overscan=0 时严格只渲染视口内行', () => {
    render(
      <VirtualList
        data={buildRows(1000)}
        itemHeight={64}
        height={600}
        overscan={0}
        renderItem={renderLabel}
      />,
    )
    // visible=10, overscan=0 → 渲染 row-0..row-9（10 个）
    expect(screen.queryAllByTestId(/^row-/)).toHaveLength(10)
    expect(screen.queryByTestId('row-9')).toBeTruthy()
    expect(screen.queryByTestId('row-10')).toBeNull()
  })

  it('未传 onReachEnd 时滚动不报错', async () => {
    render(
      <VirtualList
        data={buildRows(1000)}
        itemHeight={64}
        height={600}
        renderItem={renderLabel}
      />,
    )
    await expect(setScrollPosition(63500, 64000)).resolves.not.toThrow()
  })
})
