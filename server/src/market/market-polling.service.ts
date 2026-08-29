import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { MarketService } from './market.service';

type Listener = (data: unknown[]) => void;

@Injectable()
export class MarketPollingService implements OnModuleDestroy {
  private readonly logger = new Logger(MarketPollingService.name);
  private timer: NodeJS.Timeout | null = null;
  private polling = false;
  private intervalMs = 5000;
  private listeners: Listener[] = [];

  constructor(private readonly marketService: MarketService) {}

  isPolling(): boolean {
    return this.polling;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(data: unknown[]) {
    this.listeners.forEach((l) => {
      try {
        l(data);
      } catch (err) {
        this.logger.error('轮询订阅回调异常', err as Error);
      }
    });
  }

  async start(intervalMs = 5000): Promise<void> {
    // 幂等：已在轮询则先清理
    if (this.polling) {
      this.stop();
    }
    this.intervalMs = intervalMs;
    this.polling = true;
    await this.tick();
    this.timer = setInterval(() => {
      void this.tick();
    }, intervalMs);
    this.logger.log(`行情轮询已启动，间隔 ${intervalMs}ms`);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.polling = false;
    this.logger.log('行情轮询已停止');
  }

  async tick(): Promise<void> {
    try {
      const list = await this.marketService.getMarketList();
      this.notify(list);
    } catch (err) {
      this.logger.error('行情轮询拉取失败', err as Error);
    }
  }

  onModuleDestroy() {
    this.stop();
  }
}
