import { useState, useRef, useEffect } from 'react'

export interface UseAnimatedNumberOptions {
  /** 动画时长（毫秒）。默认 600。 */
  duration?: number
  /** 缓动函数，参数为 0..1 的进度，返回值同样约束在 0..1。默认 easeOutCubic。 */
  easing?: (t: number) => number
  /** 显示精度（小数位）。默认 2；传 0 表示整数。 */
  precision?: number
}

/**
 * 默认缓动：开始快、结束慢，符合「数字滚动逐渐到位」的视觉直觉。
 */
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3)

/**
 * 纯函数：在指定 elapsed 时刻下，从 from 到 to 的插值。
 * 暴露出来便于在测试中直接验证行为，无需 React 运行时。
 *
 * - `elapsed < 0` 按 0 处理；`elapsed > duration` 按 1 处理
 * - 支持负数（线性插值天然支持）
 * - 精度截断使用 `Number(value.toFixed(precision))`，避免浮点尾数
 */
export function computeTweenValue(
  from: number,
  to: number,
  elapsed: number,
  duration: number,
  easing: (t: number) => number,
  precision: number,
): number {
  const t = Math.min(1, Math.max(0, elapsed / duration))
  const eased = easing(t)
  const value = from + (to - from) * eased
  return Number(value.toFixed(precision))
}

/**
 * React hook：当 target 变化时，从当前显示值平滑过渡到 target。
 *
 * 行为约定：
 * - 初始 display === target，无需动画
 * - target 变化时重启（从当前 display 出发，不打断已有动画）
 * - 进度 >= 1 时停止 rAF，display === target
 * - 组件卸载时 cancelAnimationFrame
 * - 异步更新通过 setDisplay 触发重渲染（每个 rAF 帧一次）
 *
 * 默认参数：duration=600ms、easing=easeOutCubic、precision=2。
 */
export function useAnimatedNumber(
  target: number,
  options?: UseAnimatedNumberOptions,
): number {
  const duration = options?.duration ?? 600
  const easing = options?.easing ?? easeOutCubic
  const precision = options?.precision ?? 2

  // 初始值 = target（无需动画）
  const [display, setDisplay] = useState<number>(() =>
    Number(target.toFixed(precision)),
  )

  // 持有 display 的最新值，用于「从当前显示值出发」
  const displayRef = useRef<number>(target)
  const fromRef = useRef<number>(target)
  const startTimeRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  // 每次 display 变化后同步到 ref，供下一段 tween 起点读取
  useEffect(() => {
    displayRef.current = display
  }, [display])

  // 监听 target / 配置变化，重启动画
  useEffect(() => {
    fromRef.current = displayRef.current
    startTimeRef.current = null

    const tick = (now: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = now
      }
      const elapsed = now - startTimeRef.current
      const value = computeTweenValue(
        fromRef.current,
        target,
        elapsed,
        duration,
        easing,
        precision,
      )
      setDisplay(value)
      if (elapsed < duration) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        rafRef.current = null
      }
    }

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [target, duration, easing, precision])

  return display
}