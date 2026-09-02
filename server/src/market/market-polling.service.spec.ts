import { Test, TestingModule } from '@nestjs/testing';
import { MarketPollingService } from './market-polling.service';
import { MarketService } from './market.service';

// 测试数据隔离：独立 SQLite，禁止触碰生产库 data/quant.db
const TEST_DB = `/tmp/quant-test-${process.pid}-${Date.now()}-${Math.round(Math.random() * 1e9)}.db`;
process.env.SQLITE_PATH = TEST_DB;

describe('MarketPollingService (TDD)', () => {
  let service: MarketPollingService;
  let tickCount: number;
  let fetchSpy: jest.SpyInstance;

  const mockMarketService = {
    getMarketList: jest.fn().mockResolvedValue([
      { symbol: '600519', name: '贵州茅台', price: 1300 },
    ]),
  };

  beforeEach(async () => {
    tickCount = 0;
    jest.useFakeTimers();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketPollingService,
        { provide: MarketService, useValue: mockMarketService },
      ],
    }).compile();
    service = module.get(MarketPollingService);
    fetchSpy = mockMarketService.getMarketList;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('默认不开启轮询', () => {
    expect(service.isPolling()).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('start 后立即拉取一次行情', async () => {
    await service.start();
    expect(service.isPolling()).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('按间隔定时拉取行情', async () => {
    await service.start(1000);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(2500);
    expect(fetchSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('stop 后停止拉取', async () => {
    await service.start(1000);
    const count = fetchSpy.mock.calls.length;
    service.stop();
    expect(service.isPolling()).toBe(false);
    await jest.advanceTimersByTimeAsync(3000);
    expect(fetchSpy.mock.calls.length).toBe(count);
  });

  it('重复 start 不会创建多个定时器', async () => {
    await service.start(1000);
    await service.start(1000);
    await jest.advanceTimersByTimeAsync(1500);
    // 1次立即 + 1次interval = 2，不应翻倍
    expect(fetchSpy.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it('行情更新时通知订阅者', async () => {
    const subscriber = jest.fn();
    service.subscribe(subscriber);
    await service.start(1000);
    expect(subscriber).toHaveBeenCalled();
    const payload = subscriber.mock.calls[0][0];
    expect(Array.isArray(payload)).toBe(true);
  });
});

  afterAll(async () => {
    try {
      require('fs').unlinkSync(TEST_DB);
    } catch (e) {
      /* ignore */
    }
  });
