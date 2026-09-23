import { PropsWithChildren } from 'react';
import { LucideTaroProvider } from 'lucide-react-taro';
import { Toaster } from '@/components/ui/toast';
import { initNotificationPolling, applyTabBarBadge, useNotificationStore } from '@/stores/notification';
import '@/app.css';
import { Preset } from './presets';

// 启动通知轮询 + 订阅未读数变化同步到 TabBar 角标
initNotificationPolling();
useNotificationStore.subscribe((state) => {
  applyTabBarBadge(state.unreadCount);
});

const App = ({ children }: PropsWithChildren) => {
  return (
    <LucideTaroProvider defaultColor="#000" defaultSize={24}>
      <Preset>{children}</Preset>
      <Toaster />
    </LucideTaroProvider>
  );
};

export default App;
