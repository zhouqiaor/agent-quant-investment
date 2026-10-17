import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { ScreenerModule } from './screener.module';
import { PersistenceModule } from '@/persistence/persistence.module';
import { PersistenceService } from '@/persistence/persistence.service';
import {
  StockService,
  StockInfo,
  KlineWithIndicators,
} from '@/stock/stock.service';

// 测试数据隔离：独立 SQLite（与已有 e2e 规范一致）
const TEST_DB = `/tmp/quant-test-screener-${process.pid}-${Date.now()}-${Math.round(
  Math.random() * 1e9,
)}.db`;
process.env.SQLITE_PATH = TEST_DB;
process.env.NODE_ENV = 'test';

// ---------------------------------------------------------------------------
// Mock fixtures —— 固定 7 只票，覆盖正/负涨跌幅，便于排序 + 分页断言
// 注：PersistenceService.searchDirectory 返回行的最小字段约定：symbol/name/market/price/changePercent
// ---------------------------------------------------------------------------
const MOCK_DIR_ROWS: Array<{
  symbol: string;
  name: string;
  market: string;
  price: number;
  changePercent: number;
}> = [
  { symbol: '600519', name: '贵州茅台', market: 'sh', price: 1300, changePercent: 2.5 },
  { symbol: '000858', name: '五粮液', market: 'sz', price: 160, changePercent: 1.8 },
  { symbol: '300750', name: '宁德时代', market: 'sz', price: 200, changePercent: -2.5 },
  { symbol: '002594', name: '比亚迪', market: 'sz', price: 240, changePercent: 3.5 },
  { symbol: '601318', name: '中国平安', market: 'sh', price: 45, changePercent: 1.1 },
  { symbol: '600036', name: '招商银行', market: 'sh', price: 35, changePercent: 0.9 },
  { symbol: '000001', name: '平安银行', market: 'sz', price: 12, changePercent: -0.5 },
];

const MOCK_STOCKS: StockInfo[] = MOCK_DIR_ROWS.map((r) => ({
  symbol: r.symbol,
  name: r.name,
  market: 'A',
  industry: '未知',
  price: r.price,
  change: 0,
  changePercent: r.changePercent,
  volume: 1e8,
  marketCap: 1e11,
  pe: 20,
  pb: 5,
  roe: 15,
  high52w: r.price * 1.2,
  low52w: r.price * 0.8,
}));

const MOCK_KLINES: KlineWithIndicators = {
  klines: Array.from({ length: 60 }, (_, i) => ({
    date: `2024-01-${String((i % 28) + 1).padStart(2, '0')}`,
    open: 100 + i,
    high: 105 + i,
    low: 98 + i,
    close: 103 + i,
    volume: 1_000_000 + i * 1000,
  })),
  indicators: {
    ma: { '5': [], '10': [], '20': [], '60': [] },
    macd: { dif: [], dea: [], hist: [], crosses: [] },
    boll: { mid: [], upper: [], lower: [], breaks: [] },
    kdj: { k: [], d: [], j: [], extremes: [] },
    signals: [],
  },
};

describe('条件选股器 E2E (TDD)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, ScreenerModule],
    })
      .overrideProvider(StockService)
      .useValue({
        getAllStocks: () => MOCK_STOCKS,
        fetchRealtimeQuote: jest.fn(async (symbol: string) => {
          return MOCK_STOCKS.find((s) => s.symbol === symbol) ?? null;
        }),
        getKlineBundle: jest.fn(async () => MOCK_KLINES),
      })
      .overrideProvider(PersistenceService)
      .useValue({
        searchDirectory: jest.fn((_q: string, _limit: number) => MOCK_DIR_ROWS),
      })
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    try {
      require('fs').unlinkSync(TEST_DB);
    } catch {
      /* ignore */
    }
  });

  // ----- 1. 字段字典 -----
  it('GET /stock/screener/fields 返回 200 + 字段字典结构', async () => {
    const res = await request(app.getHttpServer()).get('/api/stock/screener/fields');
    expect(res.body.code).toBe(200);
    expect(res.body.msg).toBe('success');
    expect(res.body.data).toHaveProperty('fields');
    expect(res.body.data).toHaveProperty('sort');
    // 12 个字段
    expect(Object.keys(res.body.data.fields)).toHaveLength(12);
    // sort 数组长度匹配
    expect(Array.isArray(res.body.data.sort)).toBe(true);
    expect(res.body.data.sort.length).toBe(12);
    // 字段字典结构：每个字段都有 category/dataSource/ops/valueType
    const pe = res.body.data.fields.pe;
    expect(pe.category).toBe('fundamental');
    expect(pe.dataSource).toBe('daily_basic');
    expect(Array.isArray(pe.ops)).toBe(true);
    expect(pe.valueType).toBe('number');
  });

  // ----- 2. 空 groups -----
  it('POST 空 groups 返回 200 + items 数组', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/stock/screener')
      .send({
        combinator: 'AND',
        groups: [],
        page: 1,
        pageSize: 10,
        sort: { field: 'changePct', order: 'desc' },
      });
    expect(res.body.code).toBe(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    // total ≥ 7（MOCK_DIR_ROWS 全部通过空 groups）
    expect(res.body.data.total).toBe(7);
  });

  // ----- 3. groups > 8 -----
  it('POST groups > 8 返回 400', async () => {
    const groups = Array.from({ length: 9 }, () => ({
      field: 'pe',
      op: '<',
      value: 30,
    }));
    const res = await request(app.getHttpServer())
      .post('/api/stock/screener')
      .send({
        combinator: 'AND',
        groups,
        page: 1,
        pageSize: 10,
        sort: { field: 'changePct', order: 'desc' },
      });
    expect(res.status).toBe(400);
  });

  // ----- 4. 非法 field -----
  it('POST 非法 field name 返回 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/stock/screener')
      .send({
        combinator: 'AND',
        groups: [{ field: 'notAField', op: '=', value: 1 }],
        page: 1,
        pageSize: 10,
        sort: { field: 'changePct', order: 'desc' },
      });
    expect(res.status).toBe(400);
  });

  // ----- 5. 合法 schema + 排序 -----
  it('POST 合法 schema + 排序 → items 按 changePct desc 单调非增', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/stock/screener')
      .send({
        combinator: 'AND',
        groups: [{ field: 'changePct', op: '>', value: -10 }],
        page: 1,
        pageSize: 10,
        sort: { field: 'changePct', order: 'desc' },
      });
    expect(res.body.code).toBe(200);
    const items = res.body.data.items;
    expect(items.length).toBeGreaterThan(0);
    // 验证 desc 单调非增
    for (let i = 1; i < items.length; i++) {
      expect(items[i].changePct).toBeLessThanOrEqual(items[i - 1].changePct);
    }
  });

  // ----- 6. 分页 -----
  it('POST 分页 page=1 pageSize=5 → items.length <= 5', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/stock/screener')
      .send({
        combinator: 'AND',
        groups: [],
        page: 1,
        pageSize: 5,
        sort: { field: 'changePct', order: 'desc' },
      });
    expect(res.body.code).toBe(200);
    expect(res.body.data.items.length).toBeLessThanOrEqual(5);
    // pageSize=5 + 7 只票 → 应返回前 5
    expect(res.body.data.items.length).toBe(5);
    // page 信息透传
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.pageSize).toBe(5);
    expect(res.body.data.total).toBe(7);
  });
});
