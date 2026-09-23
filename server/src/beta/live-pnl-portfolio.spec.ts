import { PersistenceService } from '../persistence/persistence.service';
import { StrategyService, CustomStrategy } from '../strategy/strategy.service';
import { PaperTradingService } from '../paper-trading/paper-trading.service';
import { NotificationService } from '../notification/notification.service';
import { WatchlistService } from '../stock/watchlist.service';
import { BetaConfigService } from './beta-config.service';
import { LivePnlService } from './live-pnl.service';
import { PortfolioService } from '../portfolio/portfolio.service';
import { IndicatorCalcService } from '@/indicators';

/**
 * Part 2 TDD：live-pnl portfolio 双路径
 * - legacy 路径由 live-pnl.spec.ts 覆盖（保持全绿）
 * - 本文件：portfolio 模式去重 / cashReserve / maxPositionPct / notify / flag 隔离
 */
describe('LivePnlService - portfolio 模式（多策略组合）', () => {
  let persistence: PersistenceService;
  let strategy: StrategyService;
  let paper: PaperTradingService;
  let notification: NotificationService;
  let watchlist: WatchlistService;
  let betaConfig: BetaConfigService;
  let portfolio: PortfolioService;
  let live: LivePnlService;
  const dbPath = `/tmp/live-pnl-portfolio-${Date.now()}.db`;

  const tickOf = (price: number, changePercent = -1) => [
    { symbol: '600519', price, changePercent },
  ];

  const createBuyStrategy = async (name: string) => {
    // 底层 createCustomStrategy id 为 cs_${Date.now()}，同毫秒会撞 id（且 update 按 first match）
    await new Promise((r) => setTimeout(r, 1));
    const s = strategy.createCustomStrategy({
      name,
      symbol: '600519',
      buyConditions: [{ id: 'c1', indicator: 'price', operator: 'lte', value: 80, description: '价格≤80低吸' }],
      sellConditions: [],
      autoTrade: true,
      monitorEnabled: true,
    } as Partial<CustomStrategy>);
    strategy.updateCustomStrategy(s.id, { status: 'running' });
    return s.id;
  };

  const createSellStrategy = async (name: string) => {
    await new Promise((r) => setTimeout(r, 1));
    const s = strategy.createCustomStrategy({
      name,
      symbol: '600519',
      buyConditions: [],
      sellConditions: [{ id: 's1', indicator: 'price', operator: 'gte', value: 100, description: '价格≥100止盈' }],
      autoTrade: true,
      monitorEnabled: true,
    } as Partial<CustomStrategy>);
    strategy.updateCustomStrategy(s.id, { status: 'running' });
    return s.id;
  };

  const freshAccount = (capital = 200000) => {
    paper.resetAccount('default', capital);
    paper.startTrading('default', ['s1']);
  };

  beforeEach(() => {
    delete process.env.PORTFOLIO_MODE;
    persistence = new PersistenceService(dbPath);
    persistence.init();
    // Windows 上 SQLite 文件可能因占用无法 unlink（afterEach 的 unlink 静默失败），显式清空全部表防串数据
    persistence.clearAllData();
    strategy = new StrategyService(new IndicatorCalcService());
    paper = new PaperTradingService(strategy);
    notification = new NotificationService(persistence);
    watchlist = new WatchlistService(persistence);
    betaConfig = new BetaConfigService(persistence, watchlist, strategy);
    portfolio = new PortfolioService(persistence, strategy, paper);
    live = new LivePnlService(paper, strategy, notification, watchlist, betaConfig, portfolio);

    watchlist.addWatch('600519');
    watchlist.addWatch('000333');
  });

  afterEach(() => {
    delete process.env.PORTFOLIO_MODE;
    try {
      require('fs').unlinkSync(dbPath);
    } catch (e) {
      /* ignore */
    }
  });

  it('P1 同股两策略 BUY → 去重仅成交一笔，金额 ≤ min(proposals)', async () => {
    process.env.PORTFOLIO_MODE = 'portfolio';
    freshAccount();
    const idA = await createBuyStrategy('策略A');
    const idB = await createBuyStrategy('策略B');
    // 两策略均给 50% 上限：原始意向 min=40000，不截断
    await portfolio.setStrategyRunning(idA, true, { maxPositionPct: 0.5 });
    await portfolio.setStrategyRunning(idB, true, { maxPositionPct: 0.5 });

    const stats = await live.onTick(tickOf(70));
    expect(stats.signals).toBe(2);
    expect(stats.executed).toBe(1);
    const trades = paper.getAccount().trades.filter((t) => t.symbol === '600519' && t.type === 'BUY');
    expect(trades).toHaveLength(1);
    // 原始意向 200000*20%=40000；去重取 min=40000；成交金额不得超过
    expect(trades[0].amount).toBeLessThanOrEqual(40000);
  });

  it('P2 cashReserve 不足 → 跳过提议：不成交且不通知', async () => {
    process.env.PORTFOLIO_MODE = 'portfolio';
    freshAccount();
    const id = await createBuyStrategy('低现金策略');
    // 默认 maxPositionPct=10% → cap=20000；现金仅 20000 → 5% 保留后最多用 19000 → 拒绝
    await portfolio.setStrategyRunning(id, true);
    // 通过另一标的手动建仓把现金压到 20000：
    // manualBuy 仅在已持仓时走 allowExisting 路径（不受 80% 上限），故先建底仓再加仓
    expect(paper.manualBuy('000333', '美的集团', 10, 100, 'drain-base').success).toBe(true);
    const drain = paper.manualBuy('000333', '美的集团', 10, 17900, 'drain');
    expect(drain.success).toBe(true);
    expect(paper.getAccount().cash).toBe(20000);

    const stats = await live.onTick(tickOf(70));
    expect(stats.executed).toBe(0);
    const trades = paper.getAccount().trades.filter((t) => t.symbol === '600519');
    expect(trades).toHaveLength(0);
    const notes = await persistence.listNotifications();
    expect(notes.filter((n) => n.symbol === '600519')).toHaveLength(0);
  });

  it('P3 策略 maxPositionPct 截断：成交金额 ≤ initialCapital*maxPct', async () => {
    process.env.PORTFOLIO_MODE = 'portfolio';
    freshAccount();
    const id = await createBuyStrategy('小仓位策略');
    await portfolio.setStrategyRunning(id, true, { maxPositionPct: 0.05 }); // cap=10000

    const stats = await live.onTick(tickOf(70));
    expect(stats.executed).toBe(1);
    const trade = paper.getAccount().trades.find((t) => t.symbol === '600519')!;
    expect(trade.amount).toBeLessThanOrEqual(10000);
    // 70 元/股、1 手 100 股 → 实际 7000
    expect(trade.quantity).toBe(100);
  });

  it('P4 notify 仍被调用且原始 reason 保留', async () => {
    process.env.PORTFOLIO_MODE = 'portfolio';
    freshAccount();
    const id = await createBuyStrategy('通知策略');
    await portfolio.setStrategyRunning(id, true, { maxPositionPct: 0.5 });
    const notifySpy = jest.spyOn(notification, 'notify');

    await live.onTick(tickOf(70));
    expect(notifySpy).toHaveBeenCalledTimes(1);
    const arg = notifySpy.mock.calls[0][0];
    expect(arg.symbol).toBe('600519');
    expect(arg.type).toBe('BUY');
    // reason 由策略引擎生成（price 操作符触发买入信号），原样透传
    expect(arg.reason).toContain('price');
    expect(arg.reason).toContain('买入');
    // 持久化通知标题同样保留买卖方向
    const notes = await persistence.listNotifications();
    expect(notes.some((n) => n.symbol === '600519' && n.title?.includes('买入'))).toBe(true);
  });

  it('P5 flag 关闭时 PortfolioService 完全不被调用（走 legacy）', async () => {
    // flag 默认关闭（env 未设置、beta_config 无 portfolio_enabled）
    freshAccount();
    const id = await createBuyStrategy('legacy策略');
    const mockPortfolio = {
      getSummary: jest.fn(),
      dedupeBuyProposals: jest.fn(),
      checkCashReserve: jest.fn(),
      clampProposalByMaxPct: jest.fn(),
      getStrategyConfig: jest.fn(),
      checkInvariant: jest.fn(),
    };
    const legacyLive = new LivePnlService(
      paper, strategy, notification, watchlist, betaConfig, mockPortfolio as never,
    );

    const stats = await legacyLive.onTick(tickOf(70));
    expect(stats.executed).toBe(1);
    expect(mockPortfolio.getSummary).not.toHaveBeenCalled();
    expect(mockPortfolio.dedupeBuyProposals).not.toHaveBeenCalled();
    expect(mockPortfolio.checkInvariant).not.toHaveBeenCalled();
    // 真实 portfolio 也未被触碰（id 仅创建策略，未注册组合）
    expect(id).toBeTruthy();
  });

  it('P6 beta_config.portfolio_enabled=true 可开启（env 缺省）', async () => {
    freshAccount();
    betaConfig.saveConfig({
      initialCapital: 200000,
      watchSymbols: ['600519'],
      strategyId: null,
      autoTrade: true,
      portfolio_enabled: true,
    } as never);
    const idA = await createBuyStrategy('配置策略A');
    const idB = await createBuyStrategy('配置策略B');
    await portfolio.setStrategyRunning(idA, true, { maxPositionPct: 0.5 });
    await portfolio.setStrategyRunning(idB, true, { maxPositionPct: 0.5 });

    const stats = await live.onTick(tickOf(70));
    expect(stats.executed).toBe(1); // 去重生效
  });

  it('P7 PORTFOLIO_MODE=legacy 显式关闭 → legacy 逐信号路径', async () => {
    process.env.PORTFOLIO_MODE = 'legacy';
    freshAccount();
    const mockPortfolio = { getSummary: jest.fn(), dedupeBuyProposals: jest.fn() };
    const l = new LivePnlService(
      paper, strategy, notification, watchlist, betaConfig, mockPortfolio as never,
    );
    const id = await createBuyStrategy('显式legacy');
    const stats = await l.onTick(tickOf(70));
    expect(stats.executed).toBe(1);
    expect(mockPortfolio.getSummary).not.toHaveBeenCalled();
    expect(id).toBeTruthy();
  });

  it('P8 portfolio 模式下 SELL 信号正常通知并成交', async () => {
    process.env.PORTFOLIO_MODE = 'portfolio';
    freshAccount();
    // 持仓 600519
    const setup = paper.executeSignal({
      type: 'BUY',
      symbol: '600519',
      name: '贵州茅台',
      price: 80,
      quantity: 1000,
      reason: 'setup',
      strategyId: 'setup',
    });
    expect(setup.success).toBe(true);

    const sellStrategyId = await createSellStrategy('止盈策略');
    await portfolio.setStrategyRunning(sellStrategyId, true, { maxPositionPct: 0.5 });
    jest.spyOn(notification, 'notify');

    const stats = await live.onTick(tickOf(110, 3));
    expect(stats.executed).toBe(1);
    expect(paper.getAccount().positions.filter((p) => p.symbol === '600519')).toHaveLength(0);
    const sellArg = jest.mocked(notification.notify).mock.calls.find(
      (c) => c[0].symbol === '600519' && c[0].type === 'SELL',
    )?.[0];
    expect(sellArg).toBeTruthy();
    expect(sellArg!.reason).toContain('卖出');
    const notes = await persistence.listNotifications();
    expect(notes.some((n) => n.symbol === '600519' && n.title?.includes('卖出'))).toBe(true);
  });
});
