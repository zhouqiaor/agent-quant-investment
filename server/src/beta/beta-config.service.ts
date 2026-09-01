import { BadRequestException, Injectable, Inject, Optional } from '@nestjs/common';
import { PersistenceService } from '../persistence/persistence.service';
import { WatchlistService } from '../stock/watchlist.service';
import { StrategyService } from '../strategy/strategy.service';
import { PaperTradingService } from '../paper-trading/paper-trading.service';

export const BETA_CONFIG_KEY = 'default';

/** 内测配置（单例），从零引导向导的持久化形态 */
export interface BetaConfig {
  initialCapital: number;
  watchSymbols: string[];
  strategyId: string | null;
  autoTrade: boolean;
  status: 'draft' | 'active';
  updatedAt?: number;
}

/** 内置/自定义策略存在性校验的最小接口 */
export interface StrategyChecker {
  getCustomStrategy(id: string): unknown | null | undefined;
  getStrategies(): Array<{ id: string }>;
}

const MAX_CAPITAL = 1e9;

/**
 * 内测从零配置会话：
 * - 金额 1 ~ 1e9
 * - watchSymbols 必须已在关注列表
 * - strategyId 为空 → 内置默认策略；非空 → 必须存在
 * - 保存成功后 status='active'，支持覆盖更新
 */
@Injectable()
export class BetaConfigService {
  constructor(
    private readonly persistence: PersistenceService,
    private readonly watchlistService: WatchlistService,
    @Optional()
    @Inject(StrategyService)
    private readonly strategyChecker?: StrategyChecker,
    @Optional()
    @Inject(PaperTradingService)
    private readonly paperTrading?: PaperTradingService,
  ) {}

  getDefaultConfig(): BetaConfig {
    return {
      initialCapital: 100000,
      watchSymbols: [],
      strategyId: null,
      autoTrade: true,
      status: 'draft',
    };
  }

  /**
   * 一键从零重置：清空关注/自定义股票/自定义策略/账户/通知/回测/优化/配置，
   * 账户金额归零且停止运行，回到完全未配置状态。
   */
  resetAll(): void {
    this.persistence.clearAllData();
    this.paperTrading?.resetAccount('default', 0);
  }

  getConfig(): BetaConfig | null {
    return this.persistence.getBetaConfig<BetaConfig>(BETA_CONFIG_KEY);
  }

  saveConfig(input: Partial<BetaConfig>): BetaConfig {
    const config: BetaConfig = {
      ...this.getDefaultConfig(),
      ...this.getConfig(),
      ...input,
      status: 'active',
    };
    this.validate(config);
    config.updatedAt = Date.now();
    this.persistence.saveBetaConfig(BETA_CONFIG_KEY, config);
    return config;
  }

  private validate(config: BetaConfig): void {
    const capital = Number(config.initialCapital);
    if (!Number.isFinite(capital) || capital <= 0) {
      throw new BadRequestException('投入金额必须大于 0');
    }
    if (capital > MAX_CAPITAL) {
      throw new BadRequestException('投入金额不能超过 10 亿');
    }
    if (!Array.isArray(config.watchSymbols) || config.watchSymbols.length === 0) {
      throw new BadRequestException('至少需要关注一只股票');
    }
    const watched = new Set(this.watchlistService.listWatch().map((w) => w.symbol));
    for (const symbol of config.watchSymbols) {
      if (!watched.has(symbol)) {
        throw new BadRequestException(`股票 ${symbol} 未在关注列表中，请先添加关注`);
      }
    }
    if (config.strategyId) {
      const custom = this.strategyChecker?.getCustomStrategy(config.strategyId);
      const builtin = this.strategyChecker
        ?.getStrategies()
        .some((s) => (s as { id?: string }).id === config.strategyId);
      if (!custom && !builtin) {
        throw new BadRequestException('策略不存在，请重新选择或创建');
      }
    }
  }
}
