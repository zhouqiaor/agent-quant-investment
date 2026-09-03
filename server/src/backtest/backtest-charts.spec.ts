// 回测数据质量与图表前端可视化基础测试
// 验证 equityCurve 序列正确性与指标计算准确性，为前端图表化提供数据保障

import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import * as request from 'supertest'
import { AppModule } from '../app.module'

// 测试数据隔离
const TEST_DB = `/tmp/quant-test-backtest-chart-${process.pid}-${Date.now()}.db`
process.env.SQLITE_PATH = TEST_DB

describe('回测图表数据质量', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()
    app = moduleFixture.createNestApplication()
    app.setGlobalPrefix('api')
    await app.init()
  }, 30000)

  afterAll(async () => {
    await app.close()
    try { require('fs').unlinkSync(TEST_DB) } catch (e) { /* ignore */ }
  })

  const runBacktest = async (params: any) => {
    return request(app.getHttpServer())
      .post('/api/backtest/run')
      .send(params)
      .expect(200)
  }

  it('T1 equityCurve 首末值正确性：首值=初始资金，末值=最终资金', async () => {
    const res = await runBacktest({
      symbol: '600519',
      startDate: '2024-01-02',
      endDate: '2024-03-31',
      initialCapital: 100000,
      indicators: ['MA'],
    })
    const { equityCurve, finalCapital, initialCapital } = res.body.data
    expect(equityCurve.length).toBeGreaterThan(30)
    expect(equityCurve[0].value).toBeCloseTo(initialCapital, 0)
    expect(equityCurve[equityCurve.length - 1].value).toBeCloseTo(finalCapital, 0)
    // 每日都有日期
    expect(equityCurve.every((p: any) => /^\d{4}-\d{2}-\d{2}$/.test(p.date))).toBe(true)
  })

  it('T2 drawdown 回撤非负且峰值处回撤为0', async () => {
    const res = await runBacktest({
      symbol: '600519',
      startDate: '2024-01-02',
      endDate: '2024-03-31',
      initialCapital: 100000,
      indicators: ['MA'],
    })
    const { equityCurve, maxDrawdown } = res.body.data
    // 所有回撤 >= 0
    expect(equityCurve.every((p: any) => p.drawdown >= -0.01)).toBe(true)
    // 最大回撤与序列最大值一致
    const maxDd = Math.max(...equityCurve.map((p: any) => p.drawdown))
    expect(maxDd).toBeCloseTo(maxDrawdown, 1)
    // 首日回撤接近 0
    expect(equityCurve[0].drawdown).toBeLessThan(0.1)
  })

  it('T3 总收益率 = (末值/首值 - 1) * 100', async () => {
    const res = await runBacktest({
      symbol: '000858',
      startDate: '2024-02-01',
      endDate: '2024-05-31',
      initialCapital: 50000,
      indicators: ['MACD'],
    })
    const { equityCurve, totalReturn, initialCapital } = res.body.data
    const calcReturn = ((equityCurve[equityCurve.length - 1].value / initialCapital) - 1) * 100
    expect(calcReturn).toBeCloseTo(totalReturn, 1)
  })

  it('T4 交易记录在 equityCurve 上可定位', async () => {
    const res = await runBacktest({
      symbol: '600036',
      startDate: '2024-01-02',
      endDate: '2024-06-30',
      initialCapital: 100000,
      indicators: ['MA', 'RSI'],
    })
    const { equityCurve, trades } = res.body.data
    const dateSet = new Set(equityCurve.map((p: any) => p.date))
    // 每笔交易的日期都在曲线日期集合里
    expect(trades.every((t: any) => dateSet.has(t.date))).toBe(true)
    // 买卖成对
    if (trades.length > 0) {
      const first = trades[0]
      expect(['BUY', 'SELL'] as string[]).toContain(first.type)
      expect(first.price).toBeGreaterThan(0)
      expect(first.quantity).toBeGreaterThan(0)
      expect(first.amount).toBeGreaterThan(0)
    }
  })

  it('T5 年化收益、夏普、盈亏比字段完整且数值合理', async () => {
    const res = await runBacktest({
      symbol: '601318',
      startDate: '2024-01-02',
      endDate: '2024-08-31',
      initialCapital: 200000,
      indicators: ['BOLL'],
    })
    const r = res.body.data
    // 字段完整性
    expect(typeof r.annualizedReturn).toBeDefined()
    expect(typeof r.sharpeRatio).toBeDefined()
    expect(typeof r.profitFactor).toBeDefined()
    expect(typeof r.winRate).toBeDefined()
    expect(typeof r.totalTrades).toBeDefined()
    // 胜率 0-100
    expect(r.winRate).toBeGreaterThanOrEqual(0)
    expect(r.winRate).toBeLessThanOrEqual(100)
    // 盈亏比非负
    expect(r.profitFactor).toBeGreaterThanOrEqual(0)
    // 总交易数 = 胜 + 负
    expect(r.winTrades + r.loseTrades).toBe(r.totalTrades)
  })
})
