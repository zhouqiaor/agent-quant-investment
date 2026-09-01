import { Injectable } from '@nestjs/common';
import { StrategyService } from '../strategy/strategy.service';

export interface PaperPosition {
  symbol: string;
  name: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  pnl: number;
  pnlRate: number;
  openDate: string;
}

export interface PaperTrade {
  id: string;
  date: string;
  time: string;
  type: 'BUY' | 'SELL';
  symbol: string;
  name: string;
  price: number;
  quantity: number;
  amount: number;
  reason: string;
  strategyId: string;
}

export interface PaperAccount {
  id: string;
  name: string;
  initialCapital: number;
  cash: number;
  positions: PaperPosition[];
  trades: PaperTrade[];
  totalValue: number;
  totalPnl: number;
  totalPnlRate: number;
  isRunning: boolean;
  startDate: string;
  strategies: string[]; // 关联的策略ID
}

@Injectable()
export class PaperTradingService {
  private accounts: Map<string, PaperAccount> = new Map();
  private defaultAccountId = 'default';

  constructor(private readonly strategyService: StrategyService) {
    // 初始化默认账户
    this.initDefaultAccount();
  }

  private initDefaultAccount() {
    this.accounts.set(this.defaultAccountId, {
      id: this.defaultAccountId,
      name: '模拟交易账户',
      initialCapital: 100000,
      cash: 100000,
      positions: [],
      trades: [],
      totalValue: 100000,
      totalPnl: 0,
      totalPnlRate: 0,
      isRunning: false,
      startDate: new Date().toISOString(),
      strategies: [],
    });
  }

  /**
   * 按最新价格快照重估全部持仓（实时看盘核心）：
   * 更新 position.currentPrice/marketValue/pnl/pnlRate 与账户 totalValue/totalPnl/totalPnlRate
   * @returns 更新后的账户
   */
  markPrices(prices: Record<string, number>, accountId?: string): PaperAccount {
    const account = this.getAccount(accountId);
    let totalMarketValue = 0;
    let changed = false;
    for (const pos of account.positions) {
      const price = prices[pos.symbol];
      if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) continue;
      pos.currentPrice = price;
      pos.marketValue = this.round2(pos.quantity * price);
      pos.pnl = this.round2(pos.marketValue - pos.quantity * pos.avgCost);
      pos.pnlRate = pos.avgCost > 0 ? this.round2(((price - pos.avgCost) / pos.avgCost) * 100) : 0;
      changed = true;
    }
    for (const pos of account.positions) {
      totalMarketValue += pos.marketValue;
    }
    if (changed) {
      account.totalValue = this.round2(account.cash + totalMarketValue);
      account.totalPnl = this.round2(account.totalValue - account.initialCapital);
      account.totalPnlRate =
        account.initialCapital > 0
          ? this.round2((account.totalPnl / account.initialCapital) * 100)
          : 0;
    }
    return account;
  }

  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  getAccount(accountId?: string): PaperAccount {
    const id = accountId || this.defaultAccountId;
    let account = this.accounts.get(id);
    if (!account) {
      this.initDefaultAccount();
      account = this.accounts.get(id);
    }
    return account!;
  }

  resetAccount(accountId?: string, initialCapital?: number): PaperAccount {
    const id = accountId || this.defaultAccountId;
    const capital = initialCapital ?? 100000;

    this.accounts.set(id, {
      id,
      name: '模拟交易账户',
      initialCapital: capital,
      cash: capital,
      positions: [],
      trades: [],
      totalValue: capital,
      totalPnl: 0,
      totalPnlRate: 0,
      isRunning: false,
      startDate: new Date().toISOString(),
      strategies: [],
    });

    return this.accounts.get(id)!;
  }

  startTrading(accountId?: string, strategyIds?: string[]): PaperAccount {
    const id = accountId || this.defaultAccountId;
    const account = this.getAccount(id);
    account.isRunning = true;
    if (strategyIds) {
      account.strategies = strategyIds;
    }
    return account;
  }

  stopTrading(accountId?: string): PaperAccount {
    const id = accountId || this.defaultAccountId;
    const account = this.getAccount(id);
    account.isRunning = false;
    return account;
  }

  // 模拟执行交易信号
  executeSignal(
    signal: {
      type: 'BUY' | 'SELL';
      symbol: string;
      name: string;
      price: number;
      reason: string;
      strategyId: string;
      quantity?: number;
    },
    accountId?: string,
  ): { success: boolean; message: string; trade?: PaperTrade } {
    const id = accountId || this.defaultAccountId;
    const account = this.getAccount(id);

    if (!account.isRunning) {
      return { success: false, message: '模拟交易未启动' };
    }

    if (signal.type === 'BUY') {
      return this.executeBuy(account, signal);
    } else {
      return this.executeSell(account, signal);
    }
  }

  private executeBuy(
    account: PaperAccount,
    signal: { symbol: string; name: string; price: number; reason: string; strategyId: string; quantity?: number },
  ): { success: boolean; message: string; trade?: PaperTrade } {
    // 检查是否已持仓
    const existingPosition = account.positions.find(p => p.symbol === signal.symbol);
    if (existingPosition) {
      return { success: false, message: `已持仓 ${signal.name}，跳过买入` };
    }

    // 计算可买数量：优先使用信号指定的数量，否则使用80%资金（A股100股整数倍）
    const availableCash = account.cash * 0.8;
    const maxAffordable = Math.floor(availableCash / signal.price / 100) * 100;
    const quantity = signal.quantity && signal.quantity > 0
      ? Math.min(signal.quantity, maxAffordable)
      : maxAffordable;

    if (quantity <= 0) {
      return { success: false, message: '可用资金不足' };
    }

    const amount = quantity * signal.price;
    account.cash -= amount;

    // 添加持仓
    account.positions.push({
      symbol: signal.symbol,
      name: signal.name,
      quantity,
      avgCost: signal.price,
      currentPrice: signal.price,
      marketValue: amount,
      pnl: 0,
      pnlRate: 0,
      openDate: new Date().toISOString(),
    });

    // 记录交易
    const trade: PaperTrade = {
      id: `pt_${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().split(' ')[0],
      type: 'BUY',
      symbol: signal.symbol,
      name: signal.name,
      price: signal.price,
      quantity,
      amount,
      reason: signal.reason,
      strategyId: signal.strategyId,
    };
    account.trades.push(trade);

    this.updateAccountTotal(account);

    return { success: true, message: `买入 ${signal.name} ${quantity}股`, trade };
  }

  private executeSell(
    account: PaperAccount,
    signal: { symbol: string; name: string; price: number; reason: string; strategyId: string; quantity?: number },
  ): { success: boolean; message: string; trade?: PaperTrade } {
    // 查找持仓
    const positionIndex = account.positions.findIndex(p => p.symbol === signal.symbol);
    if (positionIndex === -1) {
      return { success: false, message: `未持仓 ${signal.name}，无法卖出` };
    }

    const position = account.positions[positionIndex];
    const amount = position.quantity * signal.price;
    const pnl = (signal.price - position.avgCost) * position.quantity;

    account.cash += amount;
    account.positions.splice(positionIndex, 1);

    // 记录交易
    const trade: PaperTrade = {
      id: `pt_${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().split(' ')[0],
      type: 'SELL',
      symbol: signal.symbol,
      name: signal.name,
      price: signal.price,
      quantity: position.quantity,
      amount,
      reason: signal.reason + ` (盈亏: ${pnl > 0 ? '+' : ''}${pnl.toFixed(2)})`,
      strategyId: signal.strategyId,
    };
    account.trades.push(trade);

    this.updateAccountTotal(account);

    return {
      success: true,
      message: `卖出 ${signal.name} ${position.quantity}股，${pnl > 0 ? '盈利' : '亏损'} ${Math.abs(pnl).toFixed(2)}`,
      trade,
    };
  }

  // 更新持仓价格
  updatePositionPrice(symbol: string, price: number, accountId?: string) {
    const id = accountId || this.defaultAccountId;
    const account = this.accounts.get(id);
    if (!account) return;

    const position = account.positions.find(p => p.symbol === symbol);
    if (position) {
      position.currentPrice = price;
      position.marketValue = position.quantity * price;
      position.pnl = (price - position.avgCost) * position.quantity;
      position.pnlRate = ((price - position.avgCost) / position.avgCost) * 100;
    }

    this.updateAccountTotal(account);
  }

  private updateAccountTotal(account: PaperAccount) {
    const positionValue = account.positions.reduce((sum, p) => sum + p.marketValue, 0);
    account.totalValue = account.cash + positionValue;
    account.totalPnl = account.totalValue - account.initialCapital;
    account.totalPnlRate = ((account.totalValue - account.initialCapital) / account.initialCapital) * 100;
  }

  // 获取持仓列表
  getPositions(accountId?: string): PaperPosition[] {
    return this.getAccount(accountId).positions;
  }

  // 获取交易记录
  getTrades(accountId?: string, limit = 20): PaperTrade[] {
    const trades = this.getAccount(accountId).trades;
    return trades.slice(-limit).reverse();
  }

  // 模拟自动交易（根据策略信号执行）
  async simulateAutoTrading(accountId?: string): Promise<{ executed: number; messages: string[] }> {
    const id = accountId || this.defaultAccountId;
    const account = this.getAccount(id);

    if (!account.isRunning) {
      return { executed: 0, messages: ['模拟交易未启动'] };
    }

    const messages: string[] = [];
    let executed = 0;

    // 获取关联策略的信号
    for (const strategyId of account.strategies) {
      const strategies = this.strategyService.getStrategies();
      const strategy = strategies.find(s => s.id === strategyId);
      if (!strategy || strategy.status !== 'running') continue;

      // 模拟生成信号（实际应该从 Agent 服务获取）
      const random = Math.random();
      if (random < 0.1) { // 10% 概率生成信号
        const symbols = ['600519', '300750', '002594', '601318', '000858'];
        const names = ['贵州茅台', '宁德时代', '比亚迪', '中国平安', '五粮液'];
        const prices = [1850, 210, 260, 52, 155];
        const idx = Math.floor(Math.random() * symbols.length);

        const hasPosition = account.positions.some(p => p.symbol === symbols[idx]);
        const signalType = hasPosition && Math.random() > 0.5 ? 'SELL' : 'BUY';

        const result = this.executeSignal({
          type: signalType,
          symbol: symbols[idx],
          name: names[idx],
          price: prices[idx] * (1 + (Math.random() - 0.5) * 0.02),
          reason: `${strategy.name} 信号`,
          strategyId,
        }, id);

        messages.push(result.message);
        executed++;
      }
    }

    return { executed, messages };
  }
}
