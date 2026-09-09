import { HistoryKlineService } from './history-kline.service';
import { PersistenceService } from '../persistence/persistence.service';

/**
 * 阶段4 TDD：历史K线服务（真实历史行情）
 * SPEC: .cozeproj/documents/plan.md §1 历史K线服务
 * 目标：替换回测中的 generateHistoricalKline 假K线，使用腾讯/新浪真实历史K线
 * - 主源：腾讯 fqkline（按日期区间、前复权）
 * - 兜底：新浪 CN_MarketDataService datalen=1023
 * - 缓存：SQLite history_kline（symbol+date 主键），增量补拉
 * - 限速：150ms；失败重试 1 次
 */
describe('HistoryKlineService - 真实历史K线', () => {
  let persistence: PersistenceService;
  let service: HistoryKlineService;
  const dbPath = `/tmp/history-kline-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`;

  // 腾讯 fqkline 响应（成功）—— [date, open, close, high, low, volume]
  const TENCENT_OK_BODY = JSON.stringify({
    code: 0,
    msg: '',
    data: {
      'sh600519': {
        qfqday: [
          ['2024-01-02', '1685.00', '1685.50', '1690.00', '1678.00', '50000'],
          ['2024-01-03', '1685.50', '1690.00', '1692.00', '1683.00', '48000'],
          ['2024-01-04', '1690.00', '1675.00', '1691.00', '1672.00', '55000'],
        ],
      },
    },
  });

  beforeEach(() => {
    persistence = new PersistenceService(dbPath);
    persistence.init();
  });

  afterEach(() => {
    try {
      require('fs').unlinkSync(dbPath);
    } catch (e) {
      /* ignore */
    }
  });

  function makeService(fetchImpl: typeof fetch): HistoryKlineService {
    return new HistoryKlineService(persistence, fetchImpl as any);
  }

  /** T1: 解析腾讯 fqkline 响应为 KlineData[] */
  it('T1 解析腾讯 fqkline 响应（qfqday 数组 → KlineData[]）', () => {
    const service = makeService(
      jest.fn(async () => ({ ok: true, text: async () => TENCENT_OK_BODY } as any)) as any,
    );
    const parsed = service.parseTencentResponse(TENCENT_OK_BODY, '600519');
    expect(parsed.length).toBe(3);
    expect(parsed[0]).toMatchObject({
      date: '2024-01-02',
      open: 1685.0,
      close: 1685.5,
      high: 1690.0,
      low: 1678.0,
      volume: 50000,
    });
  });

  /** T2: 拉取成功 → 落库 + 返回 */
  it('T2 fetchRealKline 成功 → 写入缓存 + 返回 KlineData[]', async () => {
    const fetchMock = jest.fn(async () => ({ ok: true, text: async () => TENCENT_OK_BODY } as any)) as any;
    service = makeService(fetchMock as any);

    const result = await service.fetchRealKline('600519', '2024-01-02', '2024-01-04');
    expect(result.length).toBe(3);
    expect(result[0].date).toBe('2024-01-02');

    // 落库验证
    const cached = persistence.getHistoryKline('600519', '2024-01-02', '2024-01-04');
    expect(cached.length).toBe(3);
    expect(cached[0].source).toBe('tencent');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  /** T3: 缓存命中 → 不请求上游 */
  it('T3 缓存命中（已存在日期）→ 不发起网络请求', async () => {
    // 先预置缓存
    persistence.upsertHistoryKline([
      { symbol: '600519', date: '2024-01-02', open: 1685, high: 1690, low: 1678, close: 1685.5, volume: 50000, source: 'tencent' },
      { symbol: '600519', date: '2024-01-03', open: 1685.5, high: 1692, low: 1683, close: 1690, volume: 48000, source: 'tencent' },
    ]);

    const fetchMock = jest.fn(async () => ({ ok: true, text: async () => TENCENT_OK_BODY } as any)) as any;
    service = makeService(fetchMock as any);

    const result = await service.fetchRealKline('600519', '2024-01-02', '2024-01-03');
    expect(result.length).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(0); // 缓存命中零请求
  });

  /** T4: 部分日期已缓存 → 增量补拉 */
  it('T4 部分日期已缓存 → 仅补拉缺失日期', async () => {
    persistence.upsertHistoryKline([
      { symbol: '600519', date: '2024-01-02', open: 1685, high: 1690, low: 1678, close: 1685.5, volume: 50000, source: 'tencent' },
    ]);

    const fetchMock = jest.fn(async () => ({ ok: true, text: async () => TENCENT_OK_BODY } as any)) as any;
    service = makeService(fetchMock as any);

    const result = await service.fetchRealKline('600519', '2024-01-02', '2024-01-04');
    expect(result.length).toBe(3); // 1 缓存 + 2 拉取
    expect(fetchMock).toHaveBeenCalledTimes(1); // 一次拉取补齐剩余
  });

  /** T5: 腾讯失败 → 降级新浪 + 标记 source='sina' */
  it('T5 腾讯失败 → 降级新浪 datalen 接口 + source=sina', async () => {
    // 腾讯失败（HTTP 500），新浪返回 JSONP（带括号包裹）
    const SINA_BODY = `var _=([["2024-01-02","1685.00","1690.00","1683.00","1685.50","50000"],["2024-01-03","1685.50","1692.00","1684.00","1690.00","48000"]]);`;
    let callCount = 0;
    const fetchMock = jest.fn(async (url: string) => {
      callCount++;
      if (url.includes('ifzq.gtimg.cn')) {
        return { ok: false, status: 500, text: async () => '' } as any;
      }
      if (url.includes('quotes.sina.cn')) {
        return { ok: true, text: async () => SINA_BODY } as any;
      }
      return { ok: false, status: 404, text: async () => '' } as any;
    }) as any;

    service = makeService(fetchMock as any);
    const result = await service.fetchRealKline('600519', '2024-01-02', '2024-01-03');
    expect(result.length).toBe(2);
    expect(result[0].close).toBe(1685.5);

    const cached = persistence.getHistoryKline('600519', '2024-01-02', '2024-01-03');
    expect(cached.every((c) => c.source === 'sina')).toBe(true);
    expect(callCount).toBeGreaterThanOrEqual(2); // 至少腾讯1 + 新浪1
  });

  /** T6: 全部失败 → 返回可空数组 + 不抛异常（调用方按 availableRange 判断） */
  it('T6 全部数据源失败 → 返回空数组（不抛异常，由调用方决定如何提示）', async () => {
    const fetchMock = jest.fn(async () => ({ ok: false, status: 502, text: async () => '' } as any)) as any;
    service = makeService(fetchMock as any);
    const result = await service.fetchRealKline('600519', '2024-01-02', '2024-01-04');
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  /** T7: 区间查询 → 返回该股已缓存的 [minDate, maxDate] */
  it('T7 getAvailableRange 返回已缓存数据的 [最早, 最晚] 日期', () => {
    persistence.upsertHistoryKline([
      { symbol: '600519', date: '2024-01-02', open: 1, high: 2, low: 0.5, close: 1.5, volume: 100, source: 'tencent' },
      { symbol: '600519', date: '2024-06-15', open: 1, high: 2, low: 0.5, close: 1.5, volume: 100, source: 'tencent' },
      { symbol: '600519', date: '2024-03-10', open: 1, high: 2, low: 0.5, close: 1.5, volume: 100, source: 'tencent' },
    ]);
    service = makeService(jest.fn() as any);
    const range = service.getAvailableRange('600519');
    expect(range).toEqual({ start: '2024-01-02', end: '2024-06-15' });
  });

  /** T8: 区间为空 → null */
  it('T8 getAvailableRange 无数据 → 返回 null', () => {
    service = makeService(jest.fn() as any);
    expect(service.getAvailableRange('600519')).toBeNull();
  });
});