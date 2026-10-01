import { Injectable, Logger } from '@nestjs/common'
import { PersistenceService } from '../persistence/persistence.service'
import {
  INDUSTRIES,
  STRATEGIES,
  RISK_PREFERENCES,
  STRATEGY_BASE_PARAMS,
  type IndustryCode,
  type StrategyCode,
  type RiskPreference,
} from './simulation.constants'
import { logUniform, perturbParams, uniform, weightedPick } from './simulation.constants'

export interface SimulationConfig {
  accountCount?: number
  industries?: IndustryCode[]
  strategies?: StrategyCode[]
  capitalMin?: number
  capitalMax?: number
  industriesPerAccount?: [number, number]
}

export interface SimAccountTemplate {
  id: string
  runId: string
  seq: number
  name: string
  industry: IndustryCode
  industryLabel: string
  strategy: StrategyCode
  strategyLabel: string
  initialCapital: number
  cash: number
  riskPreference: RiskPreference
  riskLabel: string
  tradesPerHour: number
  paramOverrides: Record<string, number>
  watchlist: string[]
}

/**
 * 100 账户仿真 — 工厂
 * 一次性创建 N 个虚拟账户，每个随机分配资金/行业/策略/参数
 */
@Injectable()
export class SimulationFactory {
  private readonly logger = new Logger(SimulationFactory.name)

  constructor(private readonly persistence: PersistenceService) {}

  async createBatch(
    runId: string,
    config: SimulationConfig = {},
  ): Promise<SimAccountTemplate[]> {
    const count = config.accountCount ?? 100
    const capitalMin = config.capitalMin ?? 10_000
    const capitalMax = config.capitalMax ?? 1_000_000
    const industries = (config.industries && config.industries.length > 0
      ? INDUSTRIES.filter(i => config.industries!.includes(i.code as IndustryCode))
      : INDUSTRIES) as typeof INDUSTRIES
    const strategies = (config.strategies && config.strategies.length > 0
      ? config.strategies
      : STRATEGIES) as StrategyCode[]
    const [indMin, indMax] = config.industriesPerAccount ?? [1, 3]
    const riskWeights = [0.2, 0.6, 0.2]

    const accounts: SimAccountTemplate[] = []

    for (let seq = 0; seq < count; seq++) {
      // 资金：log-uniform，让分布更接近真实（小额账户多）
      const initialCapital = Math.round(logUniform(capitalMin, capitalMax) / 1000) * 1000
      const industryCount = Math.floor(uniform(indMin, indMax + 1))
      const picked = this.pickN(industries, industryCount)
      const watchlist = Array.from(new Set(picked.flatMap(p => [...p.stocks])))
      const strategy = strategies[Math.floor(Math.random() * strategies.length)]
      const risk = weightedPick([...RISK_PREFERENCES], riskWeights) as RiskPreference
      const baseParams = STRATEGY_BASE_PARAMS[strategy]
      const params = perturbParams(baseParams, risk === 'aggressive' ? 0.3 : risk === 'conservative' ? 0.1 : 0.2)
      const tradesPerHour = Math.round(uniform(1, 6))
      const industry = picked[0]
      const id = `sim_${runId.replace(/^sim_/, '').slice(-6)}_${String(seq).padStart(3, '0')}`
      const name = `${industry.name}-${strategy}-${String(seq + 1).padStart(3, '0')}`

      accounts.push({
        id,
        runId,
        seq,
        name,
        industry: industry.code,
        industryLabel: industry.name,
        strategy,
        strategyLabel: this.strategyLabel(strategy),
        initialCapital,
        cash: initialCapital,
        riskPreference: risk,
        riskLabel: this.riskLabel(risk),
        tradesPerHour,
        paramOverrides: params,
        watchlist,
      })

      this.persistence.saveSimAccount({
        id, runId, seq, name,
        industry: industry.code,
        strategy,
        initialCapital,
        cash: initialCapital,
        riskPreference: risk,
        tradesPerHour,
        paramOverrides: params,
        watchlist,
      })
    }

    this.logger.log(`创建 ${accounts.length} 个仿真账户（run=${runId}）`)
    return accounts
  }

  private pickN<T>(arr: readonly T[], n: number): T[] {
    const copy = [...arr]
    const out: T[] = []
    for (let i = 0; i < n && copy.length > 0; i++) {
      const idx = Math.floor(Math.random() * copy.length)
      out.push(copy.splice(idx, 1)[0])
    }
    return out
  }

  private strategyLabel(s: StrategyCode): string {
    return ({ ma_cross: '均线交叉', momentum: '动量', reversal: '反转', breakout: '突破', trend_follow: '趋势跟随' } as const)[s]
  }

  private riskLabel(r: RiskPreference): string {
    return ({ conservative: '保守', neutral: '中性', aggressive: '激进' } as const)[r]
  }
}