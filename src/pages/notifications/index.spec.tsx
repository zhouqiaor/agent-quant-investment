/**
 * 通知中心页面冒烟测试（jsdom）
 *
 * mock：
 *  - @tarojs/taro：补齐页面使用的 useDidShow / usePullDownRefresh 生命周期 hook
 *  - @/network：request 返回固定通知数据
 *
 * 仅断言：页面渲染不崩溃、空态 / 列表态文案出现。
 */
import * as React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import NotificationsPage from './index'

jest.mock('@tarojs/taro', () => ({
  showToast: jest.fn(),
  navigateTo: jest.fn(),
  stopPullDownRefresh: jest.fn(),
  useDidShow: (cb: () => void) => React.useEffect(cb, []),
  usePullDownRefresh: (_cb: () => Promise<void>) => {},
}))

const requestMock = jest.fn()

jest.mock('@/network', () => ({
  Network: {
    request: (...args: unknown[]) => requestMock(...args),
  },
}))

const sampleNotifications = [
  {
    id: 'n1',
    title: 'MACD 金叉买入信号',
    body: '600519 出现日线金叉',
    read: false,
    type: 'BUY',
    symbol: '600519',
    time: new Date().toISOString(),
  },
  {
    id: 'n2',
    title: 'BOLL 跌破卖出信号',
    body: '000001 跌破下轨',
    read: true,
    type: 'SELL',
    symbol: '000001',
    time: new Date(Date.now() - 2 * 3600_000).toISOString(),
  },
]

describe('<NotificationsPage /> 页面冒烟', () => {
  beforeEach(() => {
    requestMock.mockReset()
  })

  it('空列表：渲染空态文案与顶部 Tab，不崩溃', async () => {
    requestMock.mockResolvedValue({ statusCode: 200, data: { data: [] } })

    render(<NotificationsPage />)

    expect(screen.getByText('全部')).toBeTruthy()
    expect(screen.getByText('未读')).toBeTruthy()

    await waitFor(() => {
      expect(screen.getByText(/还没有/)).toBeTruthy()
    })
  })

  it('有数据：渲染通知标题，点击标题触发 mark read + 跳转', async () => {
    requestMock.mockResolvedValue({
      statusCode: 200,
      data: { data: sampleNotifications },
    })

    render(<NotificationsPage />)

    await waitFor(() => {
      expect(screen.getByText('MACD 金叉买入信号')).toBeTruthy()
    })
    expect(screen.getByText('BOLL 跌破卖出信号')).toBeTruthy()

    // 点击未读项 → POST /read 后标为已读，并 navigateTo 持仓页
    requestMock.mockResolvedValueOnce({ statusCode: 200, data: {} })
    fireEvent.click(screen.getByText('MACD 金叉买入信号'))

    await waitFor(() => {
      expect(requestMock).toHaveBeenCalledWith(
        expect.objectContaining({ url: '/api/notifications/n1/read' }),
      )
    })
  })

  it('切换类型筛选 chip 不崩溃并重新请求', async () => {
    requestMock.mockResolvedValue({ statusCode: 200, data: { data: [] } })

    render(<NotificationsPage />)
    fireEvent.click(screen.getByText('买入信号'))

    await waitFor(() => {
      expect(requestMock.mock.calls.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('Network 异常：走 catch，渲染空态不崩溃', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    requestMock.mockRejectedValue(new Error('network down'))

    render(<NotificationsPage />)

    await waitFor(() => {
      expect(screen.getByText(/还没有/)).toBeTruthy()
    })
    spy.mockRestore()
  })
})
