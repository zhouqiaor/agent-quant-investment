import { LiveStrategyAdapter } from './live-strategy-adapter'
import type { TickEvent } from './mock-feed.service'

function tick(price: number, ts = 1700000000000): TickEvent {
  return {
    symbol: '600519',
    name: '贵州茅台',
    ts,
    open: price,
    high: price,
    low: price,
    price,
    changePct: 0, // 由 adapter 按上一 tick 自行计算
    volume: 1000,
  }
}

describe('LiveStrategyAdapter', () => {
  let adapter: LiveStrategyAdapter

  beforeEach(() => {
    adapter = new LiveStrategyAdapter()
  })

  it('未注册的 run 返回 null', () => {
    expect(adapter.onTick('no-run', tick(10))).toBeNull()
  })

  it('unregisterRun 后停止产出信号', () => {
    adapter.registerRun('r1', 'ma_cross')
    adapter.unregisterRun('r1')
    expect(adapter.onTick('r1', tick(10))).toBeNull()
    expect(adapter.getStateWindow('r1', '600519')).toEqual([])
  })

  it('updatePosition 对未注册 run 不抛错', () => {
    expect(() => adapter.updatePosition('no-run', '600519', 100, 10)).not.toThrow()
  })

  describe('ma_cross', () => {
    it('首 tick（无前价）不触发；涨幅 > 0.5% 触发 BUY', () => {
      adapter.registerRun('r1', 'ma_cross')
      // 首个 tick：changePct = 0 → 不触发
      expect(adapter.onTick('r1', tick(10))).toBeNull()
      // 涨 1% → BUY
      const sig = adapter.onTick('r1', tick(10.1, 1700000001000))
      expect(sig).not.toBeNull()
      expect(sig!.side).toBe('BUY')
      expect(sig!.quantity).toBe(100)
      expect(sig!.reason).toContain('金叉')
      // BUY 后立即又涨 → ticksSinceLastBuy 不足，不重复触发
      const sig2 = adapter.onTick('r1', tick(10.2, 1700000002000))
      expect(sig2).toBeNull()
    })

    it('持仓后涨幅达到止盈（8%）触发 SELL', () => {
      adapter.registerRun('r1', 'ma_cross')
      adapter.onTick('r1', tick(10))
      adapter.updatePosition('r1', '600519', 100, 10)
      // +1% 也触发 SELL（死叉分支 changePct < -0.5 不满足，但止盈 (11-10)/10 >= 0.08 需要 10.8）
      const sig = adapter.onTick('r1', tick(10.9, 1700000001000))
      expect(sig).not.toBeNull()
      expect(sig!.side).toBe('SELL')
      expect(sig!.quantity).toBe(100)
      expect(sig!.reason).toContain('止盈')
    })

    it('持仓后跌幅 < -0.5% 触发 SELL（死叉）', () => {
      adapter.registerRun('r1', 'ma_cross')
      adapter.onTick('r1', tick(10))
      adapter.updatePosition('r1', '600519', 100, 10)
      const sig = adapter.onTick('r1', tick(9.9, 1700000001000)) // -1%
      expect(sig!.side).toBe('SELL')
      expect(sig!.reason).toContain('死叉')
    })
  })

  describe('momentum', () => {
    it('涨幅超过阈值 2% 触发 BUY；持仓止盈止损触发 SELL', () => {
      adapter.registerRun('r1', 'momentum')
      expect(adapter.onTick('r1', tick(10))).toBeNull()
      // +3% > threshold 0.02
      const sig = adapter.onTick('r1', tick(10.3, 1700000001000))
      expect(sig!.side).toBe('BUY')
      expect(sig!.reason).toContain('动量')

      // 持仓后 +10% >= takeProfit 0.10 → SELL
      adapter.updatePosition('r1', '600519', 100, 10)
      const sell = adapter.onTick('r1', tick(11.1, 1700000002000))
      expect(sell!.side).toBe('SELL')
      expect(sell!.reason).toContain('动量')
    })

    it('持仓跌破止损（4%）触发 SELL', () => {
      adapter.registerRun('r1', 'momentum')
      adapter.onTick('r1', tick(10))
      adapter.updatePosition('r1', '600519', 100, 10)
      const sell = adapter.onTick('r1', tick(9.5, 1700000001000)) // -5% <= -0.04
      expect(sell!.side).toBe('SELL')
    })
  })

  describe('reversal', () => {
    it('跌幅超过超卖阈值（-5%）触发抄底 BUY', () => {
      adapter.registerRun('r1', 'reversal')
      expect(adapter.onTick('r1', tick(10))).toBeNull()
      const sig = adapter.onTick('r1', tick(9.4, 1700000001000)) // -6% < -0.05
      expect(sig!.side).toBe('BUY')
      expect(sig!.reason).toContain('反转')
    })

    it('持仓后涨幅超过超买阈值（5%）触发 SELL', () => {
      adapter.registerRun('r1', 'reversal')
      adapter.onTick('r1', tick(10))
      adapter.updatePosition('r1', '600519', 100, 10)
      const sell = adapter.onTick('r1', tick(10.6, 1700000001000)) // +6% > 0.05
      expect(sell!.side).toBe('SELL')
      expect(sell!.reason).toContain('反转')
    })
  })

  describe('breakout / trend_follow', () => {
    it('breakout 涨幅 > 3% 触发 BUY', () => {
      adapter.registerRun('r1', 'breakout')
      expect(adapter.onTick('r1', tick(10))).toBeNull()
      const sig = adapter.onTick('r1', tick(10.35, 1700000001000)) // +3.5%
      expect(sig!.side).toBe('BUY')
      expect(sig!.reason).toContain('突破')
    })

    it('trend_follow 涨幅 > 2% 触发 BUY，止盈 15%', () => {
      adapter.registerRun('r1', 'trend_follow')
      expect(adapter.onTick('r1', tick(10))).toBeNull()
      const sig = adapter.onTick('r1', tick(10.25, 1700000001000)) // +2.5%
      expect(sig!.side).toBe('BUY')
      expect(sig!.reason).toContain('趋势')
      // 未达止盈不触发 SELL
      adapter.updatePosition('r1', '600519', 100, 10)
      expect(adapter.onTick('r1', tick(11.0, 1700000002000))).toBeNull() // +10% < 15%
      const sell = adapter.onTick('r1', tick(11.6, 1700000003000)) // +16% >= 15%
      expect(sell!.side).toBe('SELL')
    })
  })

  describe('滚动窗口', () => {
    it('窗口长度封顶 30，先进先出', () => {
      adapter.registerRun('r1', 'ma_cross')
      for (let i = 0; i < 35; i++) {
        adapter.onTick('r1', tick(10 + i * 0.01, 1700000000000 + i * 1000))
      }
      const win = adapter.getStateWindow('r1', '600519')
      expect(win).toHaveLength(30)
      // 最旧的 5 个价格被丢弃
      expect(win[0]).toBeCloseTo(10.05, 6)
      expect(win[29]).toBeCloseTo(10.34, 6)
    })
  })
})
