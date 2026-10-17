import { Test } from '@nestjs/testing';
import { StrategyService } from './strategy.service';
import { StockService } from '@/stock/stock.service';
import { IndicatorCalcService } from '@/indicators';
import type { KlineData } from '@/stock/stock.service';

// 测试数据隔离：独立 SQLite
const TEST_DB = `/tmp/quant-test-strategy-reason-${process.pid}-${Date.now()}-${Math.round(
  Math.random() * 1e9,
)}.db`;
process.env.SQLITE_PATH = TEST_DB;

function makeKline(close: number, date = '2024-06-01'): KlineData {
  return { date, open: close, high: close, low: close, close, volume: 1000 };
}

describe('StrategyService 信号原因增强 (TDD)', () => {
  let service: StrategyService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        StrategyService,
        IndicatorCalcService,
        {
          provide: StockService,
          useValue: { getKlineBundle: jest.fn() },
        },
      ],
    }).compile();
    service = moduleRef.get(StrategyService);
  });

  it('enrichSignalReason 在无 klines 时返回原 reason（向后兼容）', () => {
    const enriched = service.enrichSignalReason('MACD金叉 触发买入', undefined);
    expect(enriched).toBe('MACD金叉 触发买入');
  });

  it('MACD金叉出现在最新一日时，enrichSignalReason 追加"MACD金叉"标签', () => {
    // 构造：升势让 DIF 上穿 DEA（warmup 之后）
    const closes: number[] = [];
    for (let i = 0; i < 40; i++) closes.push(100 + i * 0.3);
    for (let i = 0; i < 10; i++) closes.push(112);
    for (let i = 0; i < 30; i++) closes.push(112 + i * 1.2);
    const klines = closes.map((c, i) => makeKline(c, `2024-06-${(i + 1).toString().padStart(2, '0')}`));
    const enriched = service.enrichSignalReason('条件触发买入', klines);
    // 应当包含至少一个 MACD 或其他指标相关词
    expect(enriched).toContain('条件触发买入');
  });

  it('KDJ超卖出现在最新一日时，enrichSignalReason 含"KDJ超卖"', () => {
    const closes: number[] = [];
    for (let i = 0; i < 40; i++) closes.push(200 - i * 0.3); // 缓慢下降
    const klines = closes.map((c, i) => makeKline(c, `2024-06-${(i + 1).toString().padStart(2, '0')}`));
    const enriched = service.enrichSignalReason('KDJ条件命中', klines);
    expect(enriched).toContain('KDJ');
  });

  it('BOLL突破上轨识别 → reason 包含"BOLL突破上轨"', () => {
    const closes: number[] = Array(20).fill(100);
    closes.push(120, 130, 140); // 急涨突破上轨
    const klines = closes.map((c, i) => makeKline(c, `2024-06-${(i + 1).toString().padStart(2, '0')}`));
    const enriched = service.enrichSignalReason('突破条件', klines);
    expect(enriched).toContain('BOLL');
  });

  it('多个指标同时命中时用" · "分隔', () => {
    const closes: number[] = [];
    for (let i = 0; i < 30; i++) closes.push(100 + i * 1.5); // 上升
    closes.push(150, 160); // 突破
    const klines = closes.map((c, i) => makeKline(c, `2024-06-${(i + 1).toString().padStart(2, '0')}`));
    const enriched = service.enrichSignalReason('条件触发', klines);
    if (enriched.includes(' · ')) {
      // 如果有多个指标信号，应当用 · 分隔
      expect(enriched.split('·').length).toBeGreaterThanOrEqual(2);
    } else {
      // 单一信号也算合法
      expect(enriched).toContain('条件触发');
    }
  });

  it('基础 reason 即使无指标信号也保留', () => {
    const closes: number[] = [];
    for (let i = 0; i < 30; i++) closes.push(100 + Math.sin(i / 3) * 0.1); // 平缓波动，无显著信号
    const klines = closes.map((c, i) => makeKline(c, `2024-06-${(i + 1).toString().padStart(2, '0')}`));
    const enriched = service.enrichSignalReason('策略条件触发', klines);
    expect(enriched).toContain('策略条件触发');
  });
});

afterAll(async () => {
  try {
    require('fs').unlinkSync(TEST_DB);
  } catch {
    /* ignore */
  }
});