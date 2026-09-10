import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PaperTradingService } from '../paper-trading/paper-trading.service';
import { StrategyService, MonitorSignal } from '../strategy/strategy.service';
import { NotificationService } from '../notification/notification.service';
import { WatchlistService } from '../stock/watchlist.service';
import { BetaConfigService } from './beta-config.service';
import { MarketPollingService } from '../market/market-polling.service';

export interface TickStats {
  marked: number;
  signals: number;
  executed: number;
}

export interface LiveStatus {
  lastTickAt: number;
  watchedEnabled: number;
  tickCount: number;
  signalsTotal: number;
  executedTotal: number;
}

export interface MarketTick {
  symbol: string;
  price: number;
  changePercent: number;
}

/**
 * 实时收益联动服务（内测实时看盘核心）：
 * 行情快照 → 持仓重估 → 关注股票策略信号 → 通知 → 自动模拟下单
 *
 * 可测试性：
 * - onTick(marketData) 纯输入驱动，不依赖外部行情源
 * - 条件求值为确定性（价格阈值/涨跌幅规则）
 * - 同 symbol+type+price 信号 60s 内防抖，避免重复成交
 */
@Injectable()
export class LivePnlService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LivePnlService.name);
  private lastTickAt = 0;
  /** 防抖表：`${symbol}:${type}:${price}` → 时间戳 */
  private recentSignals = new Map<string, number>();
  private static DEBOUNCE_MS = 60_000;
  private unsubscribeMarket: (() => void) | null = null;
  private tickCount = 0;
  private signalsTotal = 0;
  private executedTotal = 0;

  constructor(
    private readonly paperTrading: PaperTradingService,
    private readonly strategyService: StrategyService,
    private readonly notificationService: NotificationService,
    private readonly watchlistService: WatchlistService,
    private readonly betaConfigService: BetaConfigService,
    private readonly marketPolling?: MarketPollingService,
  ) {}

  /**
   * 自动订阅行情轮询：每个 tick 把真实价格喂给 onTick → 持仓重估 + 信号 + 模拟下单
   * 注意：MarketPollingService 是可选依赖（测试可省略），避免破坏现有 16 个单元测试
   */
  onModuleInit(): void {
    if (!this.marketPolling) {
      this.logger.log('MarketPollingService 未注入，跳过自动订阅（仅手动 tick 模式）');
      return;
    }
    this.unsubscribeMarket = this.marketPolling.subscribe((raw) => {
      const items = Array.isArray(raw) ? raw : [];
      const ticks: MarketTick[] = items
        .map((it: any) => ({
          symbol: String(it.symbol ?? ''),
          price: typeof it.price === 'number' ? it.price : 0,
          changePercent: typeof it.changePercent === 'number' ? it.changePercent : 0,
        }))
        .filter((t) => /^[036][0-9]{5}$/.test(t.symbol) && t.price > 0);
      if (ticks.length === 0) return;
      void this.onTick(ticks).then((stats) => {
        if (stats.marked > 0 || stats.signals > 0 || stats.executed > 0) {
          this.tickCount += 1;
          this.signalsTotal += stats.signals;
          this.executedTotal += stats.executed;
          this.logger.log(
            `[实时轮询] 标=${ticks.length} 重估=${stats.marked} 信号=${stats.signals} 自动成交=${stats.executed}`,
          );
        }
      }).catch((err) => {
        this.logger.error('实时轮询处理失败', err as Error);
      });
    });
    this.logger.log('已订阅 MarketPollingService 实时行情');
  }

  onModuleDestroy(): void {
    if (this.unsubscribeMarket) {
      this.unsubscribeMarket();
      this.unsubscribeMarket = null;
    }
  }

  async onTick(marketData: MarketTick[]): Promise<TickStats> {
    const stats: TickStats = { marked: 0, signals: 0, executed: 0 };

    // 1) 持仓按最新价重估
    const prices: Record<string, number> = {};
    for (const tick of marketData) {
      if (typeof tick.price === 'number' && tick.price > 0) prices[tick.symbol] = tick.price;
    }
    this.paperTrading.markPrices(prices);
    const account = this.paperTrading.getAccount();
    stats.marked = account.positions.filter((p) => prices[p.symbol] !== undefined).length;

    // 2) 仅对"已开启投资"的关注股票生成信号
    const enabled = new Set(
      this.watchlistService.listWatch().filter((w) => w.enabled).map((w) => w.symbol),
    );
    const watchedData = marketData.filter((m) => enabled.has(m.symbol));

    // 3) 策略条件求值（确定性）
    const signals: MonitorSignal[] = this.strategyService.checkMonitorSignals(watchedData);
    stats.signals = signals.length;

    // 4) 通知 + 自动交易（必须先完成引导配置，否则不产生任何信号/交易）
    const config = this.betaConfigService.getConfig();
    // 未配置（未走完引导）时直接跳过，绝不对正式账户自动下单
    if (!config) {
      this.lastTickAt = Date.now();
      return stats;
    }
    const autoTrade = config.autoTrade !== false;

    for (const signal of signals) {
      const key = `${signal.symbol}:${signal.type}:${signal.price}`;
      if (this.isDebounced(key)) continue;
      this.recentSignals.set(key, Date.now());

      await this.notificationService.notify({
        id: signal.id,
        type: signal.type === 'buy' ? 'BUY' : 'SELL',
        symbol: signal.symbol,
        name: signal.strategyName,
        price: signal.price,
        reason: signal.reason,
        source: 'custom',
        time: signal.time,
      });

      if (!autoTrade) continue;

      const result = this.paperTrading.executeSignal({
        type: signal.type === 'buy' ? 'BUY' : 'SELL',
        symbol: signal.symbol,
        name: signal.strategyName,
        price: signal.price,
        reason: signal.reason,
        strategyId: signal.strategyId,
      });
      if (result.success) stats.executed += 1;
    }

    this.lastTickAt = Date.now();
    this.persistenceHeartbeat(stats);
    return stats;
  }

  getStatus(): LiveStatus {
    return {
      lastTickAt: this.lastTickAt,
      watchedEnabled: this.watchlistService.listWatch().filter((w) => w.enabled).length,
      tickCount: this.tickCount,
      signalsTotal: this.signalsTotal,
      executedTotal: this.executedTotal,
    };
  }

  private isDebounced(key: string): boolean {
    const now = Date.now();
    const last = this.recentSignals.get(key);
    if (last && now - last < LivePnlService.DEBOUNCE_MS) return true;
    // 清理过期防抖记录，防泄漏
    for (const [k, t] of this.recentSignals) {
      if (now - t >= LivePnlService.DEBOUNCE_MS) this.recentSignals.delete(k);
    }
    return false;
  }

  private persistenceHeartbeat(stats: TickStats): void {
    try {
      this.strategyService.getMonitorSignals(1); // 轻触策略引擎保持状态活跃
      this.logger.log(`tick: marked=${stats.marked} signals=${stats.signals} executed=${stats.executed}`);
    } catch (e) {
      /* ignore */
    }
  }
}
