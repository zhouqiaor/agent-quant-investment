import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { BacktestService } from '../backtest/backtest.service';
import { PersistenceService } from '../persistence/persistence.service';

/**
 * 参数优化服务（网格搜索）
 * 参考 Freqtrade Hyperopt 的优化目标设计：
 * - totalReturn / sharpeRatio / winRate / composite（多目标加权）
 */
export interface ParamSpec {
  name: string;
  min: number;
  max: number;
  step: number;
}

export interface OptimizeRequest {
  symbol: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  paramSpace: ParamSpec[];
  objective: 'totalReturn' | 'sharpeRatio' | 'winRate' | 'composite';
  indicators?: string[];
}

export interface OptimizeResult {
  symbol: string;
  objective: string;
  totalCombinations: number;
  evaluated: number;
  bestParams: Record<string, number>;
  bestResult: Record<string, number>;
  results: {
    params: Record<string, number>;
    fitness: number;
    metrics: Record<string, number>;
  }[];
  durationMs: number;
}

@Injectable()
export class OptimizerService {
  private static readonly MAX_COMBINATIONS = 2000;

  constructor(
    private readonly backtestService: BacktestService,
    private readonly persistenceService: PersistenceService,
  ) {}

  /** 生成单个参数的取值网格 */
  buildParamGrid(space: ParamSpec[]): { name: string; values: number[] }[] {
    return space.map(({ name, min, max, step }) => {
      if (!Number.isFinite(step) || step <= 0) {
        throw new BadRequestException(`参数 ${name} 的 step 必须为正数`);
      }
      if (min > max) {
        throw new BadRequestException(`参数 ${name} 的 min 不能大于 max`);
      }
      const values: number[] = [];
      const epsilon = step / 1e6;
      for (let v = min; v <= max + epsilon; v += step) {
        values.push(Math.round(v * 1e6) / 1e6);
      }
      return { name, values };
    });
  }

  /** 计算笛卡尔积组合总数（可带上限） */
  countCombinations(space: ParamSpec[], limit = OptimizerService.MAX_COMBINATIONS): number {
    const grid = this.buildParamGrid(space);
    let total = 1;
    for (const g of grid) total *= g.values.length;
    return Math.min(total, limit);
  }

  /** 执行网格搜索优化 */
  async optimize(req: OptimizeRequest): Promise<OptimizeResult> {
    const started = Date.now();

    if (!req.paramSpace || req.paramSpace.length === 0) {
      throw new BadRequestException('paramSpace 不能为空');
    }
    if (new Date(req.startDate) > new Date(req.endDate)) {
      throw new BadRequestException('startDate 不能晚于 endDate');
    }

    const grid = this.buildParamGrid(req.paramSpace);
    let total = 1;
    for (const g of grid) total *= g.values.length;
    if (total > OptimizerService.MAX_COMBINATIONS) {
      throw new BadRequestException(
        `参数组合数 ${total} 超过上限 ${OptimizerService.MAX_COMBINATIONS}，请增大 step 或缩小范围`,
      );
    }

    // 笛卡尔积枚举
    const combos: Record<string, number>[] = [];
    const walk = (idx: number, acc: Record<string, number>) => {
      if (idx === grid.length) {
        combos.push({ ...acc });
        return;
      }
      for (const v of grid[idx].values) {
        acc[grid[idx].name] = v;
        walk(idx + 1, acc);
      }
    };
    walk(0, {});

    // 逐组合回测评估
    const results: OptimizeResult['results'] = [];
    for (const params of combos) {
      try {
        const metrics = await this.backtestService.runBacktest({
          symbol: req.symbol,
          startDate: req.startDate,
          endDate: req.endDate,
          initialCapital: req.initialCapital,
          indicators: req.indicators,
          ...params,
        } as any);
        const m = {
          totalReturn: metrics.totalReturn ?? 0,
          sharpeRatio: metrics.sharpeRatio ?? 0,
          winRate: metrics.winRate ?? 0,
          maxDrawdown: metrics.maxDrawdown ?? 0,
        };
        results.push({
          params,
          fitness: this.computeFitness(m, req.objective),
          metrics: m,
        });
      } catch {
        // 单组合失败不中断整体优化
        results.push({
          params,
          fitness: -Infinity,
          metrics: {},
        });
      }
    }

    // 排序（降序）
    results.sort((a, b) => b.fitness - a.fitness);

    const out: OptimizeResult = {
      symbol: req.symbol,
      objective: req.objective,
      totalCombinations: total,
      evaluated: results.filter(r => r.fitness !== -Infinity).length,
      bestParams: results[0]?.params ?? {},
      bestResult: results[0]?.metrics ?? {},
      results,
      durationMs: Date.now() - started,
    };

    // 持久化优化结果（失败不影响返回）
    try {
      this.persistenceService.saveOptimization(out as any);
    } catch {
      /* ignore */
    }
    return out;
  }

  /** 优化历史列表（参考 Freqtrade Hyperopt 结果落盘设计） */
  getHistory(symbol?: string) {
    const list = this.persistenceService.listOptimizations(symbol);
    return { data: list.slice(0, 50) };
  }

  /** 单次优化详情 */
  getOptimization(id: string) {
    const list = this.persistenceService.listOptimizations();
    const found = list.find(item => item.id === id);
    if (!found) {
      throw new NotFoundException(`优化记录 ${id} 不存在`);
    }
    return { data: found };
  }

  /** 适应度计算（参考 Freqtrade Hyperopt 多目标设计） */
  private computeFitness(
    m: { totalReturn: number; sharpeRatio: number; winRate: number; maxDrawdown: number },
    objective: OptimizeRequest['objective'],
  ): number {
    switch (objective) {
      case 'totalReturn':
        return m.totalReturn;
      case 'sharpeRatio':
        return m.sharpeRatio;
      case 'winRate':
        return m.winRate;
      case 'composite':
      default:
        // 收益 50% + 夏普 30% + 胜率 20% - 回撤惩罚
        return (
          0.5 * m.totalReturn +
          0.3 * m.sharpeRatio * 10 +
          0.2 * m.winRate -
          0.5 * m.maxDrawdown * 10
        );
    }
  }
}
