import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Res } from '@nestjs/common'
import type { Response as ExpressResp } from 'express'
import { SimulationFactory, SimulationConfig } from './simulation.factory'
import { SimulationScheduler } from './simulation.scheduler'
import { SimulationReportService } from './simulation-report.service'
import { MarkdownReportRenderer } from './markdown-report.service'
import { PersistenceService } from '../persistence/persistence.service'
import { StrategyTunerService } from './strategy-tuner.service'
import { YearReportService } from './year-report.service'

@Controller('simulation')
export class SimulationController {
  constructor(
    private readonly factory: SimulationFactory,
    private readonly scheduler: SimulationScheduler,
    private readonly report: SimulationReportService,
    private readonly markdown: MarkdownReportRenderer,
    private readonly persistence: PersistenceService,
    private readonly tuner: StrategyTunerService,
    private readonly yearReportSvc: YearReportService,
  ) {}

  /**
   * 一键创建 + 启动某月回放 run
   * - 流程：保存 run 记录 → 工厂创建 N 个账户 → 调度器启动（history 价格源 + 回放模式）
   * - body: { month: '2026-09', accountCount?: 100, capitalMin?, capitalMax?, replayTickMs? }
   */
  @Post('replay')
  @HttpCode(200)
  async replayMonth(@Body() body: {
    month: string
    accountCount?: number
    capitalMin?: number
    capitalMax?: number
    replayTickMs?: number
    name?: string
    industryWeights?: Record<string, number>
    strategyWeights?: Record<string, number>
    watchlist?: string[]
    capitalTierWeights?: Record<string, number>
  }) {
    if (!body.month || !/^\d{4}-\d{2}$/.test(body.month)) {
      return { code: 400, msg: 'month 必须为 YYYY-MM 格式', data: null }
    }
    // 检查该月 K 线数据是否就绪
    const tradingDays = this.persistence.getTradingDaysForMonth(body.month)
    if (tradingDays.length === 0) {
      return { code: 400, msg: `该月无 K 线数据，请先调 POST /api/stock/kline/import`, data: null }
    }

    const runId = `sim_${Date.now().toString(36)}`
    const cfg = {
      accountCount: body.accountCount ?? 100,
      capitalMin: body.capitalMin ?? 10_000,
      capitalMax: body.capitalMax ?? 1_000_000,
      industryWeights: body.industryWeights,
      strategyWeights: body.strategyWeights,
      watchlist: body.watchlist,
      capitalTierWeights: body.capitalTierWeights,
    }
    this.persistence.saveSimulationRun({
      id: runId,
      name: body.name ?? `${body.month} 月回放-${cfg.accountCount}账户`,
      accountCount: cfg.accountCount,
      industries: [],
      strategies: [],
      status: 'created',
      startedAt: Date.now(),
      config: {
        ...cfg,
        month: body.month,
        priceSource: 'history',
        replayTickMs: body.replayTickMs ?? 60_000,
      },
    })
    const accounts = await this.factory.createBatch(runId, cfg)
    this.scheduler.start(runId, {
      priceSource: 'history',
      month: body.month,
      replayTickMs: body.replayTickMs ?? 60_000,
    })
    this.persistence.updateSimulationRun(runId, { status: 'running' })
    return {
      data: {
        runId,
        month: body.month,
        accountCount: accounts.length,
        tradingDays: tradingDays.length,
        estimatedDurationMs: tradingDays.length * (body.replayTickMs ?? 60_000),
        sample: accounts.slice(0, 3).map((a: any) => ({ id: a.id, name: a.name, industry: a.industryLabel, strategy: a.strategyLabel })),
      },
    }
  }

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

  /** Markdown 报告（text/markdown） */
  @Get('runs/:id/report.md')
  reportMarkdown(@Param('id') id: string, @Res() res: ExpressResp) {
    const run = this.persistence.getSimulationRun(id)
    if (!run) {
      res.status(404).type('text/plain').send(`run ${id} not found`)
      return
    }
    const md = this.markdown.render(id)
    res.type('text/markdown; charset=utf-8').send(md)
  }

  /** 自动调优：基于某月 run 的产出生成下一轮的 industryWeights / strategyWeights */
  @Post('strategy-tune')
  @HttpCode(200)
  async tuneStrategy(@Body() body: { runId: string }) {
    if (!body.runId) return { code: 400, msg: 'runId required', data: null }
    const result = this.tuner.tuneFromRun(body.runId)
    return {
      data: {
        runId: body.runId,
        industryWeights: result.industryWeights,
        strategyWeights: result.strategyWeights,
        watchlist: result.watchlist,
        diagnostics: result.diagnostics,
      },
    }
  }

  /** 年度汇总报告：跨多个月度 run 聚合产出 Markdown */
  @Get('year-report')
  async yearReport() {
    const runs = await this.yearReportSvc.aggregate()
    const markdown = this.yearReportSvc.renderMarkdown(runs)
    return { data: { runCount: runs.length, markdown } }
  }

  /** Markdown 形式直接下载 */
  @Get('year-report.md')
  yearReportMarkdown(@Res() res: ExpressResp) {
    this.yearReportSvc.aggregate().then((runs) => {
      const md = this.yearReportSvc.renderMarkdown(runs)
      res.type('text/markdown; charset=utf-8').send(md)
    }).catch((e) => {
      res.status(500).type('text/plain').send(`err: ${e?.message ?? e}`)
    })
  }
}