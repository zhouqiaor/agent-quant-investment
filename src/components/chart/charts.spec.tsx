/**
 * Chart 组件 jsdom 渲染测试（candle / macd / kdj）
 *
 * 依赖 jest.setup.ts 中 @tarojs/components 的默认 passthrough mock
 *（View→div / Text→span / Image→img），SVG 以 data URL 写入 <img src>。
 *
 * 覆盖：
 *  - 空/不足数据 → 空态文案，不渲染 Image
 *  - 固定数据 → 渲染 Image，src 为 data:image/svg+xml
 *  - 可选 props（costPrice/currentPrice/periods）不崩溃，周期切换回调可触发
 *  - MACD/KDJ：有效数据渲染 Image，无效数据返回 null
 */
import * as React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import type { MacdResult, KdjResult } from '@/lib/indicators/types'
import { CandleChart, type Candle } from './candle-chart'
import { MacdChart } from './macd-chart'
import { KdjChart } from './kdj-chart'

jest.mock('@tarojs/taro', () => ({
  showToast: jest.fn(),
  reLaunch: jest.fn(),
  setClipboardData: jest.fn(),
}))

const candles: Candle[] = [
  { date: '2026-09-20', open: 10, close: 11, high: 12, low: 9, volume: 100 },
  { date: '2026-09-21', open: 11, close: 10.5, high: 11.5, low: 10, volume: 120 },
  { date: '2026-09-22', open: 10.5, close: 12, high: 12.5, low: 10.2, volume: 130 },
]

describe('<CandleChart />', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    ;(console.error as jest.Mock).mockRestore?.()
  })

  it('空数组 → 渲染空态文案，不渲染 Image', () => {
    const { container } = render(<CandleChart data={[]} />)
    expect(screen.getByText('暂无K线数据')).toBeTruthy()
    expect(container.querySelector('img')).toBeNull()
  })

  it('仅 1 条数据（不足 2 条）→ 同样视为空态', () => {
    render(<CandleChart data={[candles[0]!]} />)
    expect(screen.getByText('暂无K线数据')).toBeTruthy()
  })

  it('自定义 emptyText 生效', () => {
    render(<CandleChart data={[]} emptyText="没有行情" />)
    expect(screen.getByText('没有行情')).toBeTruthy()
  })

  it('有效数据 → 渲染 Image，src 为 SVG data URL，且展示最新一日 OHLC/日期', () => {
    const { container } = render(
      <CandleChart data={candles} height={200} />,
    )
    const img = container.querySelector('img')
    expect(img).toBeTruthy()
    expect(img?.getAttribute('src')?.startsWith('data:image/svg+xml')).toBe(true)
    // 最新一根：2026-09-22，收 12.00
    expect(screen.getByText('2026-09-22')).toBeTruthy()
    expect(screen.getByText('12.00')).toBeTruthy()
  })

  it('传入 costPrice / currentPrice 不崩溃，仍渲染 Image', () => {
    const { container } = render(
      <CandleChart data={candles} costPrice={9.5} currentPrice={12} />,
    )
    expect(container.querySelector('img')).toBeTruthy()
  })

  it('周期切换：点击周期触发 onPeriodChange', () => {
    const onPeriodChange = jest.fn()
    render(
      <CandleChart
        data={candles}
        periods={[
          { label: '日K', value: 'day' },
          { label: '周K', value: 'week' },
        ]}
        period="day"
        onPeriodChange={onPeriodChange}
      />,
    )
    fireEvent.click(screen.getByText('周K'))
    expect(onPeriodChange).toHaveBeenCalledWith('week')
  })

  it('关闭 MACD/KDJ 副图开关时不崩溃（未传 indicators 时本来也不渲染）', () => {
    const { container } = render(
      <CandleChart data={candles} showMacd={false} showKdj={false} />,
    )
    expect(container.querySelector('img')).toBeTruthy()
  })
})

describe('<MacdChart />', () => {
  const validMacd: MacdResult = {
    dif: [1, 1.5, 2],
    dea: [0.8, 1.2, 1.6],
    hist: [0.2, 0.3, 0.4],
    crosses: [],
  }

  it('有效数据 → 渲染 Image（SVG data URL）', () => {
    const { container } = render(<MacdChart data={validMacd} />)
    const img = container.querySelector('img')
    expect(img).toBeTruthy()
    expect(img?.getAttribute('src')?.startsWith('data:image/svg+xml')).toBe(true)
  })

  it('dif 有效点不足 2 个 → 返回 null（无容器无 Image）', () => {
    const invalid: MacdResult = {
      dif: [null, null, null],
      dea: [null, null, null],
      hist: [null, null, null],
      crosses: [],
    }
    const { container } = render(<MacdChart data={invalid} />)
    expect(container.querySelector('img')).toBeNull()
  })
})

describe('<KdjChart />', () => {
  const validKdj: KdjResult = {
    k: [20, 50, 80],
    d: [15, 40, 70],
    j: [30, 70, 100],
    extremes: [],
  }

  it('有效数据 → 渲染 Image（SVG data URL）', () => {
    const { container } = render(<KdjChart data={validKdj} />)
    const img = container.querySelector('img')
    expect(img).toBeTruthy()
    expect(img?.getAttribute('src')?.startsWith('data:image/svg+xml')).toBe(true)
  })

  it('k 有效点不足 2 个 → 返回 null', () => {
    const invalid: KdjResult = {
      k: [null, null],
      d: [null, null],
      j: [null, null],
      extremes: [],
    }
    const { container } = render(<KdjChart data={invalid} />)
    expect(container.querySelector('img')).toBeNull()
  })
})
