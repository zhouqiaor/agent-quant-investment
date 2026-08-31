import { BadRequestException, Injectable } from '@nestjs/common';
import { STOCK_NAMES } from './stock.service';
import { PersistenceService } from '../persistence/persistence.service';

export interface WatchItem {
  symbol: string;
  name: string;
  enabled: boolean;
  createdAt: number;
}

/**
 * 关注列表服务（SPEC-beta 2.1）
 * 用户从零配置时关注股票，并逐只开关「参与投资」。
 * 与自定义股票联动：添加关注自动写入 custom_stocks，保证搜索/回测可见。
 */
@Injectable()
export class WatchlistService {
  constructor(private readonly persistence: PersistenceService) {}

  addWatch(symbol: string, name?: string, enabled = true): WatchItem {
    const code = (symbol || '').trim().toUpperCase();
    if (!/^[036][0-9]{5}$/.test(code)) {
      throw new BadRequestException(`无效的股票代码: ${code}（仅支持A股6位代码，6/0/3开头）`);
    }
    const stockName = (name || '').trim() || this.resolveName(code);
    const existing = this.persistence.listWatches().find((w) => w.symbol === code);
    // createdAt 单调递增（同毫秒多次添加也能保证稳定排序）
    const maxCreated = this.persistence.listWatches().reduce((m, w) => Math.max(m, w.createdAt), 0);
    const createdAt = existing?.createdAt || Math.max(Date.now(), maxCreated + 1);
    this.persistence.saveWatch({ symbol: code, name: stockName, enabled, createdAt });
    // 联动：确保自定义股票库中有该标的（幂等，不覆盖已有名称）
    if (!this.persistence.listCustomStocks().some((s) => s.symbol === code)) {
      this.persistence.saveCustomStock({ symbol: code, name: stockName, market: 'A', createdAt });
    }
    return { symbol: code, name: stockName, enabled, createdAt };
  }

  toggleWatch(symbol: string, enabled: boolean): WatchItem {
    const code = (symbol || '').trim().toUpperCase();
    const ok = this.persistence.updateWatchEnabled(code, enabled);
    if (!ok) {
      throw new BadRequestException(`关注列表中不存在: ${code}`);
    }
    const item = this.persistence.listWatches().find((w) => w.symbol === code)!;
    return item;
  }

  removeWatch(symbol: string): boolean {
    return this.persistence.deleteWatch((symbol || '').trim().toUpperCase());
  }

  listWatch(): WatchItem[] {
    const all = this.persistence.listWatches();
    return all.sort((a, b) => {
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      return b.createdAt - a.createdAt;
    });
  }

  getEnabledSymbols(): string[] {
    return this.persistence.listWatches().filter((w) => w.enabled).map((w) => w.symbol);
  }

  private resolveName(code: string): string {
    return STOCK_NAMES[code] || code;
  }
}
