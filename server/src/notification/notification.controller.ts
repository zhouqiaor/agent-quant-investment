import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { NotificationService, TradeSignalInput } from './notification.service';
import { AgentService, AgentSignal } from '@/agent/agent.service';
import { MarketPollingService } from '@/market/market-polling.service';

@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly agentService: AgentService,
    private readonly marketPollingService: MarketPollingService,
  ) {}

  @Get()
  async list(
    @Query('unread') unread?: string,
    @Query('limit') limit?: string,
  ): Promise<{ code: number; msg: string; data: Awaited<ReturnType<NotificationService['list']>> }> {
    const data = await this.notificationService.list({
      unreadOnly: unread === 'true',
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return { code: 200, msg: 'success', data };
  }

  @Get('unread-count')
  async unreadCount(): Promise<{ code: number; msg: string; data: { count: number } }> {
    const count = await this.notificationService.unreadCount();
    return { code: 200, msg: 'success', data: { count } };
  }

  @Post(':id/read')
  async markRead(@Param('id') id: string): Promise<{ code: number; msg: string; data: { marked: boolean } }> {
    const marked = await this.notificationService.markRead(id);
    return { code: 200, msg: 'success', data: { marked } };
  }

  @Post('read-all')
  async markAllRead(): Promise<{ code: number; msg: string; data: { marked: number } }> {
    const marked = await this.notificationService.markAllRead();
    return { code: 200, msg: 'success', data: { marked } };
  }

  /** 将 Agent 最新信号同步为通知（去重） */
  @HttpCode(200)
  @Post('sync')
  async sync(
    @Body('limit') limit?: number,
  ): Promise<{ code: number; msg: string; data: { created: number; deduplicated: number; notifications: Awaited<ReturnType<NotificationService['list']>> } }> {
    const signals: AgentSignal[] = this.agentService.getSignals(limit ?? 10);
    let created = 0;
    let deduplicated = 0;
    for (const s of signals) {
      const input: TradeSignalInput = {
        id: s.id,
        type: s.type === 'buy' ? 'BUY' : 'SELL',
        symbol: s.symbol,
        name: s.symbol,
        price: s.price,
        reason: s.reason,
        source: 'agent',
        time: s.time,
      };
      const res = await this.notificationService.notify(input);
      if (res.deduplicated) deduplicated += 1;
      else created += 1;
    }
    const notifications = await this.notificationService.list({ limit: 20 });
    return { code: 200, msg: 'success', data: { created, deduplicated, notifications } };
  }
}
