import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common'
import { SimulationFactory, SimulationConfig } from './simulation.factory'
import { SimulationScheduler } from './simulation.scheduler'
import { SimulationReportService } from './simulation-report.service'
import { PersistenceService } from '../persistence/persistence.service'

@Controller('simulation')
export class SimulationController {
  constructor(
    private readonly factory: SimulationFactory,
    private readonly scheduler: SimulationScheduler,
    private readonly report: SimulationReportService,
    private readonly persistence: PersistenceService,
  ) {}

  @Post('runs')
  @HttpCode(200)
  async createRun(@Body() body: { name: string; config?: SimulationConfig }) {
    const runId = `sim_${Date.now().toString(36)}`
    const cfg = body.config ?? {}
    this.persistence.saveSimulationRun({
      id: runId,
      name: body.name,
      accountCount: cfg.accountCount ?? 100,
      industries: cfg.industries ?? [],
      strategies: cfg.strategies ?? [],
      status: 'created',
      startedAt: Date.now(),
      config: cfg,
    })
    const accounts = await this.factory.createBatch(runId, cfg)
    return { data: { runId, accountCount: accounts.length, sample: accounts.slice(0, 3) } }
  }

  @Get('runs')
  listRuns() {
    const runs = this.persistence.listSimulationRuns(20)
    return { data: runs }
  }

  @Get('runs/:id')
  getRun(@Param('id') id: string) {
    const run = this.persistence.getSimulationRun(id)
    if (!run) return { code: 404, msg: 'run not found', data: null }
    const accounts = this.persistence.listSimAccounts(id)
    const tradeCount = this.persistence['db'].prepare('SELECT COUNT(*) as c FROM sim_trades WHERE run_id = ?').get(id) as any
    return {
      data: {
        ...run,
        accounts: accounts.length,
        trades: tradeCount?.c ?? 0,
      },
    }
  }

  @Put('runs/:id/start')
  @HttpCode(200)
  startRun(@Param('id') id: string) {
    const run = this.persistence.getSimulationRun(id)
    if (!run) return { code: 404, msg: 'run not found', data: null }
    this.scheduler.start(id)
    this.persistence.updateSimulationRun(id, { status: 'running' })
    return { data: { runId: id, status: 'running' } }
  }

  @Put('runs/:id/stop')
  @HttpCode(200)
  stopRun(@Param('id') id: string) {
    this.scheduler.stop()
    this.persistence.updateSimulationRun(id, { status: 'stopped', finishedAt: Date.now() })
    return { data: { runId: id, status: 'stopped' } }
  }

  @Delete('runs/:id')
  @HttpCode(200)
  deleteRun(@Param('id') id: string) {
    const db = this.persistence['db']
    db.prepare('DELETE FROM sim_snapshots WHERE run_id = ?').run(id)
    db.prepare('DELETE FROM sim_trades WHERE run_id = ?').run(id)
    db.prepare('DELETE FROM sim_accounts WHERE run_id = ?').run(id)
    db.prepare('DELETE FROM simulation_runs WHERE id = ?').run(id)
    return { data: { deleted: id } }
  }

  @Get('runs/:id/status')
  runStatus(@Param('id') id: string) {
    const run = this.persistence.getSimulationRun(id)
    if (!run) return { code: 404, msg: 'run not found', data: null }
    return { data: { run, scheduler: this.scheduler.getStatus() } }
  }

  @Get('runs/:id/accounts')
  listAccounts(@Param('id') id: string) {
    const accounts = this.persistence.listSimAccounts(id)
    return { data: accounts }
  }

  @Get('runs/:id/state')
  currentState(@Param('id') id: string) {
    return {
      data: {
        accounts: this.scheduler.getCurrentState(id),
        prices: this.scheduler.getPriceBook(),
      },
    }
  }

  @Get('runs/:id/trades')
  listTrades(@Param('id') id: string, @Param('accountId') accountId?: string) {
    return { data: this.persistence.listSimTrades(id) }
  }

  @Get('runs/:id/report')
  reportRun(@Param('id') id: string) {
    const report = this.report.generate(id)
    if (!report) return { code: 404, msg: 'run not found', data: null }
    return { data: report }
  }
}