import * as React from 'react'
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from './button'

/**
 * 跨端 React ErrorBoundary（H5 + 微信小程序 + 抖音小程序）
 *
 * - 默认 fallback：显示错误信息、"重新加载"（调用 Taro.reLaunch）、"复制错误"
 *   （调用 Taro.setClipboardData，H5 下有 DOM clipboard 兜底）
 * - 自定义 fallback：通过 fallback prop 传入 (error, reset) => ReactNode
 * - 副作用：componentDidCatch 中调用 Taro.showToast 提示用户
 *
 * 设计：渲染层尽量保持轻量，便于在 chart 这类子组件中重复包裹。
 */
export interface ErrorBoundaryProps {
  children: React.ReactNode
  /**
   * 自定义 fallback UI。`reset` 调用后可清除错误并重新渲染 children。
   */
  fallback?: (error: Error, reset: () => void) => React.ReactNode
  /**
   * 错误捕获时的扩展回调（例如上报到 Sentry / 自家后端）。
   * 与 Taro.showToast 并行执行，不影响 fallback 渲染。
   */
  onError?: (error: Error, info: React.ErrorInfo) => void
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  state: ErrorBoundaryState = {
    error: null,
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // 开发期：同时打 error + componentStack
    console.error('[ErrorBoundary] caught error:', error, info?.componentStack ?? '')
    // 用户感知：toast 提示
    try {
      Taro.showToast({
        title: '页面出了点小问题',
        icon: 'none',
        duration: 2000,
      })
    } catch {
      /* Taro.showToast 在部分环境不可用，静默 */
    }
    // 扩展钩子
    this.props.onError?.(error, info)
  }

  /**
   * 清除错误状态并重新渲染 children。
   * 注意：reset 仅清状态；调用方需确保 children 的下次渲染不会再 throw
   *（典型用法：父级切换 props 让子组件恢复正常）。
   */
  reset = (): void => {
    this.setState({ error: null })
  }

  render(): React.ReactNode {
    const { error } = this.state
    const { children, fallback } = this.props

    if (error) {
      if (fallback) {
        return fallback(error, this.reset)
      }
      return <DefaultErrorFallback error={error} onReset={this.reset} />
    }
    return children
  }
}

/**
 * 默认 fallback：提示文案 + 重新加载 + 复制错误
 * 通过 Taro.reLaunch / Taro.setClipboardData 跨端调用；
 * H5 端使用 navigator.clipboard 做兜底（小程序 setClipboardData 不可用时）。
 */
function DefaultErrorFallback({
  error,
  onReset,
}: {
  error: Error
  onReset: () => void
}): React.ReactElement {
  const handleReload = (): void => {
    try {
      Taro.reLaunch({ url: '/' })
      return
    } catch {
      /* 跨端 fallback */
    }
    if (typeof window !== 'undefined') {
      window.location.reload()
    } else {
      onReset()
    }
  }

  const handleCopy = async (): Promise<void> => {
    const text = formatErrorForCopy(error)
    try {
      await Taro.setClipboardData({ data: text })
      Taro.showToast({ title: '已复制错误信息', icon: 'success', duration: 1500 })
      return
    } catch {
      /* 跨端 fallback */
    }
    // H5 兜底：navigator.clipboard
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard?.writeText
    ) {
      try {
        await navigator.clipboard.writeText(text)
        Taro.showToast({ title: '已复制错误信息', icon: 'success', duration: 1500 })
        return
      } catch {
        /* fallthrough */
      }
    }
    Taro.showToast({ title: '复制失败', icon: 'none', duration: 1500 })
  }

  return (
    <View
      className="flex flex-col items-center justify-center min-h-screen p-6 bg-background"
      style={{ minHeight: '100vh' }}
    >
      <Text className="block text-2xl font-semibold mb-2 text-foreground">
        页面出了点小问题
      </Text>
      <Text className="block text-sm text-muted-foreground mb-6 text-center max-w-md">
        {error?.message || '未知错误，请稍后重试'}
      </Text>
      <View className="flex flex-row gap-3">
        <Button onClick={handleReload}>重新加载</Button>
        <Button variant="outline" onClick={handleCopy}>
          复制错误
        </Button>
      </View>
    </View>
  )
}

function formatErrorForCopy(error: Error): string {
  const lines = [
    `[ErrorBoundary] ${new Date().toISOString()}`,
    `Name: ${error.name}`,
    `Message: ${error.message}`,
  ]
  if (error.stack) lines.push(`Stack:\n${error.stack}`)
  return lines.join('\n')
}

export default ErrorBoundary