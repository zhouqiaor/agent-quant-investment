/**
 * portfolio store 单测
 *
 * 覆盖：
 * - loadSummary 正常解析 / 异常处理
 * - toggleStrategy 乐观更新 running 与 maxPositionPct
 * - toggleStrategy 失败回滚
 * - toggleStrategy 请求体契约
 * - createPortfolio 正常创建 / 空名短路
 *
 * ambient describe/it/expect/jest 声明，沿用项目 spec 风格
 * （前端测试运行时由并行任务搭建，本文件只保证 pnpm tsc 干净）。
 */

import type { PortfolioSummary } from '@/lib/portfolio'
import { usePortfolioStore } from './portfolio'

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
declare const describe: (name: string, fn: () => void) => void
declare const it: (name: string, fn: () => void) => void
declare const expect: (val: unknown) => {
  toBe: (expected: unknown) => void
  toEqual: (expected: unknown) => void
  toBeNull: () => void
}

interface MockFn {
  (...args: any[]): any
  mock: { calls: any[][] }
  mockResolvedValue: (v: any) => void
  mockImplementation: (f: (...args: any[]) => any) => void
  mockClear: () => void
  mockReset: () => void
}
declare const jest: {
  fn: () => MockFn
  mock: (moduleName: string, factory: () => unknown) => void
}
declare const beforeEach: (fn: () => void) => void

const mockRequest = jest.fn()

jest.mock('@/network', () => ({
  Network: {
    request: (opts: any) => mockRequest(opts),
  },
}))

jest.mock('@tarojs/taro', () => ({
  showToast: () => undefined,
}))

function mkSummary(): PortfolioSummary {
  return {
    portfolio: {
      id: 'default',
      name: '默认组合',
      initialCapital: 100000,
      cashReservePct: 0.05,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    cash: 80000,
    positions: [],
    totalValue: 100000,
    totalPnl: 0,
    totalPnlRate: 0,
    strategies: [
      {
        strategyId: 'ma-cross',
        pnl: 1200,
        pnlRate: 1.2,
        trades: 3,
        running: false,
        maxPositionPct: 0.1,
      },
    ],
  }
}

beforeEach(() => {
  mockRequest.mockReset()
  usePortfolioStore.getState().reset()
})

describe('usePortfolioStore loadSummary', () => {
  it('请求 /api/portfolio/summary 并解析 summary', async () => {
    const payload = mkSummary()
    mockRequest.mockResolvedValue({ data: { code: 200, data: payload } })

    const result = await usePortfolioStore.getState().loadSummary()
    const state = usePortfolioStore.getState()

    expect(mockRequest.mock.calls[0][0].url).toBe('/api/portfolio/summary')
    expect(result).toEqual(payload)
    expect(state.summary).toEqual(payload)
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('请求失败时设置 error、summary 保持 null、loading 复位', async () => {
    mockRequest.mockImplementation(() => Promise.reject(new Error('network down')))

    const result = await usePortfolioStore.getState().loadSummary()
    const state = usePortfolioStore.getState()

    expect(result).toBeNull()
    expect(state.summary).toBeNull()
    expect(state.error).toBe('network down')
    expect(state.loading).toBe(false)
  })
})

describe('usePortfolioStore toggleStrategy', () => {
  it('乐观更新 running 与 maxPositionPct，并发送契约请求体', async () => {
    usePortfolioStore.setState({ summary: mkSummary() })
    mockRequest.mockResolvedValue({ data: { code: 200 } })

    await usePortfolioStore
      .getState()
      .toggleStrategy('ma-cross', true, 0.2)

    const s = usePortfolioStore.getState().summary!
    expect(s.strategies[0].running).toBe(true)
    expect(s.strategies[0].maxPositionPct).toBe(0.2)

    const body = mockRequest.mock.calls[0][0]
    expect(body.url).toBe('/api/portfolio/strategy/toggle')
    expect(body.method).toBe('POST')
    expect(body.data).toEqual({ strategyId: 'ma-cross', running: true, maxPositionPct: 0.2 })
  })

  it('不传 maxPositionPct 时请求体不带该字段，且本地保留原值', async () => {
    usePortfolioStore.setState({ summary: mkSummary() })
    mockRequest.mockResolvedValue({ data: { code: 200 } })

    await usePortfolioStore.getState().toggleStrategy('ma-cross', true)

    const s = usePortfolioStore.getState().summary!
    expect(s.strategies[0].running).toBe(true)
    expect(s.strategies[0].maxPositionPct).toBe(0.1)
    expect(mockRequest.mock.calls[0][0].data).toEqual({
      strategyId: 'ma-cross',
      running: true,
    })
  })

  it('请求失败时回滚到原状态', async () => {
    usePortfolioStore.setState({ summary: mkSummary() })
    mockRequest.mockImplementation(() => Promise.reject(new Error('boom')))

    await usePortfolioStore.getState().toggleStrategy('ma-cross', true)

    const s = usePortfolioStore.getState().summary!
    expect(s.strategies[0].running).toBe(false)
  })
})

describe('usePortfolioStore createPortfolio', () => {
  it('发送组合名称并返回创建结果', async () => {
    const info = {
      id: 'pf_1',
      name: '激进组合',
      initialCapital: 100000,
      cashReservePct: 0.05,
      createdAt: '2026-09-23T00:00:00.000Z',
    }
    mockRequest.mockResolvedValue({ data: { code: 200, data: info } })

    const result = await usePortfolioStore.getState().createPortfolio('激进组合')

    expect(result).toEqual(info)
    const req = mockRequest.mock.calls[0][0]
    expect(req.url).toBe('/api/portfolio/create')
    expect(req.method).toBe('POST')
    expect(req.data).toEqual({ name: '激进组合' })
  })

  it('名称为空白时短路返回 null，不发请求', async () => {
    const result = await usePortfolioStore.getState().createPortfolio('   ')
    expect(result).toBeNull()
    expect(mockRequest.mock.calls.length).toBe(0)
  })
})
