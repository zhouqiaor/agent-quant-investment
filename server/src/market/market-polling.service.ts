import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { MarketService } from './market.service';

type Listener = (data: unknown[]) => void;

@Injectable()
export class MarketPollingService implements OnModuleDestroy {
  private readonly logger = new Logger(MarketPollingService.name);
  private timer: NodeJS.Timeout | null = null;
  private polling = false;
  private intervalMs = 5000;
  private lastTickAt: number | null = null;
  private listeners: Listener[] = [];

  constructor(private readonly marketService: MarketService) {}

  isPolling(): boolean {
    return this.polling;
  }

  getIntervalMs(): number {
    return this.intervalMs;
  }

  getLastTickAt(): number | null {
    return this.lastTickAt;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(data: unknown[]) {
    this.lastTickAt = Date.now();
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
    this.timer = setInterval(() => {
      void this.tick();
    }, intervalMs);
    this.logger.log(`行情轮询已启动，间隔 ${intervalMs}ms`);
    // 首次拉取绝不阻塞启动流程：无外网环境下 DNS/连接可挂起 20s+，
    // 若 await 会卡死 Nest onModuleInit 导致健康探测超时。tick() 内部自捕获错误，浮动调用安全。
    void this.tick();
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
