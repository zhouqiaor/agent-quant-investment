import { Injectable } from '@nestjs/common';

export interface StockInfo {
  symbol: string;
  name: string;
  market: 'A' | 'HK' | 'US';
  industry: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  pe: number;
  pb: number;
  roe: number;
  high52w: number;
  low52w: number;
}

export interface KlineData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

@Injectable()
export class StockService {
  // 模拟股票数据库（支持A股/港股/美股）
  private stockDb: Map<string, StockInfo> = new Map([
    // A股
    ['600519', { symbol: '600519', name: '贵州茅台', market: 'A', industry: '白酒', price: 1688.50, change: 12.30, changePercent: 0.73, volume: 2856000, marketCap: 2120000000000, pe: 32.5, pb: 10.8, roe: 33.2, high52w: 1850.00, low52w: 1480.00 }],
    ['000858', { symbol: '000858', name: '五粮液', market: 'A', industry: '白酒', price: 152.30, change: -1.20, changePercent: -0.78, volume: 5680000, marketCap: 590000000000, pe: 22.1, pb: 6.5, roe: 29.4, high52w: 178.00, low52w: 135.00 }],
    ['300750', { symbol: '300750', name: '宁德时代', market: 'A', industry: '新能源', price: 218.60, change: 5.80, changePercent: 2.72, volume: 12500000, marketCap: 958000000000, pe: 28.3, pb: 5.2, roe: 18.5, high52w: 258.00, low52w: 178.00 }],
    ['002594', { symbol: '002594', name: '比亚迪', market: 'A', industry: '新能源汽车', price: 268.40, change: 8.60, changePercent: 3.31, volume: 18900000, marketCap: 780000000000, pe: 25.6, pb: 4.8, roe: 18.8, high52w: 298.00, low52w: 198.00 }],
    ['601318', { symbol: '601318', name: '中国平安', market: 'A', industry: '保险', price: 48.50, change: -0.30, changePercent: -0.62, volume: 32000000, marketCap: 885000000000, pe: 8.5, pb: 1.1, roe: 13.0, high52w: 55.00, low52w: 38.00 }],
    ['600036', { symbol: '600036', name: '招商银行', market: 'A', industry: '银行', price: 35.80, change: 0.25, changePercent: 0.70, volume: 28000000, marketCap: 900000000000, pe: 6.2, pb: 0.95, roe: 15.3, high52w: 42.00, low52w: 30.00 }],
    ['000001', { symbol: '000001', name: '平安银行', market: 'A', industry: '银行', price: 12.35, change: 0.08, changePercent: 0.65, volume: 45000000, marketCap: 240000000000, pe: 5.1, pb: 0.58, roe: 11.3, high52w: 14.50, low52w: 10.20 }],
    ['601012', { symbol: '601012', name: '隆基绿能', market: 'A', industry: '光伏', price: 25.60, change: -0.80, changePercent: -3.03, volume: 22000000, marketCap: 194000000000, pe: 12.8, pb: 2.1, roe: 16.5, high52w: 38.00, low52w: 22.00 }],
    ['002475', { symbol: '002475', name: '立讯精密', market: 'A', industry: '电子', price: 35.20, change: 1.10, changePercent: 3.23, volume: 15600000, marketCap: 251000000000, pe: 28.5, pb: 4.5, roe: 15.8, high52w: 42.00, low52w: 28.00 }],
    ['600900', { symbol: '600900', name: '长江电力', market: 'A', industry: '电力', price: 28.90, change: 0.15, changePercent: 0.52, volume: 18000000, marketCap: 706000000000, pe: 22.0, pb: 4.2, roe: 19.1, high52w: 32.00, low52w: 24.00 }],
    // 港股
    ['00700', { symbol: '00700', name: '腾讯控股', market: 'HK', industry: '互联网', price: 368.40, change: 5.60, changePercent: 1.54, volume: 12800000, marketCap: 3520000000000, pe: 22.5, pb: 5.8, roe: 25.7, high52w: 420.00, low52w: 280.00 }],
    ['09988', { symbol: '09988', name: '阿里巴巴', market: 'HK', industry: '互联网', price: 82.50, change: -1.80, changePercent: -2.13, volume: 25600000, marketCap: 1680000000000, pe: 10.2, pb: 1.5, roe: 14.7, high52w: 108.00, low52w: 68.00 }],
    // 美股
    ['AAPL', { symbol: 'AAPL', name: '苹果公司', market: 'US', industry: '科技', price: 178.50, change: 2.30, changePercent: 1.30, volume: 52000000, marketCap: 2780000000000, pe: 28.5, pb: 45.2, roe: 158.7, high52w: 198.00, low52w: 143.00 }],
    ['NVDA', { symbol: 'NVDA', name: '英伟达', market: 'US', industry: '半导体', price: 485.20, change: 12.80, changePercent: 2.71, volume: 38000000, marketCap: 1190000000000, pe: 65.2, pb: 52.3, roe: 80.5, high52w: 540.00, low52w: 280.00 }],
    ['TSLA', { symbol: 'TSLA', name: '特斯拉', market: 'US', industry: '新能源汽车', price: 245.80, change: -3.50, changePercent: -1.40, volume: 42000000, marketCap: 780000000000, pe: 72.5, pb: 18.5, roe: 25.5, high52w: 299.00, low52w: 152.00 }],
  ]);

  /**
   * 搜索股票（支持代码/名称模糊搜索）
   */
  searchStocks(query: string): StockInfo[] {
    if (!query || query.trim() === '') {
      return Array.from(this.stockDb.values()).slice(0, 10);
    }
    const q = query.toLowerCase().trim();
    return Array.from(this.stockDb.values()).filter(
      (s) =>
        s.symbol.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.industry.toLowerCase().includes(q),
    );
  }

  /**
   * 获取股票详情
   */
  getStockQuote(symbol: string): StockInfo | null {
    return this.stockDb.get(symbol) || null;
  }

  /**
   * 获取K线数据（模拟）
   */
  getKlineData(symbol: string, period: string = 'daily', limit: number = 60): KlineData[] {
    const stock = this.stockDb.get(symbol);
    if (!stock) return [];

    const data: KlineData[] = [];
    const basePrice = stock.price * 0.85;
    const now = new Date();

    for (let i = limit; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      const trend = Math.sin(i / 10) * 0.1;
      const noise = (Math.random() - 0.5) * 0.05;
      const priceMultiplier = 1 + trend + noise;
      const close = basePrice * priceMultiplier;
      const open = close * (1 + (Math.random() - 0.5) * 0.02);
      const high = Math.max(open, close) * (1 + Math.random() * 0.015);
      const low = Math.min(open, close) * (1 - Math.random() * 0.015);
      const volume = Math.floor(stock.volume * (0.5 + Math.random()));

      data.push({
        date: date.toISOString().split('T')[0],
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        volume,
      });
    }

    return data;
  }

  /**
   * 获取所有支持的股票列表
   */
  getAllStocks(): StockInfo[] {
    return Array.from(this.stockDb.values());
  }
}
