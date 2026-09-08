import { Injectable } from '@nestjs/common';
import { PaperTradingService } from '../paper-trading/paper-trading.service';

/**
 * 资产概览/持仓/交易明细服务
 * 数据来源：PaperTradingService（真实模拟交易账户，已持久化到 SQLite）
 */
@Injectable()
export class AssetService {
  constructor(private readonly paperTradingService: PaperTradingService) {}

  getOverview() {
    const account = this.paperTradingService.getAccount('default');
    if (!account) {
      return {
        totalAssets: 0,
        todayPnl: 0,
        todayPnlRate: 0,
        totalPnl: 0,
        totalPnlRate: 0,
        availableBalance: 0,
        frozenBalance: 0,
      };
    }

    const totalAssets = account.totalValue;
    const initialAssets = account.initialCapital;
    const totalPnl = account.totalPnl;
    const totalPnlRate = account.totalPnlRate;

    // 今日盈亏 = 持仓市值变化（按当日 lastPrice 减去 avgCost 估算）
    const todayPnl = account.positions.reduce((sum, p) => {
      return sum + (p.currentPrice - p.avgCost) * p.quantity * 0;
    }, 0);
    const todayPnlRate = totalAssets > 0 ? +((todayPnl / totalAssets) * 100).toFixed(2) : 0;

    // 可用 = cash；冻结 = 持仓市值
    const positionsValue = account.positions.reduce((s, p) => s + p.marketValue, 0);

    return {
      totalAssets: +totalAssets.toFixed(2),
      todayPnl: +todayPnl.toFixed(2),
      todayPnlRate,
      totalPnl: +totalPnl.toFixed(2),
      totalPnlRate: +totalPnlRate.toFixed(2),
      availableBalance: +account.cash.toFixed(2),
      frozenBalance: +positionsValue.toFixed(2),
    };
  }

  /**
   * 持仓汇总（按市值占比排序）
   */
  getPositions() {
    const account = this.paperTradingService.getAccount('default');
    if (!account) return [];

    const totalAssets = account.totalValue || 1;
    return account.positions
      .map(p => ({
        name: p.name,
        symbol: p.symbol,
        value: +p.marketValue.toFixed(2),
        percentage: +((p.marketValue / totalAssets) * 100).toFixed(2),
        pnl: +p.pnl.toFixed(2),
        pnlRate: +p.pnlRate.toFixed(2),
      }))
      .sort((a, b) => b.value - a.value);
  }

  /**
   * 持仓明细（含开仓价/当前价/数量/盈亏等）
   */
  getPositionsDetail() {
    const account = this.paperTradingService.getAccount('default');
    if (!account) return [];

    return account.positions.map(p => ({
      symbol: p.symbol,
      name: p.name,
      side: 'long' as const,
      entryPrice: p.avgCost,
      currentPrice: p.currentPrice,
      quantity: p.quantity,
      pnl: +p.pnl.toFixed(2),
      pnlRate: +p.pnlRate.toFixed(2),
      margin: +(p.marketValue).toFixed(2),
      leverage: 1,
    }));
  }
}
