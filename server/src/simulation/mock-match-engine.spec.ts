import { MockMatchEngine } from './mock-match-engine'
import type { LiveSignal } from './live-strategy-adapter'

function buySignal(price: number, quantity: number, ts = 1700000000000): LiveSignal {
  return { side: 'BUY', reason: 'test-buy', quantity, price, ts, symbol: '600519' }
}
function sellSignal(price: number, quantity: number, ts = 1700000000001): LiveSignal {
  return { side: 'SELL', reason: 'test-sell', quantity, price, ts, symbol: '600519' }
}

describe('MockMatchEngine', () => {
  let engine: MockMatchEngine

  beforeEach(() => {
    engine = new MockMatchEngine()
  })

  it('HOLD 信号不产生成交', () => {
    const portfolio = { cash: 10000, positions: {}, realizedPnl: 0 }
    const fill = engine.match('r1', { ...buySignal(10, 100), side: 'HOLD' }, portfolio)
    expect(fill).toBeNull()
  })

  describe('BUY', () => {
    it('足额成交：手续费 0.1% 计入成本，现金扣减', () => {
      const portfolio = { cash: 10000, positions: {}, realizedPnl: 0 }
      const fill = engine.match('r1', buySignal(10, 100), portfolio)
      expect(fill).not.toBeNull()
      expect(fill!.side).toBe('BUY')
      expect(fill!.quantity).toBe(100)
      expect(fill!.amount).toBe(1000)
      expect(fill!.fee).toBeCloseTo(1, 6)
      expect(fill!.realizedPnl).toBeNull()
      expect(fill!.id).toBe('r1-1')
      // 现金 = 10000 - 1000 - 1
      expect(portfolio.cash).toBeCloseTo(8999, 6)
      // 成本含费：(1000+1)/100 = 10.01
      expect(portfolio.positions['600519'].avgCost).toBeCloseTo(10.01, 6)
      expect(portfolio.positions['600519'].qty).toBe(100)
    })

    it('资金不足时按可用现金缩量成交', () => {
      const portfolio = { cash: 5000, positions: {}, realizedPnl: 0 }
      const fill = engine.match('r1', buySignal(10, 1000), portfolio)
      expect(fill).not.toBeNull()
      // maxQty = floor(5000 / (10 * 1.001)) = 499
      expect(fill!.quantity).toBe(499)
      expect(portfolio.cash).toBeCloseTo(5000 - 4990 - 4.99, 6)
    })

    it('现金不足以买 1 股时拒绝', () => {
      const portfolio = { cash: 5, positions: {}, realizedPnl: 0 }
      const fill = engine.match('r1', buySignal(10, 100), portfolio)
      expect(fill).toBeNull()
    })

    it('加仓时均价按含费成本加权', () => {
      const portfolio = { cash: 100000, positions: { '600519': { qty: 100, avgCost: 10 } }, realizedPnl: 0 }
      const fill = engine.match('r1', buySignal(12, 100), portfolio)
      expect(fill).not.toBeNull()
      const pos = portfolio.positions['600519']
      expect(pos.qty).toBe(200)
      // newCost = (1200 + 1.2)/100 = 12.012；avg = (10*100 + 12.012*100)/200 = 11.006
      expect(pos.avgCost).toBeCloseTo(11.006, 6)
    })
  })

  describe('SELL', () => {
    it('无持仓时拒绝', () => {
      const portfolio = { cash: 10000, positions: {}, realizedPnl: 0 }
      const fill = engine.match('r1', sellSignal(10, 100), portfolio)
      expect(fill).toBeNull()
    })

    it('全部平仓：已实现盈亏扣费、持仓删除、现金回笼', () => {
      const portfolio = { cash: 0, positions: { '600519': { qty: 100, avgCost: 10 } }, realizedPnl: 0 }
      const fill = engine.match('r1', sellSignal(12, 100), portfolio)
      expect(fill).not.toBeNull()
      expect(fill!.side).toBe('SELL')
      expect(fill!.quantity).toBe(100)
      expect(fill!.amount).toBe(1200)
      expect(fill!.fee).toBeCloseTo(1.2, 6)
      // realized = (12-10)*100 - 1.2
      expect(fill!.realizedPnl).toBeCloseTo(198.8, 6)
      expect(portfolio.positions['600519']).toBeUndefined()
      expect(portfolio.cash).toBeCloseTo(1200 - 1.2, 6)
      expect(portfolio.realizedPnl).toBeCloseTo(198.8, 6)
    })

    it('部分平仓：数量取 min(信号, 持仓)', () => {
      const portfolio = { cash: 0, positions: { '600519': { qty: 100, avgCost: 10 } }, realizedPnl: 0 }
      const fill = engine.match('r1', sellSignal(12, 30), portfolio)
      expect(fill!.quantity).toBe(30)
      expect(portfolio.positions['600519'].qty).toBe(70)
      // 持仓超出部分保留
      const fill2 = engine.match('r1', sellSignal(12, 500), portfolio)
      expect(fill2!.quantity).toBe(70)
      expect(portfolio.positions['600519']).toBeUndefined()
    })
  })

  describe('订单号与状态', () => {
    it('同一 run 内订单号递增，resetRun 后重新计数', () => {
      const portfolio = { cash: 100000, positions: {}, realizedPnl: 0 }
      const f1 = engine.match('r2', buySignal(10, 10), portfolio)
      const f2 = engine.match('r2', buySignal(10, 10), portfolio)
      expect(f1!.id).toBe('r2-1')
      expect(f2!.id).toBe('r2-2')
      engine.resetRun('r2')
      const f3 = engine.match('r2', buySignal(10, 10), portfolio)
      expect(f3!.id).toBe('r2-1')
    })

    it('不同 run 的计数互不影响', () => {
      const p1 = { cash: 100000, positions: {}, realizedPnl: 0 }
      const p2 = { cash: 100000, positions: {}, realizedPnl: 0 }
      expect(engine.match('a', buySignal(10, 10), p1)!.id).toBe('a-1')
      expect(engine.match('b', buySignal(10, 10), p2)!.id).toBe('b-1')
    })

    it('markToMarket 计算未实现盈亏与权益', () => {
      const portfolio = {
        cash: 5000,
        positions: { '600519': { qty: 100, avgCost: 10 }, '000858': { qty: 50, avgCost: 20 } },
        realizedPnl: 0,
      }
      const mtm = engine.markToMarket(portfolio, { '600519': 12, '000858': 18 })
      expect(mtm.unrealizedPnl).toBe((12 - 10) * 100 + (18 - 20) * 50)
      expect(mtm.equity).toBe(5000 + mtm.unrealizedPnl)
    })
  })
})
