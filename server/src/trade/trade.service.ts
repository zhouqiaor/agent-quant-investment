import { Injectable } from '@nestjs/common';

export interface TradeRecord {
  id: string;
  type: 'buy' | 'sell';
  symbol: string;
  price: number;
  quantity: number;
  amount: number;
  pnl: number;
  time: string;
  strategy: string;
}

@Injectable()
export class TradeService {
  getTradeHistory(limit = 10): TradeRecord[] {
    const trades: TradeRecord[] = [
      { id: 't1', type: 'buy', symbol: 'BTC', price: 67200, quantity: 0.05, amount: 3360, pnl: 0, time: '2024-01-15 14:32', strategy: 'MACD 金叉策略' },
      { id: 't2', type: 'sell', symbol: 'ETH', price: 3480, quantity: 2.0, amount: 6960, pnl: 234.5, time: '2024-01-15 14:15', strategy: '布林带突破策略' },
      { id: 't3', type: 'buy', symbol: 'SOL', price: 176.5, quantity: 10, amount: 1765, pnl: 0, time: '2024-01-15 13:48', strategy: 'MACD 金叉策略' },
      { id: 't4', type: 'sell', symbol: 'LINK', price: 14.56, quantity: 200, amount: 2912, pnl: 156.8, time: '2024-01-15 13:20', strategy: '网格交易策略' },
      { id: 't5', type: 'buy', symbol: 'AVAX', price: 34.8, quantity: 50, amount: 1740, pnl: 0, time: '2024-01-15 12:55', strategy: 'MACD 金叉策略' },
      { id: 't6', type: 'sell', symbol: 'BTC', price: 66800, quantity: 0.03, amount: 2004, pnl: -45.6, time: '2024-01-15 12:30', strategy: '布林带突破策略' },
      { id: 't7', type: 'buy', symbol: 'DOGE', price: 0.148, quantity: 10000, amount: 1480, pnl: 0, time: '2024-01-15 11:45', strategy: '网格交易策略' },
      { id: 't8', type: 'sell', symbol: 'ETH', price: 3420, quantity: 1.5, amount: 5130, pnl: 189.3, time: '2024-01-15 11:20', strategy: 'MACD 金叉策略' },
      { id: 't9', type: 'buy', symbol: 'SOL', price: 172.3, quantity: 15, amount: 2584.5, pnl: 0, time: '2024-01-15 10:50', strategy: '网格交易策略' },
      { id: 't10', type: 'sell', symbol: 'DOT', price: 7.45, quantity: 300, amount: 2235, pnl: -78.9, time: '2024-01-15 10:15', strategy: 'RSI 超买超卖' },
    ];

    return trades.slice(0, limit);
  }
}
