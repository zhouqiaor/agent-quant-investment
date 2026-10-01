import { Injectable, Logger } from '@nestjs/common'
import { PersistenceService } from '../persistence/persistence.service'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

export interface KlineImportResult {
  source: 'local'
  file: string
  totalRows: number
  inserted: number
  skipped: number
  errors: string[]
  sampleSymbols: string[]
  dataset: 'sept' | 'year'
  monthFilter?: string
}

/**
 * K 线导入器（本地 JSON → history_kline）
 * - dataset: 'sept'（默认，data/sept-kline.json） | 'year'（data/year-kline.json）
 * - month: 可选，YYYY-MM 月份过滤（仅 year 模式生效）
 * - 格式：{ rows: [{ symbol, date, open, high, low, close, volume }, ...] }
 * - 行为：INSERT OR IGNORE（已存在则跳过，幂等）
 * - 校验：OHLC 合法性 + 高低包络 + 必填字段
 */
@Injectable()
export class KLineImporterService {
  private readonly logger = new Logger(KLineImporterService.name)
  private readonly PATHS: Record<string, string[]> = {
    sept: [
      resolve(process.cwd(), 'data/sept-kline.json'),
      resolve(process.cwd(), '../data/sept-kline.json'),
      resolve(process.cwd(), 'server/data/sept-kline.json'),
    ],
    year: [
      resolve(process.cwd(), 'data/year-kline.json'),
      resolve(process.cwd(), '../data/year-kline.json'),
      resolve(process.cwd(), 'server/data/year-kline.json'),
    ],
  }

  constructor(private readonly persistence: PersistenceService) {}

  /**
   * 从本地 JSON 文件导入 K 线
   * @param opts.dataset 'sept' | 'year'，默认 sept
   * @param opts.month 可选月份过滤（YYYY-MM），仅 year 模式生效
   */
  importLocal(opts: { dataset?: 'sept' | 'year'; month?: string } = {}): KlineImportResult {
    const dataset = opts.dataset ?? 'sept'
    const month = opts.month
    const candidates = this.PATHS[dataset]
    const file = candidates.find((p) => existsSync(p))
    if (!file) {
      throw new Error(`K线文件不存在 (dataset=${dataset}): 已尝试 ${candidates.join(', ')}`)
    }

    const raw = JSON.parse(readFileSync(file, 'utf-8'))
    let rows = raw.rows
    if (!Array.isArray(rows)) {
      throw new Error(`K线文件格式错误: rows 字段缺失或非数组`)
    }

    if (month && dataset === 'year') {
      const before = rows.length
      rows = rows.filter((r: any) => r.date && r.date.startsWith(`${month}-`))
      this.logger.log(`月份过滤: dataset=${dataset} month=${month} ${before} → ${rows.length} 行`)
    }

    const errors: string[] = []
    const valid: any[] = []
    const symbolSet = new Set<string>()

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      const err = this.validateRow(r)
      if (err) {
        errors.push(`row[${i}]: ${err}`)
        continue
      }
      valid.push(r)
      symbolSet.add(r.symbol)
    }

    const before = this.db.prepare('SELECT COUNT(*) as n FROM history_kline').get() as { n: number }
    this.persistence.upsertHistoryKline(
      valid.map((r) => ({ ...r, source: dataset === 'year' ? 'year-import' : 'local-import' })),
    )
    const after = this.db.prepare('SELECT COUNT(*) as n FROM history_kline').get() as { n: number }
    const inserted = after.n - before.n
    const skipped = valid.length - inserted

    this.logger.log(`K线导入完成: dataset=${dataset} month=${month ?? '-'} total=${valid.length} inserted=${inserted} skipped=${skipped} errors=${errors.length}`)

    return {
      source: 'local',
      file,
      dataset,
      monthFilter: month,
      totalRows: valid.length,
      inserted,
      skipped,
      errors: errors.slice(0, 20),
      sampleSymbols: Array.from(symbolSet).slice(0, 5),
    }
  }

  private validateRow(r: any): string | null {
    if (!r || typeof r !== 'object') return '非对象'
    const required = ['symbol', 'date', 'open', 'high', 'low', 'close', 'volume']
    for (const k of required) {
      if (r[k] === undefined || r[k] === null) return `缺少字段 ${k}`
    }
    if (typeof r.symbol !== 'string' || r.symbol.length < 6) return `symbol 非法: ${r.symbol}`
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) return `date 格式错误: ${r.date}`
    if (!(r.high >= r.low)) return `high (${r.high}) < low (${r.low})`
    if (r.high < Math.max(r.open, r.close)) return `high 包络错误`
    if (r.low > Math.min(r.open, r.close)) return `low 包络错误`
    if (r.close <= 0 || r.open <= 0) return '价格必须为正'
    return null
  }

  private get db() {
    return (this.persistence as any).db
  }
}