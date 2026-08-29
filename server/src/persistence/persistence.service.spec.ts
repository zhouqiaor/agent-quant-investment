import { join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { PersistenceService } from './persistence.service';

const TEST_DIR = join(__dirname, 'test-data');
const TEST_DB = join(TEST_DIR, 'test.db');

describe('PersistenceService (数据持久化层)', () => {
  let service: PersistenceService;

  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    mkdirSync(TEST_DIR, { recursive: true });
    service = new PersistenceService(TEST_DB);
    service.init();
  });

  afterEach(() => {
    service.close();
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  // ---------- 自定义策略 ----------
  describe('自定义策略 CRUD', () => {
    const strategy = {
      name: 'MACD金叉策略',
      symbol: '600519',
      indicators: ['MACD'],
      buyConditions: [{ indicator: 'MACD', operator: 'cross_above', value: 0 }],
      sellConditions: [{ indicator: 'MACD', operator: 'cross_below', value: 0 }],
      positionSize: 15,
      stopLoss: 5,
      takeProfit: 12,
    };

    it('应能保存自定义策略并返回 id', () => {
      const id = service.saveCustomStrategy(strategy as any);
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
    });

    it('保存后应能按 id 查询且字段一致', () => {
      const id = service.saveCustomStrategy(strategy as any);
      const found = service.getCustomStrategy(id);
      expect(found).not.toBeNull();
      expect(found!.name).toBe(strategy.name);
      expect(found!.symbol).toBe('600519');
      expect(found!.positionSize).toBe(15);
    });

    it('复杂对象(indicators/conditions)应能正确序列化为 JSON', () => {
      const id = service.saveCustomStrategy(strategy as any);
      const found = service.getCustomStrategy(id)!;
      expect(Array.isArray(found.indicators)).toBe(true);
      expect(found.indicators).toContain('MACD');
      expect(Array.isArray(found.buyConditions)).toBe(true);
      expect((found.buyConditions as any[])[0].operator).toBe('cross_above');
    });

    it('应能查询所有自定义策略列表', () => {
      service.saveCustomStrategy(strategy as any);
      service.saveCustomStrategy({ ...strategy, id: 'test-custom-2', name: 'RSI超卖策略' } as any);
      const list = service.getAllCustomStrategies();
      expect(list.length).toBe(2);
    });

    it('应能删除策略', () => {
      const id = service.saveCustomStrategy(strategy as any);
      const deleted = service.deleteCustomStrategy(id);
      expect(deleted).toBe(true);
      expect(service.getCustomStrategy(id)).toBeNull();
    });

    it('删除不存在的策略应返回 false', () => {
      expect(service.deleteCustomStrategy('not-exist-id')).toBe(false);
    });

    it('数据应持久化(重新打开服务后仍存在)', () => {
      const id = service.saveCustomStrategy(strategy as any);
      service.close();
      const reopened = new PersistenceService(TEST_DB);
      reopened.init();
      const found = reopened.getCustomStrategy(id);
      expect(found).not.toBeNull();
      expect(found!.name).toBe(strategy.name);
      reopened.close();
    });
  });

  // ---------- 交易记录 ----------
  describe('交易记录', () => {
    const trade = {
      id: 't1',
      type: 'BUY',
      symbol: '600519',
      name: '贵州茅台',
      price: 1300,
      quantity: 100,
      amount: 130000,
      reason: 'MACD金叉',
      time: '2024-06-01 10:00:00',
    };

    it('应能保存交易记录', () => {
      service.saveTrade(trade as any);
      const trades = service.getTrades();
      expect(trades.length).toBe(1);
      expect(trades[0].symbol).toBe('600519');
      expect(trades[0].type).toBe('BUY');
    });

    it('应能按 code 过滤交易记录', () => {
      service.saveTrade(trade as any);
      service.saveTrade({ ...trade, id: 't2', code: '000858', symbol: '000858' } as any);
      const filtered = service.getTrades({ code: '600519' });
      expect(filtered.length).toBe(1);
      expect(filtered[0].code).toBe('600519');
    });

    it('应按时间倒序返回', () => {
      service.saveTrade({ ...trade, id: 'a', time: '2024-06-01 10:00:00' } as any);
      service.saveTrade({ ...trade, id: 'b', time: '2024-06-02 10:00:00' } as any);
      const trades = service.getTrades();
      expect(trades[0].id).toBe('b');
    });
  });

  // ---------- 回测结果 ----------
  describe('回测结果', () => {
    const result = {
      symbol: '600519',
      strategyReturn: 15.5,
      maxDrawdown: 8.2,
      sharpe: 1.3,
      winRate: 0.62,
      equityCurve: [{ date: '2024-01-01', value: 100000 }],
      trades: [{ id: '1', type: 'BUY' }],
    };

    it('应能保存回测结果并返回 id', () => {
      const id = service.saveBacktestResult(result as any);
      expect(id).toBeTruthy();
    });

    it('应能查询回测历史列表', () => {
      service.saveBacktestResult(result as any);
      service.saveBacktestResult({ ...result, id: 'bt-test-2', code: '000858' } as any);
      const list = service.getBacktestHistory();
      expect(list.length).toBe(2);
    });

    it('回测列表不应包含巨大的 equityCurve/trades 字段', () => {
      service.saveBacktestResult(result as any);
      const list = service.getBacktestHistory();
      expect((list[0] as any).equityCurve).toBeUndefined();
      expect(list[0].code).toBe('600519');
      expect(list[0].totalReturn).toBe(15.5);
    });

    it('应能按 id 查询完整回测详情', () => {
      const id = service.saveBacktestResult(result as any);
      const detail = service.getBacktestResult(id);
      expect(detail).not.toBeNull();
      expect((detail!.equityCurve as any[]).length).toBe(1);
      expect((detail!.trades as any[]).length).toBe(1);
    });
  });
});
