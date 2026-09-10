import { Injectable, OnModuleInit } from '@nestjs/common';
import { StrategyService } from '../strategy/strategy.service';
import { PersistenceService } from '../persistence/persistence.service';

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
  type: 'live' | 'backtest'; // 账户类型：实盘模拟 / 回测
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
  meta?: {
    // 回测专用元数据
    backtestRunId?: string;
    startDate?: string;
    endDate?: string;
    symbols?: string[];
    strategyId?: string;
  };
}

@Injectable()
export class PaperTradingService implements OnModuleInit {
  private accounts: Map<string, PaperAccount> = new Map();
  private defaultAccountId = 'default';
  private initialized = false;

  constructor(
    private readonly strategyService: StrategyService,
    private readonly persistenceService: PersistenceService,
  ) {
    // 构造函数保持空，数据加载延后到 onModuleInit 阶段
    // 这样 e2e 测试可以先 setDbPath 再 app.init() 触发加载，避免读到错误的 db
  }

  /**
   * NestJS 生命周期：模块初始化完成后加载数据
   * 延后到此阶段是为了让测试可以通过 PersistenceService.setDbPath() 切换 db 后再加载
   */
  onModuleInit() {
    console.log("[PBT] onModuleInit NODE_ENV=" + process.env.NODE_ENV + " initialized=" + this.initialized); if (this.initialized) return;
    if (process.env.NODE_ENV === 'test') return;
    this.initialized = true;
    this.initDefaultAccount();
    this.loadAllPersistedAccounts();
  }

  /**
   * 从持久化恢复所有账户到内存，让"我的"页面能列出所有历史回测账户。
   * 默认账户已经在 initDefaultAccount 中处理，这里只处理其他账户。
   */
  private loadAllPersistedAccounts() {
    const persistedAccounts = this.persistenceService.loadPaperAccounts();
    for (const acc of persistedAccounts) {
      if (acc.id === this.defaultAccountId) continue; // 默认账户已处理
      const positions = this.persistenceService.loadPaperPositions(acc.id);
      const trades = this.persistenceService.loadPaperTrades(acc.id);
      this.accounts.set(acc.id, {
        id: acc.id,
        name: acc.name,
        type: acc.type || 'live',
        initialCapital: acc.initialCapital,
        cash: acc.cash,
        positions,
        trades: trades.map((t: any) => {
          const d = new Date(t.time);
          return {
            ...t,
            date: d.toISOString().split('T')[0],
            time: t.time,
          };
        }),
        totalValue: acc.totalValue,
        totalPnl: acc.totalPnl,
        totalPnlRate: acc.totalPnlRate,
        isRunning: false, // 重启后默认停止
        startDate: acc.startDate,
        strategies: acc.strategies || [],
        meta: acc.meta,
      });
    }
  }

  private initDefaultAccount() {
    // 优先从持久化恢复
    const persistedAccount = this.persistenceService.loadPaperAccount(this.defaultAccountId);
    if (persistedAccount) {
      const persistedPositions = this.persistenceService.loadPaperPositions(this.defaultAccountId);
      const persistedTrades = this.persistenceService.loadPaperTrades(this.defaultAccountId);
      this.accounts.set(this.defaultAccountId, {
        id: persistedAccount.id,
        name: persistedAccount.name,
        type: persistedAccount.type || 'live',
        initialCapital: persistedAccount.initialCapital,
        cash: persistedAccount.cash,
        positions: persistedPositions,
        trades: persistedTrades.map((t: any) => {
          const d = new Date(t.time);
          return {
            ...t,
            date: d.toISOString().split('T')[0],
            time: t.time,
          };
        }),
        totalValue: persistedAccount.totalValue,
        totalPnl: persistedAccount.totalPnl,
        totalPnlRate: persistedAccount.totalPnlRate,
        isRunning: persistedAccount.isRunning,
        startDate: persistedAccount.startDate,
        strategies: persistedAccount.strategies,
        meta: persistedAccount.meta,
      });
      return;
    }

    // 没有持久化数据，创建新账户
    this.accounts.set(this.defaultAccountId, {
      id: this.defaultAccountId,
      name: '模拟交易账户',
      type: 'live',
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
    this.persistAccount(this.defaultAccountId);
  }

  /**
   * 判断是否为应持久化的账户。
   * 所有非临时（`temp_` 前缀）账户都需要持久化，包括：
   * - 默认 live 账户
   * - 回测产生的 backtest 账户（用户在"我的-持仓/交易记录"中可见）
   * 内存临时账户才不落库。
   */
  private isPersistentAccount(accountId: string): boolean {
    if (accountId.startsWith('temp_')) return false;
    if (accountId.startsWith('backtest_')) return true; // 回测账户现在需要持久化
    return true;
  }

  /** 持久化账户（账户信息 + 持仓 + 交易） */
  private persistAccount(accountId: string): void {
    const account = this.accounts.get(accountId);
    if (!account) return;
    // 临时账户不落库
    if (process.env.NODE_ENV === "test") return;
    if (!this.isPersistentAccount(accountId)) return;

    this.persistenceService.savePaperAccount({
      id: account.id,
      name: account.name,
      type: account.type,
      initialCapital: account.initialCapital,
      cash: account.cash,
      totalValue: account.totalValue,
      totalPnl: account.totalPnl,
      totalPnlRate: account.totalPnlRate,
      isRunning: account.isRunning,
      startDate: account.startDate,
      strategies: account.strategies,
      meta: account.meta,
    });

    for (const pos of account.positions) {
      this.persistenceService.savePaperPosition(accountId, pos);
    }
  }

  /** 持久化单笔交易（回测临时账户跳过，不落库） */
  private persistTrade(account: PaperAccount, trade: PaperTrade): void {
    if (!this.isPersistentAccount(account.id)) return;
    this.persistenceService.savePaperTrade(account.id, {
      id: trade.id,
      type: trade.type,
      symbol: trade.symbol,
      name: trade.name,
      price: trade.price,
      quantity: trade.quantity,
      amount: trade.amount,
      reason: trade.reason,
      strategyId: trade.strategyId,
      time: `${trade.date}T${trade.time}`,
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
      this.persistAccount(account.id);
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

    // 清理旧持久化数据
    for (const pos of this.persistenceService.loadPaperPositions(id)) {
      this.persistenceService.deletePaperPosition(id, pos.symbol);
    }

    // 保留原账户的 name/type/meta（如果是已存在账户）
    const existing = this.accounts.get(id);

    this.accounts.set(id, {
      id,
      name: existing?.name || '模拟交易账户',
      type: existing?.type || 'live',
      initialCapital: capital,
      cash: capital,
      positions: [],
      trades: [],
      totalValue: capital,
      totalPnl: 0,
      totalPnlRate: 0,
      isRunning: false,
      startDate: existing?.startDate || new Date().toISOString(),
      strategies: [],
      meta: existing?.meta,
    });

    this.persistAccount(id);
    return this.accounts.get(id)!;
  }

  /**
   * 列出所有模拟账户（按类型分组：live / backtest）
   */
  listAccounts(): Array<{
    id: string;
    name: string;
    type: 'live' | 'backtest';
    totalValue: number;
    totalPnl: number;
    totalPnlRate: number;
    positionCount: number;
    tradeCount: number;
    startDate: string;
    isRunning: boolean;
    meta?: PaperAccount['meta'];
  }> {
    return Array.from(this.accounts.values()).map((acc) => ({
      id: acc.id,
      name: acc.name,
      type: acc.type,
      totalValue: acc.totalValue,
      totalPnl: acc.totalPnl,
      totalPnlRate: acc.totalPnlRate,
      positionCount: acc.positions.length,
      tradeCount: acc.trades.length,
      startDate: acc.startDate,
      isRunning: acc.isRunning,
      meta: acc.meta,
    }));
  }

  /**
   * 创建/获取指定ID的账户（用于回测时指定目标账户）
   */
  ensureAccount(
    accountId: string,
    options: {
      name?: string;
      type?: 'live' | 'backtest';
      initialCapital?: number;
      meta?: PaperAccount['meta'];
    } = {},
  ): PaperAccount {
    if (this.accounts.has(accountId)) {
      return this.accounts.get(accountId)!;
    }
    const capital = options.initialCapital ?? 100000;
    const account: PaperAccount = {
      id: accountId,
      name: options.name || (options.type === 'backtest' ? '回测账户' : '模拟交易账户'),
      type: options.type || 'live',
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
      meta: options.meta,
    };
    this.accounts.set(accountId, account);
    this.persistAccount(accountId);
    return account;
  }

  /**
   * 删除账户（包括其持仓、交易和持久化数据）
   * 不允许删除默认 live 账户
   */
  removeAccount(accountId: string): boolean {
    if (accountId === this.defaultAccountId) {
      throw new Error('不能删除默认账户');
    }
    if (!this.accounts.has(accountId)) {
      // 即使内存没有，也要清理持久化
      this.persistenceService.deletePaperAccount(accountId);
      return true;
    }
    this.accounts.delete(accountId);
    this.persistenceService.deletePaperAccount(accountId);
    return true;
  }

  startTrading(accountId?: string, strategyIds?: string[]): PaperAccount {
    const id = accountId || this.defaultAccountId;
    const account = this.getAccount(id);
    account.isRunning = true;
    if (strategyIds) {
      account.strategies = strategyIds;
    }
    this.persistAccount(id);
    return account;
  }

  stopTrading(accountId?: string): PaperAccount {
    const id = accountId || this.defaultAccountId;
    const account = this.getAccount(id);
    account.isRunning = false;
    this.persistAccount(id);
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
    signal: { type: 'BUY' | 'SELL'; symbol: string; name: string; price: number; reason: string; strategyId: string; quantity?: number },
    allowExisting = false,
  ): { success: boolean; message: string; trade?: PaperTrade } {
    // 检查是否已持仓
    const existingPosition = account.positions.find(p => p.symbol === signal.symbol);

    // 手动加仓：允许已持仓，按加权平均成本合并
    if (existingPosition && allowExisting) {
      const qty = signal.quantity && signal.quantity > 0 ? signal.quantity : 0;
      if (qty <= 0) {
        return { success: false, message: '加仓数量必须大于0' };
      }
      const amount = qty * signal.price;
      if (amount > account.cash) {
        return { success: false, message: '可用资金不足' };
      }
      account.cash -= amount;
      const totalQty = existingPosition.quantity + qty;
      existingPosition.avgCost =
        Math.round(((existingPosition.avgCost * existingPosition.quantity + amount) / totalQty) * 100) / 100;
      existingPosition.quantity = totalQty;
      existingPosition.currentPrice = signal.price;
      existingPosition.marketValue = totalQty * signal.price;

      const addTrade: PaperTrade = {
        id: `pt_${Date.now()}_${account.trades.length + 1}`,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().split(' ')[0],
        type: 'BUY',
        symbol: signal.symbol,
        name: signal.name,
        price: signal.price,
        quantity: qty,
        amount,
        reason: signal.reason,
        strategyId: signal.strategyId,
      };
      account.trades.push(addTrade);
      this.updateAccountTotal(account);
      this.persistTrade(account, addTrade);
      this.persistAccount(account.id);
      return { success: true, message: `加仓 ${signal.name} ${qty}股`, trade: addTrade };
    }

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
      id: `pt_${Date.now()}_${account.trades.length + 1}`,
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

    this.persistTrade(account, trade);
    this.persistAccount(account.id);

    return { success: true, message: `买入 ${signal.name} ${quantity}股`, trade };
  }

  private executeSell(
    account: PaperAccount,
    signal: { type: 'BUY' | 'SELL'; symbol: string; name: string; price: number; reason: string; strategyId: string; quantity?: number },
  ): { success: boolean; message: string; trade?: PaperTrade } {
    // 查找持仓
    const positionIndex = account.positions.findIndex(p => p.symbol === signal.symbol);
    if (positionIndex === -1) {
      return { success: false, message: `未持仓 ${signal.name}，无法卖出` };
    }

    const position = account.positions[positionIndex];
    // 支持部分卖出：指定数量则卖出对应数量（不超过持仓），未指定则清仓
    const qty =
      signal.quantity && signal.quantity > 0
        ? Math.min(signal.quantity, position.quantity)
        : position.quantity;
    const amount = qty * signal.price;
    const pnl = (signal.price - position.avgCost) * qty;

    account.cash += amount;
    if (qty >= position.quantity) {
      account.positions.splice(positionIndex, 1);
    } else {
      position.quantity -= qty;
      position.marketValue = position.quantity * signal.price;
    }

    // 记录交易
    const trade: PaperTrade = {
      id: `pt_${Date.now()}_${account.trades.length + 1}`,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().split(' ')[0],
      type: 'SELL',
      symbol: signal.symbol,
      name: signal.name,
      price: signal.price,
      quantity: qty,
      amount,
      reason: signal.reason + ` (盈亏: ${pnl > 0 ? '+' : ''}${pnl.toFixed(2)})`,
      strategyId: signal.strategyId,
    };
    account.trades.push(trade);

    this.updateAccountTotal(account);

    this.persistTrade(account, trade);
    this.persistAccount(account.id);

    return {
      success: true,
      message: `卖出 ${signal.name} ${qty}股，${pnl > 0 ? '盈利' : '亏损'} ${Math.abs(pnl).toFixed(2)}`,
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

  // 获取单笔交易记录
  getTrade(id: string, accountId?: string): PaperTrade | null {
    return this.getAccount(accountId).trades.find((t) => t.id === id) ?? null;
  }

  // 获取交易汇总统计
  getTradeSummary(accountId?: string): {
    totalTrades: number;
    buyCount: number;
    sellCount: number;
    totalBuyAmount: number;
    totalSellAmount: number;
    realizedPnl: number;
  } {
    const trades = this.getAccount(accountId).trades;
    let buyCount = 0;
    let sellCount = 0;
    let totalBuyAmount = 0;
    let totalSellAmount = 0;
    let realizedPnl = 0;
    let buyCost = 0; // 加权平均买入成本（简化：用累计买入总成本/累计买入量计算已实现盈亏）
    let buyQty = 0;
    for (const t of trades) {
      if (t.type === 'BUY') {
        buyCount++;
        totalBuyAmount += t.amount;
        buyCost += t.amount;
        buyQty += t.quantity;
      } else {
        sellCount++;
        totalSellAmount += t.amount;
        const avgCost = buyQty > 0 ? buyCost / buyQty : 0;
        realizedPnl += (t.price - avgCost) * t.quantity;
        buyQty -= t.quantity;
        buyCost -= avgCost * t.quantity;
      }
    }
    return {
      totalTrades: trades.length,
      buyCount,
      sellCount,
      totalBuyAmount: Math.round(totalBuyAmount * 100) / 100,
      totalSellAmount: Math.round(totalSellAmount * 100) / 100,
      realizedPnl: Math.round(realizedPnl * 100) / 100,
    };
  }

  // 获取交易记录（支持按股票/类型筛选，时间倒序，分页）
  getTrades(query?: {
    accountId?: string;
    symbol?: string;
    type?: 'BUY' | 'SELL';
    strategyId?: string;
    limit?: number;
    offset?: number;
  }): { list: PaperTrade[]; total: number } {
    const { accountId, symbol, type: typeFilter, strategyId, limit = 50, offset = 0 } = query ?? {};
    const all = this.getAccount(accountId).trades.slice().reverse();
    const filtered = all.filter((t) => {
      if (symbol && t.symbol !== symbol) return false;
      if (typeFilter && t.type !== typeFilter) return false;
      if (strategyId && t.strategyId !== strategyId) return false;
      return true;
    });
    const list = filtered.slice(offset, offset + limit);
    return { list, total: filtered.length };
  }

  // 获取单只持仓详情
  getPosition(symbol: string, accountId?: string): PaperPosition | null {
    return this.getAccount(accountId).positions.find((p) => p.symbol === symbol) ?? null;
  }

  /**
   * 数据一致性对账（reconcile）
   *
   * 背景：用户报告"交易记录跟持仓不匹配"。
   * 历史脏数据：trades 表里有 BUY 记录，但 positions=[], cash=initialCapital（未扣）。
   *
   * 算法：
   * 1) 从持久化加载该账户的所有 trades，按 time 正序排列
   * 2) 按 symbol 分组，对每组做 FIFO + 加权平均：BUY 增加 quantity 和 cost，SELL 减少 quantity
   * 3) 重算 avgCost = 剩余 cost / 剩余 quantity（SELL 不影响剩余持仓的 avgCost）
   * 4) 重建 positions 数组
   * 5) 调整 cash：cash = initialCapital + sum(SELL.amount) - sum(BUY.amount)
   * 6) 持久化账户 + 全量替换持仓
   *
   * @returns { fixed: boolean, changes: string[] } 是否有改动、变更描述
   */
  reconcilePositionsForAccount(accountId?: string): { fixed: boolean; changes: string[] } {
    const id = accountId || this.defaultAccountId;
    const account = this.getAccount(id);
    const persistedTrades = this.persistenceService
      .loadPaperTrades(id)
      .slice()
      .reverse(); // loadPaperTrades 返回 DESC，对账需按时间正序

    if (persistedTrades.length === 0) {
      return { fixed: false, changes: [] };
    }

    // 1) 按 symbol 聚合
    const groups: Record<string, { qty: number; cost: number }> = {};
    for (const t of persistedTrades) {
      if (!groups[t.symbol]) groups[t.symbol] = { qty: 0, cost: 0 };
      if (t.type === 'BUY') {
        groups[t.symbol].qty += t.quantity;
        groups[t.symbol].cost += t.amount;
      } else if (t.type === 'SELL') {
        // 按当前平均成本释放
        const avgCost = groups[t.symbol].qty > 0 ? groups[t.symbol].cost / groups[t.symbol].qty : 0;
        const sellQty = Math.min(t.quantity, groups[t.symbol].qty);
        groups[t.symbol].cost -= avgCost * sellQty;
        groups[t.symbol].qty -= sellQty;
      }
    }

    // 2) 重建 positions（过滤 qty<=0 的）
    const newPositions: PaperPosition[] = [];
    for (const [symbol, g] of Object.entries(groups)) {
      if (g.qty <= 0) continue;
      const tradesForSymbol = persistedTrades.filter(t => t.symbol === symbol);
      const avgCost = Math.round((g.cost / g.qty) * 100) / 100;
      newPositions.push({
        symbol,
        name: tradesForSymbol[tradesForSymbol.length - 1].name,
        quantity: g.qty,
        avgCost,
        currentPrice: avgCost, // 对账无实时价，先用 avgCost 占位
        marketValue: Math.round(g.qty * avgCost * 100) / 100,
        pnl: 0,
        pnlRate: 0,
        openDate: tradesForSymbol[0].time,
      });
    }

    // 3) 重算 cash = initialCapital + sum(SELL.amount) - sum(BUY.amount)
    let totalBuy = 0, totalSell = 0;
    for (const t of persistedTrades) {
      if (t.type === 'BUY') totalBuy += t.amount;
      else if (t.type === 'SELL') totalSell += t.amount;
    }
    const newCash = Math.round((account.initialCapital + totalSell - totalBuy) * 100) / 100;

    // 4) 比较是否真有改动
    const oldPositionsJson = JSON.stringify(account.positions.map(p => ({ symbol: p.symbol, quantity: p.quantity, avgCost: p.avgCost })));
    const newPositionsJson = JSON.stringify(newPositions.map(p => ({ symbol: p.symbol, quantity: p.quantity, avgCost: p.avgCost })));
    const cashChanged = Math.abs(account.cash - newCash) > 0.01;
    const positionsChanged = oldPositionsJson !== newPositionsJson;
    if (!cashChanged && !positionsChanged) {
      return { fixed: false, changes: [] };
    }

    // 5) 写回
    account.positions = newPositions;
    account.cash = newCash;
    this.updateAccountTotal(account);

    // 6) 持久化：先清空旧持仓再写新持仓
    for (const oldPos of this.persistenceService.loadPaperPositions(id)) {
      this.persistenceService.deletePaperPosition(id, oldPos.symbol);
    }
    this.persistAccount(id);

    const changes: string[] = [];
    if (positionsChanged) {
      changes.push(`positions 重建：${newPositions.length} 条`);
    }
    if (cashChanged) {
      changes.push(`cash 调整：${account.cash}（原 ${account.cash + (totalBuy - totalSell)}）`);
    }
    return { fixed: true, changes };
  }

  // 手动买入
  manualBuy(
    symbol: string,
    name: string,
    price: number,
    quantity: number,
    reason = '手动买入',
    accountId?: string,
  ): { success: boolean; message: string; trade?: PaperTrade } {
    if (quantity <= 0 || !Number.isFinite(quantity)) {
      return { success: false, message: '数量必须大于0' };
    }
    if (price <= 0 || !Number.isFinite(price)) {
      return { success: false, message: '价格必须大于0' };
    }
    const account = this.getAccount(accountId);
    return this.executeBuy(account, {
      type: 'BUY',
      symbol,
      name,
      price,
      reason,
      strategyId: 'manual',
      quantity,
    }, true);
  }

  // 手动卖出（可指定数量，默认全仓）
  manualSell(
    symbol: string,
    price: number,
    quantity?: number,
    reason = '手动卖出',
    accountId?: string,
  ): { success: boolean; message: string; trade?: PaperTrade } {
    if (price <= 0 || !Number.isFinite(price)) {
      return { success: false, message: '价格必须大于0' };
    }
    const account = this.getAccount(accountId);
    const pos = account.positions.find((p) => p.symbol === symbol);
    if (!pos) {
      return { success: false, message: '无该持仓' };
    }
    const qty = quantity && quantity > 0 ? Math.min(quantity, pos.quantity) : pos.quantity;
    if (qty <= 0) {
      return { success: false, message: '卖出数量无效' };
    }
    return this.executeSell(account, {
      type: 'SELL',
      symbol,
      name: pos.name,
      price,
      reason,
      strategyId: 'manual',
      quantity: qty,
    });
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
