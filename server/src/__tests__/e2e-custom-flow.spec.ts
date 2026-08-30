/**
 * E2E 集成测试 — 自定义股票 + 自定义金额/时间段回测 全流程
 *
 * SPEC: docs/SPEC-custom.md §3
 * 链路：添加自定义股票 → 搜索可见（isCustom 优先） → 自定义金额区间回测
 *      → 金额等比收益（totalReturn 相等, finalCapital 10倍） → 非法参数 400
 *      → 模拟交易用自定义金额买入 → 持久化留存
 */
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';

describe('E2E 自定义股票/金额回测全流程', () => {
  let app: INestApplication;
  const CUSTOM_SYMBOL = '601888';
  const CUSTOM_NAME = `中免E2E-${Date.now()}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('步骤1: 添加自定义股票并可见于搜索（isCustom 标记优先）', async () => {
    // 清理旧数据，保证幂等起点
    await request(app.getHttpServer()).delete(`/api/stock/custom/${CUSTOM_SYMBOL}`);

    const addRes = await request(app.getHttpServer())
      .post('/api/stock/custom')
      .send({ symbol: CUSTOM_SYMBOL, name: CUSTOM_NAME });
    expect(addRes.status).toBe(200);
    expect(addRes.body).toHaveProperty('code', 200);
    expect(addRes.body.data).toMatchObject({ symbol: CUSTOM_SYMBOL, name: CUSTOM_NAME, isCustom: true });

    // 列表可见
    const listRes = await request(app.getHttpServer()).get('/api/stock/custom');
    expect(listRes.status).toBe(200);
    const list = listRes.body.data as Array<{ symbol: string; name: string }>;
    expect(list.some(s => s.symbol === CUSTOM_SYMBOL)).toBe(true);

    // 搜索合并：自定义记录优先于静态库
    const searchRes = await request(app.getHttpServer()).get('/api/stock/search').query({ q: CUSTOM_SYMBOL });
    expect(searchRes.status).toBe(200);
    const results = searchRes.body.data as Array<{ symbol: string; name: string; isCustom?: boolean }>;
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toMatchObject({ symbol: CUSTOM_SYMBOL, name: CUSTOM_NAME, isCustom: true });
  });

  it('步骤2: 非法代码/非法参数 → 400', async () => {
    const badStock = await request(app.getHttpServer())
      .post('/api/stock/custom')
      .send({ symbol: '12345' });
    expect(badStock.status).toBe(400);

    const badDate = await request(app.getHttpServer())
      .post('/api/backtest/run')
      .send({ symbol: CUSTOM_SYMBOL, startDate: '2024/01/01', endDate: '2024-06-30', initialCapital: 100000 });
    expect(badDate.status).toBe(400);

    const badCapital = await request(app.getHttpServer())
      .post('/api/backtest/run')
      .send({ symbol: CUSTOM_SYMBOL, startDate: '2024-01-01', endDate: '2024-06-30', initialCapital: 0 });
    expect(badCapital.status).toBe(400);
  });

  it('步骤3: 自定义金额+时间段回测成功（曲线起点=本金）', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/backtest/run')
      .send({
        symbol: CUSTOM_SYMBOL,
        startDate: '2024-01-01',
        endDate: '2024-06-30',
        initialCapital: 88888,
      });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('code', 200);
    const d = res.body.data;
    expect(d.tradingDays).toBeGreaterThan(0);
    expect(d.equityCurve[0].value).toBe(88888);
    expect(d.finalCapital).toBeGreaterThan(0);
  });

  it('步骤4: 金额等比 — A vs 10A → totalReturn 相等, finalCapital 10倍', async () => {
    const r1 = await request(app.getHttpServer())
      .post('/api/backtest/run')
      .send({ symbol: CUSTOM_SYMBOL, startDate: '2024-01-01', endDate: '2024-06-30', initialCapital: 50000 });
    const r2 = await request(app.getHttpServer())
      .post('/api/backtest/run')
      .send({ symbol: CUSTOM_SYMBOL, startDate: '2024-01-01', endDate: '2024-06-30', initialCapital: 500000 });
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    const d1 = r1.body.data;
    const d2 = r2.body.data;
    expect(d2.totalReturn).toBeCloseTo(d1.totalReturn, 4);
    expect(d2.finalCapital / d1.finalCapital).toBeCloseTo(10, 2);
  });

  it('步骤5: 模拟交易用自定义金额对自定义标的下单并持久化', async () => {
    // 重置并启动模拟交易（默认标的池含自定义股票时优先选中自定义标的）
    await request(app.getHttpServer()).post('/api/paper-trading/reset').send({});
    const startRes = await request(app.getHttpServer())
      .post('/api/paper-trading/start')
      .send({ initialCapital: 200000, watchlist: [CUSTOM_SYMBOL, '600519'] });
    expect(startRes.status).toBe(200);

    // 直接执行一笔买入（自定义标的，quantity 由后端按资金约束执行）
    const execRes = await request(app.getHttpServer())
      .post('/api/paper-trading/execute')
      .send({
        type: 'BUY',
        symbol: CUSTOM_SYMBOL,
        name: CUSTOM_NAME,
        price: 80,
        quantity: 100,
        reason: 'E2E自定义金额下单',
        strategyId: 'e2e-custom',
      });
    expect(execRes.status).toBe(200);
    expect(execRes.body.data).toHaveProperty('success', true);

    // 持仓与交易记录中可见
    const positionsRes = await request(app.getHttpServer()).get('/api/paper-trading/positions');
    expect(positionsRes.status).toBe(200);
    const positions = positionsRes.body.data || [];
    const tradesRes = await request(app.getHttpServer()).get('/api/paper-trading/trades');
    expect(tradesRes.status).toBe(200);
    const trades = tradesRes.body.data || [];
    const hit =
      (Array.isArray(positions) ? positions : []).find((p: any) => p.symbol === CUSTOM_SYMBOL) ||
      (Array.isArray(trades) ? trades : []).find((t: any) => t.symbol === CUSTOM_SYMBOL);
    expect(hit).toBeTruthy();

    // 自定义股票仍持久化（跨请求留存）
    const listRes = await request(app.getHttpServer()).get('/api/stock/custom');
    expect((listRes.body.data as Array<{ symbol: string }>).some(s => s.symbol === CUSTOM_SYMBOL)).toBe(true);

    // 清理
    await request(app.getHttpServer()).delete(`/api/stock/custom/${CUSTOM_SYMBOL}`);
  });
});
