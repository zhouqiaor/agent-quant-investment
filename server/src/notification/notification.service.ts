import { Injectable } from '@nestjs/common';
import { PersistenceService } from '../persistence/persistence.service';

export interface TradeSignalInput {
  id: string;
  type: 'BUY' | 'SELL';
  symbol: string;
  name: string;
  price: number;
  reason: string;
  source: 'agent' | 'custom' | 'manual';
  time: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  read: boolean;
  signalId: string;
  type: 'BUY' | 'SELL';
  symbol: string;
  time: string;
}

/**
 * 信号通知服务
 * 参考 Freqtrade 的 Telegram/Webhook 通知渠道设计，
 * 本阶段实现应用内通知（in-app channel），后续可扩展。
 */
@Injectable()
export class NotificationService {
  constructor(private readonly persistence: PersistenceService) {}

  async notify(signal: TradeSignalInput): Promise<NotificationItem & { deduplicated?: boolean }> {
    // 去重：同 signalId 的未读通知不重复发送
    const existing = await this.persistence.listNotifications();
    const dup = existing.find((n: any) => n.signalId === signal.id && !n.read);
    if (dup) {
      return {
        ...(dup as any),
        deduplicated: true,
      };
    }

    const action = signal.type === 'BUY' ? '买入' : '卖出';
    const item: NotificationItem = {
      id: `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: `${action}信号：${signal.name}（${signal.symbol}）`,
      body: `价格 ${signal.price.toFixed(2)}，原因：${signal.reason}`,
      read: false,
      signalId: signal.id,
      type: signal.type,
      symbol: signal.symbol,
      time: signal.time || new Date().toISOString(),
    };
    await this.persistence.saveNotification(item);
    return item;
  }

  async list(opts: { unreadOnly?: boolean; limit?: number } = {}): Promise<NotificationItem[]> {
    const all = (await this.persistence.listNotifications()) as any[];
    let list = all as NotificationItem[];
    if (opts.unreadOnly) list = list.filter((n) => !n.read);
    // 未读优先，时间倒序
    list = [...list].sort((a, b) => {
      if (a.read !== b.read) return a.read ? 1 : -1;
      return new Date(b.time).getTime() - new Date(a.time).getTime();
    });
    if (opts.limit) list = list.slice(0, opts.limit);
    return list;
  }

  async markRead(id: string): Promise<boolean> {
    return this.persistence.markNotificationRead(id);
  }

  async markAllRead(): Promise<number> {
    const all = (await this.persistence.listNotifications()) as any[];
    let count = 0;
    for (const n of all) {
      if (!n.read) {
        await this.persistence.markNotificationRead(n.id);
        count += 1;
      }
    }
    return count;
  }

  async unreadCount(): Promise<number> {
    const all = (await this.persistence.listNotifications()) as any[];
    return all.filter((n) => !n.read).length;
  }
}
