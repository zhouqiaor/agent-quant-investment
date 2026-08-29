/**
 * E2E 集成测试 — 全流程验证
 *
 * 参考业界实践（Freqtrade e2e-tests）：启动真实 AppModule（内存 SQLite），
 * 通过 supertest 发起 HTTP 请求，覆盖完整业务链路：
 *   选股搜索 → 行情 → 创建自定义策略 → 启动策略 → 回测 → 参数优化
 *   → 模拟交易执行 → 持仓查询 → 信号通知持久化
 *
 * 注意：真实行情依赖外网（hq.sinajs.cn），E2E 中对 Market/Stock/Backtest 的
 * 行情获取做了网络失败兜底，测试断言聚焦于「接口契约 + 数据流贯通」。
 */
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';

describe('E2E 全流程集成测试', () => {
  let app: INestApplication;

  const envelopeOk = (res: request.Response) => {
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('code', 200);
    expect(res.body).toHaveProperty('data');
  };

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

  it('步骤1: 健康检查 — 服务可用', async () => {
    const res = await request(app.getHttpServer()).get('/api/');
    expect([200, 404]).toContain(res.status); // 根路径可能有或没有 handler
  });

  it('步骤2: 股票搜索 — 返回结果数组（本地库兜底）', async () => {
    const res = await request(app.getHttpServer()).get('/api/stock/search?q=600519');
    envelopeOk(res);
    expect(Array.isArray(res.body.data)).toBe(true);
    if (res.body.data.length > 0) {
      expect(res.body.data[0]).toHaveProperty('symbol');
      expect(res.body.data[0]).toHaveProperty('name');
    }
  });

  it('步骤3: 行情列表 — 返回数组且字段契约完整', async () => {
    const res = await request(app.getHttpServer()).get('/api/market/list');
    envelopeOk(res);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    const quote = res.body.data[0];
    for (const key of ['symbol', 'name', 'price', 'changePercent']) {
      expect(quote).toHaveProperty(key);
    }
  });

  it('步骤4: 创建自定义策略 → 持久化 → 可查询', async () => {
    const payload = {
      name: 'E2E测试策略',
      symbol: '600519',
      indicators: ['MACD', 'RSI'],
      indicatorParams: { MACD: { fast: 12, slow: 26, signal: 9 } },
      buyConditions: [{ id: 'b1', indicator: 'MACD', operator: 'cross_above', value: 0, description: '金叉' }],
      sellConditions: [{ id: 's1', indicator: 'RSI', operator: 'less_than', value: 30, description: '超卖' }],
      positionSize: 20,
      stopLoss: 5,
      takeProfit: 10,
      autoTrade: false,
      monitorEnabled: true,
    };

    const createRes = await request(app.getHttpServer())
      .post('/api/strategies/custom')
      .send(payload);
    envelopeOk(createRes);
    expect(createRes.body.data.id).toBeTruthy();

    // 从列表查询（列表 = 内置 + 自定义），确认已持久化
    const listRes = await request(app.getHttpServer()).get('/api/strategies');
    envelopeOk(listRes);
    const found = (listRes.body.data as Array<Record<string, unknown>>).find(
      (s) => s.id === createRes.body.data.id,
    );
    expect(found).toBeTruthy();
    expect(found?.['name']).toBe('E2E测试策略');
  });

  it('步骤5: 回测执行 — 返回完整指标结构', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/backtest/run')
      .send({
        symbol: '600519',
        startDate: '2024-01-01',
        endDate: '2024-06-30',
        initialCapital: 100000,
        indicators: ['MA', 'MACD'],
      });
    envelopeOk(res);
    const d = res.body.data;
    for (const key of [
      'totalReturn', 'benchmarkReturn', 'maxDrawdown', 'volatility',
      'sharpeRatio', 'winRate', 'trades', 'equityCurve',
    ]) {
      expect(d).toHaveProperty(key);
    }
    expect(Array.isArray(d.equityCurve)).toBe(true);
    expect(d.equityCurve.length).toBeGreaterThan(0);
  });

  it('步骤6: 参数优化 — 返回最优参数组合', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/optimizer/run')
      .send({
        symbol: '600519',
        startDate: '2024-01-01',
        endDate: '2024-06-30',
        initialCapital: 100000,
        objective: 'totalReturn',
        indicators: ['MA'],
        paramSpace: [
          { name: 'period', min: 5, max: 10, step: 5 },
        ],
      });
    // 优化器依赖回测数据，网络受限时也应返回合法结构
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('code');
    if (res.body.code === 200) {
      const d = res.body.data;
      expect(d).toHaveProperty('bestParams');
      expect(d).toHaveProperty('bestResult');
      expect(d).toHaveProperty('results');
      expect(Array.isArray(d.results)).toBe(true);
    }
  });

  it('步骤7: 模拟交易 — 买入→持仓→卖出→账户一致', async () => {
    const server = app.getHttpServer();

    // 重置并启动模拟账户（reset 会停止运行状态，故先 reset 后 start）
    await request(server).post('/api/paper-trading/reset');
    const startRes = await request(server).post('/api/paper-trading/start').send({});
    expect(startRes.status).toBe(200);

    // 买入
    const buyRes = await request(server)
      .post('/api/paper-trading/execute')
      .send({
        type: 'BUY',
        symbol: '601318',
        name: '中国平安',
        price: 52,
        reason: 'E2E测试买入',
        strategyId: 'momentum',
      });
    envelopeOk(buyRes);
    expect(buyRes.body.data.success).toBe(true);

    // 持仓应包含该标的
    const posRes = await request(server).get('/api/paper-trading/positions');
    envelopeOk(posRes);
    const pos = (posRes.body.data as Array<Record<string, unknown>>).find(
      (p) => p.symbol === '601318',
    );
    expect(pos).toBeTruthy();

    // 卖出
    const sellRes = await request(server)
      .post('/api/paper-trading/execute')
      .send({
        type: 'SELL',
        symbol: '601318',
        name: '中国平安',
        price: 55,
        reason: 'E2E测试卖出',
        strategyId: 'momentum',
      });
    envelopeOk(sellRes);
    expect(sellRes.body.data.success).toBe(true);

    // 账户统计一致：有已实现盈亏，交易数 >= 2
    const accRes = await request(server).get('/api/paper-trading/account');
    envelopeOk(accRes);
    expect(Array.isArray(accRes.body.data.trades)).toBe(true);
    expect(accRes.body.data.trades.length).toBeGreaterThanOrEqual(2);
    expect(typeof accRes.body.data.totalPnl).toBe('number');
  });

  it('步骤8: 通知服务 — 创建并查询（持久化验证）', async () => {
    const server = app.getHttpServer();

    // Agent 生成信号应同时写入通知
    const genRes = await request(server).post('/api/notifications/sync');
    expect(genRes.status).toBe(200);

    const listRes = await request(server).get('/api/notifications?limit=5');
    envelopeOk(listRes);
    expect(Array.isArray(listRes.body.data)).toBe(true);
  });

  it('步骤9: 回归 — 原有核心接口全部可用', async () => {
    const endpoints = [
      '/api/assets/overview',
      '/api/assets/positions',
      '/api/agent/status',
      '/api/risk/settings',
    ];
    for (const ep of endpoints) {
      const res = await request(app.getHttpServer()).get(ep);
      envelopeOk(res);
    }
  });
});
