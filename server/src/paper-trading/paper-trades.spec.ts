/**
 * TDD RED：交易记录查询 API（分页/筛选/单条详情/汇总）
 */
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

// 测试数据隔离：独立 SQLite，禁止触碰生产库 data/quant.db
const TEST_DB = `/tmp/quant-test-${process.pid}-${Date.now()}-${Math.round(Math.random() * 1e9)}.db`;
process.env.SQLITE_PATH = TEST_DB;

describe('交易记录查询 API', () => {
  let app: INestApplication;
  let firstTradeId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    // 先重置再 seed：3 笔买入 + 2 笔卖出，共 5 笔
    await request(app.getHttpServer()).post('/api/beta/reset-all').expect(200);
    await request(app.getHttpServer())
      .post('/api/stock/watchlist')
      .send({ symbol: '600519', name: '贵州茅台' })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/stock/watchlist')
      .send({ symbol: '600036', name: '招商银行' })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/beta/start')
      .send({ initialCapital: 100000, watchSymbols: ['600519','600036'], strategyId: null, autoTrade: false })
      .expect(200);
    // 手动下单造数据
    await request(app.getHttpServer())
      .post('/api/paper-trading/manual/buy')
      .send({ symbol: '600519', name: '贵州茅台', price: 100, quantity: 50, reason: 'T1' });
    await request(app.getHttpServer())
      .post('/api/paper-trading/manual/buy')
      .send({ symbol: '600519', name: '贵州茅台', price: 110, quantity: 30, reason: 'T2' });
    await request(app.getHttpServer())
      .post('/api/paper-trading/manual/buy')
      .send({ symbol: '600036', name: '招商银行', price: 30, quantity: 200, reason: 'T3' });
    await request(app.getHttpServer())
      .post('/api/paper-trading/manual/sell')
      .send({ symbol: '600519', price: 120, quantity: 40, reason: 'T4' });
    await request(app.getHttpServer())
      .post('/api/paper-trading/manual/sell')
      .send({ symbol: '600036', price: 33, quantity: 100, reason: 'T5' });
    const seedRes = await request(app.getHttpServer()).get('/api/paper-trading/trades');
    firstTradeId = seedRes.body.data.list[0].id;
  });

  afterAll(async () => {
    await app.close();
    try {
      require('fs').unlinkSync(TEST_DB);
    } catch (e) {
      /* ignore */
    }
  });

  it('T1 默认返回最新 20 条，按时间倒序', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/paper-trading/trades')
      .expect(200);
    const list = res.body.data.list;
    console.log('DEBUG_TRADES=', JSON.stringify(list.map(x => ({id: x.id, type: x.type, symbol: x.symbol, qty: x.quantity}))));
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBe(5);
    // 倒序：最后一笔（T5 卖出招行）在最前
    expect(list[0].reason).toContain('T5');
    firstTradeId = list[0].id;
  });

  it('T2 type=BUY 只返回买入记录', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/paper-trading/trades?type=BUY')
      .expect(200);
    expect(res.body.data.list.length).toBe(3);
    for (const t of res.body.data.list) {
      expect(t.type).toBe('BUY');
    }
  });

  it('T3 type=SELL 只返回卖出记录', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/paper-trading/trades?type=SELL')
      .expect(200);
    expect(res.body.data.list.length).toBe(2);
    for (const t of res.body.data.list) {
      expect(t.type).toBe('SELL');
    }
  });

  it('T4 symbol 筛选只返回指定股票', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/paper-trading/trades?symbol=600036')
      .expect(200);
    expect(res.body.data.list.length).toBe(2);
    for (const t of res.body.data.list) {
      expect(t.symbol).toBe('600036');
    }
  });

  it('T5 limit + offset 分页正确', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/paper-trading/trades?limit=2&offset=1')
      .expect(200);
    expect(res.body.data.list.length).toBe(2);
    expect(res.body.data.total).toBe(5);
  });

  it('T6 单条详情可查询', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/paper-trading/trade/${firstTradeId}`)
      .expect(200);
    expect(res.body.data.id).toBe(firstTradeId);
    expect(res.body.data.symbol).toBe('600036');
    expect(res.body.data.type).toBe('SELL');
  });

  it('T7 summary 汇总：成交笔数/买入次数/卖出次数', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/paper-trading/summary')
      .expect(200);
    expect(res.body.data.totalTrades).toBe(5);
    expect(res.body.data.buyCount).toBe(3);
    expect(res.body.data.sellCount).toBe(2);
    // 红涨绿跌语义：总金额（买入花的钱/卖出收回的钱，部分卖出按实际数量）
    expect(res.body.data.totalBuyAmount).toBe(50 * 100 + 30 * 110 + 200 * 30);
    expect(res.body.data.totalSellAmount).toBe(40 * 120 + 100 * 33);
  });
});
