import { MockFeedService, type TickEvent } from './mock-feed.service'

/**
 * 说明：start() 会以 tickMs 启动真实 setInterval。
 * 测试中传入超大 tickMs（不会在测试期触发），改用 tickOnce 手动步进，保证确定性。
 */
describe('MockFeedService', () => {
  let svc: MockFeedService

  beforeEach(() => {
    svc = new MockFeedService()
  })

  afterEach(() => {
    svc.shutdown()
  })

  describe('start', () => {
    it('month 格式非法时抛错', async () => {
      await expect(
        svc.start('f1', '202601', 1e9, () => {}),
      ).rejects.toThrow('month 格式错误')
    })

    it('不存在的月份抛错', async () => {
      await expect(svc.start('f1', '1999-01', 1e9, () => {})).rejects.toThrow('未找到月份')
    })

    it('有效月份启动：返回总 tick 数与月份主题名', async () => {
      const r = await svc.start('f1', '2026-01', 1e9, () => {})
      expect(r.totalTicks).toBeGreaterThan(0)
      expect(typeof r.monthName).toBe('string')
      expect(r.monthName.length).toBeGreaterThan(0)
      expect(svc.getStatus('f1')).toMatchObject({
        status: 'running',
        month: '2026-01',
        currentTick: 0,
        totalTicks: r.totalTicks,
        tickMs: 1e9,
      })
    })

    it('重复启动同一 runId 会替换旧 feed', async () => {
      const r1 = await svc.start('f1', '2026-01', 1e9, () => {})
      const r2 = await svc.start('f1', '2026-02', 1e9, () => {})
      expect(r1.totalTicks).toBeGreaterThan(0)
      expect(r2.totalTicks).toBeGreaterThan(0)
      expect(svc.getStatus('f1')!.month).toBe('2026-02')
    })
  })

  describe('tickOnce（手动步进）', () => {
    it('按序推送 tick：首支股票 changePct=0，同股票后续按昨收计算', async () => {
      const received: TickEvent[] = []
      await svc.start('f1', '2026-01', 1e9, (t) => received.push(t))
      const first = svc.tickOnce('f1')
      expect(first).not.toBeNull()
      expect(first!.changePct).toBe(0) // 该 symbol 首个 tick 无昨收
      expect(first!.price).toBeGreaterThan(0)
      expect(received).toHaveLength(1)

      // 步进到同一 symbol 的下一个交易日
      let second: TickEvent | null = null
      for (let i = 0; i < 50; i++) {
        const t = svc.tickOnce('f1')
        if (t && t.symbol === first!.symbol) {
          second = t
          break
        }
      }
      expect(second).not.toBeNull()
      expect(second!.ts).toBeGreaterThan(first!.ts)
      expect(received.length).toBeGreaterThanOrEqual(2)
      expect(svc.getStatus('f1')!.currentTick).toBe(received.length)
    })

    it('listener 抛异常不影响 feed 推进', async () => {
      await svc.start('f1', '2026-01', 1e9, () => {
        throw new Error('boom')
      })
      const t = svc.tickOnce('f1')
      expect(t).not.toBeNull()
      expect(svc.getStatus('f1')!.currentTick).toBe(1)
    })
  })

  describe('pause / resume / stop', () => {
    it('pause 后 tickOnce 返回 null 且不推进', async () => {
      await svc.start('f1', '2026-01', 1e9, () => {})
      svc.tickOnce('f1')
      expect(svc.pause('f1')).toBe(true)
      expect(svc.getStatus('f1')!.status).toBe('paused')
      expect(svc.tickOnce('f1')).toBeNull()
      expect(svc.getStatus('f1')!.currentTick).toBe(1)
    })

    it('resume 后恢复推进；running 状态下 resume 幂等', async () => {
      await svc.start('f1', '2026-01', 1e9, () => {})
      svc.pause('f1')
      expect(svc.resume('f1')).toBe(true)
      expect(svc.getStatus('f1')!.status).toBe('running')
      expect(svc.resume('f1')).toBe(true) // 已是 running，幂等
      expect(svc.tickOnce('f1')).not.toBeNull()
    })

    it('stopFeed 清理 feed；对未知 runId 返回 false', async () => {
      await svc.start('f1', '2026-01', 1e9, () => {})
      expect(svc.stopFeed('f1')).toBe(true)
      expect(svc.getStatus('f1')).toBeNull()
      expect(svc.stopFeed('f1')).toBe(false)
      expect(svc.pause('f1')).toBe(false)
      expect(svc.resume('f1')).toBe(false)
      expect(svc.tickOnce('f1')).toBeNull()
    })

    it('未知 runId 的 pause/resume 返回 false', () => {
      expect(svc.pause('no-run')).toBe(false)
      expect(svc.resume('no-run')).toBe(false)
    })
  })

  describe('finished / shutdown', () => {
    it('全部 tick 推完后状态置 finished，resume 无效，tickOnce 返回 null', async () => {
      const r = await svc.start('f1', '2026-01', 1e9, () => {})
      for (let i = 0; i < r.totalTicks; i++) {
        svc.tickOnce('f1')
      }
      expect(svc.getStatus('f1')!.status).toBe('finished')
      expect(svc.tickOnce('f1')).toBeNull()
      expect(svc.resume('f1')).toBe(false)
    })

    it('shutdown 清空全部 feed', async () => {
      await svc.start('f1', '2026-01', 1e9, () => {})
      await svc.start('f2', '2026-02', 1e9, () => {})
      svc.shutdown()
      expect(svc.getStatus('f1')).toBeNull()
      expect(svc.getStatus('f2')).toBeNull()
    })
  })
})
