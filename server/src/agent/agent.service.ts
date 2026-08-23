import { Injectable } from '@nestjs/common';

export interface AgentSignal {
  id: string;
  type: 'buy' | 'sell';
  symbol: string;
  price: number;
  confidence: number;
  reason: string;
  time: string;
  executed: boolean;
}

@Injectable()
export class AgentService {
  private isActive = true;
  private signalCounter = 10;

  getStatus() {
    return {
      isActive: this.isActive,
      strategy: 'MACD 金叉 + 布林带复合策略',
      signals: Math.floor(Math.random() * 5) + 3,
      trades: Math.floor(Math.random() * 8) + 5,
      winRate: Math.floor(Math.random() * 15) + 65,
    };
  }

  getSignals(limit = 5): AgentSignal[] {
    const baseSignals: AgentSignal[] = [
      { id: 'sig1', type: 'buy', symbol: 'BTC', price: 67200, confidence: 85, reason: 'MACD 金叉 + 成交量放大，短期看涨', time: '2分钟前', executed: true },
      { id: 'sig2', type: 'sell', symbol: 'ETH', price: 3480, confidence: 72, reason: 'RSI 超买区域 + 布林带上轨压力', time: '15分钟前', executed: true },
      { id: 'sig3', type: 'buy', symbol: 'SOL', price: 176.5, confidence: 91, reason: '突破关键阻力位，资金流入明显', time: '32分钟前', executed: false },
      { id: 'sig4', type: 'buy', symbol: 'LINK', price: 14.2, confidence: 78, reason: '均线多头排列，MACD 柱状图转正', time: '1小时前', executed: true },
      { id: 'sig5', type: 'sell', symbol: 'DOGE', price: 0.155, confidence: 66, reason: '量能萎缩 + KDJ 死叉，短期回调风险', time: '1小时前', executed: false },
      { id: 'sig6', type: 'buy', symbol: 'AVAX', price: 34.8, confidence: 83, reason: '底部放量反弹，突破短期下降趋势线', time: '2小时前', executed: true },
      { id: 'sig7', type: 'sell', symbol: 'DOT', price: 7.45, confidence: 70, reason: '上方套牢盘压力大，建议减仓', time: '3小时前', executed: false },
    ];

    return baseSignals.slice(0, limit);
  }

  startAgent() {
    this.isActive = true;
    return { isActive: true, message: 'Agent 已启动' };
  }

  stopAgent() {
    this.isActive = false;
    return { isActive: false, message: 'Agent 已停止' };
  }

  generateSignal(): AgentSignal {
    this.signalCounter++;
    const symbols = ['BTC', 'ETH', 'SOL', 'BNB', 'AVAX', 'LINK'];
    const reasons = [
      'MACD 金叉形成，趋势看涨',
      'RSI 超卖反弹信号',
      '布林带下轨支撑有效',
      '成交量异常放大，可能突破',
      '均线系统多头排列',
      'KDJ 指标金叉确认',
    ];
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    const type = Math.random() > 0.5 ? 'buy' : 'sell';

    return {
      id: `sig${this.signalCounter}`,
      type,
      symbol,
      price: +(Math.random() * 50000 + 100).toFixed(2),
      confidence: Math.floor(Math.random() * 30) + 65,
      reason: reasons[Math.floor(Math.random() * reasons.length)],
      time: '刚刚',
      executed: false,
    };
  }
}
