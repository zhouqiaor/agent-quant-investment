/**
 * K 线 + 自定义指标配置（TDD）
 *
 * 覆盖：
 *  - maPeriods=5,20 → indicators.ma 只包含 5 和 20
 *  - macdFast=5&macdSlow=15&macdSignal=5 → indicators.macd 用 5/15/5 计算
 *  - 非法 maPeriods（负数）→ BadRequestException
 *  - 非法 macd（fast >= slow）→ BadRequestException
 *  - 与默认 config 等价（不带 query 时）
 */
import { BadRequestException } from '@nestjs/common';
import { StockService } from '@/stock/stock.service';
import { IndicatorCalcService } from '@/indicators';
import { PersistenceService } from '@/persistence/persistence.service';
import type { KlineData } from '@/stock/stock.service';

function buildService(): {
  service: StockService;
  persistence: PersistenceService;
  dbPath: string;
} {
  const dbPath = `/tmp/quant-test-kline-cfg-${Date.now()}-${Math.floor(Math.random() * 1e6)}.db`;
  const persistence = new PersistenceService(dbPath);
  persistence.init();
  const service = new StockService(persistence, new IndicatorCalcService());
  return { service, persistence, dbPath };
}

/** 长度足够支持 MA60 / MACD warmup 的样本 K 线 */
const SAMPLE: KlineData[] = Array.from({ length: 80 }, (_, i) => ({
  date: `2024-01-${(i + 1).toString().padStart(2, '0')}`,
  open: 100 + i * 0.5,
  high: 101 + i * 0.5,
  low: 99 + i * 0.5,
  close: 100 + Math.sin(i / 3) * 5 + i * 0.3,
  volume: 1000 + i * 10,
}));

describe('StockService - K线 自定义指标配置 (TDD)', () => {
  const originalFetch = globalThis.fetch;

  beforeAll(() => {
    (globalThis as { fetch: unknown }).fetch = (async () => ({
      ok: true,
      status: 200,
      text: async () => `(${JSON.stringify(
        SAMPLE.map((k) => ({
          day: k.date,
          open: String(k.open),
          high: String(k.high),
          low: String(k.low),
          close: String(k.close),
          volume: String(k.volume),
        })),
      )})`,
      json: async () => [],
      arrayBuffer: async () => new ArrayBuffer(0),
    }) as unknown) as typeof fetch;
  });

  afterAll(() => {
    (globalThis as { fetch: unknown }).fetch = originalFetch;
  });

  it('maPeriods=5,20 → indicators.ma 只包含 5 和 20（无 10/60）', async () => {
    const { service, persistence, dbPath } = buildService();
    try {
      const cfg = service.buildIndicatorConfigFromQuery({ maPeriods: '5,20' });
      const result = await service.getKlineBundle('600519', 'daily', 80, cfg);
      expect(result.indicators).not.toBeNull();
      const periods = Object.keys(result.indicators!.ma).sort();
      expect(periods).toEqual(['20', '5']);
    } finally {
      persistence.close?.();
      try {
        require('fs').unlinkSync(dbPath);
      } catch { /* ignore */ }
    }
  });

  it('macdFast=5&macdSlow=15&macdSignal=5 → indicators.macd 用 5/15/5 计算', async () => {
    const { service, persistence, dbPath } = buildService();
    try {
      const cfg = service.buildIndicatorConfigFromQuery({
        macdFast: '5',
        macdSlow: '15',
        macdSignal: '5',
      });
      const result = await service.getKlineBundle('600519', 'daily', 80, cfg);
      // DIF 应在前 14 位为 null（slow-1）
      // DEA 应在前 18 位为 null（slow+signal-2）
      expect(result.indicators).not.toBeNull();
      const macd = result.indicators!.macd;
      expect(macd.dif[14]).not.toBeNull();
      expect(macd.dea[18]).not.toBeNull();
    } finally {
      persistence.close?.();
      try {
        require('fs').unlinkSync(dbPath);
      } catch { /* ignore */ }
    }
  });

  it('非法 maPeriods（负数）→ BadRequestException', () => {
    const { service, persistence, dbPath } = buildService();
    try {
      expect(() =>
        service.buildIndicatorConfigFromQuery({ maPeriods: '-1,5' }),
      ).toThrow(BadRequestException);
    } finally {
      persistence.close?.();
      try {
        require('fs').unlinkSync(dbPath);
      } catch { /* ignore */ }
    }
  });

  it('非法 macd（fast >= slow）→ BadRequestException', () => {
    const { service, persistence, dbPath } = buildService();
    try {
      expect(() =>
        service.buildIndicatorConfigFromQuery({
          macdFast: '26',
          macdSlow: '12',
          macdSignal: '9',
        }),
      ).toThrow(BadRequestException);
    } finally {
      persistence.close?.();
      try {
        require('fs').unlinkSync(dbPath);
      } catch { /* ignore */ }
    }
  });

  it('与默认 config 等价（不带 query 时返回相同 ma/macd 周期集合）', async () => {
    const { service, persistence, dbPath } = buildService();
    try {
      const defaultResult = await service.getKlineBundle('600519', 'daily', 80);
      // 不传 config → 等价 DEFAULT_INDICATOR_CONFIG（80 长度下 4 个 MA 都应出现）
      expect(defaultResult.indicators).not.toBeNull();
      const periods = Object.keys(defaultResult.indicators!.ma).sort();
      expect(periods).toEqual(['10', '20', '5', '60']);
    } finally {
      persistence.close?.();
      try {
        require('fs').unlinkSync(dbPath);
      } catch { /* ignore */ }
    }
  });
});
