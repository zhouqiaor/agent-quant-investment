import { Injectable } from '@nestjs/common';

export interface Strategy {
  id: string;
  name: string;
  type: string;
  status: 'running' | 'stopped' | 'backtesting';
  pnl: number;
  pnlRate: number;
  winRate: number;
  trades: number;
  description: string;
}

@Injectable()
export class StrategyService {
  private strategies: Strategy[] = [
    {
      id: 's1',
      name: 'MACD 金叉策略',
      type: '趋势跟踪',
      status: 'running',
      pnl: 3456.78,
      pnlRate: 12.35,
      winRate: 68,
      trades: 142,
      description: '基于 MACD 指标金叉/死叉信号进行多空操作',
    },
    {
      id: 's2',
      name: '布林带突破策略',
      type: '均值回归',
      status: 'running',
      pnl: 2134.56,
      pnlRate: 8.92,
      winRate: 72,
      trades: 98,
      description: '价格突破布林带上下轨时反向操作，回归均值获利',
    },
    {
      id: 's3',
      name: 'RSI 超买超卖',
      type: '震荡策略',
      status: 'stopped',
      pnl: -567.89,
      pnlRate: -2.34,
      winRate: 45,
      trades: 67,
      description: 'RSI 指标超买区做空，超卖区做多',
    },
    {
      id: 's4',
      name: '网格交易策略',
      type: '网格策略',
      status: 'running',
      pnl: 1890.23,
      pnlRate: 7.56,
      winRate: 82,
      trades: 356,
      description: '在设定价格区间内自动高抛低吸',
    },
  ];

  getStrategies(): Strategy[] {
    return this.strategies;
  }

  toggleStrategy(id: string, action: 'start' | 'stop'): Strategy | null {
    const strategy = this.strategies.find((s) => s.id === id);
    if (!strategy) return null;
    strategy.status = action === 'start' ? 'running' : 'stopped';
    return strategy;
  }
}
