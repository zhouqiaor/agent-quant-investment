import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Optional } from '@nestjs/common';
import { PaperTradingService } from '../paper-trading/paper-trading.service';
import { StrategyService, MonitorSignal } from '../strategy/strategy.service';
import { NotificationService } from '../notification/notification.service';
import { WatchlistService } from '../stock/watchlist.service';
import { BetaConfigService } from './beta-config.service';
import { MarketPollingService } from '../market/market-polling.service';
import {
  PortfolioService,
  BuyProposal,
  PortfolioSummary,
} from '../portfolio/portfolio.service';

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

/** beta_config 中可选的组合开关字段（未升级 BetaConfig 类型前以最小接口读取） */
type BetaConfigWithPortfolioFlag = { portfolio_enabled?: boolean };

/**
 * 实时收益联动服务（内测实时看盘核心）：
 * 行情快照 → 持仓重估 → 关注股票策略信号 → 通知 → 自动模拟下单
 *
 * Part 2：新增 portfolio 双路径（feature flag，默认关闭）：
 * - legacy（默认）：逐信号 notify + executeSignal，行为不变
 * - portfolio：顺序收集信号 → BUY 同股去重（min）→ 策略 maxPositionPct 截断
 *   → 组合 cashReservePct 过滤 → 通过的才 notify + execute；tick 后 invariant 校验（仅 warn）
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
  /** portfolio 模式下每笔 BUY 信号的原始意向金额（占初始资金比例），随后经风控截断 */
  private static PORTFOLIO_RAW_PROPOSAL_PCT = 0.2;
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
    @Optional()
    private readonly portfolioService?: PortfolioService,
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

    // 4) 通知 + 自动交易
    if (this.isPortfolioMode() && this.portfolioService) {
      await this.runPortfolioMode(signals, stats);
    } else {
      await this.runLegacyMode(signals, stats);
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

  // ---------- legacy 路径（默认；行为保持不变） ----------

  private async runLegacyMode(signals: MonitorSignal[], stats: TickStats): Promise<void> {
    // 全局 autoTrade 开关，默认开启
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
  }

  // ---------- portfolio 路径（feature flag 显式开启） ----------

  /**
   * flag 判定（不触碰 PortfolioService，便于"flag 关 → service 不调用"断言）：
   * 1. 环境变量 PORTFOLIO_MODE：'portfolio' 开 / 'legacy' 关
   * 2. beta_config.portfolio_enabled === true
   * 默认关闭。
   */
  private isPortfolioMode(): boolean {
    const envMode = process.env.PORTFOLIO_MODE;
    if (envMode === 'portfolio') return true;
    if (envMode === 'legacy') return false;
    const cfg = this.betaConfigService.getConfig() as (BetaConfigWithPortfolioFlag & object) | null;
    return cfg?.portfolio_enabled === true;
  }

  private async runPortfolioMode(signals: MonitorSignal[], stats: TickStats): Promise<void> {
    const portfolio = this.portfolioService!;
    // 全局 autoTrade 开关，默认开启
    const betaConfig = this.betaConfigService.getConfig();
    const autoTrade = betaConfig ? betaConfig.autoTrade !== false : true;

    const summary: PortfolioSummary = await portfolio.getSummary();

    // 1) 顺序收集 BUY / SELL
    const buySignals = signals.filter((s) => s.type === 'buy');
    const sellSignals = signals.filter((s) => s.type === 'sell');

    // SELL 提议不做合并，沿用逐信号路径
    for (const signal of sellSignals) {
      const executed = await this.processPortfolioSell(signal, autoTrade);
      if (executed) stats.executed += 1;
    }

    // 2) BUY 原始意向
    const account = this.paperTrading.getAccount();
    const rawAmount =
      account.initialCapital * LivePnlService.PORTFOLIO_RAW_PROPOSAL_PCT;
    const proposals: BuyProposal[] = buySignals.map((s) => ({
      strategyId: s.strategyId,
      symbol: s.symbol,
      name: s.strategyName,
      price: s.price,
      proposedAmount: rawAmount,
    }));

    // 3) 同股去重（取 min，记录 contributors）
    const dedupedBuys = portfolio.dedupeBuyProposals(proposals);

    // 4) 每笔：策略 maxPositionPct 截断（多贡献者取最严）→ cashReserve 过滤 → notify + execute
    for (const buy of dedupedBuys) {
      const key = `${buy.symbol}:buy:${buy.price}`;
      if (this.isDebounced(key)) continue;

      let cappedAmount = buy.finalAmount;
      for (const contributor of buy.contributors) {
        const cfg = await portfolio.getStrategyConfig(contributor);
        const r = portfolio.clampProposalByMaxPct(
          {
            strategyId: contributor,
            symbol: buy.symbol,
            name: buy.name,
            price: buy.price,
            proposedAmount: buy.finalAmount,
          },
          cfg.maxPositionPct,
        );
        cappedAmount = Math.min(cappedAmount, r.cappedAmount);
      }

      const currentCash = this.paperTrading.getAccount().cash;
      const reserve = portfolio.checkCashReserve({
        proposedAmount: cappedAmount,
        accountCash: currentCash,
        cashReservePct: summary.portfolio.cashReservePct,
      });
      if (!reserve.allowed) {
        this.logger.warn(
          `[portfolio] 跳过 ${buy.symbol} BUY：${reserve.reason}（contributors=${buy.contributors.join(',')}）`,
        );
        continue;
      }

      // A 股 100 股整数倍
      const quantity = Math.floor(cappedAmount / buy.price / 100) * 100;
      if (quantity <= 0) {
        this.logger.warn(`[portfolio] 跳过 ${buy.symbol} BUY：截断后不足 1 手`);
        continue;
      }

      this.recentSignals.set(key, Date.now());

      // 取首个贡献策略的原始信号作为通知元数据（reason 原样保留）
      const originSignal =
        buySignals.find((s) => s.strategyId === buy.contributors[0]) ?? buySignals[0];

      await this.notificationService.notify({
        id: originSignal.id,
        type: 'BUY',
        symbol: buy.symbol,
        name: originSignal.strategyName,
        price: buy.price,
        reason: originSignal.reason,
        source: 'custom',
        time: originSignal.time,
      });

      if (!autoTrade) continue;

      const result = this.paperTrading.executeSignal({
        type: 'BUY',
        symbol: buy.symbol,
        name: originSignal.strategyName,
        price: buy.price,
        reason: originSignal.reason,
        strategyId: buy.contributors[0],
        quantity,
      });
      if (result.success) stats.executed += 1;
    }

    // 5) tick 后 invariant 校验（失败仅 warn，不阻塞）
    try {
      const inv = portfolio.checkInvariant();
      if (!inv.ok) {
        this.logger.warn(`[portfolio] 资金守恒 invariant 偏差 ${inv.diff}（cash=${inv.cash}, mv=${inv.marketValue}）`);
      }
    } catch (e) {
      this.logger.warn(`[portfolio] invariant 校验异常：${(e as Error).message}`);
    }
  }

  private async processPortfolioSell(signal: MonitorSignal, autoTrade: boolean): Promise<boolean> {
    const key = `${signal.symbol}:${signal.type}:${signal.price}`;
    if (this.isDebounced(key)) return false;
    this.recentSignals.set(key, Date.now());

    await this.notificationService.notify({
      id: signal.id,
      type: 'SELL',
      symbol: signal.symbol,
      name: signal.strategyName,
      price: signal.price,
      reason: signal.reason,
      source: 'custom',
      time: signal.time,
    });

    if (!autoTrade) return false;

    const result = this.paperTrading.executeSignal({
      type: 'SELL',
      symbol: signal.symbol,
      name: signal.strategyName,
      price: signal.price,
      reason: signal.reason,
      strategyId: signal.strategyId,
    });
    return result.success;
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
