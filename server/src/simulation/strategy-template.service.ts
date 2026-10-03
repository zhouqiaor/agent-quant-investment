import { Injectable, Logger } from '@nestjs/common'
import type { StrategyCode } from './simulation.constants'
import { TryoutReplayService } from './tryout-replay.service'

/**
 * 参数元数据：用于前端渲染参数面板（类型 / 范围 / 含义）
 */
export interface ParamMeta {
  key: string
  label: string
  /** 数值范围下限 */
  min: number
  /** 数值范围上限 */
  max: number
  /** 推荐步长 */
  step: number
  /** UI 类型：slider 滑块 / number 数字框 */
  type: 'slider' | 'number'
  /** 简短说明 */
  help: string
}

/**
 * 单策略的参数定义（前端 UI 元数据 + 默认值）
 */
export interface StrategyTemplate {
  code: StrategyCode
  name: string
  shortDesc: string
  params: Record<string, number>
  paramMeta: ParamMeta[]
  presets: { key: string; name: string; description: string; params: Record<string, number> }[]
}

const PCT_PARAMS: Record<StrategyCode, ParamMeta[]> = {
  ma_cross: [
    { key: 'maShort', label: '短期均线', min: 2, max: 30, step: 1, type: 'slider', help: '金叉计算的快线窗口，越小越敏感' },
    { key: 'maLong', label: '长期均线', min: 10, max: 120, step: 5, type: 'slider', help: '金叉计算的慢线窗口，越大越平滑' },
    { key: 'takeProfit', label: '止盈比例', min: 0.02, max: 0.30, step: 0.01, type: 'slider', help: '盈利达到此比例触发止盈' },
    { key: 'stopLoss', label: '止损比例', min: 0.01, max: 0.20, step: 0.01, type: 'slider', help: '亏损达到此比例触发止损' },
  ],
  momentum: [
    { key: 'lookback', label: '回看窗口', min: 3, max: 60, step: 1, type: 'slider', help: '看 N 日前到现在涨了多少' },
    { key: 'threshold', label: '信号阈值', min: 0.005, max: 0.10, step: 0.005, type: 'slider', help: '涨幅超过此值才触发买入' },
    { key: 'takeProfit', label: '止盈比例', min: 0.02, max: 0.30, step: 0.01, type: 'slider', help: '盈利达到此比例触发止盈' },
    { key: 'stopLoss', label: '止损比例', min: 0.01, max: 0.20, step: 0.01, type: 'slider', help: '亏损达到此比例触发止损' },
  ],
  reversal: [
    { key: 'oversold', label: '超卖阈值', min: -0.20, max: -0.01, step: 0.01, type: 'slider', help: '跌幅超过此值视为超卖' },
    { key: 'overbought', label: '超买阈值', min: 0.01, max: 0.20, step: 0.01, type: 'slider', help: '涨幅超过此值视为超买' },
    { key: 'takeProfit', label: '止盈比例', min: 0.02, max: 0.30, step: 0.01, type: 'slider', help: '盈利达到此比例触发止盈' },
    { key: 'stopLoss', label: '止损比例', min: 0.01, max: 0.20, step: 0.01, type: 'slider', help: '亏损达到此比例触发止损' },
  ],
  breakout: [
    { key: 'range', label: '突破窗口', min: 5, max: 90, step: 1, type: 'slider', help: '看多少日的最高最低' },
    { key: 'takeProfit', label: '止盈比例', min: 0.02, max: 0.30, step: 0.01, type: 'slider', help: '盈利达到此比例触发止盈' },
    { key: 'stopLoss', label: '止损比例', min: 0.01, max: 0.20, step: 0.01, type: 'slider', help: '亏损达到此比例触发止损' },
  ],
  trend_follow: [
    { key: 'fastLen', label: '快线', min: 2, max: 30, step: 1, type: 'slider', help: '快均线窗口' },
    { key: 'slowLen', label: '慢线', min: 10, max: 120, step: 5, type: 'slider', help: '慢均线窗口' },
    { key: 'takeProfit', label: '止盈比例', min: 0.02, max: 0.30, step: 0.01, type: 'slider', help: '盈利达到此比例触发止盈' },
    { key: 'stopLoss', label: '止损比例', min: 0.01, max: 0.20, step: 0.01, type: 'slider', help: '亏损达到此比例触发止损' },
  ],
}

const BASE_PARAMS: Record<StrategyCode, Record<string, number>> = {
  ma_cross: { maShort: 5, maLong: 20, takeProfit: 0.08, stopLoss: 0.05 },
  momentum: { lookback: 10, threshold: 0.02, takeProfit: 0.10, stopLoss: 0.04 },
  reversal: { oversold: -0.05, overbought: 0.05, takeProfit: 0.06, stopLoss: 0.06 },
  breakout: { range: 20, takeProfit: 0.12, stopLoss: 0.04 },
  trend_follow: { fastLen: 3, slowLen: 30, takeProfit: 0.15, stopLoss: 0.05 },
}

const PRESETS: Record<StrategyCode, StrategyTemplate['presets']> = {
  ma_cross: [
    { key: 'short_term', name: '短线敏感版', description: '短快长慢、止盈止损都更紧', params: { maShort: 3, maLong: 10, takeProfit: 0.06, stopLoss: 0.04 } },
    { key: 'medium_term', name: '中线稳健版', description: '拉长均线降低噪音，放大止盈止损', params: { maShort: 10, maLong: 60, takeProfit: 0.12, stopLoss: 0.06 } },
  ],
  momentum: [
    { key: 'aggressive', name: '激进版', description: '更短的回看窗口和更低的触发阈值，交易更频繁', params: { lookback: 5, threshold: 0.01, takeProfit: 0.15, stopLoss: 0.03 } },
    { key: 'conservative', name: '稳健版', description: '更长回看窗口更高阈值，过滤弱动量', params: { lookback: 30, threshold: 0.04, takeProfit: 0.08, stopLoss: 0.06 } },
  ],
  reversal: [
    { key: 'mean_revert', name: '均值回归版', description: '更深的超卖阈值和更紧的止盈，适合震荡市', params: { oversold: -0.08, overbought: 0.08, takeProfit: 0.04, stopLoss: 0.08 } },
  ],
  breakout: [
    { key: 'short_break', name: '短线突破版', description: '较短突破窗口，捕捉日内或周内突破', params: { range: 10, takeProfit: 0.10, stopLoss: 0.03 } },
    { key: 'mid_break', name: '中线突破版', description: '较长突破窗口，过滤假突破', params: { range: 40, takeProfit: 0.18, stopLoss: 0.06 } },
  ],
  trend_follow: [
    { key: 'fast_trend', name: '快趋势版', description: '短快长慢，灵敏跟随短周期趋势', params: { fastLen: 2, slowLen: 15, takeProfit: 0.12, stopLoss: 0.04 } },
  ],
}

const DESCRIPTIONS: Record<StrategyCode, string> = {
  ma_cross: '均线金叉死叉：短期均线上穿长期均线买入，下穿卖出',
  momentum: '动量：买入过去 N 日涨幅超过阈值的资产',
  reversal: '反转：超卖时买入，超买时卖出，赌均值回归',
  breakout: '突破：突破近期高点买入，跌穿低点卖出',
  trend_follow: '趋势跟随：综合多种信号打分，得分高追趋势，低则反向',
}

@Injectable()
export class StrategyTemplateService {
  private readonly logger = new Logger(StrategyTemplateService.name)

  constructor(private readonly tryout: TryoutReplayService) {}

  list(): StrategyTemplate[] {
    const codes: StrategyCode[] = ['ma_cross', 'momentum', 'reversal', 'breakout', 'trend_follow']
    return codes.map((c) => ({
      code: c,
      name: this.codeToName(c),
      shortDesc: DESCRIPTIONS[c],
      params: { ...BASE_PARAMS[c] },
      paramMeta: PCT_PARAMS[c],
      presets: PRESETS[c],
    }))
  }

  get(code: StrategyCode): StrategyTemplate | null {
    const found = this.list().find((t) => t.code === code)
    return found ?? null
  }

  private codeToName(c: StrategyCode): string {
    switch (c) {
      case 'ma_cross': return '均线交叉'
      case 'momentum': return '动量'
      case 'reversal': return '反转'
      case 'breakout': return '突破'
      case 'trend_follow': return '趋势跟随'
      default: return c
    }
  }

  /**
   * 网格扫描：按 step 在 [min, max] 内对每个参数组合跑一次 tryout
   * 返回 top-N 与 bottom-N
   */
  async gridSearch(args: {
    month: string
    strategy: string
    params: Record<string, { min: number; max: number; step: number }>
    metric?: 'totalReturnPct' | 'sharpe' | 'calmar'
    initialCash?: number
  }): Promise<{
    month: string
    strategy: string
    metric: string
    total: number
    top5: { params: Record<string, number>; metricValue: number; totalReturnPct: number; sharpe: number; calmar: number }[]
    bottom5: { params: Record<string, number>; metricValue: number; totalReturnPct: number; sharpe: number; calmar: number }[]
    totalDuration: number
  }> {
    const metric = args.metric ?? 'totalReturnPct'
    const start = Date.now()
    const entries = Object.entries(args.params)
    const grids: Record<string, number[]> = {}
    for (const [key, range] of entries) {
      const list: number[] = []
      for (let v = range.min; v <= range.max + 1e-9; v += range.step) {
        list.push(Math.round(v * 1e6) / 1e6)
      }
      grids[key] = list
    }
    const combinations: Record<string, number>[] = []
    const walk = (idx: number, current: Record<string, number>) => {
      if (idx === entries.length) {
        combinations.push({ ...current })
        return
      }
      const [k, list] = entries[idx]
      for (const v of (grids[k] ?? [])) {
        current[k] = v
        walk(idx + 1, current)
      }
    }
    walk(0, {})
    this.logger.log(`grid-search: ${args.strategy} ${args.month} ${combinations.length} 组合`)
    const results: { params: Record<string, number>; metricValue: number; totalReturnPct: number; sharpe: number; calmar: number }[] = []
    for (const params of combinations) {
      const r = await this.tryout.run({
        month: args.month,
        strategy: args.strategy as StrategyCode,
        params,
        initialCash: args.initialCash,
      })
      const metricValue = metric === 'sharpe' ? r.risk.sharpe : metric === 'calmar' ? r.risk.calmar : r.totalReturnPct
      results.push({
        params,
        metricValue,
        totalReturnPct: r.totalReturnPct,
        sharpe: r.risk.sharpe,
        calmar: r.risk.calmar,
      })
    }
    results.sort((a, b) => b.metricValue - a.metricValue)
    const top5 = results.slice(0, 5)
    const bottom5 = results.slice(-5).reverse()
    return {
      month: args.month,
      strategy: args.strategy,
      metric,
      total: combinations.length,
      top5,
      bottom5,
      totalDuration: Date.now() - start,
    }
  }
}