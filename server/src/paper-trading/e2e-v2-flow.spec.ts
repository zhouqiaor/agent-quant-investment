/**
 * E2E v2：第2轮迭代全链路（交易记录 + 持仓详情 + 手动交易）
 * 用户旅程：重置 → 配置（股票+策略+金额）→ 开启投资 → 行情触发自动买入
 *         → 查看交易记录（筛选/分页/详情）→ 查看持仓详情
 *         → 手动加仓（加权成本变化）→ 手动减仓（已实现盈亏）→ 汇总 → 重置回归
 */
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { PersistenceService } from '../persistence/persistence.service';

describe('E2E v2: 模拟交易全链路（交易记录+持仓+手动交易）', () => {
  let app: INestApplication;
  let http: any;
  const dbPath = `/tmp/e2e-v2-${Date.now()}.db`;
  let strategyId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    const ps = app.get(PersistenceService);
    ps.setDbPath(dbPath);
    ps.init();
    await app.init();
    http = app.getHttpServer();
  }, 30000);

  afterAll(async () => {
    await app.close();
    try {
      require('fs').unlinkSync(dbPath);
    } catch (e) {
      /* ignore */
    }
  });

  it('步骤1：重置账户 → 初始状态干净', async () => {
    await request(http).post('/api/beta/reset-all').expect(200);
    const acc = await request(http).get('/api/paper-trading/account').expect(200);
    expect(acc.body.data.positions).toEqual([]);
    expect(acc.body.data.trades).toEqual([]);
    expect(acc.body.data.isRunning).toBe(false);
  });

  it('步骤2：添加关注股票（600519 贵州茅台）', async () => {
    const res = await request(http).post('/api/stock/watchlist').send({ symbol: '600519' }).expect(200);
    expect(res.body.data.symbol).toBe('600519');
    expect(res.body.data.enabled).toBe(true);
  });

  it('步骤3：创建并启动买入策略（价格低于100自动买入）', async () => {
    const created = await request(http)
      .post('/api/strategies/custom')
      .send({
        name: 'E2E-v2策略',
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
    await request(http).post(`/api/strategies/${strategyId}/start`).expect(200);
  });

  it('步骤4：开启投资（beta/start 30万）→ 行情触发自动买入', async () => {
    const start = await request(http)
      .post('/api/beta/start')
      .send({ initialCapital: 300000, watchSymbols: ['600519'], strategyId, autoTrade: true })
      .expect(200);
    expect(start.body.data.account.isRunning).toBe(true);

    // tick 到 80 → 触发买入信号并成交
    const tick = await request(http)
      .post('/api/beta/tick')
      .send({ marketData: [{ symbol: '600519', price: 80, changePercent: -5 }] })
      .expect(200);
    expect(tick.body.data.stats.signals).toBeGreaterThanOrEqual(1);
    expect(tick.body.data.stats.executed).toBeGreaterThanOrEqual(1);

    // 交易记录已有流水
    const trades = await request(http).get('/api/paper-trading/trades?limit=10').expect(200);
    expect(trades.body.data.total).toBeGreaterThanOrEqual(1);
    expect(trades.body.data.list.length).toBeGreaterThanOrEqual(1);
    const first = trades.body.data.list[0];
    expect(first.symbol).toBe('600519');
    expect(first.type).toBe('BUY');
    expect(typeof first.amount).toBe('number');
  });

  it('步骤5：交易记录筛选（类型/股票）与分页', async () => {
    const buys = await request(http).get('/api/paper-trading/trades?type=BUY&limit=10').expect(200);
    expect(buys.body.data.total).toBeGreaterThanOrEqual(1);
    buys.body.data.list.forEach((t: { type: string }) => expect(t.type).toBe('BUY'));

    const bySymbol = await request(http)
      .get('/api/paper-trading/trades?symbol=600519&limit=10')
      .expect(200);
    bySymbol.body.data.list.forEach((t: { symbol: string }) => expect(t.symbol).toBe('600519'));

    // 分页：offset=total → 空列表；offset=total-1 → 恰好1条
    const total = buys.body.data.total;
    const empty = await request(http)
      .get(`/api/paper-trading/trades?type=BUY&offset=${total}&limit=10`)
      .expect(200);
    expect(empty.body.data.list.length).toBe(0);
    const one = await request(http)
      .get(`/api/paper-trading/trades?type=BUY&offset=${total - 1}&limit=10`)
      .expect(200);
    expect(one.body.data.list.length).toBe(1);
  });

  it('步骤6：交易详情（按 id 查单笔流水）', async () => {
    const list = await request(http).get('/api/paper-trading/trades?limit=1').expect(200);
    const id = list.body.data.list[0].id;
    const detail = await request(http).get(`/api/paper-trading/trade/${id}`).expect(200);
    expect(detail.body.data.id).toBe(id);
    expect(detail.body.data.symbol).toBe('600519');
    expect(detail.body.data.type).toBe('BUY');
    expect(detail.body.data.quantity).toBeGreaterThan(0);
  });

  it('步骤7：持仓详情（成本/现价/市值/浮盈）', async () => {
    const pos = await request(http).get('/api/paper-trading/position/600519').expect(200);
    const p = pos.body.data;
    expect(p).toBeTruthy();
    expect(p.symbol).toBe('600519');
    expect(p.quantity).toBeGreaterThan(0);
    expect(p.currentPrice).toBe(80);
    expect(p.avgCost).toBeGreaterThan(0);
    expect(p.marketValue).toBeCloseTo(p.quantity * p.currentPrice, 2);
    expect(p.pnl).toBeCloseTo(p.quantity * (p.currentPrice - p.avgCost), 2);
  });

  it('步骤8：手动加仓（70 买入 100 股）→ 持仓数量与加权成本变化', async () => {
    const before = await request(http).get('/api/paper-trading/position/600519').expect(200);
    const beforeQty = before.body.data.quantity;
    const beforeCost = before.body.data.avgCost;

    const buy = await request(http)
      .post('/api/paper-trading/manual/buy')
      .send({ symbol: '600519', name: '贵州茅台', price: 70, quantity: 100, reason: 'E2E手动加仓' })
      .expect(200);
    expect(buy.body.code).toBe(200);
    expect(buy.body.data.type).toBe('BUY');
    expect(buy.body.data.quantity).toBe(100);
    expect(buy.body.data.strategyId).toBe('manual');

    const after = await request(http).get('/api/paper-trading/position/600519').expect(200);
    expect(after.body.data.quantity).toBe(beforeQty + 100);
    // 加权平均成本：介于两次买入价之间且不等于原成本
    expect(after.body.data.avgCost).toBeLessThan(beforeCost);
    expect(after.body.data.avgCost).toBeGreaterThanOrEqual(70);
  });

  it('步骤9：手动减仓（90 卖出 50 股）→ 已实现盈利', async () => {
    const before = await request(http).get('/api/paper-trading/position/600519').expect(200);
    const beforeQty = before.body.data.quantity;

    const sell = await request(http)
      .post('/api/paper-trading/manual/sell')
      .send({ symbol: '600519', price: 90, quantity: 50, reason: 'E2E手动减仓' })
      .expect(200);
    expect(sell.body.code).toBe(200);
    expect(sell.body.data.type).toBe('SELL');
    expect(sell.body.data.quantity).toBe(50);

    const after = await request(http).get('/api/paper-trading/position/600519').expect(200);
    expect(after.body.data.quantity).toBe(beforeQty - 50);
  });

  it('步骤10：交易汇总（笔数/买卖统计/已实现盈亏为正）', async () => {
    const sum = await request(http).get('/api/paper-trading/summary').expect(200);
    const s = sum.body.data;
    expect(s.totalTrades).toBeGreaterThanOrEqual(3); // 策略买 + 手动买 + 手动卖
    expect(s.buyCount).toBeGreaterThanOrEqual(2);
    expect(s.sellCount).toBeGreaterThanOrEqual(1);
    expect(s.totalBuyAmount).toBeGreaterThan(0);
    expect(s.totalSellAmount).toBeGreaterThan(0);
    // 卖出价90高于所有买入成本（70~80）→ 已实现盈亏必为正
    expect(s.realizedPnl).toBeGreaterThan(0);
  });

  it('步骤11：重置回归 → 再配置可用（金额正确恢复）', async () => {
    await request(http).post('/api/beta/reset-all').expect(200);
    const acc = await request(http).get('/api/paper-trading/account').expect(200);
    expect(acc.body.data.trades).toEqual([]);
    expect(acc.body.data.positions).toEqual([]);

    // 真实用户旅程：重置后需重新添加关注，才能一键开启投资
    await request(http).post('/api/stock/watchlist').send({ symbol: '600519' }).expect(200);
    const start = await request(http)
      .post('/api/beta/start')
      .send({ initialCapital: 50000, watchSymbols: ['600519'], strategyId, autoTrade: true })
      .expect(200);
    expect(start.body.data.account.initialCapital).toBe(50000);
    expect(start.body.data.account.cash).toBe(50000);
  });
});
