import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { BacktestService } from '../backtest/backtest.service';
import { PersistenceService } from '../persistence/persistence.service';
import { StrategyService } from '../strategy/strategy.service';

export interface ABTestConfig {
  v1StrategyId: string;
  v2StrategyId: string;
  symbols: string[];
  startDate: string; // YYYY-MM-DD
  endDate: string;
  initialCapital: number;
}

interface SideResult {
  strategyId: string;
  strategyName: string;
  finalCapital: number;
  totalReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  totalTrades: number;
  equityCurve: Array<{ ts: number; equity: number }>;
}

export interface ABTestSummary {
  winner: 'v1' | 'v2' | 'tie';
  v1Metrics: Omit<SideResult, 'equityCurve'>;
  v2Metrics: Omit<SideResult, 'equityCurve'>;
  delta: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
  };
  significance: { note: string; sufficient: boolean };
}

export interface ABExperimentResult {
  id: string;
  summary: ABTestSummary;
  v1: SideResult;
  v2: SideResult;
}

@Injectable()
export class ABTestRunnerService {
  private readonly logger = new Logger(ABTestRunnerService.name);

  constructor(
    private readonly backtestService: BacktestService,
    private readonly persistence: PersistenceService,
    private readonly strategyService: StrategyService,
  ) {}

  async runExperiment(config: ABTestConfig): Promise<ABExperimentResult> {
    const { v1StrategyId, v2StrategyId, symbols, startDate, endDate, initialCapital } = config;
    if (!Array.isArray(symbols) || symbols.length === 0) {
      throw new BadRequestException('symbols 不能为空');
    }
    const v1 = this.strategyService.getCustomStrategy(v1StrategyId);
    const v2 = this.strategyService.getCustomStrategy(v2StrategyId);
    if (!v1) throw new BadRequestException(`v1 策略不存在: ${v1StrategyId}`);
    if (!v2) throw new BadRequestException(`v2 策略不存在: ${v2StrategyId}`);
    if (v1.symbol && symbols.length === 1 && !symbols.includes(v1.symbol)) {
      this.logger.warn(`v1 策略绑定 symbol=${v1.symbol}，但实验未包含该 symbol，将忽略绑定`);
    }

    // 创建实验记录（status=running）
    const experimentId = this.persistence.saveAbExperiment({
      v1StrategyId,
      v2StrategyId,
      symbols,
      startAt: new Date(startDate).getTime(),
      endAt: new Date(endDate).getTime(),
      initialCapital,
      status: 'running',
      createdAt: Date.now(),
    });

    const v1Result = await this.runSide(v1StrategyId, symbols, startDate, endDate, initialCapital);
    const v2Result = await this.runSide(v2StrategyId, symbols, startDate, endDate, initialCapital);
    const summary = this.compare(v1Result, v2Result);

    // 持久化净值点
    const points: Array<{ experimentId: string; side: 'v1' | 'v2'; ts: number; equity: number }> = [];
    for (const p of v1Result.equityCurve) points.push({ experimentId, side: 'v1', ts: p.ts, equity: p.equity });
    for (const p of v2Result.equityCurve) points.push({ experimentId, side: 'v2', ts: p.ts, equity: p.equity });
    this.persistence.saveAbEquityPoints(points);

    // 更新实验状态
    this.persistence.saveAbExperiment({
      id: experimentId,
      v1StrategyId,
      v2StrategyId,
      symbols,
      startAt: new Date(startDate).getTime(),
      endAt: new Date(endDate).getTime(),
      initialCapital,
      status: 'finished',
      summaryMetrics: summary,
      v1AccountId: null,
      v2AccountId: null,
      createdAt: undefined,
      finishedAt: Date.now(),
    });

    this.logger.log(`AB experiment ${experimentId} done: winner=${summary.winner}`);
    return { id: experimentId, summary, v1: v1Result, v2: v2Result };
  }

  private async runSide(
    strategyId: string,
    symbols: string[],
    startDate: string,
    endDate: string,
    initialCapital: number,
  ): Promise<SideResult> {
    const strategy = this.strategyService.getCustomStrategy(strategyId)!;
    // 多标的累加：每标的独立跑回测，equityCurve 按时间对齐相加
    const perSymbol = await Promise.all(
      symbols.map((sym) =>
        this.backtestService.runBacktest({
          strategyId,
          symbol: sym,
          startDate,
          endDate,
          initialCapital: initialCapital / symbols.length,
          indicators: strategy.indicators?.map((i: any) => i.id || i.name || i).filter(Boolean) as any,
          buyConditions: strategy.buyConditions as any,
          sellConditions: strategy.sellConditions as any,
        }),
      ),
    );

    // 合并 equityCurve：以日期为 key，equity 相加
    const dateMap = new Map<string, number>();
    for (const r of perSymbol) {
      for (const p of r.equityCurve) {
        dateMap.set(p.date, (dateMap.get(p.date) || 0) + p.value);
      }
    }
    const equityCurve = Array.from(dateMap.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([date, equity]) => ({ ts: new Date(`${date}T00:00:00Z`).getTime(), equity }));

    // 汇总指标：按资金加权和交易数加和
    const sum = perSymbol.reduce(
      (acc, r) => {
        acc.finalCapital += r.finalCapital;
        acc.totalTrades += r.totalTrades;
        acc.maxDrawdown = Math.max(acc.maxDrawdown, r.maxDrawdown);
        acc.sharpeSum += r.sharpeRatio;
        acc.winSum += r.winRate;
        acc.count += 1;
        return acc;
      },
      { finalCapital: 0, totalTrades: 0, maxDrawdown: 0, sharpeSum: 0, winSum: 0, count: 0 },
    );
    const totalReturn = (sum.finalCapital / initialCapital - 1) * 100;

    return {
      strategyId,
      strategyName: strategy.name,
      finalCapital: sum.finalCapital,
      totalReturn,
      maxDrawdown: sum.maxDrawdown,
      sharpeRatio: sum.sharpeSum / Math.max(1, sum.count),
      winRate: sum.winSum / Math.max(1, sum.count),
      totalTrades: sum.totalTrades,
      equityCurve,
    };
  }

  private compare(v1: SideResult, v2: SideResult): ABTestSummary {
    const delta = {
      totalReturn: v2.totalReturn - v1.totalReturn,
      sharpeRatio: v2.sharpeRatio - v1.sharpeRatio,
      maxDrawdown: v2.maxDrawdown - v1.maxDrawdown,
      winRate: v2.winRate - v1.winRate,
    };
    // 简易显著性判定：交易数 + 总收益差
    const minTrades = Math.min(v1.totalTrades, v2.totalTrades);
    const sufficient = minTrades >= 10 && Math.abs(delta.totalReturn) >= 2;
    let winner: 'v1' | 'v2' | 'tie' = 'tie';
    if (Math.abs(delta.totalReturn) >= 1) {
      winner = delta.totalReturn > 0 ? 'v2' : 'v1';
    }
    return {
      winner,
      v1Metrics: {
        strategyId: v1.strategyId,
        strategyName: v1.strategyName,
        finalCapital: v1.finalCapital,
        totalReturn: v1.totalReturn,
        maxDrawdown: v1.maxDrawdown,
        sharpeRatio: v1.sharpeRatio,
        winRate: v1.winRate,
        totalTrades: v1.totalTrades,
      },
      v2Metrics: {
        strategyId: v2.strategyId,
        strategyName: v2.strategyName,
        finalCapital: v2.finalCapital,
        totalReturn: v2.totalReturn,
        maxDrawdown: v2.maxDrawdown,
        sharpeRatio: v2.sharpeRatio,
        winRate: v2.winRate,
        totalTrades: v2.totalTrades,
      },
      delta,
      significance: {
        sufficient,
        note: sufficient
          ? '样本量充足，可参考结论'
          : minTrades < 10
            ? '交易样本不足，建议增加回测天数'
            : '收益差较小（<2%），差异不显著',
      },
    };
  }

  getExperiment(id: string) {
    const exp = this.persistence.getAbExperiment(id);
    if (!exp) return null;
    return {
      ...exp,
      v1Equity: this.persistence.getAbEquityCurve(id, 'v1'),
      v2Equity: this.persistence.getAbEquityCurve(id, 'v2'),
    };
  }

  listExperiments(limit?: number) {
    return this.persistence.listAbExperiments(limit ?? 20);
  }

  deleteExperiment(id: string): boolean {
    return this.persistence.deleteAbExperiment(id);
  }
}