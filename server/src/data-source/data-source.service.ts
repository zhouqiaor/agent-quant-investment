import { Injectable, Logger } from '@nestjs/common';
import { PersistenceService } from '../persistence/persistence.service';
import { StockService } from '../stock/stock.service';

export interface DataSourceInfo {
  key: 'realtime_quote' | 'history_kline' | 'stock_directory';
  label: string;
  status: 'live' | 'cached' | 'unavailable';
  description: string;
  primaryUrl: string;
  fallbackUrl?: string;
  lastUpdate?: string | null;
  meta?: Record<string, any>;
}

/**
 * 数据来源聚合服务
 * - 探测三大数据源的实时状态
 * - 为前端「数据来源说明」卡片 + 徽标 + 弹层提供数据
 */
@Injectable()
export class DataSourceService {
  private readonly logger = new Logger(DataSourceService.name);
  /** 探测超时（毫秒）：超过即视为不可用 */
  private static readonly PROBE_TIMEOUT_MS = 3000;

  constructor(
    private readonly persistence: PersistenceService,
    private readonly stockService: StockService,
  ) {}

  async getDataSources(): Promise<{ sources: DataSourceInfo[]; updatedAt: string }> {
    const sources: DataSourceInfo[] = [];

    // 1. 实时行情（腾讯 qt.gtimg.cn）
    sources.push(await this.probeRealtimeQuote());

    // 2. 历史K线（腾讯 fqkline → 新浪降级 → SQLite 缓存）
    sources.push(await this.probeHistoryKline());

    // 3. 全量股票目录
    sources.push(await this.probeStockDirectory());

    return { sources, updatedAt: new Date().toISOString() };
  }

  private async probeRealtimeQuote(): Promise<DataSourceInfo> {
    const info: DataSourceInfo = {
      key: 'realtime_quote',
      label: '实时行情',
      status: 'live',
      description: '股票当前价格、涨跌幅等实时快照。',
      primaryUrl: 'https://qt.gtimg.cn/q=sh600519',
    };
    try {
      const probe = await this.probeUrl('https://qt.gtimg.cn/q=sh600519');
      if (!probe.ok) {
        info.status = 'unavailable';
      } else {
        info.lastUpdate = new Date().toISOString();
      }
    } catch {
      info.status = 'unavailable';
    }
    return info;
  }

  private async probeHistoryKline(): Promise<DataSourceInfo> {
    const info: DataSourceInfo = {
      key: 'history_kline',
      label: '历史K线',
      status: 'live',
      description: '回测所需的真实历史日线。',
      primaryUrl: 'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get',
      fallbackUrl: 'https://quotes.sina.cn/cn/api/jsonp_v2.php/CN_MarketDataService.getKLineData',
    };
    // 优先探测腾讯
    try {
      const tencentProbe = await this.probeUrl(
        'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=sh600519,2024-01-01,2024-01-05,640,qfq',
      );
      if (tencentProbe.ok) {
        info.status = 'live';
      } else {
        info.status = 'unavailable';
      }
    } catch {
      info.status = 'unavailable';
    }
    // 缓存数据信息
    try {
      const cached = this.persistence.getHistoryKlineRangeStats();
      if (cached.totalRows > 0) {
        info.meta = {
          cachedSymbols: cached.symbolCount,
          totalRows: cached.totalRows,
          oldestDate: cached.oldestDate,
          newestDate: cached.newestDate,
        };
        // 即使主源暂时不可用，仍是 cached 状态
        if (info.status === 'unavailable') {
          info.status = 'cached';
        }
      }
    } catch {
      // 忽略持久化探测错误
    }
    return info;
  }

  private async probeStockDirectory(): Promise<DataSourceInfo> {
    const info: DataSourceInfo = {
      key: 'stock_directory',
      label: '全量股票目录',
      status: 'cached',
      description: '沪深两市全量股票代码 + 名称映射，用于选股和搜索。',
      primaryUrl: 'https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=5000',
      fallbackUrl: 'https://www.shdjt.com/js/lib/stockdata_hs.js',
    };
    try {
      const stats = this.persistence.getDirectoryStats();
      info.meta = {
        totalCount: stats.count,
        lastSyncAt: stats.lastSyncAt,
      };
      info.lastUpdate = stats.lastSyncAt;
      if (stats.count === 0) {
        info.status = 'unavailable';
      }
    } catch {
      info.status = 'unavailable';
    }
    return info;
  }

  /** 通过 HEAD-like 请求探测 URL 是否可达（实际用范围请求兼容跨域） */
  private async probeUrl(url: string): Promise<{ ok: boolean; status: number }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DataSourceService.PROBE_TIMEOUT_MS);
    try {
      const resp = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      return { ok: resp.ok, status: resp.status };
    } catch {
      return { ok: false, status: 0 };
    } finally {
      clearTimeout(timer);
    }
  }
}