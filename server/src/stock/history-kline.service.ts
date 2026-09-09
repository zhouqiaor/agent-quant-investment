import { Injectable, Logger, Optional } from '@nestjs/common';
import { PersistenceService } from '../persistence/persistence.service';

export type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export const HISTORY_KLINE_FETCH = Symbol('HISTORY_KLINE_FETCH');

export interface KlineData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * 历史K线服务（真实行情）
 * - 主源：腾讯 fqkline（按日期区间、前复权）
 *   URL: https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=sh600519,start,end,640,qfq
 * - 兜底：新浪 CN_MarketDataService datalen=1023（约 4 年日K）
 * - 缓存：SQLite history_kline(symbol+date 主键)，增量补拉缺失日期
 * - 限速：请求间 150ms；失败重试 1 次
 * - 失败语义：返回空数组，不抛异常（调用方按业务判断提示）
 */
@Injectable()
export class HistoryKlineService {
  private readonly logger = new Logger(HistoryKlineService.name);
  private readonly REQUEST_INTERVAL_MS = 150;
  private lastRequestAt = 0;
  private readonly MAX_RETRIES = 1;
  private readonly fetchImpl: FetchFn;

  /**
   * 注入 fetch 实现便于测试（生产用全局 fetch）。
   */
  constructor(
    private readonly persistence: PersistenceService,
    @Optional() injectedFetch?: FetchFn,
  ) {
    this.fetchImpl = injectedFetch ?? ((input, init) => fetch(input, init));
  }

  /**
   * 拉取 [start, end]（含）区间内的真实K线
   * - 增量：先查库，已存在的日期不重复请求
   * - 主源：腾讯 → 失败降级新浪
   * - 返回：缓存合并后的 KlineData[]（按日期升序）
   */
  async fetchRealKline(symbol: string, start: string, end: string): Promise<KlineData[]> {
    const cached = this.persistence.getHistoryKline(symbol, start, end);
    const cachedDates = new Set(cached.map((c) => c.date));
    const tradingDays = this.enumerateTradingDays(start, end);
    const missing = tradingDays.filter((d) => !cachedDates.has(d));

    let fetched: KlineData[] = [];
    let source: 'tencent' | 'sina' | 'cache' = 'cache';

    if (missing.length > 0) {
      // 取缺失段的最小/最大日期作为拉取窗口
      const fetchStart = missing[0];
      const fetchEnd = missing[missing.length - 1];

      // 尝试腾讯
      try {
        fetched = await this.fetchFromTencentWithRetry(symbol, fetchStart, fetchEnd);
        if (fetched.length > 0) {
          source = 'tencent';
        }
      } catch (e: any) {
        this.logger.warn(`腾讯K线拉取失败 ${symbol}: ${e.message}`);
      }

      // 失败 → 降级新浪
      if (fetched.length === 0) {
        try {
          fetched = await this.fetchFromSina(symbol);
          if (fetched.length > 0) {
            source = 'sina';
          }
        } catch (e: any) {
          this.logger.warn(`新浪K线降级也失败 ${symbol}: ${e.message}`);
        }
      }

      // 落库
      if (fetched.length > 0) {
        this.persistence.upsertHistoryKline(
          fetched.map((k) => ({ symbol, ...k, source })),
        );
      }
    }

    // 合并缓存 + 本次拉取（以持久化为准，因为缓存包含此前所有数据）
    const all = this.persistence.getHistoryKline(symbol, start, end);
    return all
      .map((r) => ({
        date: r.date,
        open: r.open,
        high: r.high,
        low: r.low,
        close: r.close,
        volume: r.volume,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * 解析腾讯 fqkline 响应（qfqday: [date, open, close, high, low, volume]）
   * 提取暴露成方法便于测试。
   */
  parseTencentResponse(raw: string, symbol: string): KlineData[] {
    let json: any;
    try {
      json = JSON.parse(raw);
    } catch {
      return [];
    }
    const data = json?.data;
    if (!data) return [];

    // 兼容 sh600519 / sz000001 / sh600519 等多种 key
    const code = this.getTencentCode(symbol);
    let entry: any = data[code];
    if (!entry) {
      // 退而求其次：用 symbols 中的第一个
      const keys = Object.keys(data);
      if (keys.length > 0) entry = data[keys[0]];
    }
    if (!entry) return [];

    const qfqday: string[][] | undefined = entry.qfqday ?? entry.day;
    if (!Array.isArray(qfqday)) return [];

    return qfqday
      .filter((row) => Array.isArray(row) && row.length >= 6)
      .map((row) => ({
        date: row[0],
        open: Number(row[1]),
        close: Number(row[2]),
        high: Number(row[3]),
        low: Number(row[4]),
        volume: Number(row[5]) || 0,
      }))
      .filter((k) => k.date && Number.isFinite(k.open) && Number.isFinite(k.close));
  }

  /**
   * 返回该股已缓存数据的 [最早, 最晚] 日期。无数据返回 null。
   */
  getAvailableRange(symbol: string): { start: string; end: string } | null {
    const all = this.persistence.getHistoryKline(symbol, '1900-01-01', '2999-12-31');
    if (all.length === 0) return null;
    const dates = all.map((r) => r.date).sort();
    return { start: dates[0], end: dates[dates.length - 1] };
  }

  // ====================== 私有方法 ======================

  /**
   * 腾讯 fqkline 请求（重试 1 次）。
   * 返回的数组只含 [fetchStart, fetchEnd] 区间内的数据。
   */
  private async fetchFromTencentWithRetry(
    symbol: string,
    start: string,
    end: string,
  ): Promise<KlineData[]> {
    let lastError: any = null;
    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        await this.throttle();
        const code = this.getTencentCode(symbol);
        const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${code},day,${start},${end},640,qfq`;
        const resp = await this.fetchImpl(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            Referer: 'https://gu.qq.com/',
          },
        });
        if (!resp.ok) {
          lastError = new Error(`HTTP ${resp.status}`);
          continue;
        }
        const text = await resp.text();
        const all = this.parseTencentResponse(text, symbol);
        return all.filter((k) => k.date >= start && k.date <= end);
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError ?? new Error('tencent fetch failed');
  }

  /**
   * 新浪 datalen=1023 降级（JSONP 包 var _=[...]）。
   * 返回的数组包含尽可能多的历史日K（无日期区间过滤能力）。
   */
  private async fetchFromSina(symbol: string): Promise<KlineData[]> {
    await this.throttle();
    const code = this.toSinaCode(symbol);
    const url = `https://quotes.sina.cn/cn/api/jsonp_v2.php/var%20_=/CN_MarketDataService.getKLineData?symbol=${code}&scale=240&ma=no&datalen=1023`;
    const resp = await this.fetchImpl(url, {
      headers: {
        Referer: 'https://finance.sina.com.cn',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    if (!resp.ok) return [];
    const text = await resp.text();
    // Sina 返回格式：var _=([["YYYY-MM-DD","open","high","low","close","volume"],...]);
    const match = text.match(/\((\[[\s\S]*\])\)/);
    if (!match) return [];
    try {
      const arr = JSON.parse(match[1]) as Array<[string, string, string, string, string, string]>;
      return arr
        .filter((row) => Array.isArray(row) && row.length >= 6)
        .map((row) => ({
          date: row[0],
          open: Number(row[1]),
          high: Number(row[2]),
          low: Number(row[3]),
          close: Number(row[4]),
          volume: Number(row[5]) || 0,
        }))
        .filter((k) => k.date && Number.isFinite(k.open) && Number.isFinite(k.close));
    } catch {
      return [];
    }
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestAt;
    if (elapsed < this.REQUEST_INTERVAL_MS) {
      await new Promise((r) => setTimeout(r, this.REQUEST_INTERVAL_MS - elapsed));
    }
    this.lastRequestAt = Date.now();
  }

  /**
   * 沪市 6/9/5 → sh，深市 0/3/1/2 → sz
   * 兼容带前缀（如 sh600519）
   */
  private getTencentCode(symbol: string): string {
    const clean = symbol.replace(/^(sh|sz)/, '');
    const head = clean[0];
    return head === '6' || head === '9' || head === '5' ? `sh${clean}` : `sz${clean}`;
  }

  private toSinaCode(symbol: string): string {
    const clean = symbol.replace(/^(sh|sz)/, '');
    const head = clean[0];
    return head === '6' || head === '9' || head === '5' ? `sh${clean}` : `sz${clean}`;
  }

  /**
   * 枚举 [start, end] 之间的所有日期（YYYY-MM-DD 升序）。
   * 不剔除周末——上游接口会按交易日过滤。
   */
  private enumerateTradingDays(start: string, end: string): string[] {
    const out: string[] = [];
    const s = new Date(`${start}T00:00:00Z`);
    const e = new Date(`${end}T00:00:00Z`);
    if (s > e) return [];
    const cur = new Date(s);
    while (cur <= e) {
      out.push(cur.toISOString().split('T')[0]);
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return out;
  }
}