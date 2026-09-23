import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';

/**
 * Part 2 TDD：PortfolioController 三路由
 * - 200 + 统一信封 { code:200, msg:'success', data }
 * - 错误 body → HTTP 400
 *
 * PortfolioService 使用 mock（纯路由/校验测试，不落盘、不依赖账户）。
 */
describe('PortfolioController', () => {
  let app: INestApplication;
  let portfolioMock: {
    getSummary: jest.Mock;
    create: jest.Mock;
    setStrategyRunning: jest.Mock;
    getStrategyConfig: jest.Mock;
  };

  beforeAll(async () => {
    portfolioMock = {
      getSummary: jest.fn().mockResolvedValue({ portfolio: { id: 'default' }, cash: 100000 }),
      create: jest.fn().mockImplementation(async (name: string, opts?: { cashReservePct?: number }) => ({
        id: 'pf_x',
        name,
        cashReservePct: opts?.cashReservePct ?? 0.05,
      })),
      setStrategyRunning: jest.fn().mockResolvedValue(undefined),
      getStrategyConfig: jest.fn().mockResolvedValue({
        strategyId: 's1',
        running: true,
        maxPositionPct: 0.1,
      }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [PortfolioController],
      providers: [{ provide: PortfolioService, useValue: portfolioMock }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('T1 GET /portfolio/summary → 200 + 信封结构', async () => {
    const res = await request(app.getHttpServer())
      .get('/portfolio/summary')
      .expect(200);
    expect(res.body).toMatchObject({ code: 200, msg: 'success' });
    expect(res.body.data).toBeTruthy();
    expect(res.body.data.portfolio.id).toBe('default');
    expect(portfolioMock.getSummary).toHaveBeenCalledTimes(1);
  });

  it('T2 POST /portfolio/create → 200 + 信封结构，service 收到 name', async () => {
    const res = await request(app.getHttpServer())
      .post('/portfolio/create')
      .send({ name: '进取组合' })
      .expect(200);
    expect(res.body).toMatchObject({ code: 200, msg: 'success' });
    expect(res.body.data.name).toBe('进取组合');
    expect(portfolioMock.create).toHaveBeenCalledWith('进取组合', { cashReservePct: undefined });
  });

  it('T3 POST /portfolio/strategy/toggle → 200，透传 running 与 maxPositionPct', async () => {
    const res = await request(app.getHttpServer())
      .post('/portfolio/strategy/toggle')
      .send({ strategyId: 's1', running: true, maxPositionPct: 0.2 })
      .expect(200);
    expect(res.body).toMatchObject({ code: 200, msg: 'success' });
    expect(res.body.data).toMatchObject({ strategyId: 's1', running: true, maxPositionPct: 0.1 });
    expect(portfolioMock.setStrategyRunning).toHaveBeenCalledWith('s1', true, {
      maxPositionPct: 0.2,
    });
  });

  it('T4 create 缺少 name → 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/portfolio/create')
      .send({})
      .expect(400);
    expect(res.body).toBeTruthy();
    expect(portfolioMock.create).not.toHaveBeenCalled();
  });

  it('T5 toggle running 非布尔 / strategyId 缺失 → 400', async () => {
    await request(app.getHttpServer())
      .post('/portfolio/strategy/toggle')
      .send({ strategyId: 's1', running: 'yes' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/portfolio/strategy/toggle')
      .send({ running: true })
      .expect(400);
    expect(portfolioMock.setStrategyRunning).not.toHaveBeenCalled();
  });

  it('T6 toggle maxPositionPct 越界 → 400', async () => {
    await request(app.getHttpServer())
      .post('/portfolio/strategy/toggle')
      .send({ strategyId: 's1', running: true, maxPositionPct: 1.5 })
      .expect(400);
    expect(portfolioMock.setStrategyRunning).not.toHaveBeenCalled();
  });
});
