import { Controller, Get, Post, Body } from '@nestjs/common'
import { ScenarioReplayService } from './scenario-replay.service'
import { ScenarioKlineService, type Scenario } from './scenario-kline.service'
import type { StrategyCode } from './simulation.constants'

const STRATEGY_CODES: StrategyCode[] = ['ma_cross', 'momentum', 'breakout', 'reversal', 'trend_follow']

interface RunScenarioBody {
  month: string
  strategy: StrategyCode
  initialCash?: number
  scenarios: Scenario[]
  seed?: number
}

@Controller('scenarios')
export class ScenarioController {
  constructor(
    private readonly replay: ScenarioReplayService,
    private readonly kline: ScenarioKlineService,
  ) {}

  /** 列出可用月份 */
  @Get('months')
  async months() {
    const list = await this.kline.months()
    return { data: list }
  }

  /** 预设：内置 3 个经典场景 */
  @Get('presets')
  presets() {
    const data: { key: string; scenario: Scenario }[] = [
      {
        key: 'tech_crash_march',
        scenario: {
          name: '科技股 3 月崩盘',
          description: '2026-03 期间科技板块单月跌 25%，模拟板块系统性冲击',
          shocks: [
            {
              type: 'sector_drop',
              sector: 'tech',
              magnitude: 0.25,
              startDate: '2026-03-01',
              endDate: '2026-03-31',
            },
          ],
        },
      },
      {
        key: 'covid_jump',
        scenario: {
          name: '黑天鹅恐慌',
          description: '2026-09 月初两周全市场 -15%，波动率扩散 = 2 倍',
          shocks: [
            {
              type: 'index_crumb',
              magnitude: 0.15,
              startDate: '2026-09-01',
              endDate: '2026-09-14',
            },
            {
              type: 'volatility_scale',
              magnitude: 2.0,
              startDate: '2026-09-01',
              endDate: '2026-09-30',
            },
          ],
        },
      },
      {
        key: 'consumer_boom',
        scenario: {
          name: '消费板块暴涨',
          description: '2026-06 期间消费板块单月 +20%',
          shocks: [
            {
              type: 'sector_rise',
              sector: 'consumer',
              magnitude: 0.2,
              startDate: '2026-06-01',
              endDate: '2026-06-30',
            },
          ],
        },
      },
    ]
    return { data }
  }

  /** 列出策略代码（前端 form 用） */
  @Get('strategies')
  strategies() {
    return { data: STRATEGY_CODES }
  }

  /** 跑对比回放 */
  @Post('run')
  async run(@Body() body: RunScenarioBody) {
    if (!body?.month || !/^\d{4}-\d{2}$/.test(body.month)) {
      throw new Error('month 格式错误，应为 YYYY-MM')
    }
    if (!STRATEGY_CODES.includes(body.strategy)) {
      throw new Error(`strategy 不合法，应为 ${STRATEGY_CODES.join(', ')}`)
    }
    if (!Array.isArray(body.scenarios) || body.scenarios.length === 0) {
      throw new Error('scenarios 至少 1 个')
    }
    if (body.scenarios.length > 5) {
      throw new Error('scenarios 最多 5 个')
    }
    const result = await this.replay.compare({
      month: body.month,
      strategy: body.strategy,
      initialCash: body.initialCash,
      scenarios: body.scenarios,
      seed: body.seed,
    })
    return { data: result }
  }
}