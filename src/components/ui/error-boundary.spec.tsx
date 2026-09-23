/**
 * ErrorBoundary 单元测试
 *
 * 注意：本项目当前仅 server 侧配了 jest（ts-jest / node 环境），
 * 客户端尚未安装 jest + @testing-library/react + jest-environment-jsdom。
 * 本 spec 按 jest 风格编写，待客户端测试环境就绪后可即刻运行：
 *   - 添加 devDependencies: @testing-library/react @testing-library/jest-dom jest-environment-jsdom
 *   - 新增 jest.config.js (roots: ['<rootDir>/src'], testEnvironment: 'jsdom',
 *     moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' })
 *
 * 覆盖点：
 *   1) 子组件正常 → 不触发 fallback
 *   2) 子组件 throw → 默认 fallback UI（重新加载 / 复制错误）
 *   3) 点击"重新加载"调用 Taro.reLaunch
 *   4) 自定义 fallback prop 生效
 *   5) 自定义 fallback 中的 reset 回调可清除错误并重渲子组件
 *   6) componentDidCatch 调用 Taro.showToast
 */

import * as React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import Taro from '@tarojs/taro'
import { ErrorBoundary } from './error-boundary'

jest.mock('@tarojs/taro', () => ({
  showToast: jest.fn(),
  reLaunch: jest.fn(),
  setClipboardData: jest.fn(),
}))

const mockedTaro = Taro as unknown as {
  showToast: jest.Mock
  reLaunch: jest.Mock
  setClipboardData: jest.Mock
}

const OKChild = () => <div>child-ok</div>
const BoomChild = ({ message = 'boom' }: { message?: string }) => {
  throw new Error(message)
}

describe('<ErrorBoundary />', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // React 18+ 会把错误吞掉上报到 console.error，避免污染测试输出
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    ;(console.error as jest.Mock).mockRestore?.()
  })

  it('正常子组件 → 直接渲染 children，不触发 fallback', () => {
    render(
      <ErrorBoundary>
        <OKChild />
      </ErrorBoundary>,
    )
    expect(screen.getByText('child-ok')).toBeTruthy()
    expect(screen.queryByText('页面出了点小问题')).toBeNull()
    expect(mockedTaro.showToast).not.toHaveBeenCalled()
  })

  it('子组件 throw → 显示默认 fallback UI（包含 重新加载 / 复制错误）', () => {
    render(
      <ErrorBoundary>
        <BoomChild message="kaboom" />
      </ErrorBoundary>,
    )
    expect(screen.getByText('页面出了点小问题')).toBeTruthy()
    expect(screen.getByText('重新加载')).toBeTruthy()
    expect(screen.getByText('复制错误')).toBeTruthy()
    expect(screen.getByText('kaboom')).toBeTruthy()
  })

  it('点击"重新加载"调用 Taro.reLaunch', () => {
    render(
      <ErrorBoundary>
        <BoomChild />
      </ErrorBoundary>,
    )
    fireEvent.click(screen.getByText('重新加载'))
    expect(mockedTaro.reLaunch).toHaveBeenCalledTimes(1)
    expect(mockedTaro.reLaunch).toHaveBeenCalledWith({ url: '/' })
  })

  it('自定义 fallback prop 生效', () => {
    const custom = (_err: Error, _reset: () => void) => (
      <div>custom-fallback-marker</div>
    )
    render(
      <ErrorBoundary fallback={custom}>
        <BoomChild />
      </ErrorBoundary>,
    )
    expect(screen.getByText('custom-fallback-marker')).toBeTruthy()
    expect(screen.queryByText('页面出了点小问题')).toBeNull()
  })

  it('自定义 fallback 中通过 reset 回调可清除错误并重新渲染子组件', () => {
    let shouldThrow = true
    const CondChild = () => {
      if (shouldThrow) throw new Error('cond')
      return <div>child-recovered</div>
    }
    const custom = (_err: Error, reset: () => void) => (
      <button
        onClick={() => {
          shouldThrow = false
          reset()
        }}
      >
        recover
      </button>
    )
    render(
      <ErrorBoundary fallback={custom}>
        <CondChild />
      </ErrorBoundary>,
    )
    expect(screen.getByText('recover')).toBeTruthy()
    expect(screen.queryByText('child-recovered')).toBeNull()

    fireEvent.click(screen.getByText('recover'))
    expect(screen.getByText('child-recovered')).toBeTruthy()
    expect(screen.queryByText('recover')).toBeNull()
  })

  it('componentDidCatch 调用 Taro.showToast 上报错误', () => {
    render(
      <ErrorBoundary>
        <BoomChild />
      </ErrorBoundary>,
    )
    expect(mockedTaro.showToast).toHaveBeenCalledTimes(1)
    expect(mockedTaro.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '页面出了点小问题', icon: 'none' }),
    )
  })
})