/**
 * TDD RED: 数据一致性对账（reconcile）
 *
 * 背景：用户报告"交易记录跟持仓不匹配"。
 * 根因（已查清）：default 账户的 trades 表里有 10 笔 BUY 共 8000 股 600519（74万元），
 * 但 positions=[] 且 cash=200000（初始资金未动）。属于历史脏数据：
 * 早期版本的 executeBuy 在某些路径下未 push positions / 未扣 cash。
 *
 * 修复方向：从 trades 表按时间正序重放，FIFO 加权平均算法合并同 symbol 的 BUY，
 * 减去 SELL 数量，重建 positions 数组；同时按"重建后的持仓成本总额"扣减 cash。
 *
 * 测试覆盖：
 * 1) 5 笔混合交易（3 BUY + 2 SELL）→ positions 数量、avgCost、quantity 全部正确
 * 2) 重复 BUY 同 symbol → 加权平均 avgCost 正确
 * 3) SELL 数量 > 当前持仓 → 不报错（按当前持仓清仓）
 * 4) 没有交易的账户 → positions=[], cash=initialCapital
 * 5) cash 减少额 == sum(BUY.amount) - sum(SELL.amount)，不得透支
 */
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { PaperTradingService } from './paper-trading.service';
import { PersistenceService } from '../persistence/persistence.service';

const TEST_DB = `/tmp/quant-reconcile-${process.pid}-${Date.now()}.db`;
process.env.SQLITE_PATH = TEST_DB;

describe('数据一致性对账 reconcilePositionsForAccount', () => {
  let app: INestApplication;
  let paper: PaperTradingService;
  let persistence: PersistenceService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    paper = app.get(PaperTradingService);
    persistence = app.get(PersistenceService);
  });

  afterAll(async () => {
    await app.close();
    try { require('fs').unlinkSync(TEST_DB); } catch (e) {}
  });

  it('R1 没有交易的账户，positions 为空、cash 等于 initialCapital', async () => {
    // 启动一个新账户
    paper.ensureAccount('r_test_1', { name: '对账测试1', type: 'live', initialCapital: 50000 });
    const result = paper.reconcilePositionsForAccount('r_test_1');
    expect(result.fixed).toBe(false);
    expect(result.changes).toEqual([]);
    const acc = paper.getAccount('r_test_1');
    expect(acc.positions).toEqual([]);
    expect(acc.cash).toBe(50000);
  });

  it('R2 混合 BUY/SELL 后对账：positions 正确、cash 等于 initialCapital - netBuyAmount', async () => {
    // 准备：5 笔历史脏数据（不走 service，手动写 trades）
    persistence.savePaperTrade('r_test_2', {
      id: 'r2_1', type: 'BUY', symbol: '600519', name: '贵州茅台', price: 100, quantity: 100, amount: 10000, reason: '历史', strategyId: 'legacy', time: '2026-01-01T09:30:00',
    });
    persistence.savePaperTrade('r_test_2', {
      id: 'r2_2', type: 'BUY', symbol: '600519', name: '贵州茅台', price: 110, quantity: 50, amount: 5500, reason: '历史', strategyId: 'legacy', time: '2026-01-02T09:30:00',
    });
    persistence.savePaperTrade('r_test_2', {
      id: 'r2_3', type: 'BUY', symbol: '600036', name: '招商银行', price: 30, quantity: 200, amount: 6000, reason: '历史', strategyId: 'legacy', time: '2026-01-03T09:30:00',
    });
    persistence.savePaperTrade('r_test_2', {
      id: 'r2_4', type: 'SELL', symbol: '600519', name: '贵州茅台', price: 120, quantity: 40, amount: 4800, reason: '历史', strategyId: 'legacy', time: '2026-01-04T09:30:00',
    });
    persistence.savePaperTrade('r_test_2', {
      id: 'r2_5', type: 'SELL', symbol: '600036', name: '招商银行', price: 33, quantity: 100, amount: 3300, reason: '历史', strategyId: 'legacy', time: '2026-01-05T09:30:00',
    });

    paper.ensureAccount('r_test_2', { name: '对账测试2', type: 'live', initialCapital: 100000 });

    const result = paper.reconcilePositionsForAccount('r_test_2');
    expect(result.fixed).toBe(true);
    expect(result.changes.length).toBe(2); // 600519 + 600036

    const acc = paper.getAccount('r_test_2');
    // 600519: BUY 100@100 + BUY 50@110 = 150 股 total cost 15500, avgCost = 15500/150 = 103.33
    //         SELL 40@120 → net qty 110, avgCost 仍 103.33（加权平均法）
    const mtf = acc.positions.find(p => p.symbol === '600519')!;
    expect(mtf.quantity).toBe(110);
    expect(mtf.avgCost).toBeCloseTo(103.33, 2);
    // 600036: BUY 200@30 = 200 股 cost 6000, SELL 100@33 → net 100 股, avgCost 30
    const cmb = acc.positions.find(p => p.symbol === '600036')!;
    expect(cmb.quantity).toBe(100);
    expect(cmb.avgCost).toBe(30);
    // cash = initialCapital - (sum BUY) + (sum SELL) = 100000 - 21500 + 8100 = 86600
    expect(acc.cash).toBeCloseTo(86600, 2);
  });

  it('R3 SELL 数量超过持仓时，按当前持仓清仓，不出现负数', async () => {
    persistence.savePaperTrade('r_test_3', {
      id: 'r3_1', type: 'BUY', symbol: '002415', name: '海康威视', price: 40, quantity: 100, amount: 4000, reason: '历史', strategyId: 'legacy', time: '2026-02-01T09:30:00',
    });
    persistence.savePaperTrade('r_test_3', {
      id: 'r3_2', type: 'SELL', symbol: '002415', name: '海康威视', price: 45, quantity: 150, amount: 6750, reason: '历史', strategyId: 'legacy', time: '2026-02-02T09:30:00',
    });
    paper.ensureAccount('r_test_3', { name: '对账测试3', type: 'live', initialCapital: 80000 });
    paper.reconcilePositionsForAccount('r_test_3');
    const acc = paper.getAccount('r_test_3');
    // SELL 150 > BUY 100 → 全部清仓，positions 应无该 symbol
    expect(acc.positions.find(p => p.symbol === '002415')).toBeUndefined();
    // cash = 80000 - 4000 + 6750 = 82750
    expect(acc.cash).toBeCloseTo(82750, 2);
  });

  it('R4 幂等性：对账完成后再次对账，结果不变', async () => {
    persistence.savePaperTrade('r_test_4', {
      id: 'r4_1', type: 'BUY', symbol: '601318', name: '中国平安', price: 50, quantity: 100, amount: 5000, reason: '历史', strategyId: 'legacy', time: '2026-03-01T09:30:00',
    });
    paper.ensureAccount('r_test_4', { name: '对账测试4', type: 'live', initialCapital: 60000 });
    const first = paper.reconcilePositionsForAccount('r_test_4');
    const second = paper.reconcilePositionsForAccount('r_test_4');
    expect(second.fixed).toBe(false); // 第二次无变化
    const acc = paper.getAccount('r_test_4');
    expect(acc.cash).toBeCloseTo(55000, 2);
    expect(acc.positions.find(p => p.symbol === '601318')?.quantity).toBe(100);
  });
});
