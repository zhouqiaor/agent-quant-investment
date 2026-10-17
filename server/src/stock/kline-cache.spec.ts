/**
 * K 线 5 分钟 SQLite 缓存（TDD）
 *
 * 覆盖：
 *  1. 缓存未命中 → fetch + 写入
 *  2. 缓存命中且未过期 → 跳过 fetch
 *  3. 缓存命中但过期 → fetch + 覆盖
 *  4. fetch 失败 → 不写缓存
 *  5. 并发 3 个同 symbol/period/limit → fetch 仅 1 次
 *  6. limit 不同时不命中同一缓存槽
 */
import { PersistenceService } from '@/persistence/persistence.service';
import { IndicatorCalcService } from '@/indicators';
import { StockService } from '@/stock/stock.service';
import type { KlineData, KlineWithIndicators } from '@/stock/stock.service';

interface FetchCounters {
  callCount: number;
  /**
   * mock 工厂：生成一个 fetch 函数，返回指定条数的 K 线
   * payload 默认含 5 根样本 K 线
   */
  makeFetch: (klines?: KlineData[]) => typeof fetch;
  /**
   * 失败 mock：fetch 抛错
   */
  failingFetch: () => typeof fetch;
}

const SAMPLE_KLINES: KlineData[] = [
  { date: '2024-06-01', open: 100, high: 105, low: 99, close: 104, volume: 1000 },
  { date: '2024-06-02', open: 104, high: 108, low: 103, close: 107, volume: 1100 },
  { date: '2024-06-03', open: 107, high: 110, low: 106, close: 109, volume: 1200 },
  { date: '2024-06-04', open: 109, high: 112, low: 108, close: 111, volume: 1300 },
  { date: '2024-06-05', open: 111, high: 115, low: 110, close: 114, volume: 1400 },
];

function makeCounters(): FetchCounters {
  const counters: FetchCounters = {
    callCount: 0,
    makeFetch: (klines = SAMPLE_KLINES) => {
      return (async (..._args: Parameters<typeof fetch>): Promise<Response> => {
        counters.callCount++;
        // Sina 格式：`([{...},{...}])`
        const payload = klines.map((k) => ({
          day: k.date,
          open: String(k.open),
          high: String(k.high),
          low: String(k.low),
          close: String(k.close),
          volume: String(k.volume),
        }));
        const text = `(${JSON.stringify(payload)})`;
        return {
          ok: true,
          status: 200,
          text: async () => text,
          json: async () => payload,
          arrayBuffer: async () => new ArrayBuffer(0),
        } as unknown as Response;
      }) as unknown as typeof fetch;
    },
    failingFetch: () => {
      return (async (..._args: Parameters<typeof fetch>): Promise<Response> => {
        counters.callCount++;
        throw new Error('Sina network error');
      }) as unknown as typeof fetch;
    },
  };
  return counters;
}

describe('StockService - K线缓存 (TDD)', () => {
  let service: StockService;
  let persistence: PersistenceService;
  let dbPath: string;
  const originalFetch = globalThis.fetch;

  beforeAll(() => {
    // 默认把 fetch 关掉；每个用例单独覆盖
    (globalThis as { fetch: unknown }).fetch = async () => ({
      ok: true,
      status: 200,
      text: async () => '()',
      json: async () => [],
      arrayBuffer: async () => new ArrayBuffer(0),
    }) as unknown as typeof fetch;
  });

  afterAll(() => {
    (globalThis as { fetch: unknown }).fetch = originalFetch;
  });

  beforeEach(() => {
    dbPath = `/tmp/test-kline-cache-${Date.now()}-${Math.floor(Math.random() * 1e6)}.db`;
    persistence = new PersistenceService(dbPath);
    persistence.init();
    service = new StockService(persistence, new IndicatorCalcService());
  });

  afterEach(() => {
    persistence.close?.();
    try {
      require('fs').unlinkSync(dbPath);
    } catch {
      /* ignore */
    }
  });

  it('T1 缓存未命中 → 走 Sina fetch 并写入 SQLite', async () => {
    const ctr = makeCounters();
    (globalThis as { fetch: unknown }).fetch = ctr.makeFetch();

    const result: KlineWithIndicators = await service.getKlineBundle('600519', 'daily', 60);

    expect(ctr.callCount).toBe(1);
    expect(result.klines.length).toBe(SAMPLE_KLINES.length);
    expect(result.indicators).not.toBeNull();
    // 验证已写入缓存
    const cached = persistence.getKlineCache('600519', 'daily', 60);
    expect(cached).not.toBeNull();
    expect(cached?.fetched_at).toBeGreaterThan(0);
    const payload = JSON.parse(cached!.payload) as KlineData[];
    expect(payload).toHaveLength(SAMPLE_KLINES.length);
  });

  it('T2 缓存命中且未过期 → 跳过 fetch', async () => {
    // 先写一次
    const ctr1 = makeCounters();
    (globalThis as { fetch: unknown }).fetch = ctr1.makeFetch();
    await service.getKlineBundle('600519', 'daily', 60);
    expect(ctr1.callCount).toBe(1);

    // 再调一次：缓存新鲜，不应 fetch
    const ctr2 = makeCounters();
    (globalThis as { fetch: unknown }).fetch = ctr2.makeFetch();
    const again = await service.getKlineBundle('600519', 'daily', 60);
    expect(ctr2.callCount).toBe(0);
    expect(again.klines.length).toBe(SAMPLE_KLINES.length);
  });

  it('T3 缓存命中但过期 → 重新 fetch 并覆盖', async () => {
    const ctr1 = makeCounters();
    (globalThis as { fetch: unknown }).fetch = ctr1.makeFetch(SAMPLE_KLINES);
    await service.getKlineBundle('600519', 'daily', 60);

    // 手动把 fetched_at 拨到 10 分钟前 → 视为过期
    const cached = persistence.getKlineCache('600519', 'daily', 60);
    expect(cached).not.toBeNull();
    persistence.setKlineCache(
      '600519',
      'daily',
      60,
      JSON.stringify([
        { date: 'old', open: 0, high: 0, low: 0, close: 0, volume: 0 },
      ]),
      null,
      Date.now() - 10 * 60 * 1000,
    );

    const ctr2 = makeCounters();
    const newKlines: KlineData[] = [
      ...SAMPLE_KLINES,
      { date: '2024-06-06', open: 114, high: 118, low: 113, close: 117, volume: 1500 },
    ];
    (globalThis as { fetch: unknown }).fetch = ctr2.makeFetch(newKlines);

    const fresh = await service.getKlineBundle('600519', 'daily', 60);
    expect(ctr2.callCount).toBe(1);
    expect(fresh.klines.length).toBe(6);
    expect(fresh.klines[5].date).toBe('2024-06-06');

    // 验证 SQLite 已覆盖（fetched_at 也刷新了）
    const cachedAfter = persistence.getKlineCache('600519', 'daily', 60);
    expect(cachedAfter).not.toBeNull();
    const refreshedAt = cachedAfter!.fetched_at;
    expect(Date.now() - refreshedAt).toBeLessThan(2000);
  });

  it('T4 fetch 失败 → 不写缓存（不污染）', async () => {
    const ctr = makeCounters();
    (globalThis as { fetch: unknown }).fetch = ctr.failingFetch();

    const result = await service.getKlineBundle('600519', 'daily', 60);
    expect(ctr.callCount).toBe(1);
    expect(result.klines).toEqual([]);
    expect(result.indicators).toBeNull();

    // 缓存表不应有该键
    const cached = persistence.getKlineCache('600519', 'daily', 60);
    expect(cached).toBeNull();
  });

  it('T5 同 symbol 并发 3 个请求 → fetch 仅 1 次（in-flight 去重）', async () => {
    let resolveFetch: (v: Response) => void = () => undefined;
    const pending: Promise<Response> = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });

    const ctr = makeCounters();
    // 自定义 fetch：让请求挂起直到我们手动 resolve，便于触发并发
    (globalThis as { fetch: unknown }).fetch = (async () => {
      ctr.callCount++;
      return pending;
    }) as unknown as typeof fetch;

    const p1 = service.getKlineBundle('600519', 'daily', 60);
    const p2 = service.getKlineBundle('600519', 'daily', 60);
    const p3 = service.getKlineBundle('600519', 'daily', 60);

    // 触发 microtask 让三个 await 进入 in-flight 缓存分支
    await Promise.resolve();

    // 此时三个 promise 共享同一个 in-flight，调用计数仍为 1
    expect(ctr.callCount).toBe(1);

    // 给 mock 一个真实响应
    resolveFetch({
      ok: true,
      status: 200,
      text: async () => `(${JSON.stringify(
        SAMPLE_KLINES.map((k) => ({
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
    } as unknown as Response);

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
    expect(ctr.callCount).toBe(1);
    expect(r1.klines.length).toBe(SAMPLE_KLINES.length);
    expect(r2.klines.length).toBe(SAMPLE_KLINES.length);
    expect(r3.klines.length).toBe(SAMPLE_KLINES.length);
  });

  it('T6 不同 limit 不命中同一缓存槽（各自独立 fetch 与存储）', async () => {
    const ctr = makeCounters();
    // 两次 fetch 返回不同条数，确保两个缓存槽内容可区分
    const sixKlines: KlineData[] = [
      ...SAMPLE_KLINES,
      { date: '2024-06-06', open: 114, high: 118, low: 113, close: 117, volume: 1500 },
    ];
    let fetchRound = 0;
    (globalThis as { fetch: unknown }).fetch = (async (
      ..._args: Parameters<typeof fetch>
    ): Promise<Response> => {
      ctr.callCount++;
      const klines = fetchRound === 0 ? SAMPLE_KLINES : sixKlines;
      fetchRound++;
      const payload = klines.map((k) => ({
        day: k.date,
        open: String(k.open),
        high: String(k.high),
        low: String(k.low),
        close: String(k.close),
        volume: String(k.volume),
      }));
      const text = `(${JSON.stringify(payload)})`;
      return {
        ok: true,
        status: 200,
        text: async () => text,
        json: async () => payload,
        arrayBuffer: async () => new ArrayBuffer(0),
      } as unknown as Response;
    }) as unknown as typeof fetch;

    await service.getKlineBundle('600519', 'daily', 60);
    await service.getKlineBundle('600519', 'daily', 120);

    expect(ctr.callCount).toBe(2);

    const a = persistence.getKlineCache('600519', 'daily', 60);
    const b = persistence.getKlineCache('600519', 'daily', 120);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    // 同 symbol+period、不同 limit 是不同主键，内容也不同
    expect(a).not.toEqual(b);
    expect(JSON.parse(a!.payload)).toHaveLength(5);
    expect(JSON.parse(b!.payload)).toHaveLength(6);
  });
});