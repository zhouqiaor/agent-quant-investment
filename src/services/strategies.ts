import { Network } from '@/network'

export interface StrategyTemplate {
  code: string
  name: string
  shortDesc: string
  params: Record<string, number>
  paramMeta: ParamMeta[]
  presets: PresetTemplate[]
}

export interface ParamMeta {
  key: string
  label: string
  min: number
  max: number
  step: number
  type: 'slider' | 'number'
  help: string
}

export interface PresetTemplate {
  key: string
  name: string
  description: string
  params: Record<string, number>
}

export interface TryoutResult {
  month: string
  strategy: string
  params: Record<string, number>
  initialCash: number
  finalEquity: number
  totalPnl: number
  totalReturnPct: number
  risk: { sharpe: number; sortino: number; maxDD: number; calmar: number }
  realizedPnl: number
  totalTrades: number
  positionCount: number
}

export interface GridSearchRow {
  params: Record<string, number>
  metricValue: number
  totalReturnPct: number
  sharpe: number
  calmar: number
}

export interface GridSearchResult {
  month: string
  strategy: string
  metric: string
  total: number
  top5: GridSearchRow[]
  bottom5: GridSearchRow[]
  totalDuration: number
}

interface Envelope<T> {
  code: number
  msg: string
  data: T
}

async function unwrap<T>(res: { data: string | Envelope<T> } | { data: Envelope<T> }): Promise<T> {
  const raw: any = (res as { data: unknown }).data
  if (typeof raw === 'string') {
    return JSON.parse(raw) as T
  }
  if (raw && typeof raw === 'object' && 'data' in raw) {
    return (raw as Envelope<T>).data
  }
  return raw as T
}

export const Strategies = {
  async listTemplates(): Promise<StrategyTemplate[]> {
    const res = await Network.request({ url: '/api/strategies/templates' })
    return unwrap<StrategyTemplate[]>(res as never)
  },
  async getTemplate(code: string): Promise<StrategyTemplate> {
    const res = await Network.request({ url: `/api/strategies/templates/${code}` })
    return unwrap<StrategyTemplate>(res as never)
  },
  async tryout(args: {
    month: string
    strategy: string
    params: Record<string, number>
    initialCash?: number
  }): Promise<TryoutResult> {
    const res = await Network.request({
      url: '/api/strategies/tryout',
      method: 'POST',
      data: args,
    })
    return unwrap<TryoutResult>(res as never)
  },
  async gridSearch(args: {
    month: string
    strategy: string
    params: Record<string, { min: number; max: number; step: number }>
    metric?: 'totalReturnPct' | 'sharpe' | 'calmar'
    initialCash?: number
  }): Promise<GridSearchResult> {
    const res = await Network.request({
      url: '/api/strategies/grid-search',
      method: 'POST',
      data: args,
    })
    return unwrap<GridSearchResult>(res as never)
  },
}