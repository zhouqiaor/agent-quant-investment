import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { BacktestService } from './backtest.service';
import { StrategyService } from '../strategy/strategy.service';
import { MarketService } from '../market/market.service';

/**
 * 阶段2 TDD：回测自定义金额/时间段校验与收益模拟
 * SPEC: docs/SPEC-custom.md 2.2
 * - 金额: >0 且 ≤1e9
 * - 日期: YYYY-MM-DD 格式, start < end, 跨度 ≤3650 天
 * - 收益正确性: 金额等比缩放(totalReturn 不变, finalCapital 等比), 曲线起点=初始资金
 */
// 测试数据隔离：独立 SQLite，禁止触碰生产库 data/quant.db
const TEST_DB = `/tmp/quant-test-${process.pid}-${Date.now()}-${Math.round(Math.random() * 1e9)}.db`;
process.env.SQLITE_PATH = TEST_DB;

describe('BacktestService - 自定义金额/时间段', () => {
  let service: BacktestService;

  const validReq = {
    symbol: '600519',
    startDate: '2024-01-01',
    endDate: '2024-06-30',
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        BacktestService,
        { provide: StrategyService, useValue: { getStrategies: () => [] } },
        { provide: MarketService, useValue: {} },
      ],
    }).compile();
    service = moduleRef.get(BacktestService);
  });

  it('T1 金额 ≤0 → 400', async () => {
    await expect(service.runBacktest({ ...validReq, initialCapital: 0 })).rejects.toThrow(BadRequestException);
    await expect(service.runBacktest({ ...validReq, initialCapital: -100 })).rejects.toThrow(BadRequestException);
  });

  it('T2 金额 >1e9 → 400', async () => {
    await expect(service.runBacktest({ ...validReq, initialCapital: 1e9 + 1 })).rejects.toThrow(BadRequestException);
  });

  it('T3 非法日期格式 → 400（提示日期格式）', async () => {
    await expect(
      service.runBacktest({ ...validReq, initialCapital: 100000, startDate: '20240101' }),
    ).rejects.toThrow(/日期格式/);
    await expect(
      service.runBacktest({ ...validReq, initialCapital: 100000, endDate: '2024/06/30' }),
    ).rejects.toThrow(/日期格式/);
  });

  it('T4 start ≥ end → 400', async () => {
    await expect(
      service.runBacktest({ ...validReq, initialCapital: 100000, startDate: '2024-06-30', endDate: '2024-01-01' }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.runBacktest({ ...validReq, initialCapital: 100000, startDate: '2024-06-30', endDate: '2024-06-30' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('T5 跨度 >3650 天 → 400', async () => {
    await expect(
      service.runBacktest({ ...validReq, initialCapital: 100000, startDate: '2010-01-01', endDate: '2024-06-30' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('T6 金额等比：A vs 10A → totalReturn 相等, finalCapital 10倍', async () => {
    const r1 = await service.runBacktest({ ...validReq, initialCapital: 10000 });
    const r2 = await service.runBacktest({ ...validReq, initialCapital: 100000 });
    expect(r2.totalReturn).toBeCloseTo(r1.totalReturn, 6);
    expect(r2.finalCapital / r1.finalCapital).toBeCloseTo(10, 4);
  });

  it('T7 equityCurve[0].value === initialCapital', async () => {
    const r = await service.runBacktest({ ...validReq, initialCapital: 88888 });
    expect(r.equityCurve[0].value).toBe(88888);
    expect(r.initialCapital).toBe(88888);
  });

  it('T8 自定义金额+区间正常回测（不同区间可运行）', async () => {
    const r1 = await service.runBacktest({ ...validReq, initialCapital: 50000, endDate: '2024-03-31' });
    const r2 = await service.runBacktest({ ...validReq, initialCapital: 50000 });
    expect(r1.tradingDays).toBeGreaterThan(0);
    expect(r2.tradingDays).toBeGreaterThanOrEqual(r1.tradingDays);
    expect(typeof r1.totalReturn).toBe('number');
    expect(typeof r1.maxDrawdown).toBe('number');
  });
});

  afterAll(async () => {
    try {
      require('fs').unlinkSync(TEST_DB);
    } catch (e) {
      /* ignore */
    }
  });
