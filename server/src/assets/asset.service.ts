import { Injectable } from '@nestjs/common';

@Injectable()
export class AssetService {
  private totalAssets = 125680.45;
  private initialAssets = 100000;

  getOverview() {
    const totalPnl = this.totalAssets - this.initialAssets;
    const totalPnlRate = (totalPnl / this.initialAssets) * 100;
    const todayPnl = +(Math.random() * 2000 - 500).toFixed(2);
    const todayPnlRate = +((todayPnl / this.totalAssets) * 100).toFixed(2);

    return {
      totalAssets: this.totalAssets,
      todayPnl,
      todayPnlRate,
      totalPnl: +totalPnl.toFixed(2),
      totalPnlRate: +totalPnlRate.toFixed(2),
      availableBalance: 45230.12,
      frozenBalance: 80450.33,
    };
  }

  getPositions() {
    return [
      { name: 'Bitcoin', symbol: 'BTC', value: 52340.5, percentage: 41.6, pnl: 5234.05, pnlRate: 11.12 },
      { name: 'Ethereum', symbol: 'ETH', value: 28450.3, percentage: 22.6, pnl: 2845.03, pnlRate: 11.12 },
      { name: 'Solana', symbol: 'SOL', value: 18920.8, percentage: 15.1, pnl: 3784.16, pnlRate: 25.0 },
      { name: 'Dogecoin', symbol: 'DOGE', value: 12560.2, percentage: 10.0, pnl: -628.01, pnlRate: -4.76 },
      { name: 'Chainlink', symbol: 'LINK', value: 13408.65, percentage: 10.7, pnl: 1340.87, pnlRate: 11.12 },
    ];
  }

  getPositionsDetail() {
    return [
      { symbol: 'BTC', name: 'Bitcoin', side: 'long' as const, entryPrice: 62100, currentPrice: 67542, quantity: 0.35, pnl: 1904.7, pnlRate: 8.76, margin: 10878, leverage: 5 },
      { symbol: 'ETH', name: 'Ethereum', side: 'long' as const, entryPrice: 3280, currentPrice: 3456, quantity: 5.2, pnl: 915.2, pnlRate: 5.37, margin: 8528, leverage: 2 },
      { symbol: 'SOL', name: 'Solana', side: 'long' as const, entryPrice: 155.3, currentPrice: 178.45, quantity: 60, pnl: 1389.0, pnlRate: 14.91, margin: 4659, leverage: 3 },
      { symbol: 'DOGE', name: 'Dogecoin', side: 'short' as const, entryPrice: 0.158, currentPrice: 0.1523, quantity: 50000, pnl: 285.0, pnlRate: 3.61, margin: 395, leverage: 2 },
    ];
  }
}
