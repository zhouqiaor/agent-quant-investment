import { Injectable, Logger } from '@nestjs/common';
import { StockService, KlineData } from '../stock/stock.service';
import { WatchlistService } from '../stock/watchlist.service';
import { PaperTradingService, PaperTrade } from '../paper-trading/paper-trading.service';
import { StrategyService, MonitorSignal } from '../strategy/strategy.service';

export interface PortfolioBacktestParams {
  initialCapital: number;
  symbols?: string[];       // 指定标的列表；为空则取关注列表 enabled 项
  startDate: string;        // YYYY-MM-DD
  endDate: string;          // YYYY-MM-DD
  autoTrade?: boolean;      // 默认 true
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

    // 3) 构建交易日序列（取所有标的日期的并集）
    const tradingDays = this.buildTradingadingDays(klineMap);
    if (tradingDays.length === 0) {
      throw new Error('指定日期范围内无交易数据');
    }

    // 4) 创建隔离账户
    const accountId = `backtest_${Date.now()}`;
    this.paperTrading.resetAccount(accountId, initialCapital);
    this.paperTrading.startTrading(accountId);

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

      // 自动交易
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

    // 7) 清理隔离账户（可选，保留供前端查询）
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

    // 计算需要的数据长度（日历日差 + 缓冲）
    const start = new Date(startDate);
    const end = new Date(endDate);
    const calendarDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    // 交易日约为日历日的 70%，加上 30 天缓冲
    const datalen = Math.min(250, Math.ceil(calendarDays * 0.7) + 30);

    // 并行拉取所有标的K线
    const promises = symbols.map(async (symbol) => {
      try {
        const klines = await this.stockService.getKlineData(symbol, 'daily', datalen);
        // 按日期范围过滤
        const filtered = klines.filter(k => k.date >= startDate && k.date <= endDate);
        if (filtered.length > 0) {
          klineMap.set(symbol, filtered);
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
  private buildTradingadingDays(klineMap: Map<string, KlineData[]>): string[] {
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
