import { LivePortfolio } from './live-portfolio'

describe('LivePortfolio', () => {
  it('初始化：cash/initialCash/权益曲线首点正确', () => {
    const p = new LivePortfolio('run-1', 100000)
    expect(p.runId).toBe('run-1')
    expect(p.initialCash).toBe(100000)
    expect(p.cash).toBe(100000)
    expect(p.realizedPnl).toBe(0)
    expect(p.equityHistory()).toHaveLength(1)
    expect(p.equityHistory()[0]).toBe(100000)
  })

  describe('markToMarket', () => {
    it('市值 = Σ(价格×数量)，equity = cash + marketValue', () => {
      const p = new LivePortfolio('run-1', 100000)
      p.updatePrice('600519', 10)
      p.updatePrice('000858', 20)
      p.positions['600519'] = { qty: 100, avgCost: 8 }
      p.positions['000858'] = { qty: 50, avgCost: 22 }
      const mtm = p.markToMarket()
      expect(mtm.marketValue).toBe(10 * 100 + 20 * 50)
      expect(mtm.unrealizedPnl).toBe((10 - 8) * 100 + (20 - 22) * 50)
      expect(mtm.equity).toBe(100000 + mtm.marketValue)
    })

    it('未更新价格的持仓不计入市值（防御）', () => {
      const p = new LivePortfolio('run-1', 100000)
      p.positions['600519'] = { qty: 100, avgCost: 8 }
      const mtm = p.markToMarket()
      expect(mtm.marketValue).toBe(0)
      expect(mtm.equity).toBe(100000)
    })
  })

  describe('recordEquityTick', () => {
    it('节流：1s 内且权益变化 < 1 元不记录', () => {
      const p = new LivePortfolio('run-1', 100000)
      const t0 = p.equityHistory()[0]
      p.recordEquityTick(Date.now()) // 同权益，同秒
      expect(p.equityHistory()).toHaveLength(1)
      expect(p.equityHistory()[0]).toBe(t0)
    })

    it('权益显著变化时记录新点', () => {
      const p = new LivePortfolio('run-1', 100000)
      p.cash = 100500
      p.recordEquityTick(Date.now() + 10)
      expect(p.equityHistory()).toHaveLength(2)
      expect(p.equityHistory()[1]).toBe(100500)
    })

    it('超过 200 点后滚动丢弃最旧点', () => {
      const p = new LivePortfolio('run-1', 100000)
      for (let i = 0; i < 260; i++) {
        p.cash = 100000 + i * 100 // 每次变化都超过 1 元
        p.recordEquityTick(Date.now() + i * 2000) // 间隔 > 1s，绕过节流
      }
      expect(p.equityHistory()).toHaveLength(200)
      // 最旧的点已被 shift 掉
      expect(p.equityHistory()[0]).toBe(100000 + 60 * 100)
    })
  })

  describe('toState', () => {
    it('positions 返回共享引用：通过 state 增删持仓会反映到账本', () => {
      const p = new LivePortfolio('run-1', 100000)
      const state = p.toState()
      // positions 是同一引用（供撮合引擎直接读写）
      expect(state.positions).toBe(p.positions)
      state.positions['600519'] = { qty: 100, avgCost: 10 }
      expect(p.positions['600519']).toEqual({ qty: 100, avgCost: 10 })
      delete state.positions['600519']
      expect(p.positions['600519']).toBeUndefined()
    })

    it('cash / realizedPnl 是快照值，与账本独立', () => {
      const p = new LivePortfolio('run-1', 100000)
      const state = p.toState()
      state.cash = 99999
      expect(p.cash).toBe(100000) // 不受 state 修改影响
    })
  })

  describe('snapshot', () => {
    it('无最新价时回退到成本价，字段按精度取整', () => {
      const p = new LivePortfolio('run-1', 100000)
      p.positions['600519'] = { qty: 100, avgCost: 8.123456 }
      const snap = p.snapshot()
      expect(snap.cash).toBe(100000)
      expect(snap.positions).toHaveLength(1)
      const pos = snap.positions[0]
      expect(pos.symbol).toBe('600519')
      expect(pos.avgCost).toBeCloseTo(8.1235, 4)
      expect(pos.currentPrice).toBeCloseTo(8.123456, 6) // 回退 avgCost
      expect(pos.marketValue).toBeCloseTo(812.35, 1)
      expect(pos.unrealizedPnl).toBe(0)
      expect(pos.unrealizedPnlPct).toBe(0)
      expect(snap.equity).toBe(100000)
      expect(snap.totalPnl).toBe(0)
      expect(snap.totalPnlPct).toBe(0)
    })

    it('有持仓盈利时 unrealizedPnlPct 与 totalPnl 正确', () => {
      const p = new LivePortfolio('run-1', 100000)
      p.updatePrice('600519', 10)
      p.positions['600519'] = { qty: 100, avgCost: 8 }
      p.realizedPnl = 50
      const snap = p.snapshot()
      const pos = snap.positions[0]
      expect(pos.unrealizedPnl).toBe(200)
      expect(pos.unrealizedPnlPct).toBeCloseTo(25, 2) // (10-8)/8*100
      expect(snap.unrealizedPnl).toBe(200)
      expect(snap.totalPnl).toBe(250) // realized 50 + unrealized 200
      expect(snap.totalPnlPct).toBeCloseTo(0.25, 2) // 250/100000*100
      expect(snap.equity).toBe(101000)
    })
  })

  describe('equityHistory / reset', () => {
    it('reset() 恢复初始状态并清空价格缓存', () => {
      const p = new LivePortfolio('run-1', 100000)
      p.cash = 50000
      p.realizedPnl = -300
      p.positions['600519'] = { qty: 100, avgCost: 8 }
      p.updatePrice('600519', 10)
      p.recordEquityTick(Date.now() + 5000)
      p.reset()
      expect(p.cash).toBe(100000)
      expect(p.realizedPnl).toBe(0)
      expect(p.positions).toEqual({})
      expect(p.equityHistory()).toHaveLength(1)
      expect(p.markToMarket().equity).toBe(100000) // lastPrices 已清空
    })
  })
})
