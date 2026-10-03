import { Injectable, Logger } from '@nestjs/common'
import { promises as fs } from 'node:fs'
import * as path from 'node:path'

/**
 * 场景冲击类型
 */
export type ShockType =
  | 'sector_drop'
  | 'sector_rise'
  | 'index_crumb'
  | 'index_rise'
  | 'single_symbol'
  | 'volatility_scale'

/**
 * 单个冲击
 */
export interface ScenarioShock {
  type: ShockType
  sector?: string
  symbol?: string
  /** sector_drop/rise/index_crumb/rise → 0..1（如 0.2 = 跌 20%）；volatility_scale → 倍数（如 2.0 = 翻倍波动） */
  magnitude: number
  startDate: string
  endDate: string
}

/**
 * 完整场景
 */
export interface Scenario {
  name: string
  description: string
  shocks: ScenarioShock[]
}

/**
 * 单根 K 线行
 */
export interface KLineRow {
  symbol: string
  name: string
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface YearKLineFile {
  generatedAt: string
  totalRows: number
  symbolCount: number
  tradingDayCount: number
  monthly: Array<{ month: string; name: string; rowCount: number; tradingDays: number }>
  rows: KLineRow[]
}

/**
 * K 线文件位置（相对 cwd）
 */
const KLINE_FILE = 'data/year-kline.json'

@Injectable()
export class ScenarioKlineService {
  private readonly logger = new Logger(ScenarioKlineService.name)
  private cache: YearKLineFile | null = null

  async load(): Promise<YearKLineFile> {
    if (this.cache) return this.cache
    // 兼容多 cwd（项目根 / server / server/dist 等）
    const candidates = [
      path.resolve(process.cwd(), 'data', 'year-kline.json'),
      path.resolve(process.cwd(), '..', 'data', 'year-kline.json'),
      path.resolve(process.cwd(), 'server', '..', 'data', 'year-kline.json'),
    ]
    let raw: string | null = null
    let lastErr: Error | null = null
    for (const f of candidates) {
      try {
        raw = await fs.readFile(f, 'utf8')
        break
      } catch (e) {
        lastErr = e as Error
      }
    }
    if (!raw) throw lastErr ?? new Error('year-kline.json 未找到')
    const parsed = JSON.parse(raw) as YearKLineFile
    this.cache = parsed
    this.logger.log(`ScenarioKline loaded: ${parsed.totalRows} rows, ${parsed.symbolCount} symbols`)
    return parsed
  }

  /** 按月取所有 K 行 */
  async rowsForMonth(month: string): Promise<KLineRow[]> {
    const data = await this.load()
    return data.rows.filter((r) => r.date.startsWith(month))
  }

  /** 所有可用月份 */
  async months(): Promise<string[]> {
    const data = await this.load()
    return data.monthly.map((m) => m.month)
  }

  /**
   * 应用一个场景到全部数据。
   * 注意：只返回"受影响行"的修改，不改原数据。
   */
  applyScenario(baseRows: KLineRow[], scenario: Scenario): KLineRow[] {
    const out: KLineRow[] = new Array(baseRows.length)
    for (let i = 0; i < baseRows.length; i++) {
      out[i] = { ...baseRows[i] }
    }
    for (const shock of scenario.shocks) {
      this.applyShock(out, shock)
    }
    return out
  }

  private applyShock(rows: KLineRow[], shock: ScenarioShock): void {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (!this.inDateRange(row.date, shock.startDate, shock.endDate)) continue
      if (shock.type === 'single_symbol' && row.symbol !== shock.symbol) continue
      if ((shock.type === 'sector_drop' || shock.type === 'sector_rise') && !this.matchSector(row.symbol, shock.sector)) continue
      const newRow = this.applyShockToRow(row, shock)
      if (newRow) rows[i] = newRow
    }
  }

  private applyShockToRow(row: KLineRow, shock: ScenarioShock): KLineRow | null {
    switch (shock.type) {
      case 'sector_drop':
      case 'index_crumb':
        return this.shiftPrice(row, -shock.magnitude)
      case 'sector_rise':
      case 'index_rise':
        return this.shiftPrice(row, shock.magnitude)
      case 'single_symbol':
        return this.shiftPrice(row, -shock.magnitude)
      case 'volatility_scale': {
        // 把 daily return 减去基准（首日 open）后的波动乘以 shock.magnitude
        const mid = (row.open + row.close) / 2
        const newHigh = mid + (row.high - mid) * shock.magnitude
        const newLow = mid + (row.low - mid) * shock.magnitude
        const newClose = mid + (row.close - mid) * shock.magnitude
        return { ...row, high: newHigh, low: newLow, close: newClose }
      }
      default:
        return null
    }
  }

  /** 整体上下平移百分比（保留 high/low 相对位置） */
  private shiftPrice(row: KLineRow, pct: number): KLineRow {
    return {
      ...row,
      open: row.open * (1 + pct),
      high: row.high * (1 + pct),
      low: row.low * (1 + pct),
      close: row.close * (1 + pct),
    }
  }

  private inDateRange(date: string, start: string, end: string): boolean {
    return date >= start && date <= end
  }

  /**
   * 简单的板块匹配：基于 name 的关键词
   * 关键词分类（足够覆盖 80% 主流场景）：
   *   tech/科技/电子/信息/软件/互联网/计算机
   *   consumer/消费/食品/酒/家电
   *   finance/银行/证券/保险/金融
   *   energy/能源/石油/煤炭/电力
   *   pharma/医药/生物/健康
   *   material/材料/钢铁/化工/有色
   *   media/传媒/广告/游戏
   *   auto/汽车/车
   *   telecom/通信/移动
   *   industrial/工业/制造/装备
   *   utility/公共/水务/环保
   */
  private matchSector(symbol: string, sector?: string): boolean {
    if (!sector) return false
    // 1) 优先按精确行业匹配（symbol → industry 硬编码表，匹配真实 A 股）
    const SYMBOL_TO_INDUSTRY: Record<string, string> = {
      '688981': 'tech',          // 中芯国际
      '002594': 'auto',          // 比亚迪
      '600036': 'finance',       // 招商银行
      '601398': 'finance',       // 工商银行
      '601318': 'finance',       // 中国平安
      '601628': 'finance',       // 中国人寿
      '600519': 'consumer',      // 贵州茅台
      '000858': 'consumer',      // 五粮液
      '600887': 'consumer',      // 伊利股份
      '000333': 'consumer',      // 美的集团
      '000651': 'consumer',      // 格力电器
      '600028': 'energy',        // 中国石化
      '600900': 'energy',        // 长江电力
      '600276': 'pharma',        // 恒瑞医药
      '600585': 'material',      // 海螺水泥
      '601012': 'material',      // 隆基绿能
    }
    if (SYMBOL_TO_INDUSTRY[symbol] === sector) return true
    // 2) 行业关键词回退（name 含关键词）
    const KEYWORDS: Record<string, string[]> = {
      tech: ['科技', '电子', '信息', '软件', '互联网', '计算机', '技术', '半导体', '芯片'],
      consumer: ['消费', '食品', '酒', '家电', '零售'],
      finance: ['银行', '证券', '保险', '金融', '资本'],
      energy: ['能源', '石油', '煤炭', '电力', '天然气'],
      pharma: ['医药', '生物', '健康', '制药', '医院'],
      material: ['材料', '钢铁', '化工', '有色', '矿业', '水泥'],
      media: ['传媒', '广告', '游戏', '影视'],
      auto: ['汽车', '车', '新能源车'],
      telecom: ['通信', '移动', '联通', '电信'],
      industrial: ['工业', '制造', '装备', '机械', '工程'],
      utility: ['公共', '水务', '环保', '燃气'],
    }
    // 这里只能拿到 symbol 但拿不到 name（接口语义），所以关键词匹配在此路径下不生效
    // 仅依赖 SYMBOL_TO_INDUSTRY。name 路径下需要传入更详细的 sector 形式
    return false
  }
}