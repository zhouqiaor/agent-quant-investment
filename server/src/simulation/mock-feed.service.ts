import { Injectable, Logger } from '@nestjs/common'
import { promises as fs } from 'node:fs'
import * as path from 'node:path'

/**
 * 单根 K 线推送事件
 */
export interface TickEvent {
  /** 股票代码 */
  symbol: string
  /** 股票名称 */
  name: string
  /** 时间戳（毫秒） */
  ts: number
  /** 开盘价 */
  open: number
  /** 最高价 */
  high: number
  /** 最低价 */
  low: number
  /** 收盘价（作为当前价） */
  price: number
  /** 当日涨跌幅 %（与昨日收盘价对比） */
  changePct: number
  /** 成交量 */
  volume: number
}

export type TickListener = (tick: TickEvent) => void

interface YearKLineFile {
  generatedAt: string
  totalRows: number
  symbolCount: number
  tradingDayCount: number
  monthly: Array<{ month: string; name: string; rowCount: number; tradingDays: number }>
  rows: Array<{
    symbol: string
    name: string
    date: string
    open: number
    high: number
    low: number
    close: number
    volume: number
  }>
}

/**
 * Mock 实时行情源
 * - 从 data/year-kline.json 加载，指定月份 + tickMs 间隔逐根推送 TickEvent
 * - 单实例可同时跑多个月（按 month 隔离 state）
 * - 控制：start() / pause() / resume() / stop() / getStatus()
 */
@Injectable()
export class MockFeedService {
  private readonly logger = new Logger(MockFeedService.name)
  private fileCache: YearKLineFile | null = null
  /** runId -> feed state */
  private readonly feeds = new Map<
    string,
    {
      month: string
      rows: YearKLineFile['rows']
      idx: number
      lastBySymbol: Map<string, number>
      tickMs: number
      timer: NodeJS.Timeout | null
      status: 'idle' | 'running' | 'paused' | 'finished'
      listener: TickListener
      startedAt: number
    }
  >()

  private async loadKLines(): Promise<YearKLineFile> {
    if (this.fileCache) return this.fileCache
    // 文件可能在 server cwd 或 项目根目录（兼容两种启动方式）
    const candidates = [
      path.resolve(process.cwd(), 'data/year-kline.json'),
      path.resolve(process.cwd(), '..', 'data/year-kline.json'),
      path.resolve(__dirname, '..', '..', '..', 'data/year-kline.json'),
    ]
    let raw: string | null = null
    let usedPath = ''
    for (const p of candidates) {
      try {
        raw = await fs.readFile(p, 'utf-8')
        usedPath = p
        break
      } catch {
        // 继续
      }
    }
    if (!raw) {
      throw new Error(`无法找到 data/year-kline.json，尝试路径：${candidates.join(', ')}`)
    }
    this.fileCache = JSON.parse(raw) as YearKLineFile
    this.logger.log(`加载 year-kline.json: ${usedPath} → ${this.fileCache.totalRows} 行, ${this.fileCache.symbolCount} 支股票`)
    return this.fileCache
  }

  /**
   * 启动某月的实时 feed
   * @param runId 关联到 live run
   * @param month YYYY-MM
   * @param tickMs 推送间隔（毫秒），默认 500
   * @param listener tick 回调
   */
  async start(
    runId: string,
    month: string,
    tickMs: number,
    listener: TickListener,
  ): Promise<{ totalTicks: number; monthName: string }> {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new Error(`month 格式错误：${month}`)
    }
    const klines = await this.loadKLines()
    const monthMeta = klines.monthly.find((m) => m.month === month)
    if (!monthMeta) {
      throw new Error(`未找到月份 ${month}（仅 ${klines.monthly.length} 个月可用）`)
    }
    const rows = klines.rows
      .filter((r) => r.date.startsWith(month))
      .sort((a, b) => (a.date > b.date ? 1 : -1) || a.symbol.localeCompare(b.symbol))
    if (rows.length === 0) {
      throw new Error(`${month} 没有 K 线数据`)
    }

    // 停止旧 feed（如果存在）
    this.stopFeed(runId)

    const lastBySymbol = new Map<string, number>()
    const feed = {
      month,
      rows,
      idx: 0,
      lastBySymbol,
      tickMs,
      timer: null as NodeJS.Timeout | null,
      status: 'idle' as 'idle' | 'running' | 'paused' | 'finished',
      listener,
      startedAt: Date.now(),
    }
    this.feeds.set(runId, feed)
    this.resume(runId)
    this.logger.log(`启动 mock feed: runId=${runId} month=${month} ticks=${rows.length} tickMs=${tickMs}`)
    return { totalTicks: rows.length, monthName: monthMeta.name }
  }

  /**
   * 暂停
   */
  pause(runId: string): boolean {
    const feed = this.feeds.get(runId)
    if (!feed) return false
    if (feed.status !== 'running') return false
    if (feed.timer) clearInterval(feed.timer)
    feed.timer = null
    feed.status = 'paused'
    this.logger.log(`暂停 mock feed: runId=${runId}`)
    return true
  }

  /**
   * 恢复
   */
  resume(runId: string): boolean {
    const feed = this.feeds.get(runId)
    if (!feed) return false
    if (feed.status === 'running') return true
    if (feed.status === 'finished') return false
    feed.status = 'running'
    feed.timer = setInterval(() => this.tickOnce(runId), feed.tickMs)
    this.logger.log(`恢复 mock feed: runId=${runId}`)
    return true
  }

  /**
   * 停止并清理
   */
  stopFeed(runId: string): boolean {
    const feed = this.feeds.get(runId)
    if (!feed) return false
    if (feed.timer) clearInterval(feed.timer)
    this.feeds.delete(runId)
    this.logger.log(`停止 mock feed: runId=${runId}`)
    return true
  }

  /**
   * 单步推进（用于测试）
   */
  tickOnce(runId: string): TickEvent | null {
    const feed = this.feeds.get(runId)
    if (!feed || feed.status !== 'running') return null
    if (feed.idx >= feed.rows.length) {
      feed.status = 'finished'
      if (feed.timer) clearInterval(feed.timer)
      feed.timer = null
      return null
    }
    const row = feed.rows[feed.idx++]
    const lastClose = feed.lastBySymbol.get(row.symbol)
    const changePct = lastClose && lastClose > 0 ? ((row.close - lastClose) / lastClose) * 100 : 0
    feed.lastBySymbol.set(row.symbol, row.close)
    const tick: TickEvent = {
      symbol: row.symbol,
      name: row.name,
      ts: new Date(row.date).getTime(),
      open: row.open,
      high: row.high,
      low: row.low,
      price: row.close,
      changePct,
      volume: row.volume,
    }
    try {
      feed.listener(tick)
    } catch (err) {
      this.logger.error(`tick listener 异常: runId=${runId} err=${(err as Error).message}`)
    }
    if (feed.idx >= feed.rows.length) {
      feed.status = 'finished'
      if (feed.timer) clearInterval(feed.timer)
      feed.timer = null
    }
    return tick
  }

  /**
   * 当前状态（供 controller 返回）
   */
  getStatus(runId: string):
    | { status: 'idle' | 'running' | 'paused' | 'finished'; month: string; currentTick: number; totalTicks: number; tickMs: number }
    | null {
    const feed = this.feeds.get(runId)
    if (!feed) return null
    return {
      status: feed.status,
      month: feed.month,
      currentTick: feed.idx,
      totalTicks: feed.rows.length,
      tickMs: feed.tickMs,
    }
  }

  /**
   * 进程退出时清理所有 timer
   */
  shutdown(): void {
    for (const [runId, feed] of this.feeds) {
      if (feed.timer) clearInterval(feed.timer)
      feed.timer = null
    }
    this.feeds.clear()
  }
}