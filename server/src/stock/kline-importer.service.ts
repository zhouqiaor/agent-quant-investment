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
}

/**
 * K 线导入器（本地 JSON → history_kline）
 * - 约定路径：data/sept-kline.json（项目级 mock）
 * - 格式：{ rows: [{ symbol, date, open, high, low, close, volume }, ...] }
 * - 行为：INSERT OR IGNORE（已存在则跳过，幂等）
 * - 校验：OHLC 合法性 + 高低包络 + 必填字段
 */
@Injectable()
export class KLineImporterService {
  private readonly logger = new Logger(KLineImporterService.name)
  // 多路径兜底：项目根 / server 子目录 / 临时目录
  private readonly DEFAULT_PATHS = [
    resolve(process.cwd(), 'data/sept-kline.json'),
    resolve(process.cwd(), '../data/sept-kline.json'),
    resolve(process.cwd(), 'server/data/sept-kline.json'),
  ]

  constructor(private readonly persistence: PersistenceService) {}

  /**
   * 从本地 JSON 文件导入 K 线
   * @param filePath 可选，自定义路径；默认按 DEFAULT_PATHS 顺序查找
   */
  importLocal(filePath?: string): KlineImportResult {
    let file = filePath
    if (!file) {
      const found = DEFAULT_PATHS_SEARCH(this.DEFAULT_PATHS)
      if (!found) {
        throw new Error(`K线文件不存在: 已尝试 ${this.DEFAULT_PATHS.join(', ')}`)
      }
      file = found
    } else if (!existsSync(file)) {
      throw new Error(`K线文件不存在: ${file}`)
    }

    const raw = JSON.parse(readFileSync(file, 'utf-8'))
    const rows = raw.rows
    if (!Array.isArray(rows)) {
      throw new Error(`K线文件格式错误: rows 字段缺失或非数组`)
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

    // 落库（INSERT OR IGNORE）
    const before = this.db.prepare('SELECT COUNT(*) as n FROM history_kline').get() as { n: number }
    this.persistence.upsertHistoryKline(
      valid.map((r) => ({ ...r, source: 'local-import' })),
    )
    const after = this.db.prepare('SELECT COUNT(*) as n FROM history_kline').get() as { n: number }
    const inserted = after.n - before.n
    const skipped = valid.length - inserted

    this.logger.log(`K线导入完成: file=${file} total=${valid.length} inserted=${inserted} skipped=${skipped} errors=${errors.length}`)

    return {
      source: 'local',
      file,
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

function DEFAULT_PATHS_SEARCH(paths: string[]): string | null {
  for (const p of paths) {
    if (existsSync(p)) return p
  }
  return null
}