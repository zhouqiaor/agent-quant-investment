import { Injectable, Logger } from '@nestjs/common';
import { PaperTradingService } from '../paper-trading/paper-trading.service';
import { StrategyService, MonitorSignal } from '../strategy/strategy.service';
import { NotificationService } from '../notification/notification.service';
import { WatchlistService } from '../stock/watchlist.service';
import { BetaConfigService } from './beta-config.service';

export interface TickStats {
  marked: number;
  signals: number;
  executed: number;
}

export interface LiveStatus {
  lastTickAt: number;
  watchedEnabled: number;
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
export class LivePnlService {
  private readonly logger = new Logger(LivePnlService.name);
  private lastTickAt = 0;
  /** 防抖表：`${symbol}:${type}:${price}` → 时间戳 */
  private recentSignals = new Map<string, number>();
  private static DEBOUNCE_MS = 60_000;

  constructor(
    private readonly paperTrading: PaperTradingService,
    private readonly strategyService: StrategyService,
    private readonly notificationService: NotificationService,
    private readonly watchlistService: WatchlistService,
    private readonly betaConfigService: BetaConfigService,
  ) {}

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

    // 4) 通知 + 自动交易（全局 autoTrade 开关，默认开启）
    const config = this.betaConfigService.getConfig();
    const autoTrade = config ? config.autoTrade !== false : true;

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
      this.logger.debug(`tick: marked=${stats.marked} signals=${stats.signals} executed=${stats.executed}`);
    } catch (e) {
      /* ignore */
    }
  }
}
