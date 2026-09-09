import { Injectable, Logger } from '@nestjs/common';
import { StockService } from '../stock/stock.service';
import { WatchlistService } from '../stock/watchlist.service';
import { PaperTradingService, PaperTrade } from '../paper-trading/paper-trading.service';
import { StrategyService, MonitorSignal } from '../strategy/strategy.service';
import { HistoryKlineService, KlineData } from '../stock/history-kline.service';

export interface PortfolioBacktestParams {
  initialCapital: number;
  symbols?: string[];       // 指定标的列表；为空则取关注列表 enabled 项
  startDate: string;        // YYYY-MM-DD
  endDate: string;          // YYYY-MM-DD
  autoTrade?: boolean;      // 默认 true
  /**
   * 目标账户ID：
   * - 不传 / 传 "default"：使用默认 live 账户（回测结果直接在"我的"可见）
   * - 传 "new"：创建新回测账户（独立运行，结果在"我的"单独显示）
   * - 传具体账户ID：使用/创建该 ID 的回测账户
   */
  targetAccountId?: string;
  /**
   * 账户名（当 targetAccountId=new 时使用）
   */
  accountName?: string;
}

export interface EquityPoint {
  date: string;
  value: number;
  cash: number;
  marketValue: number;
}

export interface PortfolioBacktestMetrics {
  totalReturn: number;
  annualizedReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  profitFactor: number;
  tradeCount: number;
  tradingDays: number;
}

export interface PortfolioBacktestResult {
  equityCurve: EquityPoint[];
  trades: PaperTrade[];
  metrics: PortfolioBacktestMetrics;
  meta: {
    realKline: boolean;
    dataSource: string;
    symbols: string[];
    dateRange: { start: string; end: string };
    initialCapital: number;
    finalValue: number;
    accountId: string; // 新增：回测产生的账户ID
    accountType: 'live' | 'backtest'; // 新增：账户类型
  };
}

/**
 * 全局组合回测引擎（方案B 共享资金池账户回放）
 *
 * 复用现有模拟盘引擎（PaperTradingService + StrategyService.checkMonitorSignals），
 * 用真实历史K线替代实时行情，对关注列表全部股票 + 共享资金池做历史回放。
 *
 * 隔离性：使用独立 accountId（backtest_<ts>），不污染 live 'default' 账户。
 */
@Injectable()
export class PortfolioBacktestService {
  private readonly logger = new Logger(PortfolioBacktestService.name);

  constructor(
    private readonly stockService: StockService,
    private readonly watchlistService: WatchlistService,
    private readonly paperTrading: PaperTradingService,
    private readonly strategyService: StrategyService,
    private readonly historyKlineService: HistoryKlineService,
  ) {}

  /**
   * 运行全局组合回测
   */
  async runPortfolioBacktest(params: PortfolioBacktestParams): Promise<PortfolioBacktestResult> {
    const { startDate, endDate, initialCapital, autoTrade = true } = params;

    // 1) 确定标的列表
    const symbols = params.symbols?.length
      ? params.symbols
      : this.watchlistService.listWatch().filter(w => w.enabled).map(w => w.symbol);

    if (symbols.length === 0) {
      throw new Error('无可用标的：请先在关注列表中添加并开启股票');
    }

    // 2) 批量拉取真实历史K线
    const klineMap = await this.fetchAllKlines(symbols, startDate, endDate);

    const tradingDays = this.buildTradingDays(klineMap);
    if (tradingDays.length === 0) {
      throw new Error('指定日期范围内无交易数据');
    }

    // 4) 解析目标账户ID
    // - 不传 → 向后兼容：每次创建新账户（避免污染默认账户）
    // - "default" → 默认账户（不清空，保护用户数据）
    // - "new" → 创建新回测账户
    // - 其他 → 使用/创建该 ID 的回测账户
    const targetInput = params.targetAccountId;
    let accountId: string;
    let accountType: 'live' | 'backtest';
    let isFreshAccount = false;

    if (!targetInput) {
      // 向后兼容：保持旧行为（每次新建隔离账户）
      accountId = `backtest_${Date.now()}`;
      accountType = 'backtest';
      isFreshAccount = true;
    } else if (targetInput === 'default') {
      accountId = 'default';
      accountType = 'live';
      // 不重置，保护用户已有数据
    } else if (targetInput === 'new') {
      accountId = `backtest_${Date.now()}`;
      accountType = 'backtest';
      isFreshAccount = true;
    } else {
      accountId = targetInput;
      accountType = 'backtest';
      const existing = this.paperTrading['accounts']?.get?.(accountId);
      isFreshAccount = !existing;
    }

    // 准备账户
    if (isFreshAccount) {
      this.paperTrading.ensureAccount(accountId, {
        name: params.accountName || `回测账户 ${new Date().toLocaleString('zh-CN')}`,
        type: accountType,
        initialCapital,
        meta: {
          backtestRunId: accountId,
          startDate: tradingDays[0],
          endDate: tradingDays[tradingDays.length - 1],
          symbols,
          strategyId: 'default',
        },
      });
      this.paperTrading.resetAccount(accountId, initialCapital);
    }
    this.paperTrading.startTrading(accountId);

    // 4.5) 为每个标的确保有策略（没有则创建临时默认策略）
    const tempStrategyIds: string[] = [];
    for (const symbol of symbols) {
      const existingStrategy = this.strategyService.getCustomStrategies().find(s => s.symbol === symbol && s.monitorEnabled && s.status === 'running');
      if (!existingStrategy) {
        // 创建临时默认策略：跌 2% 买入，涨 2% 卖出
        const tempStrategy = this.strategyService.createCustomStrategy({
          name: `回测默认-${symbol}`,
          symbol,
          monitorEnabled: true,
          status: 'running',
          autoTrade: true,
          buyConditions: [{ id: `bt_buy_${symbol}`, indicator: 'changePercent', operator: 'below', value: -2, description: '跌2%买入' }],
          sellConditions: [{ id: `bt_sell_${symbol}`, indicator: 'changePercent', operator: 'above', value: 2, description: '涨2%卖出' }],
        });
        tempStrategyIds.push(tempStrategy.id);
      }
    }

    // 5) 逐日回放
    const equityCurve: EquityPoint[] = [];
    let totalSignals = 0;
    let totalExecuted = 0;

    for (const date of tradingDays) {
      // 构建当日 marketData
      const marketData: Array<{ symbol: string; price: number; changePercent: number }> = [];
      const prices: Record<string, number> = {};

      for (const symbol of symbols) {
        const klines = klineMap.get(symbol);
        if (!klines) continue;

        const todayK = klines.find(k => k.date === date);
        if (!todayK) continue;

        // 计算涨跌幅：当日close vs 前日close
        const idx = klines.indexOf(todayK);
        const prevClose = idx > 0 ? klines[idx - 1].close : todayK.open;
        const changePercent = prevClose > 0 ? ((todayK.close - prevClose) / prevClose) * 100 : 0;

        marketData.push({
          symbol,
          price: todayK.close,
          changePercent: Math.round(changePercent * 100) / 100,
        });
        prices[symbol] = todayK.close;
      }

      // 持仓重估
      this.paperTrading.markPrices(prices, accountId);

      // 策略信号（确定性求值）
      const signals: MonitorSignal[] = this.strategyService.checkMonitorSignals(marketData);
      totalSignals += signals.length;
      if (autoTrade) {
        for (const signal of signals) {
          const result = this.paperTrading.executeSignal(
            {
              type: signal.type === 'buy' ? 'BUY' : 'SELL',
              symbol: signal.symbol,
              name: signal.strategyName,
              price: signal.price,
              reason: signal.reason,
              strategyId: signal.strategyId,
            },
            accountId,
          );
          if (result.success) totalExecuted += 1;
        }
      }

      // 记录净值
      const account = this.paperTrading.getAccount(accountId);
      equityCurve.push({
        date,
        value: account.totalValue,
        cash: account.cash,
        marketValue: account.totalValue - account.cash,
      });
    }

    // 6) 计算指标
    const account = this.paperTrading.getAccount(accountId);
    const metrics = this.calculateMetrics(equityCurve, account.trades, initialCapital);

    // 7) 清理临时策略
    for (const strategyId of tempStrategyIds) {
      this.strategyService.deleteCustomStrategy(strategyId);
    }

    // 8) 清理隔离账户（可选，保留供前端查询）
    // this.paperTrading.removeAccount(accountId);

    this.logger.log(
      `[PortfolioBacktest] ${symbols.length}只标的, ${tradingDays.length}个交易日, ` +
      `${totalSignals}个信号, ${totalExecuted}笔成交, ` +
      `收益 ${(metrics.totalReturn * 100).toFixed(2)}%`
    );

    return {
      equityCurve,
      trades: account.trades,
      metrics,
      meta: {
        realKline: true,
        dataSource: '新浪财经日K（CN_MarketDataService.getKLineData）',
        symbols,
        dateRange: { start: tradingDays[0], end: tradingDays[tradingDays.length - 1] },
        initialCapital,
        finalValue: account.totalValue,
        accountId, // 新增：回测产生的账户ID
        accountType, // 新增：账户类型
      },
    };
  }

  /**
   * 批量拉取真实历史K线
   */
  private async fetchAllKlines(
    symbols: string[],
    startDate: string,
    endDate: string,
  ): Promise<Map<string, KlineData[]>> {
    const klineMap = new Map<string, KlineData[]>();

    // 并行拉取所有标的真实历史K线（与单股回测走同一通道：腾讯主源 + 新浪降级 + 缓存）
    const promises = symbols.map(async (symbol) => {
      try {
        const klines = await this.historyKlineService.fetchRealKline(symbol, startDate, endDate);
        if (klines.length > 0) {
          klineMap.set(symbol, klines);
        }
      } catch (error) {
        this.logger.warn(`Failed to fetch kline for ${symbol}: ${error.message}`);
      }
    });

    await Promise.all(promises);
    return klineMap;
  }

  /**
   * 构建交易日序列（所有标的日期的并集，升序）
   */
  private buildTradingDays(klineMap: Map<string, KlineData[]>): string[] {
    const dateSet = new Set<string>();
    for (const klines of klineMap.values()) {
      for (const k of klines) {
        dateSet.add(k.date);
      }
    }
    return Array.from(dateSet).sort();
  }

  /**
   * 计算回测指标
   */
  private calculateMetrics(
    equityCurve: EquityPoint[],
    trades: PaperTrade[],
    initialCapital: number,
  ): PortfolioBacktestMetrics {
    if (equityCurve.length === 0) {
      return {
        totalReturn: 0,
        annualizedReturn: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
        winRate: 0,
        profitFactor: 0,
        tradeCount: 0,
        tradingDays: 0,
      };
    }

    const finalValue = equityCurve[equityCurve.length - 1].value;
    const totalReturn = (finalValue - initialCapital) / initialCapital;

    // 年化收益（按交易日 250 天/年）
    const tradingDays = equityCurve.length;
    const years = tradingDays / 250;
    const annualizedReturn = years > 0 ? Math.pow(1 + totalReturn, 1 / years) - 1 : 0;

    // 最大回撤
    let maxDrawdown = 0;
    let peak = equityCurve[0].value;
    for (const point of equityCurve) {
      if (point.value > peak) peak = point.value;
      const drawdown = (peak - point.value) / peak;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    // 日收益率序列（计算 Sharpe）
    const dailyReturns: number[] = [];
    for (let i = 1; i < equityCurve.length; i++) {
      const prev = equityCurve[i - 1].value;
      const curr = equityCurve[i].value;
      if (prev > 0) {
        dailyReturns.push((curr - prev) / prev);
      }
    }

    // Sharpe Ratio（无风险利率 3%）
    const riskFreeDaily = 0.03 / 250;
    let sharpeRatio = 0;
    if (dailyReturns.length > 1) {
      const avgReturn = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
      const variance = dailyReturns.reduce((s, r) => s + Math.pow(r - avgReturn, 2), 0) / (dailyReturns.length - 1);
      const stdDev = Math.sqrt(variance);
      if (stdDev > 0) {
        sharpeRatio = ((avgReturn - riskFreeDaily) / stdDev) * Math.sqrt(250);
      }
    }

    // 胜率 & 盈亏比（按卖出交易计算）
    const sellTrades = trades.filter(t => t.type === 'SELL');
    let winCount = 0;
    let grossProfit = 0;
    let grossLoss = 0;

    // 用 FIFO 匹配买卖
    const buyQueue: PaperTrade[] = [];
    for (const trade of trades) {
      if (trade.type === 'BUY') {
        buyQueue.push(trade);
      } else {
        // 匹配买入计算盈亏
        let remaining = trade.quantity;
        while (remaining > 0 && buyQueue.length > 0) {
          const buy = buyQueue[0];
          const qty = Math.min(remaining, buy.quantity);
          const pnl = (trade.price - buy.price) * qty;
          if (pnl > 0) {
            winCount += 1;
            grossProfit += pnl;
          } else if (pnl < 0) {
            grossLoss += Math.abs(pnl);
          }
          remaining -= qty;
          buy.quantity -= qty;
          if (buy.quantity <= 0) buyQueue.shift();
        }
      }
    }

    const totalSellPairs = winCount + (sellTrades.length - winCount); // 近似
    const winRate = totalSellPairs > 0 ? winCount / totalSellPairs : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    return {
      totalReturn: Math.round(totalReturn * 10000) / 10000,
      annualizedReturn: Math.round(annualizedReturn * 10000) / 10000,
      maxDrawdown: Math.round(maxDrawdown * 10000) / 10000,
      sharpeRatio: Math.round(sharpeRatio * 100) / 100,
      winRate: Math.round(winRate * 10000) / 10000,
      profitFactor: Math.round(profitFactor * 100) / 100,
      tradeCount: trades.length,
      tradingDays,
    };
  }
}
