import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { PersistenceService } from '../persistence/persistence.service';

/**
 * E2E：内测体验全链路（从零配置 → 实时监听 → 自动交易 → 收益）
 * 用户旅程：关注股票 → 配置策略 → 设定金额开启投资 → 行情 tick → 实时收益与信号通知
 */
describe('E2E 内测体验全链路（从零开始）', () => {
  let app: INestApplication;
  let persistence: PersistenceService;
  const dbPath = `/tmp/e2e-beta-${Date.now()}.db`;
  let strategyId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    persistence = app.get(PersistenceService);
    persistence.setDbPath(dbPath);
    persistence.init();
    // 确保空库：清空关注/策略相关表
    persistence.execRaw(
      'DELETE FROM watch_stocks; DELETE FROM custom_strategies; DELETE FROM trades; DELETE FROM notifications;'
    );
  }, 30000);

  afterAll(async () => {
    await app.close();
    try {
      require('fs').unlinkSync(dbPath);
    } catch (e) {
      /* ignore */
    }
  });

  it('步骤1：添加关注股票（600519 贵州茅台）', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/stock/watchlist')
      .send({ symbol: '600519' })
      .expect(200);
    expect(res.body.data.symbol).toBe('600519');
    expect(res.body.data.enabled).toBe(true);

    const list = await request(app.getHttpServer())
      .get('/api/stock/watchlist')
      .expect(200);
    expect(Array.isArray(list.body.data)).toBe(true);
    expect(list.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('步骤2：创建并启动监控策略（价格低于 100 自动买入）', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/strategies/custom')
      .send({
        name: 'E2E内测策略',
        symbol: '600519',
        description: '低于100买入',
        buyConditions: [{ indicator: 'price', operator: 'lte', value: 100 }],
        sellConditions: [{ indicator: 'price', operator: 'gte', value: 200 }],
        monitorEnabled: true,
        autoTrade: true,
      })
      .expect(200);
    strategyId = created.body.data.id;
    expect(strategyId).toBeTruthy();

    await request(app.getHttpServer())
      .post(`/api/strategies/${strategyId}/start`)
      .expect(200);
  });

  it('步骤3：设定投入金额并一键开启投资（beta/start）', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/beta/start')
      .send({
        initialCapital: 300000,
        watchSymbols: ['600519'],
        strategyId,
        autoTrade: true,
      });
    expect(res.status).toBe(200);
    expect(res.body.data.account.initialCapital).toBe(300000);
    expect(res.body.data.account.isRunning).toBe(true);
    expect(res.body.data.config.status).toBe('active');
  });

  it('步骤4：行情 tick（价格 80 触发买入信号）→ 自动成交 + 通知', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/beta/tick')
      .send({
        marketData: [{ symbol: '600519', price: 80, changePercent: -5 }],
      })
      .expect(200);
    const stats = res.body.data.stats;
    expect(stats.marked).toBeGreaterThanOrEqual(0);
    expect(stats.signals).toBeGreaterThanOrEqual(1);
    expect(stats.executed).toBeGreaterThanOrEqual(1);
  });

  it('步骤5：实时收益可查（持仓/浮盈/账户总资产）', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/beta/status')
      .expect(200);
    const st = res.body.data;
    expect(st.configured).toBe(true);
    expect(st.totalValue).toBeGreaterThan(0);
    expect(st.positions.length).toBeGreaterThanOrEqual(1);
    const pos = st.positions.find((p: { symbol: string }) => p.symbol === '600519');
    expect(pos).toBeTruthy();
    expect(pos.currentPrice).toBe(80);
    // 再次 tick 至 75：验证实时重估产生浮亏
    await request(app.getHttpServer())
      .post('/api/beta/tick')
      .send({ marketData: [{ symbol: '600519', price: 75, changePercent: -6 }] })
      .expect(200);
    const res2 = await request(app.getHttpServer()).get('/api/beta/status').expect(200);
    const pos2 = res2.body.data.positions.find((p: { symbol: string }) => p.symbol === '600519');
    expect(pos2.currentPrice).toBe(75);
    expect(pos2.pnl).toBeLessThan(0);
    expect(res2.body.data.totalValue).toBeGreaterThan(0);
  });

  it('步骤6：信号通知已产生', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/notifications')
      .expect(200);
    const notes = Array.isArray(res.body.data) ? res.body.data : [];
    expect(notes.length).toBeGreaterThanOrEqual(1);
  });

  it('步骤7：非关注标的的价格不触发信号（disabled 过滤）', async () => {
    await request(app.getHttpServer())
      .post('/api/stock/watchlist')
      .send({ symbol: '300750' })
      .expect(200);
    // 先取消 300750 的启用
    const before = await request(app.getHttpServer())
      .post('/api/beta/tick')
      .send({ marketData: [{ symbol: '300750', price: 50, changePercent: -8 }] })
      .expect(200);
    // 300750 未被策略覆盖 → 不产生信号
    expect(before.body.data.stats.signals).toBe(0);
  });
});
