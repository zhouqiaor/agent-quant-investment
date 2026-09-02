/**
 * 阶段3 TDD 测试用例：策略参数优化服务（网格搜索）
 *
 * 参考 Freqtrade Hyperopt / Jesse 遗传算法优化的测试思路：
 * - 参数网格生成
 * - 优化执行与排序
 * - 最优参数返回
 * - 边界与异常
 */
import { Test } from '@nestjs/testing';
import { OptimizerService } from '../optimizer/optimizer.service';
import { BacktestService } from '../backtest/backtest.service';
import { StrategyService } from '../strategy/strategy.service';
import { MarketService } from '../market/market.service';
import { PersistenceService } from '../persistence/persistence.service';

// 测试数据隔离：独立 SQLite，禁止触碰生产库 data/quant.db
const TEST_DB = `/tmp/quant-test-${process.pid}-${Date.now()}-${Math.round(Math.random() * 1e9)}.db`;
process.env.SQLITE_PATH = TEST_DB;

describe('OptimizerService - 参数优化（网格搜索）', () => {
  let optimizer: OptimizerService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        OptimizerService,
        { provide: BacktestService, useValue: { runBacktest: jest.fn() } },
        { provide: StrategyService, useValue: { getStrategies: jest.fn(() => []) } },
        { provide: MarketService, useValue: {} },
        { provide: PersistenceService, useValue: { saveOptimization: jest.fn() } },
      ],
    }).compile();

    optimizer = moduleRef.get(OptimizerService);
  });

  describe('参数网格生成', () => {
    it('应为数值参数生成正确的网格', () => {
      const grid = optimizer.buildParamGrid([
        { name: 'fastPeriod', min: 5, max: 15, step: 5 }, // [5,10,15]
        { name: 'slowPeriod', min: 20, max: 30, step: 10 }, // [20,30]
      ]);
      expect(grid).toHaveLength(2);
      expect(grid[0].values).toEqual([5, 10, 15]);
      expect(grid[1].values).toEqual([20, 30]);
    });

    it('应生成正确的参数组合数（笛卡尔积）', () => {
      const count = optimizer.countCombinations([
        { name: 'a', min: 0, max: 10, step: 5 }, // 3
        { name: 'b', min: 0, max: 10, step: 5 }, // 3
        { name: 'c', min: 0, max: 10, step: 10 }, // 2
      ]);
      expect(count).toBe(18); // 3*3*2
    });

    it('应限制组合总数不超过上限', () => {
      const count = optimizer.countCombinations([
        { name: 'a', min: 1, max: 100, step: 1 }, // 100
        { name: 'b', min: 1, max: 100, step: 1 }, // 100 => 10000
      ], 500);
      expect(count).toBeLessThanOrEqual(500);
    });

    it('step 非法时应抛出错误', () => {
      expect(() =>
        optimizer.buildParamGrid([{ name: 'x', min: 1, max: 10, step: 0 }]),
      ).toThrow();
      expect(() =>
        optimizer.buildParamGrid([{ name: 'x', min: 1, max: 10, step: -2 }]),
      ).toThrow();
    });

    it('min > max 时应抛出错误', () => {
      expect(() =>
        optimizer.buildParamGrid([{ name: 'x', min: 10, max: 1, step: 1 }]),
      ).toThrow();
    });
  });

  describe('优化执行', () => {
    it('应返回按适应度排序的组合列表', async () => {
      const mockRun = jest
        .fn()
        .mockResolvedValueOnce({ totalReturn: 5, sharpeRatio: 0.5, winRate: 40, maxDrawdown: 10 })
        .mockResolvedValueOnce({ totalReturn: 20, sharpeRatio: 1.5, winRate: 70, maxDrawdown: 5 })
        .mockResolvedValueOnce({ totalReturn: 12, sharpeRatio: 1.0, winRate: 55, maxDrawdown: 8 })
        .mockResolvedValueOnce({ totalReturn: 2, sharpeRatio: 0.2, winRate: 35, maxDrawdown: 12 });

      (optimizer as any).backtestService.runBacktest = mockRun;

      const result = await optimizer.optimize({
        symbol: '600519',
        startDate: '2024-01-01',
        endDate: '2024-06-30',
        initialCapital: 100000,
        paramSpace: [
          { name: 'fastPeriod', min: 5, max: 10, step: 5 }, // 2
          { name: 'slowPeriod', min: 20, max: 30, step: 10 }, // 2
        ],
        objective: 'totalReturn',
      });

      expect(result.totalCombinations).toBe(4);
      expect(result.evaluated).toBe(4);
      expect(result.results).toHaveLength(4);
      // 最优组合的 totalReturn 应为最大
      expect(result.results[0].fitness).toBeGreaterThanOrEqual(
        result.results[1].fitness,
      );
      expect(result.bestParams).toBeDefined();
      expect(result.bestResult).toBeDefined();
    });

    it('回测失败时该组合适应度记为 -Infinity 而非中断', async () => {
      const mockRun = jest
        .fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValue({ totalReturn: 10, sharpeRatio: 1, winRate: 60, maxDrawdown: 6 });
      (optimizer as any).backtestService.runBacktest = mockRun;

      const result = await optimizer.optimize({
        symbol: '600519',
        startDate: '2024-01-01',
        endDate: '2024-06-30',
        initialCapital: 100000,
        paramSpace: [{ name: 'fastPeriod', min: 1, max: 3, step: 1 }],
        objective: 'totalReturn',
      });
      expect(result.results[0].fitness).toBe(10);
      const worst = result.results[result.results.length - 1];
      expect(worst.fitness).toBe(-Infinity);
    });

    it('夏普比率目标应使用 sharpeRatio 字段', async () => {
      const mockRun = jest
        .fn()
        .mockResolvedValue({ totalReturn: 1, sharpeRatio: 2.5, winRate: 60, maxDrawdown: 5 });
      (optimizer as any).backtestService.runBacktest = mockRun;

      const result = await optimizer.optimize({
        symbol: '600519',
        startDate: '2024-01-01',
        endDate: '2024-06-30',
        initialCapital: 100000,
        paramSpace: [{ name: 'fastPeriod', min: 1, max: 2, step: 1 }],
        objective: 'sharpeRatio',
      });
      expect(result.results[0].fitness).toBe(2.5);
    });

    it('paramSpace 为空应抛出错误', async () => {
      await expect(
        optimizer.optimize({
          symbol: '600519',
          startDate: '2024-01-01',
          endDate: '2024-06-30',
          initialCapital: 100000,
          paramSpace: [],
          objective: 'totalReturn',
        }),
      ).rejects.toThrow();
    });

    it('日期区间非法应抛出错误', async () => {
      await expect(
        optimizer.optimize({
          symbol: '600519',
          startDate: '2024-06-30',
          endDate: '2024-01-01',
          initialCapital: 100000,
          paramSpace: [{ name: 'fastPeriod', min: 1, max: 3, step: 1 }],
          objective: 'totalReturn',
        }),
      ).rejects.toThrow();
    });
  });

  describe('综合适应度（多目标加权）', () => {
    it('应正确计算收益/夏普/胜率的加权得分', () => {
      const score = (optimizer as any).computeFitness(
        { totalReturn: 20, sharpeRatio: 1.0, winRate: 50, maxDrawdown: 10 },
        'composite',
      );
      // composite = 0.5*return + 0.3*sharpe*10 + 0.2*winRate - 0.5*maxDrawdown*10
      const expected =
        0.5 * 20 + 0.3 * (1.0 * 10) + 0.2 * 50 - 0.5 * (10 * 10);
      expect(score).toBeCloseTo(expected, 5);
    });
  });
});

  afterAll(async () => {
    try {
      require('fs').unlinkSync(TEST_DB);
    } catch (e) {
      /* ignore */
    }
  });
