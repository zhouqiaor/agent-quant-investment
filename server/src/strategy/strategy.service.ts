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
  isCustom?: boolean;
  symbol?: string;
  monitorEnabled?: boolean;
  autoTrade?: boolean;
}

export interface Condition {
  id: string;
  indicator: string;
  operator: string;
  value: number;
  description: string;
}

export interface CustomStrategy {
  id: string;
  name: string;
  symbol: string;
  indicators: string[];
  indicatorParams: Record<string, Record<string, number>>;
  buyConditions: Condition[];
  sellConditions: Condition[];
  positionSize: number;
  stopLoss: number;
  takeProfit: number;
  autoTrade: boolean;
  monitorEnabled: boolean;
  status: 'running' | 'stopped';
  pnl: number;
  pnlRate: number;
  winRate: number;
  trades: number;
  createdAt: string;
  lastSignal?: string;
}

export interface MonitorSignal {
  id: string;
  strategyId: string;
  strategyName: string;
  symbol: string;
  type: 'buy' | 'sell';
  price: number;
  reason: string;
  time: string;
  executed: boolean;
}

@Injectable()
export class StrategyService {
  private strategies: Strategy[] = [
    {
      id: 's1',
      name: 'MACD 金叉策略',
      type: '趋势跟踪',
      status: 'stopped',
      pnl: 0,
      pnlRate: 0,
      winRate: 0,
      trades: 142,
      description: '基于 MACD 指标金叉/死叉信号进行多空操作',
    },
    {
      id: 's2',
      name: '布林带突破策略',
      type: '均值回归',
      status: 'stopped',
      pnl: 0,
      pnlRate: 0,
      winRate: 0,
      trades: 98,
      description: '价格突破布林带上下轨时反向操作，回归均值获利',
    },
    {
      id: 's3',
      name: 'RSI 超买超卖',
      type: '震荡策略',
      status: 'stopped',
      pnl: 0,
      pnlRate: 0,
      winRate: 0,
      trades: 67,
      description: 'RSI 指标超买区做空，超卖区做多',
    },
    {
      id: 's4',
      name: '网格交易策略',
      type: '网格策略',
      status: 'stopped',
      pnl: 0,
      pnlRate: 0,
      winRate: 0,
      trades: 356,
      description: '在设定价格区间内自动高抛低吸',
    },
  ];

  private customStrategies: CustomStrategy[] = [];
  private monitorSignals: MonitorSignal[] = [];

  getStrategies(): Strategy[] {
    // Merge custom strategies into the list
    const customList: Strategy[] = this.customStrategies.map((cs) => ({
      id: cs.id,
      name: cs.name,
      type: '自定义',
      status: cs.status,
      pnl: cs.pnl,
      pnlRate: cs.pnlRate,
      winRate: cs.winRate,
      trades: cs.trades,
      description: `自定义策略 | 标的: ${cs.symbol} | 指标: ${cs.indicators.join(', ')}`,
      isCustom: true,
      symbol: cs.symbol,
      monitorEnabled: cs.monitorEnabled,
      autoTrade: cs.autoTrade,
    }));
    return [...this.strategies, ...customList];
  }

  toggleStrategy(id: string, action: 'start' | 'stop'): Strategy | null {
    // Check built-in strategies
    const strategy = this.strategies.find((s) => s.id === id);
    if (strategy) {
      strategy.status = action === 'start' ? 'running' : 'stopped';
      return strategy;
    }
    // Check custom strategies
    const custom = this.customStrategies.find((s) => s.id === id);
    if (custom) {
      custom.status = action === 'start' ? 'running' : 'stopped';
      return {
        id: custom.id,
        name: custom.name,
        type: '自定义',
        status: custom.status,
        pnl: custom.pnl,
        pnlRate: custom.pnlRate,
        winRate: custom.winRate,
        trades: custom.trades,
        description: `自定义策略 | 标的: ${custom.symbol}`,
        isCustom: true,
        symbol: custom.symbol,
        monitorEnabled: custom.monitorEnabled,
        autoTrade: custom.autoTrade,
      };
    }
    return null;
  }

  // Custom Strategy CRUD
  createCustomStrategy(data: Partial<CustomStrategy>): CustomStrategy {
    const id = `cs_${Date.now()}`;
    const newStrategy: CustomStrategy = {
      id,
      name: data.name || '未命名策略',
      symbol: data.symbol || '',
      indicators: data.indicators || [],
      indicatorParams: data.indicatorParams || {},
      buyConditions: data.buyConditions || [],
      sellConditions: data.sellConditions || [],
      positionSize: data.positionSize || 10,
      stopLoss: data.stopLoss || 5,
      takeProfit: data.takeProfit || 15,
      autoTrade: data.autoTrade || false,
      monitorEnabled: data.monitorEnabled !== false,
      status: 'stopped',
      pnl: 0,
      pnlRate: 0,
      winRate: 0,
      trades: 0,
      createdAt: new Date().toISOString(),
    };
    this.customStrategies.push(newStrategy);
    return newStrategy;
  }

  updateCustomStrategy(id: string, data: Partial<CustomStrategy>): CustomStrategy | null {
    const idx = this.customStrategies.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    this.customStrategies[idx] = {
      ...this.customStrategies[idx],
      ...data,
      id, // prevent id change
    };
    return this.customStrategies[idx];
  }

  getCustomStrategy(id: string): CustomStrategy | null {
    return this.customStrategies.find((s) => s.id === id) || null;
  }

  deleteCustomStrategy(id: string): boolean {
    const idx = this.customStrategies.findIndex((s) => s.id === id);
    if (idx === -1) return false;
    this.customStrategies.splice(idx, 1);
    return true;
  }

  getCustomStrategies(): CustomStrategy[] {
    return this.customStrategies;
  }

  // Monitoring Engine - simulate checking conditions against market data
  checkMonitorSignals(marketData: Array<{ symbol: string; price: number; changePercent: number }>): MonitorSignal[] {
    const newSignals: MonitorSignal[] = [];

    for (const strategy of this.customStrategies) {
      if (!strategy.monitorEnabled || strategy.status !== 'running') continue;

      const market = marketData.find((m) => m.symbol === strategy.symbol);
      if (!market) continue;

      // Simulate condition checking based on indicators
      for (const condition of strategy.buyConditions) {
        const triggered = this.evaluateCondition(condition, market, 'buy');
        if (triggered) {
          const signal: MonitorSignal = {
            id: `sig_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            strategyId: strategy.id,
            strategyName: strategy.name,
            symbol: strategy.symbol,
            type: 'buy',
            price: market.price,
            reason: this.generateReason(condition, market, 'buy'),
            time: new Date().toISOString(),
            executed: strategy.autoTrade,
          };
          newSignals.push(signal);
          strategy.lastSignal = signal.time;
          strategy.trades += 1;
        }
      }

      for (const condition of strategy.sellConditions) {
        const triggered = this.evaluateCondition(condition, market, 'sell');
        if (triggered) {
          const signal: MonitorSignal = {
            id: `sig_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            strategyId: strategy.id,
            strategyName: strategy.name,
            symbol: strategy.symbol,
            type: 'sell',
            price: market.price,
            reason: this.generateReason(condition, market, 'sell'),
            time: new Date().toISOString(),
            executed: strategy.autoTrade,
          };
          newSignals.push(signal);
          strategy.lastSignal = signal.time;
        }
      }
    }

    this.monitorSignals = [...newSignals, ...this.monitorSignals].slice(0, 50);
    return newSignals;
  }

  private evaluateCondition(condition: Condition, market: { symbol: string; price: number; changePercent: number }, type: 'buy' | 'sell'): boolean {
    // 确定性求值（可测试性）：价格阈值条件直接比较；非价格条件按涨跌幅规则
    if (condition.indicator === 'price') {
      return type === 'buy'
        ? market.price <= condition.value
        : market.price >= condition.value;
    }
    // 兜底规则：跌 0.5% 触发买入，涨 0.5% 触发卖出（确定性，无随机）
    if (type === 'buy') {
      return market.changePercent < -0.5;
    }
    return market.changePercent > 0.5;
  }

  private generateReason(condition: Condition, market: { symbol: string; price: number; changePercent: number }, type: 'buy' | 'sell'): string {
    const indicatorName = condition.indicator;
    const operatorLabel = this.getOperatorLabel(condition.operator);
    const direction = type === 'buy' ? '买入' : '卖出';
    return `${indicatorName} ${operatorLabel} 触发${direction}信号 | 当前跌幅 ${market.changePercent.toFixed(2)}%`;
  }

  private getOperatorLabel(op: string): string {
    const labels: Record<string, string> = {
      cross_above: '上穿',
      cross_below: '下穿',
      above: '大于',
      below: '小于',
      equal: '等于',
      greater: '强于',
      less: '弱于',
    };
    return labels[op] || op;
  }

  getMonitorSignals(limit = 10): MonitorSignal[] {
    return this.monitorSignals.slice(0, limit);
  }
}
