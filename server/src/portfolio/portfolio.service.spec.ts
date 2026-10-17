/**
 * TDD Part 1：多策略并行 + 组合管理（基础设施）
 * SPEC: docs/SPEC-portfolio.md
 *
 * 覆盖：
 * - 组合账户视图（默认 1 个）
 * - 策略级 maxPositionPct（单策略对某股票最大仓位比例，默认 10%）
 * - 组合级 cashReservePct（必须保留的现金比例，默认 5%）
 * - 启停某策略 → setStrategyRunning
 * - 资金守恒 invariant：cash + marketValue === initialCapital + realizedPnl + unrealizedPnl
 * - 同股票多策略 BUY 去重 → 取最小 proposedAmount
 *
 * 不依赖 live-pnl，仅验证 PortfolioService 自身 + 现有 paper-trading / strategy 集成正确性。
 */
import { PersistenceService } from '../persistence/persistence.service';
import { StrategyService } from '../strategy/strategy.service';
import { PaperTradingService } from '../paper-trading/paper-trading.service';
import { IndicatorCalcService } from '@/indicators';
import { PortfolioService } from './portfolio.service';

// 测试数据隔离：独立 SQLite（与既有 spec 风格一致）
const TEST_DB = `/tmp/quant-test-portfolio-${process.pid}-${Date.now()}-${Math.round(
  Math.random() * 1e9,
)}.db`;
process.env.SQLITE_PATH = TEST_DB;

describe('PortfolioService (组合管理基础设施)', () => {
  let persistence: PersistenceService;
  let strategy: StrategyService;
  let paper: PaperTradingService;
  let portfolio: PortfolioService;

  beforeEach(() => {
    persistence = new PersistenceService(TEST_DB);
    persistence.init();
    persistence.clearAllData();
    strategy = new StrategyService(new IndicatorCalcService());
    paper = new PaperTradingService(strategy, persistence);
    portfolio = new PortfolioService(persistence, strategy, paper);
  });

  afterEach(() => {
    try {
      persistence.close();
    } catch {
      /* ignore */
    }
    try {
      require('fs').unlinkSync(TEST_DB);
    } catch {
      /* ignore */
    }
  });

  // -------- 组合账户视图 --------

  it('T1 getSummary 返回默认组合账户指标（总资产 / 各策略 PnL）', async () => {
    paper.resetAccount('default', 100000);
    paper.startTrading('default', ['s1', 's2']);
    const summary = await portfolio.getSummary();
    expect(summary.portfolio.id).toBe('default');
    expect(summary.cash).toBe(100000);
    expect(summary.totalValue).toBe(100000);
    expect(summary.totalPnl).toBe(0);
    expect(Array.isArray(summary.strategies)).toBe(true);
    // 4 个内置策略（无 custom）
    expect(summary.strategies.length).toBe(4);
    for (const s of summary.strategies) {
      expect(typeof s.strategyId).toBe('string');
      expect(typeof s.maxPositionPct).toBe('number');
    }
  });

  it('T2 setStrategyRunning 写入/读取正确（running + maxPositionPct）', async () => {
    await portfolio.setStrategyRunning('s1', true);
    const running = await portfolio.getStrategyConfig('s1');
    expect(running.running).toBe(true);
    expect(running.maxPositionPct).toBe(0.10); // 默认值

    await portfolio.setStrategyRunning('s1', false);
    const stopped = await portfolio.getStrategyConfig('s1');
    expect(stopped.running).toBe(false);
    // 关闭不应清空 maxPositionPct
    expect(stopped.maxPositionPct).toBe(0.10);
  });

  it('T3 create(name) 创建新 portfolio，多组合场景预留', async () => {
    const p = await portfolio.create('激进组合');
    expect(p.id).toMatch(/^pf_/);
    expect(p.name).toBe('激进组合');
    expect(p.cashReservePct).toBe(0.05); // T4 默认值
    // 不影响默认组合
    const summary = await portfolio.getSummary();
    expect(summary.portfolio.id).toBe('default');
    expect(summary.portfolio.name).not.toBe('激进组合');
  });

  it('T4 cashReservePct 默认 5%', async () => {
    const summary = await portfolio.getSummary();
    expect(summary.portfolio.cashReservePct).toBe(0.05);

    // create 时也能覆盖
    const custom = await portfolio.create('保守组合', { cashReservePct: 0.20 });
    expect(custom.cashReservePct).toBe(0.20);
  });

  it('T5 资金守恒 invariant 在多次买卖+重估后仍成立', async () => {
    paper.resetAccount('default', 200000);
    paper.startTrading('default', ['s1']);

    // BUY 100 @ 100
    const r1 = paper.executeSignal({
      type: 'BUY',
      symbol: '600519',
      name: '贵州茅台',
      price: 100,
      quantity: 100,
      reason: 'T5-建仓',
      strategyId: 's1',
    });
    expect(r1.success).toBe(true);

    // 涨价 100 → 110
    paper.markPrices({ '600519': 110 });

    // SELL 50 @ 115（部分卖出）
    const r2 = paper.executeSignal({
      type: 'SELL',
      symbol: '600519',
      name: '贵州茅台',
      price: 115,
      quantity: 50,
      reason: 'T5-减仓',
      strategyId: 's1',
    });
    expect(r2.success).toBe(true);

    // 再涨价 115 → 120
    paper.markPrices({ '600519': 120 });

    const result = portfolio.checkInvariant();
    expect(result.ok).toBe(true);
    // 验算：initial=200000, realized=(115-100)*50=750, unrealized=(120-100)*50=1000
    // cash = 200000 - 10000 + 5750 = 195750
    // marketValue = 50 * 120 = 6000
    // expected = 200000 + 750 + 1000 = 201750
    // actual = 195750 + 6000 = 201750
    expect(result.initialCapital).toBe(200000);
    expect(result.cash).toBe(195750);
    expect(result.marketValue).toBe(6000);
    expect(result.realizedPnl).toBe(750);
    expect(result.unrealizedPnl).toBe(1000);
    expect(result.expectedTotalValue).toBe(201750);
    expect(result.actualTotalValue).toBe(201750);
    expect(result.diff).toBe(0);
  });

  // -------- 风控约束 --------

  it('T6 单策略 maxPositionPct=0.5（半仓）约束正确，提议被截断', async () => {
    paper.resetAccount('default', 100000);
    paper.startTrading('default', ['s1']);
    await portfolio.setStrategyRunning('s1', true, { maxPositionPct: 0.5 });

    const cfg = await portfolio.getStrategyConfig('s1');
    expect(cfg.maxPositionPct).toBe(0.5);

    // 半仓上限 = 100000 * 0.5 = 50000
    const r1 = portfolio.clampProposalByStrategyPct({
      strategyId: 's1',
      symbol: '600519',
      name: '贵州茅台',
      price: 100,
      proposedAmount: 80000, // 超过半仓
    });
    expect(r1.capped).toBe(true);
    expect(r1.cappedAmount).toBe(50000);

    // 未超过上限 → 原样返回
    const r2 = portfolio.clampProposalByStrategyPct({
      strategyId: 's1',
      symbol: '600519',
      name: '贵州茅台',
      price: 100,
      proposedAmount: 30000,
    });
    expect(r2.capped).toBe(false);
    expect(r2.cappedAmount).toBe(30000);
  });

  it('T7 组合级 cashReservePct 阈值检查', async () => {
    paper.resetAccount('default', 100000);
    paper.startTrading('default', ['s1']);

    // 默认 cashReservePct=5%，可用资金 = 100000 * 0.95 = 95000
    const over = portfolio.checkCashReserve({
      proposedAmount: 96000,
      accountCash: 100000,
      cashReservePct: 0.05,
    });
    expect(over.allowed).toBe(false);
    expect(over.maxAllowed).toBe(95000);
    expect(over.reason).toContain('保留现金');

    const within = portfolio.checkCashReserve({
      proposedAmount: 90000,
      accountCash: 100000,
      cashReservePct: 0.05,
    });
    expect(within.allowed).toBe(true);
    expect(within.maxAllowed).toBe(95000);

    // 边界值：恰好等于允许值 → 通过
    const edge = portfolio.checkCashReserve({
      proposedAmount: 95000,
      accountCash: 100000,
      cashReservePct: 0.05,
    });
    expect(edge.allowed).toBe(true);
  });

  // -------- 多策略 BUY 去重 --------

  it('T8 同股票多策略 BUY 提议 → 实际仓位 ≤ min(proposed)，不重复扣费', async () => {
    paper.resetAccount('default', 100000);
    paper.startTrading('default', ['s1', 's2']);

    const proposals = [
      { strategyId: 's1', symbol: '600519', name: '贵州茅台', price: 100, proposedAmount: 20000 },
      { strategyId: 's2', symbol: '600519', name: '贵州茅台', price: 100, proposedAmount: 30000 },
    ];
    const deduped = portfolio.dedupeBuyProposals(proposals);
    expect(deduped.length).toBe(1);
    expect(deduped[0].symbol).toBe('600519');
    expect(deduped[0].finalAmount).toBe(20000); // 取最小
    expect(deduped[0].contributors.sort()).toEqual(['s1', 's2']);

    // 不同股票 → 分别保留
    const mixed = portfolio.dedupeBuyProposals([
      { strategyId: 's1', symbol: '600519', name: '贵州茅台', price: 100, proposedAmount: 20000 },
      { strategyId: 's2', symbol: '000858', name: '五粮液', price: 50, proposedAmount: 10000 },
    ]);
    expect(mixed.length).toBe(2);
    expect(mixed.map((d) => d.symbol).sort()).toEqual(['000858', '600519']);
  });

  // -------- 持久化 --------

  it('T9 setStrategyRunning 持久化到 beta_config，重启后仍可读取', async () => {
    await portfolio.setStrategyRunning('s2', true, { maxPositionPct: 0.20 });
    const cfg1 = await portfolio.getStrategyConfig('s2');
    expect(cfg1.running).toBe(true);
    expect(cfg1.maxPositionPct).toBe(0.20);

    // 用新的 service 实例（重读 beta_config）
    const strategy2 = new StrategyService(new IndicatorCalcService());
    const paper2 = new PaperTradingService(strategy2, persistence);
    const portfolio2 = new PortfolioService(persistence, strategy2, paper2);
    const cfg2 = await portfolio2.getStrategyConfig('s2');
    expect(cfg2.running).toBe(true);
    expect(cfg2.maxPositionPct).toBe(0.20);
  });
});
