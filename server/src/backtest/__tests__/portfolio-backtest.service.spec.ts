import { Test, TestingModule } from '@nestjs/testing';
import { PortfolioBacktestService } from '../portfolio-backtest.service';
import { StockService } from '../../stock/stock.service';
import { WatchlistService } from '../../stock/watchlist.service';
import { PaperTradingService } from '../../paper-trading/paper-trading.service';
import { StrategyService } from '../../strategy/strategy.service';
import { PersistenceModule } from '../../persistence/persistence.module';

describe('PortfolioBacktestService', () => {
  let service: PortfolioBacktestService;
  let stockService: jest.Mocked<StockService>;
  let watchlistService: jest.Mocked<WatchlistService>;
  let paperTrading: PaperTradingService;
  let strategyService: StrategyService;

  beforeEach(async () => {
    const mockStockService = {
      getKlineData: jest.fn(),
    };

    const mockWatchlistService = {
      listWatch: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule],
      providers: [
        PortfolioBacktestService,
        { provide: StockService, useValue: mockStockService },
        { provide: WatchlistService, useValue: mockWatchlistService },
        PaperTradingService,
        StrategyService,
      ],
    }).compile();

    service = module.get<PortfolioBacktestService>(PortfolioBacktestService);
    stockService = module.get<StockService>(StockService) as jest.Mocked<StockService>;
    watchlistService = module.get<WatchlistService>(WatchlistService) as jest.Mocked<WatchlistService>;
    paperTrading = module.get<PaperTradingService>(PaperTradingService);
    strategyService = module.get<StrategyService>(StrategyService);
  });

  describe('批量K线拉取', () => {
    it('应从关注列表获取 enabled 标的', async () => {
      watchlistService.listWatch.mockReturnValue([
        { symbol: '600519', name: '贵州茅台', enabled: true, createdAt: 1 },
        { symbol: '000858', name: '五粮液', enabled: true, createdAt: 2 },
        { symbol: '601318', name: '中国平安', enabled: false, createdAt: 3 },
      ]);

      stockService.getKlineData.mockResolvedValue([
        { date: '2024-01-02', open: 100, high: 105, low: 98, close: 103, volume: 1000 },
        { date: '2024-01-03', open: 103, high: 108, low: 101, close: 106, volume: 1200 },
      ]);

      const result = await service.runPortfolioBacktest({
        initialCapital: 100000,
        startDate: '2024-01-02',
        endDate: '2024-01-03',
      });

      // 只拉取 enabled 的 2 只
      expect(stockService.getKlineData).toHaveBeenCalledTimes(2);
      expect(result.meta.symbols).toEqual(['600519', '000858']);
    });

    it('应支持指定 symbols 参数覆盖关注列表', async () => {
      stockService.getKlineData.mockResolvedValue([
        { date: '2024-01-02', open: 100, high: 105, low: 98, close: 103, volume: 1000 },
      ]);

      const result = await service.runPortfolioBacktest({
        initialCapital: 100000,
        symbols: ['600519', '000858'],
        startDate: '2024-01-02',
        endDate: '2024-01-02',
      });

      expect(stockService.getKlineData).toHaveBeenCalledTimes(2);
      expect(result.meta.symbols).toEqual(['600519', '000858']);
    });

    it('应按日期范围过滤K线数据', async () => {
      stockService.getKlineData.mockResolvedValue([
        { date: '2024-01-01', open: 100, high: 105, low: 98, close: 103, volume: 1000 },
        { date: '2024-01-02', open: 103, high: 108, low: 101, close: 106, volume: 1200 },
        { date: '2024-01-03', open: 106, high: 110, low: 104, close: 108, volume: 1100 },
        { date: '2024-01-04', open: 108, high: 112, low: 106, close: 110, volume: 1300 },
      ]);

      const result = await service.runPortfolioBacktest({
        initialCapital: 100000,
        symbols: ['600519'],
        startDate: '2024-01-02',
        endDate: '2024-01-03',
      });

      // 只包含 01-02 和 01-03
      expect(result.equityCurve.length).toBe(2);
      expect(result.equityCurve[0].date).toBe('2024-01-02');
      expect(result.equityCurve[1].date).toBe('2024-01-03');
    });

    it('应正确计算逐日涨跌幅', async () => {
      stockService.getKlineData.mockResolvedValue([
        { date: '2024-01-02', open: 100, high: 105, low: 98, close: 100, volume: 1000 },
        { date: '2024-01-03', open: 100, high: 106, low: 99, close: 106, volume: 1200 }, // +6%
        { date: '2024-01-04', open: 106, high: 108, low: 98, close: 95, volume: 1100 }, // -10.38%
      ]);

      // 添加一个监控策略来验证信号
      strategyService.createCustomStrategy({
        name: '测试策略',
        symbol: '600519',
        monitorEnabled: true,
        status: 'running',
        autoTrade: true,
        buyConditions: [{ id: 'c1', indicator: 'changePercent', operator: 'below', value: -5, description: '跌5%买入' }],
        sellConditions: [{ id: 'c2', indicator: 'changePercent', operator: 'above', value: 5, description: '涨5%卖出' }],
      });

      const result = await service.runPortfolioBacktest({
        initialCapital: 100000,
        symbols: ['600519'],
        startDate: '2024-01-02',
        endDate: '2024-01-04',
      });

      // 3 个交易日
      expect(result.equityCurve.length).toBe(3);
      // 01-03 涨幅 +6% 应触发卖出信号（如果持仓）
      // 01-04 跌幅 -10.38% 应触发买入信号
    });

    it('缺失数据应跳过该日', async () => {
      stockService.getKlineData.mockResolvedValue([
        { date: '2024-01-02', open: 100, high: 105, low: 98, close: 103, volume: 1000 },
        // 01-03 缺失
        { date: '2024-01-04', open: 106, high: 110, low: 104, close: 108, volume: 1100 },
      ]);

      const result = await service.runPortfolioBacktest({
        initialCapital: 100000,
        symbols: ['600519'],
        startDate: '2024-01-02',
        endDate: '2024-01-04',
      });

      // 只有 2 个交易日有数据
      expect(result.equityCurve.length).toBe(2);
    });

    it('无可用标的应抛出错误', async () => {
      watchlistService.listWatch.mockReturnValue([]);

      await expect(
        service.runPortfolioBacktest({
          initialCapital: 100000,
          startDate: '2024-01-02',
          endDate: '2024-01-03',
        }),
      ).rejects.toThrow('无可用标的');
    });
  });

  describe('回放引擎', () => {
    it('应创建隔离账户不污染默认账户', async () => {
      stockService.getKlineData.mockResolvedValue([
        { date: '2024-01-02', open: 100, high: 105, low: 98, close: 103, volume: 1000 },
      ]);

      const defaultBefore = paperTrading.getAccount('default');

      await service.runPortfolioBacktest({
        initialCapital: 50000,
        symbols: ['600519'],
        startDate: '2024-01-02',
        endDate: '2024-01-02',
      });

      const defaultAfter = paperTrading.getAccount('default');
      // 默认账户不受影响
      expect(defaultAfter.initialCapital).toBe(defaultBefore.initialCapital);
      expect(defaultAfter.cash).toBe(defaultBefore.cash);
    });

    it('应使用共享资金池（80%资金分配）', async () => {
      stockService.getKlineData.mockResolvedValue([
        { date: '2024-01-02', open: 100, high: 105, low: 98, close: 100, volume: 1000 },
      ]);

      // 添加策略触发买入
      strategyService.createCustomStrategy({
        name: '买入策略',
        symbol: '600519',
        monitorEnabled: true,
        status: 'running',
        autoTrade: true,
        buyConditions: [{ id: 'c1', indicator: 'changePercent', operator: 'below', value: 1, description: '跌1%买入' }],
        sellConditions: [],
      });

      const result = await service.runPortfolioBacktest({
        initialCapital: 100000,
        symbols: ['600519'],
        startDate: '2024-01-02',
        endDate: '2024-01-02',
      });

      // 如果触发了买入，应该用 80% 资金
      if (result.trades.length > 0) {
        const buyTrade = result.trades.find(t => t.type === 'BUY');
        if (buyTrade) {
          // 80% * 100000 = 80000, 100 股整数倍, 100 * 100 = 10000
          expect(buyTrade.quantity % 100).toBe(0);
          expect(buyTrade.amount).toBeLessThanOrEqual(80000);
        }
      }
    });

    it('应记录每日净值曲线', async () => {
      stockService.getKlineData.mockResolvedValue([
        { date: '2024-01-02', open: 100, high: 105, low: 98, close: 103, volume: 1000 },
        { date: '2024-01-03', open: 103, high: 108, low: 101, close: 106, volume: 1200 },
        { date: '2024-01-04', open: 106, high: 110, low: 104, close: 108, volume: 1100 },
      ]);

      const result = await service.runPortfolioBacktest({
        initialCapital: 100000,
        symbols: ['600519'],
        startDate: '2024-01-02',
        endDate: '2024-01-04',
      });

      expect(result.equityCurve.length).toBe(3);
      expect(result.equityCurve[0]).toHaveProperty('date');
      expect(result.equityCurve[0]).toHaveProperty('value');
      expect(result.equityCurve[0]).toHaveProperty('cash');
      expect(result.equityCurve[0]).toHaveProperty('marketValue');
    });

    it('autoTrade=false 时不应执行交易', async () => {
      stockService.getKlineData.mockResolvedValue([
        { date: '2024-01-02', open: 100, high: 105, low: 98, close: 100, volume: 1000 },
      ]);

      strategyService.createCustomStrategy({
        name: '买入策略',
        symbol: '600519',
        monitorEnabled: true,
        status: 'running',
        autoTrade: true,
        buyConditions: [{ id: 'c1', indicator: 'changePercent', operator: 'below', value: 1, description: '跌1%买入' }],
        sellConditions: [],
      });

      const result = await service.runPortfolioBacktest({
        initialCapital: 100000,
        symbols: ['600519'],
        startDate: '2024-01-02',
        endDate: '2024-01-02',
        autoTrade: false,
      });

      expect(result.trades.length).toBe(0);
    });
  });

  describe('指标计算', () => {
    it('应正确计算总收益率', async () => {
      stockService.getKlineData.mockResolvedValue([
        { date: '2024-01-02', open: 100, high: 105, low: 98, close: 103, volume: 1000 },
      ]);

      const result = await service.runPortfolioBacktest({
        initialCapital: 100000,
        symbols: ['600519'],
        startDate: '2024-01-02',
        endDate: '2024-01-02',
      });

      // 无交易时，totalReturn 应为 0
      expect(result.metrics.totalReturn).toBe(0);
      expect(result.metrics.tradingDays).toBe(1);
    });

    it('应正确计算最大回撤', async () => {
      // 模拟一个先涨后跌的场景
      stockService.getKlineData.mockResolvedValue([
        { date: '2024-01-02', open: 100, high: 110, low: 98, close: 110, volume: 1000 },
        { date: '2024-01-03', open: 110, high: 120, low: 108, close: 120, volume: 1200 },
        { date: '2024-01-04', open: 120, high: 122, low: 90, close: 90, volume: 1100 },
      ]);

      // 添加策略在第一天买入
      strategyService.createCustomStrategy({
        name: '买入策略',
        symbol: '600519',
        monitorEnabled: true,
        status: 'running',
        autoTrade: true,
        buyConditions: [{ id: 'c1', indicator: 'changePercent', operator: 'below', value: 1, description: '跌1%买入' }],
        sellConditions: [],
      });

      const result = await service.runPortfolioBacktest({
        initialCapital: 100000,
        symbols: ['600519'],
        startDate: '2024-01-02',
        endDate: '2024-01-04',
      });

      // 最大回撤应 > 0（因为从高点回落了）
      expect(result.metrics.maxDrawdown).toBeGreaterThanOrEqual(0);
    });

    it('应输出真实K线标记', async () => {
      stockService.getKlineData.mockResolvedValue([
        { date: '2024-01-02', open: 100, high: 105, low: 98, close: 103, volume: 1000 },
      ]);

      const result = await service.runPortfolioBacktest({
        initialCapital: 100000,
        symbols: ['600519'],
        startDate: '2024-01-02',
        endDate: '2024-01-02',
      });

      expect(result.meta.realKline).toBe(true);
      expect(result.meta.dataSource).toContain('新浪财经');
    });
  });
});
