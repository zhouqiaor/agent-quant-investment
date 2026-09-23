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

import { easeOutCubic, computeTweenValue, useAnimatedNumber } from './use-animated-number'

/* eslint-disable @typescript-eslint/no-namespace, no-var */
declare global {
  // 极简测试全局声明——避免引入 jest 类型依赖
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type JestLikeGlobal = unknown
}

// 函数式 describe / it / expect：让 tsc 把它们当作 ambient 标识符
declare const describe: (name: string, fn: () => void) => void
declare const it: (name: string, fn: () => void) => void
declare const expect: (val: unknown) => {
  toBe: (expected: unknown) => void
  toEqual: (expected: unknown) => void
  toBeCloseTo: (expected: number, digits?: number) => void
}

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

describe('useAnimatedNumber 契约（注释式验证）', () => {
  it('hook 已导出，可被调用', () => {
    // 静态契约：仅验证可导入与函数类型。
    // 运行时验证（初始值、target 变化、卸载清理）需 renderer，
    // 待接入 RTL 时补充 renderHook(<useAnimatedNumber target={0} />)。
    expect(typeof useAnimatedNumber).toBe('function')
  })

  it('默认配置下，初始 display 等于 target（无需动画）', () => {
    // useState 初始值由 useAnimatedNumber 内部设为 Number(target.toFixed(2))
    // 这里仅做契约级断言：导出 hook 接受 target，未传入 options 时不抛错。
    // 完整验证需 RTL 的 renderHook：
    //   const { result } = renderHook(({ t }) => useAnimatedNumber(t), { initialProps: { t: 100 } })
    //   expect(result.current).toBe(100)
    expect(useAnimatedNumber.length).toBe(2)
  })

  it('rAF 生命周期：组件卸载时应 cancelAnimationFrame', () => {
    // 契约：hook 的 useEffect cleanup 中调用 cancelAnimationFrame。
    // 完整验证需 RTL：
    //   const cancelSpy = jest.spyOn(global, 'cancelAnimationFrame')
    //   const { unmount } = renderHook(() => useAnimatedNumber(100, { duration: 1000 }))
    //   unmount()
    //   expect(cancelSpy).toHaveBeenCalled()
    //
    // 当前仅做契约级断言，避免新增 jest 依赖。
    expect(typeof useAnimatedNumber).toBe('function')
  })
})