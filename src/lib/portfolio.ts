/**
 * 组合管理：前端类型 + 纯函数（图表数据转换）
 *
 * 类型与 server/src/portfolio/portfolio.service.ts 的 PortfolioSummary 对齐
 * （Part 2 接口落地前，mock 数据也按此契约构造）。
 */

/** 持仓（与 PaperTradingService.PaperPosition 对齐，仅声明页面消费的字段） */
export interface PortfolioPosition {
  symbol: string
  name: string
  quantity: number
  avgCost: number
  currentPrice: number
  marketValue: number
  pnl: number
  pnlRate: number
  openDate: string
}

/** 组合元信息 */
export interface PortfolioInfo {
  id: string
  name: string
  initialCapital: number
  cashReservePct: number
  createdAt: string
}

/** 单策略聚合（对齐 PortfolioStrategySummary） */
export interface PortfolioStrategySummary {
  strategyId: string
  pnl: number
  pnlRate: number
  trades: number
  running: boolean
  maxPositionPct: number
  /**
   * 胜率（0-100）。Part 1 service 暂未返回，字段可选；
   * 页面缺省显示 '—'。Part 2 若返回 wins 可直接填充。
   */
  winRate?: number
}

/** 组合账户视图（对齐 PortfolioSummary） */
export interface PortfolioSummary {
  portfolio: PortfolioInfo
  cash: number
  positions: PortfolioPosition[]
  totalValue: number
  totalPnl: number
  totalPnlRate: number
  strategies: PortfolioStrategySummary[]
}

/** PnL 水平条形图的单条数据 */
export interface PnlBar {
  strategyId: string
  pnl: number
  /** 条形宽度占图表绘图区百分比（0-100），相对最大绝对值归一化 */
  widthPct: number
  positive: boolean
}

/**
 * 按 pnl 降序排序（不修改入参）。
 */
export function sortStrategiesByPnl(
  strategies: PortfolioStrategySummary[],
): PortfolioStrategySummary[] {
  return strategies.slice().sort((a, b) => b.pnl - a.pnl)
}

/**
 * 把策略摘要转换为水平条形图数据：
 * - 按 pnl 降序
 * - 宽度 = |pnl| / max(|pnl|) * 100；全部为 0 时宽度均为 0
 */
export function buildPnlBars(strategies: PortfolioStrategySummary[]): PnlBar[] {
  const sorted = sortStrategiesByPnl(strategies)
  const maxAbs = sorted.reduce((m, s) => Math.max(m, Math.abs(s.pnl)), 0)
  return sorted.map((s) => ({
    strategyId: s.strategyId,
    pnl: s.pnl,
    widthPct: maxAbs > 0 ? Math.round((Math.abs(s.pnl) / maxAbs) * 1000) / 10 : 0,
    positive: s.pnl >= 0,
  }))
}

/**
 * 仓位占比（%）：(totalValue - cash) / totalValue * 100。
 * totalValue <= 0 时返回 0，结果保留 1 位小数。
 */
export function calcPositionPct(totalValue: number, cash: number): number {
  if (!(totalValue > 0)) return 0
  const pct = ((totalValue - cash) / totalValue) * 100
  return Math.round(pct * 10) / 10
}

/**
 * 用 /api/strategies 返回的名称表给策略摘要补充 name。
 * 未命中时回退到 strategyId，保证页面始终有可读标签。
 */
export function withStrategyNames<T extends { strategyId: string }>(
  items: T[],
  nameMap: Record<string, string>,
): Array<T & { name: string }> {
  return items.map((it) => ({
    ...it,
    name: nameMap[it.strategyId] ?? it.strategyId,
  }))
}
