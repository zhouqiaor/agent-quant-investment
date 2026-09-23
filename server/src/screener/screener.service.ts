import { Injectable, Logger } from '@nestjs/common';
import { PersistenceService } from '@/persistence/persistence.service';
import { StockService } from '@/stock/stock.service';
import { IndicatorCalcService, IndicatorBundle } from '@/indicators';
import type { KlineData, KlineWithIndicators, StockInfo } from '@/stock/stock.service';
import {
  FIELD_DEFINITIONS,
  ScreenerField,
  ScreenerItem,
  ScreenerRequest,
  ScreenerResponse,
} from './schema';
import type { FilterOp } from './schema';

/**
 * 条件选股器执行服务
 *
 * 流程：
 *  1. 构造候选集（persistence.searchDirectory('', 5000) → 全量目录）
 *  2. 用 8 路信号量并发拉行情 (StockService.fetchRealtimeQuote)
 *  3. 根据 groups 字段类型，惰性拉取 K 线 + 计算指标
 *  4. 求值每只股票 → 过滤（AND/OR）→ 排序 → 分页
 *  5. 进程内缓存（key = 去 page 序列化），TTL 5 分钟
 *
 * 错误隔离：单只股票的 fetchRealtimeQuote / getKlineBundle 抛错或返回空时跳过该股，
 * 不影响其他股票评估。技术/形态字段 K 线为空时该项为 undefined，过滤时被判 false。
 */
@Injectable()
export class ScreenerService {
  private readonly logger = new Logger(ScreenerService.name);
  private readonly MAX_CANDIDATES = 5000;
  private readonly CONCURRENCY = 8;
  private readonly CACHE_TTL = 5 * 60 * 1000;
  private readonly KLINE_LIMIT = 60;

  /** 全集缓存：key = 序列化 request（去 page）→ { 全集 items, at } */
  public readonly cache: Map<string, { at: number; items: ScreenerItem[] }> = new Map();

  constructor(
    private readonly persistence: PersistenceService,
    private readonly stockService: StockService,
    private readonly indicatorCalc: IndicatorCalcService,
  ) {}

  // -------------------------------------------------------------------------
  // 主入口
  // -------------------------------------------------------------------------

  async evaluate(req: ScreenerRequest): Promise<ScreenerResponse> {
    const cacheKey = this.cacheKey(req);
    const cached = this.cache.get(cacheKey);
    const now = Date.now();

    let allItems: ScreenerItem[];
    if (cached && now - cached.at < this.CACHE_TTL) {
      allItems = cached.items;
    } else {
      allItems = await this.computeAllItems(req);
      this.cache.set(cacheKey, { at: now, items: allItems });
    }

    // 分页（slice 全集）
    const page = req.page;
    const pageSize = req.pageSize;
    const start = (page - 1) * pageSize;
    const items = allItems.slice(start, start + pageSize);

    return {
      items,
      total: allItems.length,
      page,
      pageSize,
      combinator: req.combinator,
    };
  }

  /** 测试用：导出 cacheKey 生成逻辑 */
  cacheKeyForTest(req: ScreenerRequest): string {
    return this.cacheKey(req);
  }

  // -------------------------------------------------------------------------
  // 全集计算（每只股票求值 + 过滤 + 排序，不分页）
  // -------------------------------------------------------------------------

  private async computeAllItems(req: ScreenerRequest): Promise<ScreenerItem[]> {
    const directory = this.persistence.searchDirectory('', this.MAX_CANDIDATES);
    if (directory.length === 0) return [];

    // 提前判断"哪些字段需要 K 线"：technical/pattern 类 + resonance 聚合
    const needsKline = this.requiresKline(req.groups);

    // 阶段 1：并发拉行情（max 8）
    const quotes: Array<StockInfo | null> = await this.mapWithLimit(
      directory,
      this.CONCURRENCY,
      async (row) => {
        try {
          return await this.stockService.fetchRealtimeQuote(row.symbol);
        } catch (e) {
          this.logger.warn(`fetchRealtimeQuote 失败 ${row.symbol}: ${(e as Error).message}`);
          return null;
        }
      },
    );

    // 阶段 2：惰性拉 K 线（仅对需要技术指标的股票，且每只股票串行拉一次）
    const klineMap = new Map<string, KlineWithIndicators>();
    if (needsKline) {
      const klineTargets: Array<{ index: number; symbol: string }> = [];
      directory.forEach((row, i) => {
        if (quotes[i]) klineTargets.push({ index: i, symbol: row.symbol });
      });
      const bundles = await this.mapWithLimit(
        klineTargets,
        this.CONCURRENCY,
        async (t) => {
          try {
            const bundle = await this.stockService.getKlineBundle(
              t.symbol,
              'daily',
              this.KLINE_LIMIT,
            );
            // 空 klines 视为失败
            if (!bundle.klines || bundle.klines.length === 0) return null;
            return bundle;
          } catch (e) {
            this.logger.warn(`getKlineBundle 失败 ${t.symbol}: ${(e as Error).message}`);
            return null;
          }
        },
      );
      klineTargets.forEach((t, j) => {
        if (bundles[j]) klineMap.set(t.symbol, bundles[j]!);
      });
    }

    // 阶段 3：每只股票求值 + 过滤
    const items: ScreenerItem[] = [];
    for (let i = 0; i < directory.length; i++) {
      const row = directory[i]!;
      const quote = quotes[i];
      if (!quote) continue; // 行情拉不到 → 跳过

      const item = this.buildItem(row, quote, klineMap.get(row.symbol));
      if (this.matches(item, req)) {
        items.push(item);
      }
    }

    // 阶段 4：排序
    this.sortItems(items, req.sort.field, req.sort.order);

    return items;
  }

  // -------------------------------------------------------------------------
  // 求值
  // -------------------------------------------------------------------------

  /**
   * 构造 ScreenerItem（拉取 K 线时本地计算 indicators，确保 kdjZone/bollBand/macdSignal
   * 等字段基于同一 bundle 结果，避免重复 IO）
   *
   * dirRow：来自 persistence.searchDirectory 的目录行（含 changePercent / market）
   * quote：来自 fetchRealtimeQuote 的实时行情（含 pe/pb/marketCap）
   */
  private buildItem(
    dirRow: { symbol: string; name: string; market: string; price: number; changePercent: number },
    quote: StockInfo,
    bundle: KlineWithIndicators | undefined,
  ): ScreenerItem {
    const item: ScreenerItem = {
      symbol: dirRow.symbol,
      name: dirRow.name,
      price: quote.price || dirRow.price,
      changePct: quote.changePercent || dirRow.changePercent,
    };

    // fundamental：行情里若为空则兜底 0；后续可由目录 metadata 补
    if (quote.pe) item.pe = quote.pe;
    if (quote.pb) item.pb = quote.pb;
    if (quote.marketCap) item.marketCap = quote.marketCap;

    // quote extras：当前 StockInfo 未直接提供，先填 undefined
    item.turnoverRate = undefined;
    item.volumeRatio = undefined;
    item.consecutiveLimitUp = 0; // TODO: 接 tick 后回填

    // technical / pattern：基于 indicators
    if (bundle && bundle.klines.length > 0) {
      const indicators =
        bundle.indicators ?? this.indicatorCalc.computeAll(bundle.klines);
      this.applyIndicators(item, bundle.klines, indicators);
    }

    return item;
  }

  /**
   * 从指标 + K 线提取 macdSignal / kdjZone / bollBand / maAlignment / resonance。
   * 仅依据"最新一日"的状态（非最近 cross），便于 EOD 决策。
   */
  private applyIndicators(
    item: ScreenerItem,
    klines: KlineData[],
    indicators: IndicatorBundle,
  ): void {
    const n = klines.length;
    const last = n - 1;

    // ---- MACD：最新一根的状态（金叉 → dif > dea 且上一根 dif <= dea） ----
    const dif = indicators.macd.dif[last];
    const dea = indicators.macd.dea[last];
    const difPrev = indicators.macd.dif[last - 1];
    const deaPrev = indicators.macd.dea[last - 1];
    if (dif != null && dea != null && difPrev != null && deaPrev != null) {
      if (difPrev <= deaPrev && dif > dea) {
        item.macdSignal = 'golden';
      } else if (difPrev >= deaPrev && dif < dea) {
        item.macdSignal = 'death';
      }
    }

    // ---- KDJ：最新 J 值 -> oversold / overbought ----
    const j = indicators.kdj.j[last];
    if (j != null) {
      if (j < 0) item.kdjZone = 'oversold';
      else if (j > 100) item.kdjZone = 'overbought';
    }

    // ---- BOLL：最新 close vs upper/lower ----
    const upper = indicators.boll.upper[last];
    const lower = indicators.boll.lower[last];
    const close = klines[last]!.close;
    if (upper != null && close > upper) {
      item.bollBand = 'upper_break';
    } else if (lower != null && close < lower) {
      item.bollBand = 'lower_break';
    }

    // ---- MA alignment：MA5 vs MA10 vs MA20 三线方向 ----
    const ma5 = indicators.ma['5']?.[last];
    const ma10 = indicators.ma['10']?.[last];
    const ma20 = indicators.ma['20']?.[last];
    if (ma5 != null && ma10 != null && ma20 != null) {
      if (ma5 > ma10 && ma10 > ma20) {
        item.maAlignment = 'bull';
      } else if (ma5 < ma10 && ma10 < ma20) {
        item.maAlignment = 'bear';
      } else {
        item.maAlignment = 'mixed';
      }
    }

    // ---- Resonance：MACD 金叉 + KDJ 超卖 + (BOLL 上轨突破 OR MA 多头) ----
    item.resonance =
      item.macdSignal === 'golden' &&
      item.kdjZone === 'oversold' &&
      (item.bollBand === 'upper_break' || item.maAlignment === 'bull');
  }

  // -------------------------------------------------------------------------
  // 过滤（AND/OR）
  // -------------------------------------------------------------------------

  private matches(item: ScreenerItem, req: ScreenerRequest): boolean {
    if (req.groups.length === 0) return true;
    if (req.combinator === 'AND') {
      return req.groups.every((c) => this.matchCondition(item, c.field as ScreenerField, c.op as FilterOp, c.value));
    }
    // OR
    return req.groups.some((c) => this.matchCondition(item, c.field as ScreenerField, c.op as FilterOp, c.value));
  }

  private matchCondition(
    item: ScreenerItem,
    field: ScreenerField,
    op: FilterOp,
    rawValue: unknown,
  ): boolean {
    const def = FIELD_DEFINITIONS[field];
    const itemVal = (item as any)[field];

    if (def.valueType === 'number') {
      if (typeof itemVal !== 'number' || !Number.isFinite(itemVal)) return false;
      const v = rawValue as number;
      switch (op) {
        case '>':
          return itemVal > v;
        case '<':
          return itemVal < v;
        case '>=':
          return itemVal >= v;
        case '<=':
          return itemVal <= v;
        case '=':
          return itemVal === v;
        case 'between': {
          const [lo, hi] = rawValue as [number, number];
          return itemVal >= lo && itemVal <= hi;
        }
        case 'in': {
          const arr = rawValue as number[];
          return arr.includes(itemVal);
        }
      }
      return false;
    }

    if (def.valueType === 'enum') {
      if (itemVal == null) return false;
      return op === '=' && itemVal === rawValue;
    }

    if (def.valueType === 'boolean') {
      if (typeof itemVal !== 'boolean') return false;
      if (op === '=') return itemVal === rawValue;
      return false;
    }

    return false;
  }

  // -------------------------------------------------------------------------
  // 排序
  // -------------------------------------------------------------------------

  private sortItems(items: ScreenerItem[], field: ScreenerField, order: 'asc' | 'desc'): void {
    const dir = order === 'asc' ? 1 : -1;
    items.sort((a, b) => {
      const va = (a as any)[field];
      const vb = (b as any)[field];
      // undefined 排到末尾
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') {
        return (va - vb) * dir;
      }
      if (typeof va === 'string' && typeof vb === 'string') {
        return va.localeCompare(vb) * dir;
      }
      if (typeof va === 'boolean' && typeof vb === 'boolean') {
        return ((va === vb ? 0 : va ? 1 : -1)) * dir;
      }
      return 0;
    });
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private requiresKline(groups: ScreenerRequest['groups']): boolean {
    if (groups.length === 0) return false;
    return groups.some((g) => {
      const def = FIELD_DEFINITIONS[g.field as ScreenerField];
      if (!def) return false;
      return def.dataSource === 'indicator' || def.dataSource === 'pattern_engine';
    });
  }

  /**
   * 简单信号量实现的并发 map：最多 N 个并发 worker，
   * 输入数组按序遍历；遇到背压时排到队列等待。
   */
  private async mapWithLimit<T, R>(
    inputs: readonly T[],
    limit: number,
    worker: (item: T, index: number) => Promise<R>,
  ): Promise<R[]> {
    const results: R[] = new Array(inputs.length);
    let cursor = 0;

    const runOne = async () => {
      while (true) {
        const idx = cursor++;
        if (idx >= inputs.length) return;
        try {
          results[idx] = await worker(inputs[idx]!, idx);
        } catch (e) {
          // worker 自身应 catch；这里再做兜底（返回 undefined）
          this.logger.warn(`mapWithLimit worker error at ${idx}: ${(e as Error).message}`);
        }
      }
    };

    const workers = Array.from({ length: Math.min(limit, inputs.length) }, () => runOne());
    await Promise.all(workers);
    return results;
  }

  /**
   * 缓存 key：序列化 request（去掉 page）。
   * 同一查询全集只算一次；前端翻页复用缓存。
   */
  private cacheKey(req: ScreenerRequest): string {
    const { page: _page, ...rest } = req;
    void _page;
    return JSON.stringify(rest);
  }
}
