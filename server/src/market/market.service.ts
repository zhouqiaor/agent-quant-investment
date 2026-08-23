import { Injectable } from '@nestjs/common';

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

@Injectable()
export class MarketService {
  private marketData: MarketItem[] = [
    { symbol: 'BTC', name: 'Bitcoin', price: 67542.3, change24h: 1234.5, changePercent: 1.86, volume24h: 28500000000, high24h: 68200, low24h: 65800, isFavorite: true },
    { symbol: 'ETH', name: 'Ethereum', price: 3456.78, change24h: -45.2, changePercent: -1.29, volume24h: 15200000000, high24h: 3520, low24h: 3410, isFavorite: true },
    { symbol: 'SOL', name: 'Solana', price: 178.45, change24h: 12.3, changePercent: 7.42, volume24h: 4800000000, high24h: 182, low24h: 165, isFavorite: true },
    { symbol: 'BNB', name: 'BNB', price: 598.32, change24h: -8.7, changePercent: -1.43, volume24h: 1800000000, high24h: 610, low24h: 592, isFavorite: false },
    { symbol: 'XRP', name: 'Ripple', price: 0.6234, change24h: 0.0234, changePercent: 3.9, volume24h: 2100000000, high24h: 0.64, low24h: 0.598, isFavorite: false },
    { symbol: 'ADA', name: 'Cardano', price: 0.4567, change24h: -0.0123, changePercent: -2.62, volume24h: 680000000, high24h: 0.472, low24h: 0.448, isFavorite: false },
    { symbol: 'DOGE', name: 'Dogecoin', price: 0.1523, change24h: 0.0089, changePercent: 6.21, volume24h: 1500000000, high24h: 0.158, low24h: 0.142, isFavorite: true },
    { symbol: 'AVAX', name: 'Avalanche', price: 35.67, change24h: 2.13, changePercent: 6.36, volume24h: 890000000, high24h: 36.5, low24h: 33.2, isFavorite: false },
    { symbol: 'DOT', name: 'Polkadot', price: 7.234, change24h: -0.345, changePercent: -4.56, volume24h: 420000000, high24h: 7.62, low24h: 7.1, isFavorite: false },
    { symbol: 'LINK', name: 'Chainlink', price: 14.56, change24h: 0.89, changePercent: 6.51, volume24h: 780000000, high24h: 14.9, low24h: 13.5, isFavorite: false },
    { symbol: 'MATIC', name: 'Polygon', price: 0.7823, change24h: -0.0234, changePercent: -2.9, volume24h: 560000000, high24h: 0.81, low24h: 0.77, isFavorite: false },
    { symbol: 'UNI', name: 'Uniswap', price: 9.876, change24h: 0.456, changePercent: 4.84, volume24h: 340000000, high24h: 10.1, low24h: 9.3, isFavorite: false },
  ];

  getMarketList(): MarketItem[] {
    // Simulate real-time price fluctuation
    return this.marketData.map((item) => ({
      ...item,
      price: +(item.price * (1 + (Math.random() - 0.5) * 0.002)).toFixed(
        item.price > 100 ? 2 : item.price > 1 ? 4 : 6,
      ),
      change24h: +(item.change24h * (1 + (Math.random() - 0.5) * 0.01)).toFixed(4),
      changePercent: +(item.changePercent + (Math.random() - 0.5) * 0.1).toFixed(2),
    }));
  }
}
