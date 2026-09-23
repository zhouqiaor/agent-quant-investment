/**
 * 条件选股页冒烟测试（jsdom）
 *
 * 使用真实 useScreenerStore（zustand），mock Network；
 * 每个用例前调 store.reset() 避免模块单例状态串用例。
 */
import * as React from 'react'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { useScreenerStore } from '@/stores/screener'
import ScreenerPage from './index'

jest.mock('@tarojs/taro', () => ({
  showToast: jest.fn(),
  showModal: jest.fn(),
  showActionSheet: jest.fn(),
  navigateTo: jest.fn(),
}))

const requestMock = jest.fn()

jest.mock('@/network', () => ({
  Network: {
    request: (...args: unknown[]) => requestMock(...args),
  },
}))

describe('<ScreenerPage /> 页面冒烟', () => {
  beforeEach(() => {
    requestMock.mockReset()
    useScreenerStore.getState().reset()
  })

  it('初始渲染：条件构建器 + 选股结果空态，不崩溃', () => {
    render(<ScreenerPage />)
    expect(screen.getByText('条件构建器')).toBeTruthy()
    expect(screen.getByText('选股结果')).toBeTruthy()
    expect(screen.getByText('暂无结果，请先添加条件')).toBeTruthy()
  })

  it('点击 + 添加条件 → 出现条件行，300ms 防抖后发起查询', () => {
    jest.useFakeTimers()
    try {
      requestMock.mockResolvedValue({
        statusCode: 200,
        data: { data: { items: [], total: 0 } },
      })

      render(<ScreenerPage />)
      fireEvent.click(screen.getByText('+ 添加条件'))

      // 条件行出现（字段/比较/值 标签）
      expect(screen.getAllByText('字段').length).toBeGreaterThan(0)

      act(() => {
        jest.advanceTimersByTime(300)
      })

      expect(requestMock).toHaveBeenCalledWith(
        expect.objectContaining({ url: '/api/screener/query' }),
      )
    } finally {
      jest.useRealTimers()
    }
  })

  it('AND/OR 组合切换不崩溃', () => {
    render(<ScreenerPage />)
    fireEvent.click(screen.getByText('OR'))
    expect(useScreenerStore.getState().combinator).toBe('OR')
    fireEvent.click(screen.getByText('AND'))
    expect(useScreenerStore.getState().combinator).toBe('AND')
  })

  it('分类 Tab 切换（基本面 → 技术）不崩溃', () => {
    render(<ScreenerPage />)
    fireEvent.click(screen.getByText('技术'))
    expect(screen.getByText('技术')).toBeTruthy()
  })

  it('保存为预设：打开弹层 → 输入名称 → 确认保存 → toast', async () => {
    render(<ScreenerPage />)

    // 先添加一个条件，否则保存按钮 disabled
    fireEvent.click(screen.getByText('+ 添加条件'))

    fireEvent.click(screen.getAllByText('保存为预设')[0]!)
    // 弹层打开后：按钮文案 + 弹层标题共 2 处
    expect(screen.getAllByText('保存为预设').length).toBe(2)

    const nameInput = screen.getByPlaceholderText('如：低估值高换手')
    const propsKey = Object.keys(nameInput).find((k) =>
      k.startsWith('__reactProps$'),
    )!

    await act(async () => {
      ;(nameInput as unknown as Record<string, { onInput: (e: { detail: { value: string } }) => void }>)[
        propsKey
      ].onInput({ detail: { value: '我的预设' } })
    })

    await act(async () => {
      fireEvent.click(screen.getByText('确认保存'))
      await Promise.resolve()
    })

    expect(useScreenerStore.getState().presets[0]?.name).toBe('我的预设')
  })

  it('查询失败：结果区展示错误信息，不崩溃', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    requestMock.mockRejectedValue(new Error('服务器错误'))

    render(<ScreenerPage />)
    fireEvent.click(screen.getByText('+ 添加条件'))

    await waitFor(() => {
      // 防抖 300ms 后 runQuery 失败（真实定时器）
      expect(screen.getByText('服务器错误')).toBeTruthy()
    })
    spy.mockRestore()
  })
})
