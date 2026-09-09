import { Injectable } from '@nestjs/common';
import { PaperTradingService } from '../paper-trading/paper-trading.service';

export interface TradeRecord {
  id: string;
  type: 'buy' | 'sell';
  symbol: string;
  name?: string;
  price: number;
  quantity: number;
  amount: number;
  pnl: number;
  time: string;
  strategy: string;
  reason?: string;
}

/**
 * 交易历史服务
 * 数据来源：PaperTradingService（真实模拟账户成交记录，已持久化到 SQLite）
 */
@Injectable()
export class TradeService {
  constructor(private readonly paperTradingService: PaperTradingService) {}

  getTradeHistory(limit = 10, symbol?: string, accountId?: string): TradeRecord[] {
    const account = this.paperTradingService.getAccount(accountId || 'default');
    if (!account) return [];

    // 倒序（最新在前）
    const trades = [...account.trades].reverse();

    const filtered = symbol
      ? trades.filter(t => t.symbol === symbol)
      : trades;

    return filtered.slice(0, limit).map(t => ({
      id: t.id,
      type: t.type === 'BUY' ? 'buy' : 'sell',
      symbol: t.symbol,
      name: t.name,
      price: t.price,
      quantity: t.quantity,
      amount: t.amount,
      pnl: 0, // 持仓级盈亏在仓位中体现；此处保留 0 兼容历史展示
      time: t.time,
      strategy: t.strategyId || '默认策略',
      reason: t.reason,
    }));
  }
}
