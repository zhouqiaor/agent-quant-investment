import { Injectable } from '@nestjs/common';
import { PersistenceService } from '../persistence/persistence.service';
import { StrategyService } from '../strategy/strategy.service';
import { PaperTradingService, PaperPosition } from '../paper-trading/paper-trading.service';

/**
 * 策略级仓位控制（Part 1）
 * - maxPositionPct：单策略对某股票最大仓位比例（0-1）
 * - running：是否启用
 */
export interface StrategyPositionConfig {
  strategyId: string;
  maxPositionPct: number;
  running: boolean;
}

/**
 * 组合（Part 1）
 * - id / name：组合标识
 * - initialCapital：初始资金（与底层账户一致）
 * - cashReservePct：组合必须保留的现金比例（0-1，默认 0.05）
 * - strategies：纳入本组合的策略配置
 */
export interface Portfolio {
  id: string;
  name: string;
  initialCapital: number;
  cashReservePct: number;
  createdAt: string;
  strategies: StrategyPositionConfig[];
}

export interface PortfolioStrategySummary {
  strategyId: string;
  pnl: number;
  pnlRate: number;
  trades: number;
  running: boolean;
  maxPositionPct: number;
}

/**
 * 组合账户视图（聚合 default 账户 + 多策略状态）
 */
export interface PortfolioSummary {
  portfolio: Portfolio;
  cash: number;
  positions: PaperPosition[];
  totalValue: number;
  totalPnl: number;
  totalPnlRate: number;
  strategies: PortfolioStrategySummary[];
}

/**
 * 单策略 BUY 提议
 */
export interface BuyProposal {
  strategyId: string;
  symbol: string;
  name: string;
  price: number;
  proposedAmount: number;
}

/**
 * 去重后的 BUY 计划（单笔交易，finalAmount 为合并后的金额，不重复扣费）
 */
export interface DedupedBuy {
  symbol: string;
  name: string;
  price: number;
  finalAmount: number;
  contributors: string[];
}

/**
 * 资金守恒 invariant 校验结果
 *
 * 恒等式：cash + Σposition.marketValue === initialCapital + ΣrealizedPnL + ΣunrealizedPnL
 * 即：actualTotalValue === expectedTotalValue
 */
export interface InvariantResult {
  ok: boolean;
  initialCapital: number;
  cash: number;
  marketValue: number;
  realizedPnl: number;
  unrealizedPnl: number;
  expectedTotalValue: number;
  actualTotalValue: number;
  diff: number;
}

export interface CashReserveCheck {
  allowed: boolean;
  maxAllowed: number;
  reason?: string;
}

export interface ClampResult {
  cappedAmount: number;
  capped: boolean;
}

/**
 * 默认值（与 SPEC 一致）
 */
export const DEFAULT_MAX_POSITION_PCT = 0.10;
export const DEFAULT_CASH_RESERVE_PCT = 0.05;
/** 资金守恒允许的舍入误差 */
export const INVARIANT_TOLERANCE = 0.01;

/**
 * PortfolioService（Part 1：基础设施）
 *
 * 职责：
 * 1. 聚合视图：在 default account 之上叠加"组合"概念（cashReservePct、策略配置）
 * 2. 策略级风控：maxPositionPct 截断
 * 3. 组合级风控：cashReservePct 阈值
 * 4. 资金守恒 invariant 校验
 * 5. 同股票多策略 BUY 去重（取最小 proposedAmount，不重复扣费）
 *
 * 不破坏既有路径：
 * - 底层调用 StrategyService.toggleStrategy（旧接口保留为 deprecated，本服务作为新入口）
 * - 底层账户数据读写仍走 PaperTradingService
 * - 配置存储复用 PersistenceService.saveBetaConfig / getBetaConfig
 *
 * 不接入 live-pnl（Part 2 才把 onTick 接入本服务）。
 */
@Injectable()
export class PortfolioService {
  private readonly defaultPortfolioId = 'default';
  private readonly configKey = 'portfolio_config';

  constructor(
    private readonly persistence: PersistenceService,
    private readonly strategyService: StrategyService,
    private readonly paperTrading: PaperTradingService,
  ) {}

  /**
   * 获取组合账户视图（默认 1 个）。
   * 首次调用会自动创建默认组合。
   */
  async getSummary(portfolioId?: string): Promise<PortfolioSummary> {
    const id = portfolioId || this.defaultPortfolioId;
    const portfolio = await this.getOrCreatePortfolio(id);

    const account = this.paperTrading.getAccount(id);
    const allStrategies = this.strategyService.getStrategies();

    const strategies: PortfolioStrategySummary[] = allStrategies.map((s) => {
      const cfg = portfolio.strategies.find((c) => c.strategyId === s.id);
      const strategyTrades = account.trades.filter((t) => t.strategyId === s.id);
      const realizedPnl = this.calcRealizedPnlForTrades(strategyTrades);
      const running = cfg?.running ?? false;
      const maxPositionPct = cfg?.maxPositionPct ?? DEFAULT_MAX_POSITION_PCT;
      // 策略级收益率（Part 1 简化版）：以本策略已实现 PnL 占总初始资金的比值
      const pnlRate =
        portfolio.initialCapital > 0
          ? Math.round(((realizedPnl / portfolio.initialCapital) * 100) * 100) / 100
          : 0;
      return {
        strategyId: s.id,
        pnl: realizedPnl,
        pnlRate,
        trades: strategyTrades.length,
        running,
        maxPositionPct,
      };
    });

    return {
      portfolio,
      cash: account.cash,
      positions: account.positions,
      totalValue: account.totalValue,
      totalPnl: account.totalPnl,
      totalPnlRate: account.totalPnlRate,
      strategies,
    };
  }

  /**
   * 创建新 portfolio（多组合场景预留，默认未启用）。
   * - 自动生成 pf_* id
   * - 默认 cashReservePct=5%
   */
  async create(name: string, opts?: { cashReservePct?: number }): Promise<Portfolio> {
    const id = `pf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const portfolio: Portfolio = {
      id,
      name,
      initialCapital: 100000,
      cashReservePct: opts?.cashReservePct ?? DEFAULT_CASH_RESERVE_PCT,
      createdAt: new Date().toISOString(),
      strategies: [],
    };
    this.savePortfolio(portfolio);
    return portfolio;
  }

  /**
   * 启停某策略（取代 strategyService.toggleStrategy 的直接调用）。
   * - 写入 portfolio_config.strategies[*].running
   * - 可选地同时设置 maxPositionPct
   * - 同步底层 strategyService 状态（保持旧接口兼容）
   */
  async setStrategyRunning(
    strategyId: string,
    running: boolean,
    opts?: { maxPositionPct?: number },
  ): Promise<void> {
    const portfolio = await this.getOrCreatePortfolio(this.defaultPortfolioId);
    const idx = portfolio.strategies.findIndex((s) => s.strategyId === strategyId);
    const prevMax = idx >= 0 ? portfolio.strategies[idx].maxPositionPct : DEFAULT_MAX_POSITION_PCT;
    const cfg: StrategyPositionConfig = {
      strategyId,
      maxPositionPct: opts?.maxPositionPct ?? prevMax,
      running,
    };
    if (idx >= 0) {
      portfolio.strategies[idx] = cfg;
    } else {
      portfolio.strategies.push(cfg);
    }
    this.savePortfolio(portfolio);

    // 同步底层（保持 StrategyService.toggleStrategy 旧接口行为）
    this.strategyService.toggleStrategy(strategyId, running ? 'start' : 'stop');
  }

  /**
   * 读取策略配置（持久化值；不存在则返回默认值）。
   */
  async getStrategyConfig(strategyId: string): Promise<StrategyPositionConfig> {
    const portfolio = await this.getOrCreatePortfolio(this.defaultPortfolioId);
    const cfg = portfolio.strategies.find((s) => s.strategyId === strategyId);
    return (
      cfg ?? {
        strategyId,
        maxPositionPct: DEFAULT_MAX_POSITION_PCT,
        running: false,
      }
    );
  }

  /**
   * 资金守恒 invariant：
   *
   * Σcash + Σposition.marketValue === initialCapital + ΣrealizedPnL + ΣunrealizedPnL
   *
   * 测试期间暴露为 public 方法 checkInvariant() 便于断言。
   */
  checkInvariant(accountId?: string): InvariantResult {
    const account = this.paperTrading.getAccount(accountId);
    const cash = account.cash;
    const marketValue = account.positions.reduce((sum, p) => sum + p.marketValue, 0);
    const realizedPnl = this.calcRealizedPnlForTrades(account.trades);
    const unrealizedPnl = account.positions.reduce((sum, p) => sum + p.pnl, 0);
    const initialCapital = account.initialCapital;

    const expectedTotalValue = initialCapital + realizedPnl + unrealizedPnl;
    const actualTotalValue = cash + marketValue;
    const diff = Math.round((actualTotalValue - expectedTotalValue) * 100) / 100;
    const ok = Math.abs(diff) < INVARIANT_TOLERANCE;

    return {
      ok,
      initialCapital,
      cash,
      marketValue,
      realizedPnl,
      unrealizedPnl,
      expectedTotalValue,
      actualTotalValue,
      diff,
    };
  }

  /**
   * 策略级 maxPositionPct 约束：
   * - 读取 default portfolio 中该策略的持久化配置
   * - 提议金额 > 上限 → 截断；否则原样返回
   */
  clampProposalByStrategyPct(proposal: BuyProposal): ClampResult {
    const portfolio = this.getCachedDefaultPortfolio();
    const cfg = portfolio.strategies.find((s) => s.strategyId === proposal.strategyId);
    const maxPct = cfg?.maxPositionPct ?? DEFAULT_MAX_POSITION_PCT;
    return this.clampProposalInternal(proposal, maxPct);
  }

  /**
   * 显式传入 maxPositionPct 的截断（便于单测 + 跨策略比较场景）。
   */
  clampProposalByMaxPct(proposal: BuyProposal, maxPct: number): ClampResult {
    return this.clampProposalInternal(proposal, maxPct);
  }

  private clampProposalInternal(proposal: BuyProposal, maxPct: number): ClampResult {
    const account = this.paperTrading.getAccount();
    const cap = account.initialCapital * maxPct;
    if (proposal.proposedAmount <= cap) {
      return { cappedAmount: proposal.proposedAmount, capped: false };
    }
    return { cappedAmount: cap, capped: true };
  }

  /**
   * 组合级 cashReservePct 阈值检查：
   * 提议扣减后剩余现金不得低于 cashReservePct * accountCash。
   */
  checkCashReserve(opts: {
    proposedAmount: number;
    accountCash: number;
    cashReservePct: number;
  }): CashReserveCheck {
    const maxAllowed = opts.accountCash * (1 - opts.cashReservePct);
    if (opts.proposedAmount <= maxAllowed) {
      return { allowed: true, maxAllowed };
    }
    return {
      allowed: false,
      maxAllowed,
      reason: `提议 ${opts.proposedAmount} 超出保留现金比例：允许最多 ${maxAllowed.toFixed(2)}`,
    };
  }

  /**
   * 同股票多策略 BUY 去重：
   * - 按 symbol 分组
   * - 取 min(proposedAmount) 作为 finalAmount
   * - 记录所有 contributors（不重复扣费）
   */
  dedupeBuyProposals(proposals: BuyProposal[]): DedupedBuy[] {
    const bySymbol = new Map<string, BuyProposal[]>();
    for (const p of proposals) {
      const list = bySymbol.get(p.symbol) ?? [];
      list.push(p);
      bySymbol.set(p.symbol, list);
    }

    const result: DedupedBuy[] = [];
    for (const [symbol, list] of bySymbol) {
      const sorted = list.slice().sort((a, b) => a.proposedAmount - b.proposedAmount);
      const min = sorted[0];
      result.push({
        symbol,
        name: min.name,
        price: min.price,
        finalAmount: min.proposedAmount,
        contributors: list.map((p) => p.strategyId),
      });
    }
    return result;
  }

  // ---------- 内部 helpers ----------

  /**
   * 同步读取 default portfolio（不写盘）。
   * 用于 clampProposalByStrategyPct 等热路径。
   */
  private getCachedDefaultPortfolio(): Portfolio {
    const all = this.persistence.getBetaConfig<Record<string, Portfolio>>(this.configKey) ?? {};
    const found = all[this.defaultPortfolioId];
    if (found) return found;
    return {
      id: this.defaultPortfolioId,
      name: '默认组合',
      initialCapital: 100000,
      cashReservePct: DEFAULT_CASH_RESERVE_PCT,
      createdAt: new Date().toISOString(),
      strategies: [],
    };
  }

  /**
   * 读取或创建 portfolio（异步）。
   * 首次创建会落盘 beta_config。
   */
  private async getOrCreatePortfolio(id: string): Promise<Portfolio> {
    const all = this.persistence.getBetaConfig<Record<string, Portfolio>>(this.configKey) ?? {};
    if (all[id]) return all[id];
    const created: Portfolio = {
      id,
      name: id === this.defaultPortfolioId ? '默认组合' : id,
      initialCapital: 100000,
      cashReservePct: DEFAULT_CASH_RESERVE_PCT,
      createdAt: new Date().toISOString(),
      strategies: [],
    };
    all[id] = created;
    this.persistence.saveBetaConfig(this.configKey, all);
    return created;
  }

  private savePortfolio(portfolio: Portfolio): void {
    const all = this.persistence.getBetaConfig<Record<string, Portfolio>>(this.configKey) ?? {};
    all[portfolio.id] = portfolio;
    this.persistence.saveBetaConfig(this.configKey, all);
  }

  /**
   * 计算一组交易的已实现 PnL。
   * 实现方式与 PaperTradingService.getTradeSummary 保持一致：
   *   累计买入成本 / 累计买入量 = 加权平均成本
   *   每笔 SELL 的 PnL = (sellPrice - avgCost) * quantity
   */
  private calcRealizedPnlForTrades(
    trades: Array<{ type: 'BUY' | 'SELL'; price: number; quantity: number }>,
  ): number {
    let buyCost = 0;
    let buyQty = 0;
    let realizedPnl = 0;
    for (const t of trades) {
      if (t.type === 'BUY') {
        buyCost += t.price * t.quantity;
        buyQty += t.quantity;
      } else {
        const avgCost = buyQty > 0 ? buyCost / buyQty : 0;
        realizedPnl += (t.price - avgCost) * t.quantity;
        buyQty -= t.quantity;
        buyCost -= avgCost * t.quantity;
      }
    }
    return Math.round(realizedPnl * 100) / 100;
  }
}
