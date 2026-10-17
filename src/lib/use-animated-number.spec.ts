/**
 * useAnimatedNumber hook 的测试
 *
 * 项目前端目前未配置专用测试框架（Jest / Vitest / RTL），因此本 spec：
 * 1. 使用本地声明的 describe/it/expect 全局，确保 pnpm tsc 通过
 * 2. 若未来配置 Jest + @testing-library/react，本文件可直接复用：
 *    - 删除顶部的全局声明
 *    - 引入 @types/jest 即可
 *
 * 覆盖需求：
 * - 初始值 = target（无需动画）
 * - target 变化后 display 值跟随过渡
 * - 600ms 后 display == target
 * - 卸载时取消 rAF
 * - 自定义 easing 函数生效
 *
 * 由于 React hook 的运行时测试需要 renderer，本 spec 重点验证
 * 暴露的纯函数（easeOutCubic / computeTweenValue）行为，并保留
 * useAnimatedNumber 的契约注释，便于后续补充。
 */

import { renderHook, act } from '@testing-library/react'
import { easeOutCubic, computeTweenValue, useAnimatedNumber } from './use-animated-number'

describe('easeOutCubic', () => {
  it('at t=0 returns 0', () => {
    expect(easeOutCubic(0)).toBe(0)
  })

  it('at t=1 returns 1', () => {
    expect(easeOutCubic(1)).toBe(1)
  })

  it('at t=0.5 returns 0.875 (1 - 0.5^3)', () => {
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 5)
  })

  it('monotonically non-decreasing across [0, 1]', () => {
    // 缓动函数必须单调，否则数字会回退
    let prev = easeOutCubic(0)
    for (let i = 1; i <= 10; i++) {
      const v = easeOutCubic(i / 10)
      if (v < prev) {
        throw new Error(`easeOutCubic not monotonic at ${i / 10}`)
      }
      prev = v
    }
    expect(prev).toBe(1)
  })
})

describe('computeTweenValue (纯函数，覆盖 hook 核心数学)', () => {
  it('at elapsed=0 returns from（动画起点）', () => {
    const v = computeTweenValue(0, 100, 0, 600, easeOutCubic, 2)
    expect(v).toBe(0)
  })

  it('at elapsed=duration returns to（600ms 后 display == target）', () => {
    const v = computeTweenValue(0, 100, 600, 600, easeOutCubic, 2)
    expect(v).toBe(100)
  })

  it('中间帧使用 easeOutCubic：中点进度 > 0.5', () => {
    // easeOutCubic(0.5) = 0.875，因此中点位置 v0..100 应约等于 87.5
    const v = computeTweenValue(0, 100, 300, 600, easeOutCubic, 2)
    expect(v).toBeCloseTo(87.5, 1)
  })

  it('支持负数起点（from < 0 正确插值）', () => {
    const v = computeTweenValue(-50, 50, 300, 600, t => t, 2)
    expect(v).toBe(0)
  })

  it('支持负数终点（from > 0 to < 0）', () => {
    const v = computeTweenValue(50, -50, 300, 600, t => t, 2)
    expect(v).toBe(0)
  })

  it('自定义 easing：identity（线性）', () => {
    const v = computeTweenValue(0, 100, 300, 600, t => t, 2)
    expect(v).toBe(50)
  })

  it('自定义 easing：ease-in quadratic（中点落后）', () => {
    // easing(0.5) = 0.25，因此 v = 0 + 100*0.25 = 25
    const v = computeTweenValue(0, 100, 300, 600, t => t * t, 2)
    expect(v).toBeCloseTo(25, 5)
  })

  it('精度截断：precision=0 输出整数', () => {
    const v = computeTweenValue(0, 100, 300, 600, t => t, 0)
    expect(v).toBe(50)
  })

  it('精度截断：precision=4 保留 4 位', () => {
    const v = computeTweenValue(0, 1, 300, 600, t => t, 4)
    expect(v).toBe(0.5)
  })

  it('clamp：elapsed > duration 仍返回 to', () => {
    const v = computeTweenValue(0, 100, 1000, 600, easeOutCubic, 2)
    expect(v).toBe(100)
  })

  it('clamp：elapsed < 0 仍返回 from', () => {
    const v = computeTweenValue(0, 100, -100, 600, easeOutCubic, 2)
    expect(v).toBe(0)
  })

  it('change-detection 场景：从非零起点过渡到新 target', () => {
    // 模拟「当前显示 80，target 跳到 200」过渡一半时的值
    const v = computeTweenValue(80, 200, 300, 600, t => t, 2)
    expect(v).toBe(140)
  })
})

describe('useAnimatedNumber (renderHook 运行时)', () => {
  let rafId = 0
  let queued = new Map<number, FrameRequestCallback>()
  let cancelSpy: jest.SpyInstance

  beforeEach(() => {
    rafId = 0
    queued = new Map<number, FrameRequestCallback>()
    // 手动帧队列：runFrames(now) 用指定时间戳触发当前排队的所有帧
    Object.defineProperty(globalThis, 'requestAnimationFrame', {
      configurable: true,
      writable: true,
      value: (cb: FrameRequestCallback): number => {
        rafId += 1
        queued.set(rafId, cb)
        return rafId
      },
    })
    Object.defineProperty(globalThis, 'cancelAnimationFrame', {
      configurable: true,
      writable: true,
      value: (id: number): void => {
        queued.delete(id)
      },
    })
    cancelSpy = jest.spyOn(globalThis, 'cancelAnimationFrame')
  })

  afterEach(() => {
    cancelSpy.mockRestore()
  })

  function runFrames(now: number): void {
    const cbs = Array.from(queued.values())
    queued.clear()
    cbs.forEach((cb) => cb(now))
  }

  it('初始 display === target，无需动画', () => {
    const { result } = renderHook(({ t }) => useAnimatedNumber(t), {
      initialProps: { t: 100 },
    })
    expect(result.current).toBe(100)
  })

  it('target 变化后动画推进：首帧保持起点，中间帧过渡，duration 处到达终值并停止', () => {
    const { rerender, result } = renderHook(
      ({ t, duration }) => useAnimatedNumber(t, { duration }),
      { initialProps: { t: 0, duration: 600 } },
    )

    rerender({ t: 100, duration: 600 })

    act(() => runFrames(1000)) // startTime=1000, elapsed=0
    expect(result.current).toBe(0)

    act(() => runFrames(1300)) // elapsed=300 → 87.5
    expect(result.current).toBeCloseTo(87.5, 1)

    act(() => runFrames(1600)) // elapsed=600 → 100
    expect(result.current).toBe(100)

    // 动画结束后不再排队帧
    expect(queued.size).toBe(0)
  })

  it('终值按 precision 截断（precision=0 → 整数终值）', () => {
    const { rerender, result } = renderHook(
      ({ t }) => useAnimatedNumber(t, { duration: 600, precision: 0 }),
      { initialProps: { t: 0 } },
    )
    rerender({ t: 100 })

    act(() => runFrames(2000))
    act(() => runFrames(2600))
    expect(result.current).toBe(100)
  })

  it('target 变化打断旧动画：旧帧被 cancel，从当前 display 重新出发', () => {
    const { rerender, result } = renderHook(
      ({ t }) => useAnimatedNumber(t, { duration: 600 }),
      { initialProps: { t: 0 } },
    )

    // 挂载时排了一帧；重设 target 时应取消
    rerender({ t: 100 })
    expect(cancelSpy).toHaveBeenCalled()

    act(() => runFrames(3000)) // elapsed=0 → 起点
    expect(result.current).toBe(0)

    // 动画到一半 target 改到 200
    act(() => runFrames(3300)) // elapsed=300 → 87.5
    expect(result.current).toBeCloseTo(87.5, 1)

    rerender({ t: 200 })
    act(() => runFrames(4000)) // 新动画首帧 → 从 87.5 出发
    expect(result.current).toBeCloseTo(87.5, 1)
  })

  it('卸载时 cancelAnimationFrame 被调用', () => {
    const { unmount } = renderHook(() => useAnimatedNumber(100, { duration: 1000 }))
    unmount()
    expect(cancelSpy).toHaveBeenCalled()
  })

  it('支持负数 target 的动画', () => {
    const { rerender, result } = renderHook(
      ({ t }) => useAnimatedNumber(t, { duration: 600 }),
      { initialProps: { t: 0 } },
    )
    rerender({ t: -100 })

    act(() => runFrames(5000))
    act(() => runFrames(5300))
    expect(result.current).toBeCloseTo(-87.5, 1)

    act(() => runFrames(5600))
    expect(result.current).toBe(-100)
  })
})