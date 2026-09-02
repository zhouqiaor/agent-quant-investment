/**
 * TDD RED：一键从零重置（reset-all）
 * 场景：用户要求"从零开始配置"，系统不得遗留任何预置/演示/历史数据，
 * 重置后必须回到完全未配置状态，且可重新走完内测引导。
 */
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

// 测试数据隔离：独立 SQLite，禁止触碰生产库 data/quant.db
const TEST_DB = `/tmp/quant-test-${process.pid}-${Date.now()}-${Math.round(Math.random() * 1e9)}.db`;
process.env.SQLITE_PATH = TEST_DB;

describe('从零重置（POST /api/beta/reset-all）', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    try {
      require('fs').unlinkSync(TEST_DB);
    } catch (e) {
      /* ignore */
    }
  });

  async function seedDirtyData() {
    // 预置脏数据：关注、自定义股票、自定义策略、通知、回测记录、账户持仓
    await request(app.getHttpServer())
      .post('/api/stock/watchlist')
      .send({ symbol: '600519', name: '贵州茅台' })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/stock/custom')
      .send({ symbol: '601888', name: '测试自定义' })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/beta/start')
      .send({ initialCapital: 100000, watchSymbols: ['600519'], strategyId: null, autoTrade: true })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/beta/tick')
      .send({ marketData: [{ symbol: '600519', price: 90, changePercent: -5 }] })
      .expect(200);
  }

  it('T1 重置后状态回到未配置', async () => {
    await seedDirtyData();
    await request(app.getHttpServer()).post('/api/beta/reset-all').expect(200);
    const res = await request(app.getHttpServer()).get('/api/beta/status').expect(200);
    expect(res.body.data.configured).toBe(false);
  });

  it('T2 重置后关注列表为空', async () => {
    const res = await request(app.getHttpServer()).get('/api/stock/watchlist').expect(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('T3 重置后自定义股票与自定义策略为空', async () => {
    const stocks = await request(app.getHttpServer()).get('/api/stock/custom').expect(200);
    expect(stocks.body.data).toHaveLength(0);
    const strategies = await request(app.getHttpServer())
      .get('/api/strategies/custom')
      .expect(200);
    expect(strategies.body.data).toHaveLength(0);
  });

  it('T4 重置后通知与交易记录为空', async () => {
    const notifs = await request(app.getHttpServer()).get('/api/notifications').expect(200);
    expect(notifs.body.data).toHaveLength(0);
    const trades = await request(app.getHttpServer()).get('/api/paper-trading/trades').expect(200);
    expect(res0Empty(trades.body)).toBe(true);
  });

  it('T5 重置后账户归零（无持仓/未运行/金额0）', async () => {
    const res = await request(app.getHttpServer()).get('/api/paper-trading/account').expect(200);
    const acc = res.body.data;
    expect(acc.positions).toHaveLength(0);
    expect(acc.isRunning).toBe(false);
    expect(acc.totalValue).toBe(0);
  });

  it('T7 内置策略为纯模板态（无演示收益/未运行）', async () => {
    const res = await request(app.getHttpServer()).get('/api/strategies').expect(200);
    const list = res.body.data as Array<{
      id: string;
      isCustom?: boolean;
      status: string;
      pnl: number;
      pnlRate: number;
      winRate: number;
    }>;
    const builtins = list.filter((s) => !s.isCustom);
    expect(builtins.length).toBeGreaterThan(0);
    for (const b of builtins) {
      expect(b.status).not.toBe('running');
      expect(b.pnl).toBe(0);
      expect(b.pnlRate).toBe(0);
      expect(b.winRate).toBe(0);
    }
  });

  it('T6 重置后可重新从零配置并正常运行', async () => {
    // 从零流程：先关注，再启动
    await request(app.getHttpServer())
      .post('/api/stock/watchlist')
      .send({ symbol: '600036', name: '招商银行' })
      .expect(200);
    const res = await request(app.getHttpServer())
      .post('/api/beta/start')
      .send({ initialCapital: 50000, watchSymbols: ['600036'], strategyId: null, autoTrade: true })
      .expect(200);
    expect(res.body.data.account.cash).toBe(50000);
    const st = await request(app.getHttpServer()).get('/api/beta/status').expect(200);
    expect(st.body.data.configured).toBe(true);
  });
});

function res0Empty(body: any): boolean {
  const list = body?.data;
  return Array.isArray(list) ? list.length === 0 : true;
}
