/**
 * StrategyService per-strategy indicatorConfig（TDD）
 *
 * 覆盖：
 *  - 策略设置 maPeriods=[5] → enrichSignalReason 用 5 周期 MA
 *  - 策略未设置 → fallback 默认
 *  - 多个策略不同 config 并存（不互相污染）
 *  - config 校验失败时 enrich 静默回退默认
 */
import { Test } from '@nestjs/testing';
import { StrategyService } from './strategy.service';
import { StockService } from '@/stock/stock.service';
import { IndicatorCalcService } from '@/indicators';
import type { KlineData } from '@/stock/stock.service';

// 测试数据隔离：独立 SQLite
const TEST_DB = `/tmp/quant-test-strategy-cfg-${process.pid}-${Date.now()}-${Math.round(
  Math.random() * 1e9,
)}.db`;
process.env.SQLITE_PATH = TEST_DB;

function makeKline(close: number, date = '2024-06-01'): KlineData {
  return { date, open: close, high: close, low: close, close, volume: 1000 };
}

/** 构造一个上涨趋势足够长的 K 线数组（80 根确保 MA60 warmup 完成） */
function buildTrendKlines(): KlineData[] {
  const closes: number[] = [];
  for (let i = 0; i < 40; i++) closes.push(100 + i * 0.3);
  for (let i = 0; i < 10; i++) closes.push(112);
  for (let i = 0; i < 30; i++) closes.push(112 + i * 1.2);
  return closes.map((c, i) => makeKline(c, `2024-06-${(i + 1).toString().padStart(2, '0')}`));
}

describe('StrategyService - per-strategy indicatorConfig (TDD)', () => {
  let service: StrategyService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        StrategyService,
        IndicatorCalcService,
        {
          provide: StockService,
          useValue: { getKlineBundle: () => Promise.resolve({ klines: [], indicators: null }) },
        },
      ],
    }).compile();
    service = moduleRef.get(StrategyService);
  });

  it('策略设置 maPeriods=[5] → enrichSignalReason 用 5 周期 MA 计算 indicators', () => {
    const klines = buildTrendKlines();
    const customConfig = service.buildStrategyConfig({ ma: { periods: [5] } });
    // 自定义 maPeriods 应为 [5]
    expect(customConfig.maPeriods).toEqual([5]);
    // enrich 应能调用（不抛错）—— 验证 5 周期 MA 在数据上可计算
    const enriched = service.enrichSignalReason('base', klines, customConfig);
    expect(enriched).toContain('base');
  });

  it('策略未设置 → fallback 默认 enrichSignalReason', () => {
    const klines = buildTrendKlines();
    // 不传 indicatorConfig → 用默认
    const enriched = service.enrichSignalReason('base', klines);
    expect(enriched).toContain('base');
    // 通过 buildStrategyConfig 传入空对象 → 也应回退默认
    const fallback = service.buildStrategyConfig({});
    expect(fallback.maPeriods).toEqual([5, 10, 20, 60]);
    expect(fallback.macd.fast).toBe(12);
  });

  it('多个策略不同 config 并存（不互相污染）', () => {
    const cfg1 = service.buildStrategyConfig({ ma: { periods: [5] } });
    const cfg2 = service.buildStrategyConfig({ ma: { periods: [10, 20, 60] } });
    const cfg3 = service.buildStrategyConfig({ macd: { fast: 5, slow: 15, signal: 5 } });
    // 各自独立
    expect(cfg1.maPeriods).toEqual([5]);
    expect(cfg2.maPeriods).toEqual([10, 20, 60]);
    expect(cfg3.maPeriods).toEqual([5, 10, 20, 60]);
    expect(cfg1.macd).toEqual({ fast: 12, slow: 26, signal: 9 });
    expect(cfg3.macd).toEqual({ fast: 5, slow: 15, signal: 5 });
    // 浅修改后不影响其他
    const cfg1Prime = service.buildStrategyConfig({ ma: { periods: [3] } });
    expect(cfg1Prime.maPeriods).toEqual([3]);
    expect(cfg2.maPeriods).toEqual([10, 20, 60]);
  });

  it('config 校验失败时 enrich 静默回退默认（不抛错）', () => {
    const klines = buildTrendKlines();
    // 故意构造一个非法 config（maPeriods 含 0）
    const broken = {
      maPeriods: [0, 5],
      macd: { fast: 12, slow: 26, signal: 9 },
      boll: { period: 20, k: 2 },
      kdj: { n: 9, m1: 3, m2: 3 },
    } as any;
    // enrich 必须不抛
    expect(() =>
      service.enrichSignalReason('base', klines, broken),
    ).not.toThrow();
    // buildStrategyConfig 对 broken params 应能构造（因为 ma 是从 params 里的 ma 字段提取的）
    // 这里直接传 broken object → enrich 内部捕获并回退默认
    const enriched = service.enrichSignalReason('base', klines, broken);
    expect(enriched).toContain('base');
  });
});

afterAll(async () => {
  try {
    require('fs').unlinkSync(TEST_DB);
  } catch { /* ignore */ }
});
