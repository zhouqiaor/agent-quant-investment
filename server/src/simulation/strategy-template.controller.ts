import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import type { StrategyCode } from './simulation.constants'
import { StrategyTemplateService } from './strategy-template.service'
import { TryoutReplayService } from './tryout-replay.service'

@Controller('strategies')
export class StrategyTemplateController {
  constructor(
    private readonly templates: StrategyTemplateService,
    private readonly tryout: TryoutReplayService,
  ) {}

  /** 5 个策略的可调参数模板 */
  @Get('templates')
  listTemplates() {
    return { code: 200, msg: 'success', data: this.templates.list() }
  }

  /** 单策略模板详情 */
  @Get('templates/:strategy')
  getTemplate(@Param('strategy') strategy: string) {
    return { code: 200, msg: 'success', data: this.templates.get(strategy as StrategyCode) }
  }

  /** 自定义参数试跑（单次同步回放） */
  @Post('tryout')
  async tryoutOnce(
    @Body()
    body: {
      month: string
      strategy: string
      params: Record<string, number>
      initialCash?: number
    },
  ) {
    const data = await this.tryout.run({
      month: body.month,
      strategy: body.strategy as StrategyCode,
      params: body.params ?? {},
      initialCash: body.initialCash,
    })
    return { code: 200, msg: 'success', data }
  }

  /** 网格扫描：把所有可调参数组合跑一次，返回 top/bottom */
  @Post('grid-search')
  async gridSearch(
    @Body()
    body: {
      month: string
      strategy: string
      params: Record<string, { min: number; max: number; step: number }>
      metric?: 'totalReturnPct' | 'sharpe' | 'calmar'
      initialCash?: number
    },
  ) {
    const data = await this.templates.gridSearch({
      month: body.month,
      strategy: body.strategy,
      params: body.params ?? {},
      metric: body.metric,
      initialCash: body.initialCash,
    })
    return { code: 200, msg: 'success', data }
  }
}