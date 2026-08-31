import { PersistenceService } from '../persistence/persistence.service';
import { StrategyService, CustomStrategy } from '../strategy/strategy.service';
import { PaperTradingService } from '../paper-trading/paper-trading.service';
import { NotificationService } from '../notification/notification.service';
import { WatchlistService } from '../stock/watchlist.service';
import { BetaConfigService } from './beta-config.service';
import { LivePnlService } from './live-pnl.service';

/**
 * 阶段3 TDD：实时行情联动收益 + 信号自动交易
 * SPEC: docs/SPEC-beta.md 2.3
 * 链路：onTick(行情快照) → 持仓重估(markPrices) → 关注股票策略信号 → 通知 → 自动下单
 * 可测试性：evaluateCondition 为确定性求值（价格阈值），不依赖随机
 */
describe('LivePnlService - 实时收益与自动交易', () => {
  let persistence: PersistenceService;
  let strategy: StrategyService;
  let paper: PaperTradingService;
  let notification: NotificationService;
  let watchlist: WatchlistService;
  let betaConfig: BetaConfigService;
  let live: LivePnlService;
  let strategyId: string;
  const dbPath = `/tmp/live-pnl-test-${Date.now()}.db`;

  const tickOf = (price: number, changePercent = -1) => [
    { symbol: '600519', price, changePercent },
  ];

  const setupAccount = () => {
    paper.resetAccount('default', 200000);
    paper.startTrading('default', ['s1']);
    const r = paper.executeSignal({
      type: 'BUY',
      symbol: '600519',
      name: '贵州茅台',
      price: 80,
      quantity: 2000,
      reason: 'setup',
      strategyId: 'setup',
    });
    expect(r.success).toBe(true);
  };

  beforeEach(() => {
    persistence = new PersistenceService(dbPath);
    persistence.init();
    strategy = new StrategyService();
    paper = new PaperTradingService(strategy);
    notification = new NotificationService(persistence);
    watchlist = new WatchlistService(persistence);
    betaConfig = new BetaConfigService(persistence, watchlist, strategy);
    live = new LivePnlService(paper, strategy, notification, watchlist, betaConfig);

    watchlist.addWatch('600519');
    watchlist.addWatch('000333');
    const s = strategy.createCustomStrategy({
      name: '内测低吸策略',
      symbol: '600519',
      buyConditions: [{ id: 'c1', indicator: 'price', operator: 'lte', value: 80, description: '价格≤80低吸' }],
      sellConditions: [],
      autoTrade: true,
      monitorEnabled: true,
    } as Partial<CustomStrategy>);
    strategyId = s.id;
    // 启动监控
    strategy.updateCustomStrategy(strategyId, { status: 'running' });
  });

  afterEach(() => {
    try {
      require('fs').unlinkSync(dbPath);
    } catch (e) {
      /* ignore */
    }
  });

  it('T1 markPrices 重估持仓市值与浮盈', () => {
    setupAccount();
    const acc = paper.markPrices({ '600519': 90 });
    const pos = acc.positions.find((p) => p.symbol === '600519')!;
    expect(pos.currentPrice).toBe(90);
    expect(pos.marketValue).toBe(180000);
    expect(pos.pnl).toBe(20000);
    expect(pos.pnlRate).toBeCloseTo(12.5, 5);
    expect(acc.totalValue).toBe(acc.cash + 180000);
    expect(acc.totalPnl).toBe(20000);
  });

  it('T2 markPrices 部分快照只更新命中的持仓', () => {
    setupAccount();
    const before = paper.getAccount().positions.find((p) => p.symbol === '600519')!;
    paper.markPrices({ '000333': 50 });
    const after = paper.getAccount().positions.find((p) => p.symbol === '600519')!;
    expect(after.marketValue).toBe(before.marketValue);
  });

  it('T3 markPrices 空快照安全无副作用', () => {
    setupAccount();
    const before = paper.getAccount().totalValue;
    paper.markPrices({});
    expect(paper.getAccount().totalValue).toBe(before);
  });

  it('T4 onTick 无信号：只重估，不交易', async () => {
    setupAccount();
    strategy.updateCustomStrategy(strategyId, { status: 'stopped' });
    const tradesBefore = paper.getAccount().trades.length;
    const stats = await live.onTick(tickOf(88));
    expect(stats).toMatchObject({ marked: 1, signals: 0, executed: 0 });
    expect(paper.getAccount().trades.length).toBe(tradesBefore);
  });

  it('T5 onTick 确定性买入信号 + autoTrade → 自动成交并通知', async () => {
    // 从空仓开始：信号触发后由自动交易建仓
    paper.resetAccount('default', 200000);
    paper.startTrading('default', ['s1']);
    const tradesBefore = paper.getAccount().trades.length;
    const stats = await live.onTick(tickOf(70));
    expect(stats.signals).toBeGreaterThanOrEqual(1);
    expect(stats.executed).toBe(1);
    expect(paper.getAccount().trades.length).toBe(tradesBefore + 1);
    const notifications = await persistence.listNotifications();
    expect(notifications.length).toBeGreaterThanOrEqual(1);
  });

  it('T6 autoTrade=false → 只通知不交易', async () => {
    setupAccount();
    betaConfig.saveConfig({ initialCapital: 200000, watchSymbols: ['600519'], strategyId: null, autoTrade: false });
    const tradesBefore = paper.getAccount().trades.length;
    const stats = await live.onTick(tickOf(70));
    expect(stats.signals).toBeGreaterThanOrEqual(1);
    expect(stats.executed).toBe(0);
    expect(paper.getAccount().trades.length).toBe(tradesBefore);
  });

  it('T7 未开启投资的关注股票不产生信号', async () => {
    watchlist.toggleWatch('600519', false);
    const stats = await live.onTick(tickOf(70));
    expect(stats.signals).toBe(0);
    expect(stats.executed).toBe(0);
  });

  it('T8 同方向同价格信号防抖：第二次不重复成交', async () => {
    setupAccount();
    await live.onTick(tickOf(70));
    const afterFirst = paper.getAccount().trades.length;
    const second = await live.onTick(tickOf(70));
    expect(second.executed).toBe(0);
    expect(paper.getAccount().trades.length).toBe(afterFirst);
  });

  it('T9 lastTickAt 持久化，getStatus 可查', async () => {
    await live.onTick(tickOf(88));
    const status = live.getStatus();
    expect(status.lastTickAt).toBeGreaterThan(0);
    expect(status.watchedEnabled).toBe(2);
  });
});
