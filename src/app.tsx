import { PropsWithChildren } from 'react';
import { LucideTaroProvider } from 'lucide-react-taro';
import { Toaster } from '@/components/ui/toast';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { initNotificationPolling, applyTabBarBadge, useNotificationStore } from '@/stores/notification';
import { useColorScheme } from '@/lib/use-color-scheme';
import '@/app.css';
import { Preset } from './presets';

// 启动通知轮询 + 订阅未读数变化同步到 TabBar 角标
initNotificationPolling();
useNotificationStore.subscribe((state) => {
  applyTabBarBadge(state.unreadCount);
});

const App = ({ children }: PropsWithChildren) => {
  // 初始化暗色模式：读取 localStorage + 系统主题，
  // 把解析后的 scheme 写入 <html data-theme> / .dark / .light class，
  // 小程序端 best-effort 调整 navigationBar。
  useColorScheme();

  return (
    <LucideTaroProvider defaultColor="#000" defaultSize={24}>
      {/*
          顶层 ErrorBoundary：捕获所有 React 渲染错误
          - H5 + 微信小程序 + 抖音小程序 跨端兼容
          - 兜底 UI：页面文案 + 重新加载 (Taro.reLaunch) + 复制错误 (Taro.setClipboardData)
          - H5 端仍嵌套 presets/h5-error-boundary 处理 window 级 unhandled error
        */}
      <ErrorBoundary>
        <Preset>{children}</Preset>
        <Toaster />
      </ErrorBoundary>
    </LucideTaroProvider>
  );
};

export default App;
