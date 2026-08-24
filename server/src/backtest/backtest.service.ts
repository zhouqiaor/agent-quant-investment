import { Injectable } from '@nestjs/common';
import { StrategyService } from '../strategy/strategy.service';
import { MarketService } from '../market/market.service';

interface BacktestRequest {
  strategyId?: string;
  symbol: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  initialCapital: number;
  indicators?: string[];
  buyConditions?: any[];
  sellConditions?: any[];
}

interface TradeRecord {
  date: string;
  type: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  amount: number;
  reason: string;
}

export interface BacktestResult {
  // 基本信息
  symbol: string;
  startDate: string;
  endDate: string;
  tradingDays: number;
  initialCapital: number;
  finalCapital: number;

  // 收益指标
  totalReturn: number;      // 总收益率 %
  annualizedReturn: number; // 年化收益率 %
  benchmarkReturn: number;  // 基准收益率（买入持有）%

  // 风险指标
  maxDrawdown: number;      // 最大回撤 %
  volatility: number;       // 波动率 %
  sharpeRatio: number;      // 夏普比率
  sortinoRatio: number;     // 索提诺比率

  // 交易统计
  totalTrades: number;
  winTrades: number;
  loseTrades: number;
  winRate: number;          // 胜率 %
  profitFactor: number;     // 盈亏比
  avgWin: number;           // 平均盈利 %
  avgLoss: number;          // 平均亏损 %

  // 时间序列
  equityCurve: { date: string; value: number; drawdown: number }[];
  trades: TradeRecord[];

  // 策略信息
  strategyName: string;
  indicators: string[];
}

@Injectable()
export class BacktestService {
  constructor(
    private readonly strategyService: StrategyService,
    private readonly marketService: MarketService,
  ) {}

  async runBacktest(request: BacktestRequest): Promise<BacktestResult> {
    const {
      strategyId,
      symbol,
      startDate,
      endDate,
      initialCapital,
      indicators = ['MA', 'MACD'],
      buyConditions = [],
      sellConditions = [],
    } = request;

    // 获取策略信息
    let strategyName = '自定义策略';
    if (strategyId) {
      const strategies = this.strategyService.getStrategies();
      const strategy = strategies.find(s => s.id === strategyId);
      if (strategy) {
        strategyName = strategy.name;
      }
    }

    // 生成历史K线数据（模拟）
    const klineData = this.generateHistoricalKline(symbol, startDate, endDate);

    // 执行回测
    const { trades, equityCurve } = this.executeBacktest(
      klineData,
      initialCapital,
      indicators,
      buyConditions,
      sellConditions,
    );

    // 计算回测指标
    const metrics = this.calculateMetrics(equityCurve, trades, initialCapital, klineData);

    return {
      symbol,
      startDate,
      endDate,
      tradingDays: klineData.length,
      initialCapital,
      finalCapital: equityCurve[equityCurve.length - 1]?.value || initialCapital,
      ...metrics,
      equityCurve,
      trades,
      strategyName,
      indicators,
    };
  }

  private generateHistoricalKline(
    symbol: string,
    startDate: string,
    endDate: string,
  ): { date: string; open: number; high: number; low: number; close: number; volume: number }[] {
    const kline: any[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    // 根据股票代码生成不同的初始价格
    const basePrices: Record<string, number> = {
      '600519': 1800, // 贵州茅台
      '300750': 200,  // 宁德时代
      '002594': 250,  // 比亚迪
      '601318': 50,   // 中国平安
      '000858': 150,  // 五粮液
      '600036': 35,   // 招商银行
      '000333': 60,   // 美的集团
      '600276': 45,   // 恒瑞医药
      '601888': 8,    // 中国中免
      '002475': 35,   // 立讯精密
      '600900': 25,   // 长江电力
      '601012': 30,   // 隆基绿能
    };

    let price = basePrices[symbol] || 100;
    const currentDate = new Date(start);

    // 使用确定性随机种子（基于股票代码）
    let seed = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const random = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    while (currentDate <= end) {
      // 跳过周末
      if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
        const change = (random() - 0.48) * 0.04; // 略微向上的趋势
        const open = price;
        const close = price * (1 + change);
        const high = Math.max(open, close) * (1 + random() * 0.02);
        const low = Math.min(open, close) * (1 - random() * 0.02);
        const volume = Math.floor(50000 + random() * 100000);

        kline.push({
          date: currentDate.toISOString().split('T')[0],
          open: Math.round(open * 100) / 100,
          high: Math.round(high * 100) / 100,
          low: Math.round(low * 100) / 100,
          close: Math.round(close * 100) / 100,
          volume,
        });

        price = close;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return kline;
  }

  private executeBacktest(
    klineData: any[],
    initialCapital: number,
    indicators: string[],
    buyConditions: any[],
    sellConditions: any[],
  ): { trades: TradeRecord[]; equityCurve: { date: string; value: number; drawdown: number }[] } {
    const trades: TradeRecord[] = [];
    const equityCurve: { date: string; value: number; drawdown: number }[] = [];

    let cash = initialCapital;
    let position = 0; // 持仓数量
    let avgCost = 0;  // 平均成本
    let peakValue = initialCapital;

    // 计算技术指标
    const ma5 = this.calculateMA(klineData.map(k => k.close), 5);
    const ma20 = this.calculateMA(klineData.map(k => k.close), 20);
    const macd = this.calculateMACD(klineData.map(k => k.close));
    const rsi = this.calculateRSI(klineData.map(k => k.close), 14);

    for (let i = 20; i < klineData.length; i++) {
      const today = klineData[i];
      const yesterday = klineData[i - 1];

      // 生成买入/卖出信号
      const buySignal = this.generateBuySignal(
        i, today, yesterday, ma5, ma20, macd, rsi, indicators, buyConditions,
      );
      const sellSignal = this.generateSellSignal(
        i, today, yesterday, ma5, ma20, macd, rsi, indicators, sellConditions, position, avgCost,
      );

      // 执行交易
      if (buySignal && position === 0) {
        // 买入：使用80%资金
        const buyAmount = cash * 0.8;
        const quantity = Math.floor(buyAmount / today.close / 100) * 100; // A股100股整数倍
        if (quantity > 0) {
          const cost = quantity * today.close;
          cash -= cost;
          position = quantity;
          avgCost = today.close;
          trades.push({
            date: today.date,
            type: 'BUY',
            price: today.close,
            quantity,
            amount: cost,
            reason: buySignal,
          });
        }
      } else if (sellSignal && position > 0) {
        // 卖出：全部卖出
        const revenue = position * today.close;
        const profit = revenue - position * avgCost;
        cash += revenue;
        trades.push({
          date: today.date,
          type: 'SELL',
          price: today.close,
          quantity: position,
          amount: revenue,
          reason: sellSignal,
        });
        position = 0;
        avgCost = 0;
      }

      // 计算当日总资产
      const totalValue = cash + position * today.close;
      peakValue = Math.max(peakValue, totalValue);
      const drawdown = ((peakValue - totalValue) / peakValue) * 100;

      equityCurve.push({
        date: today.date,
        value: Math.round(totalValue * 100) / 100,
        drawdown: Math.round(drawdown * 100) / 100,
      });
    }

    return { trades, equityCurve };
  }

  private generateBuySignal(
    i: number,
    today: any,
    yesterday: any,
    ma5: number[],
    ma20: number[],
    macd: { dif: number; dea: number; macd: number }[],
    rsi: number[],
    indicators: string[],
    conditions: any[],
  ): string | null {
    const signals: string[] = [];

    // MA金叉
    if (indicators.includes('MA') && ma5[i] > ma20[i] && ma5[i - 1] <= ma20[i - 1]) {
      signals.push('MA金叉');
    }

    // MACD金叉
    if (indicators.includes('MACD') && macd[i].dif > macd[i].dea && macd[i - 1].dif <= macd[i - 1].dea) {
      signals.push('MACD金叉');
    }

    // RSI超卖反弹
    if (indicators.includes('RSI') && rsi[i] > 30 && rsi[i - 1] <= 30) {
      signals.push('RSI超卖反弹');
    }

    // 自定义条件
    for (const condition of conditions) {
      if (condition.indicator === 'MA' && condition.operator === 'cross_above') {
        if (ma5[i] > ma20[i] && ma5[i - 1] <= ma20[i - 1]) {
          signals.push('自定义:MA金叉');
        }
      }
    }

    return signals.length > 0 ? signals.join('+') : null;
  }

  private generateSellSignal(
    i: number,
    today: any,
    yesterday: any,
    ma5: number[],
    ma20: number[],
    macd: { dif: number; dea: number; macd: number }[],
    rsi: number[],
    indicators: string[],
    conditions: any[],
    position: number,
    avgCost: number,
  ): string | null {
    const signals: string[] = [];

    // MA死叉
    if (indicators.includes('MA') && ma5[i] < ma20[i] && ma5[i - 1] >= ma20[i - 1]) {
      signals.push('MA死叉');
    }

    // MACD死叉
    if (indicators.includes('MACD') && macd[i].dif < macd[i].dea && macd[i - 1].dif >= macd[i - 1].dea) {
      signals.push('MACD死叉');
    }

    // RSI超买
    if (indicators.includes('RSI') && rsi[i] < 70 && rsi[i - 1] >= 70) {
      signals.push('RSI超买');
    }

    // 止损
    if (position > 0 && avgCost > 0 && today.close < avgCost * 0.95) {
      signals.push('止损5%');
    }

    // 止盈
    if (position > 0 && avgCost > 0 && today.close > avgCost * 1.15) {
      signals.push('止盈15%');
    }

    return signals.length > 0 ? signals.join('+') : null;
  }

  private calculateMA(prices: number[], period: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        result.push(0);
      } else {
        const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        result.push(sum / period);
      }
    }
    return result;
  }

  private calculateMACD(prices: number[], fast = 12, slow = 26, signal = 9) {
    const emaFast = this.calculateEMA(prices, fast);
    const emaSlow = this.calculateEMA(prices, slow);

    const dif: number[] = [];
    for (let i = 0; i < prices.length; i++) {
      dif.push(emaFast[i] - emaSlow[i]);
    }

    const dea = this.calculateEMA(dif, signal);

    const result: { dif: number; dea: number; macd: number }[] = [];
    for (let i = 0; i < prices.length; i++) {
      result.push({
        dif: dif[i],
        dea: dea[i],
        macd: (dif[i] - dea[i]) * 2,
      });
    }
    return result;
  }

  private calculateEMA(prices: number[], period: number): number[] {
    const result: number[] = [];
    const multiplier = 2 / (period + 1);

    for (let i = 0; i < prices.length; i++) {
      if (i === 0) {
        result.push(prices[0]);
      } else {
        result.push((prices[i] - result[i - 1]) * multiplier + result[i - 1]);
      }
    }
    return result;
  }

  private calculateRSI(prices: number[], period: number): number[] {
    const result: number[] = [];
    const gains: number[] = [];
    const losses: number[] = [];

    for (let i = 0; i < prices.length; i++) {
      if (i === 0) {
        result.push(50);
        gains.push(0);
        losses.push(0);
      } else {
        const change = prices[i] - prices[i - 1];
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? -change : 0;

        gains.push(gain);
        losses.push(loss);

        if (i < period) {
          result.push(50);
        } else {
          const avgGain = gains.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
          const avgLoss = losses.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
          const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
          result.push(100 - 100 / (1 + rs));
        }
      }
    }
    return result;
  }

  private calculateMetrics(
    equityCurve: { date: string; value: number; drawdown: number }[],
    trades: TradeRecord[],
    initialCapital: number,
    klineData: any[],
  ) {
    const finalValue = equityCurve[equityCurve.length - 1]?.value || initialCapital;
    const totalReturn = ((finalValue - initialCapital) / initialCapital) * 100;

    // 年化收益率
    const days = equityCurve.length;
    const years = days / 252;
    const annualizedReturn = years > 0 ? (Math.pow(finalValue / initialCapital, 1 / years) - 1) * 100 : 0;

    // 基准收益率（买入持有）
    const benchmarkReturn = klineData.length > 0
      ? ((klineData[klineData.length - 1].close - klineData[0].close) / klineData[0].close) * 100
      : 0;

    // 最大回撤
    const maxDrawdown = Math.max(...equityCurve.map(e => e.drawdown));

    // 波动率（日收益率标准差 * sqrt(252)）
    const dailyReturns: number[] = [];
    for (let i = 1; i < equityCurve.length; i++) {
      const ret = (equityCurve[i].value - equityCurve[i - 1].value) / equityCurve[i - 1].value;
      dailyReturns.push(ret);
    }
    const avgReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / dailyReturns.length;
    const volatility = Math.sqrt(variance) * Math.sqrt(252) * 100;

    // 夏普比率（假设无风险利率3%）
    const riskFreeRate = 0.03;
    const excessReturn = annualizedReturn / 100 - riskFreeRate;
    const sharpeRatio = volatility > 0 ? excessReturn / (volatility / 100) : 0;

    // 索提诺比率（只考虑下行波动）
    const downsideReturns = dailyReturns.filter(r => r < 0);
    const downsideVariance = downsideReturns.reduce((sum, ret) => sum + Math.pow(ret, 2), 0) / (downsideReturns.length || 1);
    const downsideDeviation = Math.sqrt(downsideVariance) * Math.sqrt(252);
    const sortinoRatio = downsideDeviation > 0 ? excessReturn / downsideDeviation : 0;

    // 交易统计
    const sellTrades = trades.filter(t => t.type === 'SELL');
    const winTrades: number[] = [];
    const loseTrades: number[] = [];

    for (let i = 0; i < trades.length - 1; i += 2) {
      const buyTrade = trades[i];
      const sellTrade = trades[i + 1];
      if (buyTrade && sellTrade && buyTrade.type === 'BUY' && sellTrade.type === 'SELL') {
        const profit = (sellTrade.price - buyTrade.price) / buyTrade.price * 100;
        if (profit > 0) {
          winTrades.push(profit);
        } else {
          loseTrades.push(profit);
        }
      }
    }

    const totalTrades = sellTrades.length;
    const winCount = winTrades.length;
    const loseCount = loseTrades.length;
    const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;

    const avgWin = winTrades.length > 0 ? winTrades.reduce((a, b) => a + b, 0) / winTrades.length : 0;
    const avgLoss = loseTrades.length > 0 ? Math.abs(loseTrades.reduce((a, b) => a + b, 0) / loseTrades.length) : 0;
    const profitFactor = avgLoss > 0 ? (avgWin * winCount) / (avgLoss * loseCount) : winCount > 0 ? 999 : 0;

    return {
      totalReturn: Math.round(totalReturn * 100) / 100,
      annualizedReturn: Math.round(annualizedReturn * 100) / 100,
      benchmarkReturn: Math.round(benchmarkReturn * 100) / 100,
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      volatility: Math.round(volatility * 100) / 100,
      sharpeRatio: Math.round(sharpeRatio * 100) / 100,
      sortinoRatio: Math.round(sortinoRatio * 100) / 100,
      totalTrades,
      winTrades: winCount,
      loseTrades: loseCount,
      winRate: Math.round(winRate * 100) / 100,
      profitFactor: Math.round(profitFactor * 100) / 100,
      avgWin: Math.round(avgWin * 100) / 100,
      avgLoss: Math.round(avgLoss * 100) / 100,
    };
  }
}
