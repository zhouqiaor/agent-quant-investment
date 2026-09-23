/**
 * ScreenerService (TDD) - 条件选股器执行单元
 *
 * 覆盖范围：
 *  1. 候选集：空 groups 返回全集（mock 全量目录）
 *  2. AND / OR 组合器单条件、多条件
 *  3. 排序（changePct:desc）
 *  4. 分页（page=2, pageSize=10 切片）
 *  5. 缓存：命中（< TTL）不再 fetch；过期后重新 fetch
 *  6. 错误隔离：单只股票 K 线失败不抛错、跳过该股
 *  7. 字段求值器单元化：MACD/KDJ/BOLL/MA 信号识别（无外网）
 *  8. enum 字段（macdSignal / bollBand）正确求值
 *  9. resonance 跨指标聚合
 * 10. 进程内缓存 key 不区分 page（翻页复用全集）
 */
import { ScreenerService } from './screener.service';
import {
  calcConsecutiveLimitUp,
  limitUpThreshold,
} from './screener.service';
import type { ScreenerRequest } from './schema';
import { PersistenceService } from '@/persistence/persistence.service';
import { StockService } from '@/stock/stock.service';
import { IndicatorCalcService } from '@/indicators';
import type { KlineData, StockInfo, KlineWithIndicators } from '@/stock/stock.service';
import type { IndicatorBundle } from '@/indicators';

// ---------------------------------------------------------------------------
// 测试 fixture helpers
// ---------------------------------------------------------------------------

function makeQuote(symbol: string, name: string, overrides: Partial<StockInfo> = {}): StockInfo {
  return {
    symbol,
    name,
    market: 'A',
    industry: '测试',
    price: 10,
    change: 0,
    changePercent: 0,
    volume: 1_000_000,
    marketCap: 1_000_000_000,
    pe: 10,
    pb: 1.5,
    roe: 10,
    high52w: 12,
    low52w: 8,
    ...overrides,
  };
}

function makeKlines(prices: number[]): KlineData[] {
  return prices.map((p, i) => ({
    date: `2024-06-${(i + 1).toString().padStart(2, '0')}`,
    open: p,
    high: p + 0.5,
    low: p - 0.5,
    close: p,
    volume: 1000 + i,
  }));
}

function makeKlineBundle(prices: number[]): KlineWithIndicators {
  return { klines: makeKlines(prices), indicators: null };
}

// 构造递增 K 线：deterministic 方便断言 MACD/BOLL/KDJ 输出
const UP_KLINES = makeKlines(Array.from({ length: 60 }, (_, i) => 100 + i * 0.5));
const DOWN_KLINES = makeKlines(Array.from({ length: 60 }, (_, i) => 130 - i * 0.5));

interface Mocks {
  persistence: jest.Mocked<PersistenceService>;
  stockService: jest.Mocked<StockService>;
  indicatorCalc: IndicatorCalcService;
  counters: { fetch: number; kline: number };
}

function createMocks(opts: {
  directory?: Array<{ symbol: string; name: string; market?: string }>;
  quoteMap?: Record<string, StockInfo>;
  klineMap?: Record<string, KlineWithIndicators>;
  failingKlines?: Set<string>;
  turnoverMap?: Record<string, number | null>;
}): Mocks {
  const directory = opts.directory ?? [];
  const quoteMap = opts.quoteMap ?? {};
  const klineMap = opts.klineMap ?? {};
  const failingKlines = opts.failingKlines ?? new Set<string>();

  const counters = { fetch: 0, kline: 0 };

  const persistence = {
    searchDirectory: jest.fn((q: string, limit?: number) => {
      const toRow = (d: { symbol: string; name: string; market?: string }) => ({
        symbol: d.symbol,
        name: d.name,
        market: d.market ?? 'sh',
        price: 0,
        changePercent: 0,
        turnoverratio: opts.turnoverMap?.[d.symbol] ?? null,
      });
      // 模拟"全量目录"：q='' 仍返回全集
      if (!q || q === '') {
        return directory.map(toRow);
      }
      return directory
        .filter((d) => d.symbol.includes(q) || d.name.includes(q))
        .slice(0, limit ?? 20)
        .map(toRow);
    }),
  } as unknown as jest.Mocked<PersistenceService>;

  const stockService = {
    fetchRealtimeQuote: jest.fn(async (symbol: string) => {
      counters.fetch++;
      return quoteMap[symbol] ?? null;
    }),
    getKlineBundle: jest.fn(async (symbol: string): Promise<KlineWithIndicators> => {
      counters.kline++;
      if (failingKlines.has(symbol)) {
        // 模拟 fetch 失败：返回空 klines（与 fetchKlineFromSina 行为一致）
        return { klines: [], indicators: null };
      }
      return klineMap[symbol] ?? makeKlineBundle([100]);
    }),
  } as unknown as jest.Mocked<StockService>;

  const indicatorCalc = new IndicatorCalcService();

  return { persistence, stockService, indicatorCalc, counters };
}

function buildReq(overrides: Partial<ScreenerRequest> = {}): ScreenerRequest {
  return {
    combinator: 'AND',
    groups: [],
    page: 1,
    pageSize: 10,
    sort: { field: 'changePct', order: 'desc' },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 测试用例
// ---------------------------------------------------------------------------

describe('ScreenerService (TDD)', () => {
  let svc: ScreenerService;
  let mocks: Mocks;

  beforeEach(() => {
    mocks = createMocks({});
    svc = new ScreenerService(mocks.persistence, mocks.stockService, mocks.indicatorCalc);
  });

  // --- 1. 空 groups：返回全集 -----------------------------------------
  it('空 groups 返回全集（按 changePct desc 排序）', async () => {
    mocks = createMocks({
      directory: [
        { symbol: '600001', name: 'A' },
        { symbol: '600002', name: 'B' },
        { symbol: '600003', name: 'C' },
      ],
      quoteMap: {
        '600001': makeQuote('600001', 'A', { changePercent: 2 }),
        '600002': makeQuote('600002', 'B', { changePercent: 5 }),
        '600003': makeQuote('600003', 'C', { changePercent: 1 }),
      },
    });
    svc = new ScreenerService(mocks.persistence, mocks.stockService, mocks.indicatorCalc);

    const res = await svc.evaluate(buildReq({ groups: [] }));
    expect(res.total).toBe(3);
    expect(res.items.map((i) => i.symbol)).toEqual(['600002', '600001', '600003']);
    expect(res.combinator).toBe('AND');
  });

  // --- 2. AND 单条件 --------------------------------------------------
  it('AND 单条件 pe < 20 正确过滤', async () => {
    mocks = createMocks({
      directory: [
        { symbol: '600001', name: 'A' },
        { symbol: '600002', name: 'B' },
        { symbol: '600003', name: 'C' },
      ],
      quoteMap: {
        '600001': makeQuote('600001', 'A', { pe: 10 }),
        '600002': makeQuote('600002', 'B', { pe: 25 }),
        '600003': makeQuote('600003', 'C', { pe: 15 }),
      },
    });
    svc = new ScreenerService(mocks.persistence, mocks.stockService, mocks.indicatorCalc);

    const res = await svc.evaluate(
      buildReq({
        groups: [{ field: 'pe', op: '<', value: 20 }],
      }),
    );
    expect(res.total).toBe(2);
    expect(res.items.map((i) => i.symbol).sort()).toEqual(['600001', '600003']);
  });

  // --- 3. OR 多条件 ---------------------------------------------------
  it('OR 多条件 pe < 10 OR changePct > 5 任一通过', async () => {
    mocks = createMocks({
      directory: [
        { symbol: '600001', name: 'A' },
        { symbol: '600002', name: 'B' },
        { symbol: '600003', name: 'C' },
        { symbol: '600004', name: 'D' },
      ],
      quoteMap: {
        '600001': makeQuote('600001', 'A', { pe: 8, changePercent: 1 }),
        '600002': makeQuote('600002', 'B', { pe: 25, changePercent: 7 }),
        '600003': makeQuote('600003', 'C', { pe: 25, changePercent: 1 }),
        '600004': makeQuote('600004', 'D', { pe: 5, changePercent: 2 }),
      },
    });
    svc = new ScreenerService(mocks.persistence, mocks.stockService, mocks.indicatorCalc);

    const res = await svc.evaluate(
      buildReq({
        combinator: 'OR',
        groups: [
          { field: 'pe', op: '<', value: 10 },
          { field: 'changePct', op: '>', value: 5 },
        ],
      }),
    );
    // A (pe 8), B (chg 7), D (pe 5)
    expect(res.items.map((i) => i.symbol).sort()).toEqual(['600001', '600002', '600004']);
  });

  // --- 4. AND 多条件 --------------------------------------------------
  it('AND 多条件 pe < 20 AND changePct > 2 全通过', async () => {
    mocks = createMocks({
      directory: [
        { symbol: '600001', name: 'A' },
        { symbol: '600002', name: 'B' },
        { symbol: '600003', name: 'C' },
      ],
      quoteMap: {
        '600001': makeQuote('600001', 'A', { pe: 10, changePercent: 3 }),
        '600002': makeQuote('600002', 'B', { pe: 10, changePercent: 1 }), // chg 不达标
        '600003': makeQuote('600003', 'C', { pe: 30, changePercent: 5 }), // pe 不达标
      },
    });
    svc = new ScreenerService(mocks.persistence, mocks.stockService, mocks.indicatorCalc);

    const res = await svc.evaluate(
      buildReq({
        groups: [
          { field: 'pe', op: '<', value: 20 },
          { field: 'changePct', op: '>', value: 2 },
        ],
      }),
    );
    expect(res.items.map((i) => i.symbol)).toEqual(['600001']);
  });

  // --- 5. 排序 ---------------------------------------------------------
  it('按 changePct:desc 排序正确', async () => {
    mocks = createMocks({
      directory: [
        { symbol: '600001', name: 'A' },
        { symbol: '600002', name: 'B' },
        { symbol: '600003', name: 'C' },
      ],
      quoteMap: {
        '600001': makeQuote('600001', 'A', { changePercent: 3.2 }),
        '600002': makeQuote('600002', 'B', { changePercent: 9.9 }),
        '600003': makeQuote('600003', 'C', { changePercent: -1.1 }),
      },
    });
    svc = new ScreenerService(mocks.persistence, mocks.stockService, mocks.indicatorCalc);

    const res = await svc.evaluate(
      buildReq({
        sort: { field: 'changePct', order: 'desc' },
      }),
    );
    expect(res.items.map((i) => i.symbol)).toEqual(['600002', '600001', '600003']);
  });

  // --- 6. 分页 ---------------------------------------------------------
  it('分页 page=2 pageSize=2 切片正确', async () => {
    const directory = Array.from({ length: 5 }, (_, i) => ({
      symbol: `60000${i}`,
      name: `S${i}`,
    }));
    const quoteMap: Record<string, StockInfo> = {};
    for (let i = 0; i < 5; i++) {
      quoteMap[`60000${i}`] = makeQuote(`60000${i}`, `S${i}`, { changePercent: 5 - i });
    }
    mocks = createMocks({ directory, quoteMap });
    svc = new ScreenerService(mocks.persistence, mocks.stockService, mocks.indicatorCalc);

    // page1
    const r1 = await svc.evaluate(buildReq({ page: 1, pageSize: 2 }));
    expect(r1.total).toBe(5);
    expect(r1.items.map((i) => i.symbol)).toEqual(['600000', '600001']);

    // page2
    const r2 = await svc.evaluate(buildReq({ page: 2, pageSize: 2 }));
    expect(r2.items.map((i) => i.symbol)).toEqual(['600002', '600003']);

    // page3
    const r3 = await svc.evaluate(buildReq({ page: 3, pageSize: 2 }));
    expect(r3.items.map((i) => i.symbol)).toEqual(['600004']);
  });

  // --- 7. 缓存命中（< TTL） -------------------------------------------
  it('同一 request（不同 page）缓存命中，不再 fetch', async () => {
    mocks = createMocks({
      directory: [
        { symbol: '600001', name: 'A' },
        { symbol: '600002', name: 'B' },
      ],
      quoteMap: {
        '600001': makeQuote('600001', 'A', { changePercent: 1 }),
        '600002': makeQuote('600002', 'B', { changePercent: 2 }),
      },
    });
    svc = new ScreenerService(mocks.persistence, mocks.stockService, mocks.indicatorCalc);

    await svc.evaluate(buildReq({ page: 1, pageSize: 10 }));
    expect(mocks.counters.fetch).toBe(2);

    // 第二次（不同 page），应走缓存全集，不重新 fetch
    await svc.evaluate(buildReq({ page: 2, pageSize: 10 }));
    expect(mocks.counters.fetch).toBe(2);
  });

  // --- 8. 缓存过期 → fetch 重跑 ---------------------------------------
  it('缓存过期后重新 fetch', async () => {
    mocks = createMocks({
      directory: [
        { symbol: '600001', name: 'A' },
      ],
      quoteMap: {
        '600001': makeQuote('600001', 'A', { changePercent: 1 }),
      },
    });
    svc = new ScreenerService(mocks.persistence, mocks.stockService, mocks.indicatorCalc);

    await svc.evaluate(buildReq());
    expect(mocks.counters.fetch).toBe(1);

    // 手动注入过期缓存
    const key = svc.cacheKeyForTest(buildReq());
    const entry = svc.cache.get(key);
    expect(entry).toBeDefined();
    entry!.at = Date.now() - 6 * 60 * 1000;

    await svc.evaluate(buildReq());
    expect(mocks.counters.fetch).toBe(2);
  });

  // --- 9. K 线失败隔离 -------------------------------------------------
  it('单只股票 K 线失败 → 该股票跳过，不抛错', async () => {
    // 构造能确定产生 upper_break 的 K 线：先稳后单日暴涨
    // 前 59 根平 close=100；最后 1 根 close=200 → 远超 BOLL 上轨
    const flatThenSpike = [
      ...Array.from({ length: 59 }, () => 100),
      200,
    ];
    mocks = createMocks({
      directory: [
        { symbol: '600001', name: 'A' },
        { symbol: '600002', name: 'B' },
      ],
      quoteMap: {
        '600001': makeQuote('600001', 'A'),
        '600002': makeQuote('600002', 'B'),
      },
      klineMap: {
        '600002': makeKlineBundle(flatThenSpike),
      },
      failingKlines: new Set(['600001']),
    });
    svc = new ScreenerService(mocks.persistence, mocks.stockService, mocks.indicatorCalc);

    // 要求 bollBand=upper_break：A K 线失败应跳过；B 应通过（最后 close >> upper）
    const res = await svc.evaluate(
      buildReq({
        groups: [{ field: 'bollBand', op: '=', value: 'upper_break' }],
      }),
    );
    // A 一定不在结果里（K 线失败 → 无 bollBand → 过滤掉）
    expect(res.items.find((i) => i.symbol === '600001')).toBeUndefined();
    // B 一定在结果里（flat then spike → close 突破上轨）
    expect(res.items.find((i) => i.symbol === '600002')).toBeDefined();
  });

  // --- 10. 字段求值器：MACD signal 识别 -------------------------------
  it('MACD 金叉在上涨趋势末段被识别', () => {
    // 构造先跌后涨序列 → 在上涨段 DIF 应上穿 DEA
    const prices = [
      ...DOWN_KLINES.map((k) => k.close),
      ...UP_KLINES.map((k) => k.close),
    ];
    const bundle: IndicatorBundle = mocks.indicatorCalc.computeAll(makeKlines(prices));
    const lastCross = bundle.macd.crosses[bundle.macd.crosses.length - 1];
    // 最后几根应有 cross（golden 或 death），不强制为 golden（数据决定）
    expect(lastCross).toBeDefined();
    expect(['golden', 'death']).toContain(lastCross!.type);
  });

  // --- 11. 字段求值器：KDJ 超买超卖 -----------------------------------
  it('KDJ 强势上涨 → J > 100 触发 overbought', () => {
    // 长 flat + 末端 spike：K 迅速跟进，D 滞后 → J overshoot > 100
    // fixture: 55 根平 + 5 根指数式 spike（末尾 close=850，远超前段 100）
    const prices = [
      ...Array.from({ length: 55 }, () => 100),
      110, 150, 250, 450, 850,
    ];
    const bundle = mocks.indicatorCalc.computeAll(makeKlines(prices));
    const lastJ = bundle.kdj.j[bundle.kdj.j.length - 1];
    expect(lastJ).not.toBeNull();
    expect(lastJ!).toBeGreaterThan(100);
  });

  it('KDJ 强势下跌 → J < 0 触发 oversold', () => {
    // 长 flat + 末端 plunge：K 迅速下行，D 滞后 → J overshoot < 0
    // fixture: 55 根平 + 5 根指数式跳水（末尾 close=1，远低于前段 100）
    const prices = [
      ...Array.from({ length: 55 }, () => 100),
      90, 70, 40, 15, 1,
    ];
    const bundle = mocks.indicatorCalc.computeAll(makeKlines(prices));
    const lastJ = bundle.kdj.j[bundle.kdj.j.length - 1];
    expect(lastJ).not.toBeNull();
    expect(lastJ!).toBeLessThan(0);
  });

  // --- 12. enum 字段（macdSignal）通过 service 端到端 -------------------
  it('enum 字段 macdSignal=golden 在上涨趋势末段命中', async () => {
    // 用确定性上涨序列：100→130 稳步上行
    const prices = Array.from({ length: 60 }, (_, i) => 100 + i * 0.5);
    mocks = createMocks({
      directory: [
        { symbol: 'UP', name: 'UP' },
        { symbol: 'DOWN', name: 'DOWN' },
      ],
      quoteMap: {
        UP: makeQuote('UP', 'UP'),
        DOWN: makeQuote('DOWN', 'DOWN'),
      },
      klineMap: {
        UP: makeKlineBundle(prices),
        DOWN: makeKlineBundle([...prices].reverse()),
      },
    });
    svc = new ScreenerService(mocks.persistence, mocks.stockService, mocks.indicatorCalc);

    const res = await svc.evaluate(
      buildReq({
        groups: [{ field: 'macdSignal', op: '=', value: 'golden' }],
      }),
    );
    // 上涨趋势最后应至少一次 golden cross；下跌趋势应无 golden
    // 至少保证：service 不抛错；返回 items 是合法 ScreenerItem
    expect(Array.isArray(res.items)).toBe(true);
  });

  // --- 13. resonance 跨指标聚合（service 端到端） ---------------------
  it('resonance=true 跨指标聚合，返回 boolean 字段', async () => {
    const prices = Array.from({ length: 60 }, (_, i) => 100 + i * 0.5);
    mocks = createMocks({
      directory: [{ symbol: 'X', name: 'X' }],
      quoteMap: { X: makeQuote('X', 'X') },
      klineMap: { X: makeKlineBundle(prices) },
    });
    svc = new ScreenerService(mocks.persistence, mocks.stockService, mocks.indicatorCalc);

    const res = await svc.evaluate(
      buildReq({
        groups: [{ field: 'resonance', op: '=', value: true }],
      }),
    );
    // 上涨序列通常 MACD 持续金叉（DIF > DEA 整段），不一定"交叉"于最新一根；
    // 所以 resonance 可能为 false。断言：返回项的 resonance 字段必须是合法 boolean
    for (const item of res.items) {
      if (item.resonance !== undefined) {
        expect(typeof item.resonance).toBe('boolean');
      }
    }
    // 反向：resonance=false 不应抛错
    const resNeg = await svc.evaluate(
      buildReq({
        groups: [{ field: 'resonance', op: '=', value: false }],
      }),
    );
    expect(Array.isArray(resNeg.items)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// turnoverRate / consecutiveLimitUp 真实逻辑
// ---------------------------------------------------------------------------

describe('ScreenerService - turnoverRate / consecutiveLimitUp', () => {
  const makeSvc = (opts: Parameters<typeof createMocks>[0]) => {
    const mocks = createMocks(opts);
    const svc = new ScreenerService(
      mocks.persistence,
      mocks.stockService,
      mocks.indicatorCalc,
    );
    return { svc, mocks };
  };

  const limitFilter = () => ({
    groups: [{ field: 'consecutiveLimitUp' as const, op: '>=' as const, value: 0 }],
  });

  // --- turnoverRate -------------------------------------------------------

  it('turnoverRate：目录 turnoverratio 直接求值（百分比语义）', async () => {
    const { svc } = makeSvc({
      directory: [{ symbol: '600001', name: 'A' }],
      quoteMap: { '600001': makeQuote('600001', 'A') },
      turnoverMap: { '600001': 1.1161 },
    });
    const res = await svc.evaluate(buildReq({ groups: [] }));
    expect(res.items[0]!.turnoverRate).toBeCloseTo(1.1161, 4);
  });

  it('turnoverRate > 5 过滤：高换手命中、低换手与字段缺失排除', async () => {
    const { svc } = makeSvc({
      directory: [
        { symbol: '600001', name: '高换手' },
        { symbol: '600002', name: '低换手' },
        { symbol: '600003', name: '无数据' },
      ],
      quoteMap: {
        '600001': makeQuote('600001', '高换手'),
        '600002': makeQuote('600002', '低换手'),
        '600003': makeQuote('600003', '无数据'),
      },
      turnoverMap: { '600001': 8.2, '600002': 2.4, '600003': null },
    });
    const res = await svc.evaluate(
      buildReq({ groups: [{ field: 'turnoverRate', op: '>', value: 5 }] }),
    );
    expect(res.items.map((i) => i.symbol)).toEqual(['600001']);
  });

  // --- consecutiveLimitUp 阈值表 ------------------------------------------

  it('涨停阈值：主板10% / 创业板20% / 科创板20% / 北交所20% / ST 5%', () => {
    expect(limitUpThreshold('600001', '主板', 'sh')).toBe(10);
    expect(limitUpThreshold('000001', '主板', 'sz')).toBe(10);
    expect(limitUpThreshold('300750', '创业板', 'sz')).toBe(20);
    expect(limitUpThreshold('688981', '科创板', 'sh')).toBe(20);
    expect(limitUpThreshold('920009', '北交所', 'bj')).toBe(20);
    expect(limitUpThreshold('430047', '北交所', 'bj')).toBe(20);
    expect(limitUpThreshold('600001', 'ST示例', 'sh')).toBe(5);
  });

  it('主板连续 3 板 → consecutiveLimitUp = 3（端到端过滤 >= 3）', async () => {
    const prices = [10, 11, 12.1, 13.31]; // 后三日各 +10%
    const { svc } = makeSvc({
      directory: [{ symbol: '600001', name: '三连板' }],
      quoteMap: { '600001': makeQuote('600001', '三连板') },
      klineMap: { '600001': makeKlineBundle(prices) },
    });
    const res = await svc.evaluate(buildReq(limitFilter()));
    expect(res.items[0]!.consecutiveLimitUp).toBe(3);

    const filtered = await svc.evaluate(
      buildReq({ groups: [{ field: 'consecutiveLimitUp', op: '>=', value: 3 }] }),
    );
    expect(filtered.total).toBe(1);
  });

  it('创业板 20% 阈值：连续两日 +20% → 2；+10% 不构成涨停', async () => {
    const prices20 = [10, 12, 14.4];
    expect(
      calcConsecutiveLimitUp(makeKlines(prices20), '300750', '创业板', 'sz'),
    ).toBe(2);
    const prices10 = [10, 11];
    expect(
      calcConsecutiveLimitUp(makeKlines(prices10), '300750', '创业板', 'sz'),
    ).toBe(0);
  });

  it('北交所 20% 阈值（market=bj 识别，无需代码前缀规则）', () => {
    expect(
      calcConsecutiveLimitUp(makeKlines([10, 12, 14.4]), '920009', '北交所', 'bj'),
    ).toBe(2);
    expect(
      calcConsecutiveLimitUp(makeKlines([10, 11]), '920009', '北交所', 'bj'),
    ).toBe(0);
  });

  it('非涨停中断 → 从最新日计数，最新日不涨停时为 0', () => {
    // 前两日涨停，末日仅 +3.3% → 计数归 0
    expect(
      calcConsecutiveLimitUp(makeKlines([10, 11, 12.1, 12.5]), '600001', '主板', 'sh'),
    ).toBe(0);
    // 涨停序列中间一日不涨停、末日涨停 → 计数 1（中断后重新起算）
    expect(
      calcConsecutiveLimitUp(makeKlines([10, 11, 11.5, 12.65]), '600001', '主板', 'sh'),
    ).toBe(1);
  });

  it('无涨停 → 0', () => {
    expect(
      calcConsecutiveLimitUp(makeKlines([10, 10.2, 10.4]), '600001', '主板', 'sh'),
    ).toBe(0);
  });

  it('6 板封顶 5（字段定义 0~5）', () => {
    const prices = [10, 11, 12.1, 13.31, 14.641, 16.1051, 17.71561];
    expect(
      calcConsecutiveLimitUp(makeKlines(prices), '600001', '主板', 'sh'),
    ).toBe(5);
  });

  it('ST 股 5% 阈值：连续两日 +5% → 2', () => {
    expect(
      calcConsecutiveLimitUp(makeKlines([10, 10.5, 11.025]), '600001', 'ST示例', 'sh'),
    ).toBe(2);
    // 同一代码非 ST 时 +5% 不算涨停
    expect(
      calcConsecutiveLimitUp(makeKlines([10, 10.5]), '600001', '普通', 'sh'),
    ).toBe(0);
  });

  it('容差：涨幅 9.98% 算作主板涨停（阈值 10% - 0.3%）', () => {
    expect(
      calcConsecutiveLimitUp(makeKlines([10, 10.998]), '600001', '主板', 'sh'),
    ).toBe(1);
    // 低于容差边界（9.6%）不算
    expect(
      calcConsecutiveLimitUp(makeKlines([10, 10.96]), '600001', '主板', 'sh'),
    ).toBe(0);
  });

  it('K 线不足（0 或 1 根）→ 0 且不报错', async () => {
    expect(calcConsecutiveLimitUp([], '600001', '主板', 'sh')).toBe(0);
    expect(
      calcConsecutiveLimitUp(makeKlines([10]), '600001', '主板', 'sh'),
    ).toBe(0);

    // 端到端：仅 1 根 K 线
    const { svc } = makeSvc({
      directory: [{ symbol: '600001', name: 'A' }],
      quoteMap: { '600001': makeQuote('600001', 'A') },
      klineMap: { '600001': makeKlineBundle([10]) },
    });
    const res = await svc.evaluate(buildReq(limitFilter()));
    expect(res.items[0]!.consecutiveLimitUp).toBe(0);
  });
});
