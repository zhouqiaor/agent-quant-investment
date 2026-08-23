import { Injectable } from '@nestjs/common';
import { StrategyService } from '../strategy/strategy.service';

export interface MarketItem {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  changePercent: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  isFavorite: boolean;
}

// Stock market data (A-shares)
const STOCK_MARKET_DATA: MarketItem[] = [
  { symbol: '600519', name: '贵州茅台', price: 1688.50, change24h: 12.30, changePercent: 0.73, volume24h: 3200000000, high24h: 1695, low24h: 1672, isFavorite: true },
  { symbol: '000858', name: '五粮液', price: 148.62, change24h: -2.18, changePercent: -1.45, volume24h: 1800000000, high24h: 152.5, low24h: 147.8, isFavorite: true },
  { symbol: '601318', name: '中国平安', price: 48.35, change24h: 0.85, changePercent: 1.79, volume24h: 2500000000, high24h: 48.9, low24h: 47.2, isFavorite: true },
  { symbol: '000333', name: '美的集团', price: 62.18, change24h: -0.92, changePercent: -1.46, volume24h: 1500000000, high24h: 63.5, low24h: 61.8, isFavorite: false },
  { symbol: '600036', name: '招商银行', price: 35.42, change24h: 0.38, changePercent: 1.08, volume24h: 1200000000, high24h: 35.8, low24h: 34.9, isFavorite: false },
  { symbol: '000001', name: '平安银行', price: 11.85, change24h: -0.15, changePercent: -1.25, volume24h: 980000000, high24h: 12.05, low24h: 11.78, isFavorite: false },
  { symbol: '601888', name: '中国中免', price: 78.92, change24h: 2.34, changePercent: 3.05, volume24h: 2100000000, high24h: 79.5, low24h: 76.2, isFavorite: true },
  { symbol: '300750', name: '宁德时代', price: 198.56, change24h: -5.44, changePercent: -2.67, volume24h: 4500000000, high24h: 205.2, low24h: 196.8, isFavorite: true },
  { symbol: '600900', name: '长江电力', price: 28.76, change24h: 0.22, changePercent: 0.77, volume24h: 680000000, high24h: 28.95, low24h: 28.48, isFavorite: false },
  { symbol: '002594', name: '比亚迪', price: 265.30, change24h: 8.70, changePercent: 3.39, volume24h: 5200000000, high24h: 268.5, low24h: 255.8, isFavorite: true },
  { symbol: '601012', name: '隆基绿能', price: 22.45, change24h: -0.68, changePercent: -2.94, volume24h: 1100000000, high24h: 23.2, low24h: 22.18, isFavorite: false },
  { symbol: '688981', name: '中芯国际', price: 52.80, change24h: 1.56, changePercent: 3.04, volume24h: 3800000000, high24h: 53.2, low24h: 51.1, isFavorite: false },
];

@Injectable()
export class MarketService {
  constructor(private readonly strategyService: StrategyService) {}

  getMarketList(): MarketItem[] {
    // Simulate real-time price fluctuation
    const data = STOCK_MARKET_DATA.map((item) => ({
      ...item,
      price: +(item.price * (1 + (Math.random() - 0.5) * 0.002)).toFixed(
        item.price > 100 ? 2 : item.price > 10 ? 2 : 4,
      ),
      change24h: +(item.change24h * (1 + (Math.random() - 0.5) * 0.01)).toFixed(4),
      changePercent: +(item.changePercent + (Math.random() - 0.5) * 0.1).toFixed(2),
    }));

    // Trigger monitoring engine check
    this.strategyService.checkMonitorSignals(
      data.map((d) => ({ symbol: d.symbol, price: d.price, changePercent: d.changePercent })),
    );

    return data;
  }
}
