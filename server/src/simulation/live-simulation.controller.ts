import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { LiveSimulationEngine, type LiveRunOptions, type LiveStateView } from './live-simulation.engine'
import { STRATEGIES, type StrategyCode } from './simulation.constants'

interface StartBody {
  month: string
  strategy?: StrategyCode
  tickMs?: number
  initialCash?: number
}

@Controller('live')
export class LiveController {
  constructor(private readonly engine: LiveSimulationEngine) {}

  /**
   * 启动 live run
   */
  @Post('start')
  async start(@Body() body: StartBody): Promise<{ code: number; msg: string; data: { runId: string; totalTicks: number; monthName: string } | null }> {
    if (!body || !body.month || !/^\d{4}-\d{2}$/.test(body.month)) {
      return { code: 400, msg: 'month 必须为 YYYY-MM 格式', data: null }
    }
    const strategy: StrategyCode = body.strategy && (STRATEGIES as readonly string[]).includes(body.strategy)
      ? body.strategy
      : 'ma_cross'
    const options: LiveRunOptions = {
      month: body.month,
      strategy,
      tickMs: body.tickMs && body.tickMs >= 50 && body.tickMs <= 60_000 ? body.tickMs : 500,
      initialCash: body.initialCash && body.initialCash > 0 ? body.initialCash : 1_000_000,
    }
    try {
      const data = await this.engine.start(`live-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, options)
      return { code: 200, msg: 'ok', data }
    } catch (err) {
      return { code: 500, msg: (err as Error).message, data: null }
    }
  }

  /**
   * 暂停
   */
  @Post(':runId/pause')
  pause(@Param('runId') runId: string): { code: number; msg: string; data: { paused: boolean } } {
    const paused = this.engine.pause(runId)
    return { code: paused ? 200 : 400, msg: paused ? 'paused' : 'pause 失败（run 不存在或已 finished）', data: { paused } }
  }

  /**
   * 恢复
   */
  @Post(':runId/resume')
  resume(@Param('runId') runId: string): { code: number; msg: string; data: { resumed: boolean } } {
    const resumed = this.engine.resume(runId)
    return { code: resumed ? 200 : 400, msg: resumed ? 'resumed' : 'resume 失败（run 不存在或已 finished）', data: { resumed } }
  }

  /**
   * 停止
   */
  @Post(':runId/stop')
  async stop(@Param('runId') runId: string): Promise<{ code: number; msg: string; data: { stopped: boolean } }> {
    const stopped = await this.engine.stop(runId)
    return { code: stopped ? 200 : 400, msg: stopped ? 'stopped' : 'stop 失败（run 不存在）', data: { stopped } }
  }

  /**
   * 状态快照（前端轮询）
   */
  @Get(':runId/state')
  state(@Param('runId') runId: string): { code: number; msg: string; data: LiveStateView | null } {
    const view = this.engine.getState(runId)
    if (!view) return { code: 404, msg: 'run 不存在或已停止', data: null }
    return { code: 200, msg: 'ok', data: view }
  }

  /**
   * 列出所有 run（调试用）
   */
  @Get('runs')
  runs(): { code: number; msg: string; data: string[] } {
    return { code: 200, msg: 'ok', data: this.engine.listRuns() }
  }
}