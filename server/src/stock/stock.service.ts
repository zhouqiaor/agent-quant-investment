import { Injectable, Logger } from '@nestjs/common';
import * as iconv from 'iconv-lite';

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
  timestamp?: string;
}

export interface KlineData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Stock metadata (industry, market cap, etc.)
const STOCK_METADATA: Record<string, Partial<StockInfo>> = {
  '600519': { industry: '白酒', market: 'A', marketCap: 2120000000000, pe: 32.5, pb: 10.8, roe: 33.2, high52w: 1850, low52w: 1480 },
  '000858': { industry: '白酒', market: 'A', marketCap: 590000000000, pe: 22.1, pb: 6.5, roe: 29.4, high52w: 178, low52w: 135 },
  '300750': { industry: '新能源', market: 'A', marketCap: 958000000000, pe: 28.3, pb: 5.2, roe: 18.5, high52w: 258, low52w: 178 },
  '002594': { industry: '新能源汽车', market: 'A', marketCap: 780000000000, pe: 25.6, pb: 4.8, roe: 18.8, high52w: 298, low52w: 198 },
  '601318': { industry: '保险', market: 'A', marketCap: 885000000000, pe: 8.5, pb: 1.1, roe: 13.0, high52w: 55, low52w: 38 },
  '600036': { industry: '银行', market: 'A', marketCap: 900000000000, pe: 6.2, pb: 0.95, roe: 15.3, high52w: 42, low52w: 30 },
  '000001': { industry: '银行', market: 'A', marketCap: 240000000000, pe: 5.1, pb: 0.58, roe: 11.3, high52w: 14.5, low52w: 10.2 },
  '601012': { industry: '光伏', market: 'A', marketCap: 194000000000, pe: 12.8, pb: 2.1, roe: 16.5, high52w: 38, low52w: 22 },
  '002475': { industry: '电子', market: 'A', marketCap: 251000000000, pe: 28.5, pb: 4.5, roe: 15.8, high52w: 42, low52w: 28 },
  '600900': { industry: '电力', market: 'A', marketCap: 706000000000, pe: 22.0, pb: 4.2, roe: 19.1, high52w: 32, low52w: 24 },
  '601888': { industry: '旅游', market: 'A', marketCap: 1680000000000, pe: 10.2, pb: 1.5, roe: 14.7, high52w: 108, low52w: 68 },
  '688981': { industry: '半导体', market: 'A', marketCap: 420000000000, pe: 45.2, pb: 3.8, roe: 8.4, high52w: 72, low52w: 42 },
  '000333': { industry: '家电', market: 'A', marketCap: 435000000000, pe: 12.5, pb: 3.2, roe: 25.6, high52w: 72, low52w: 52 },
};

// Default stock names for search
const STOCK_NAMES: Record<string, string> = {
  '600519': '贵州茅台', '000858': '五粮液', '300750': '宁德时代',
  '002594': '比亚迪', '601318': '中国平安', '600036': '招商银行',
  '000001': '平安银行', '601012': '隆基绿能', '002475': '立讯精密',
  '600900': '长江电力', '601888': '中国中免', '688981': '中芯国际',
  '000333': '美的集团', '002714': '牧原股份', '600276': '恒瑞医药',
  '000651': '格力电器', '601166': '兴业银行', '600030': '中信证券',
  '000725': '京东方A', '601899': '紫金矿业', '600887': '伊利股份',
  '002304': '洋河股份', '600809': '山西汾酒', '002352': '顺丰控股',
};

@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);
  private realtimeCache: Map<string, StockInfo> = new Map();
  private lastFetchTime = 0;
  private readonly CACHE_TTL = 5000; // 5 seconds cache

  /**
   * Fetch real-time quote from Sina Finance API
   */
  async fetchRealtimeQuote(symbol: string): Promise<StockInfo | null> {
    try {
      const code = this.getStockCode(symbol);
      const url = `https://hq.sinajs.cn/list=${code}`;
      
      const response = await fetch(url, {
        headers: {
          'Referer': 'https://finance.sina.com.cn',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (!response.ok) return null;

      // Sina API returns GBK encoded data, convert to UTF-8
      const buffer = await response.arrayBuffer();
      const text = iconv.decode(Buffer.from(buffer), 'gbk');
      const match = text.match(/hq_str_(\w+)="(.*)"/);
      if (!match || !match[2]) return null;

      const fields = match[2].split(',');
      if (fields.length < 10) return null;

      const name = fields[0];
      const open = parseFloat(fields[1]);
      const prevClose = parseFloat(fields[2]);
      const price = parseFloat(fields[3]);
      const high = parseFloat(fields[4]);
      const low = parseFloat(fields[5]);
      const volume = parseFloat(fields[8]);
      const amount = parseFloat(fields[9]);

      if (isNaN(price) || price === 0) return null;

      const change = price - prevClose;
      const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
      const metadata = STOCK_METADATA[symbol] || {};

      const stockInfo: StockInfo = {
        symbol,
        name,
        market: metadata.market || 'A',
        industry: metadata.industry || '未知',
        price: +price.toFixed(2),
        change: +change.toFixed(2),
        changePercent: +changePercent.toFixed(2),
        volume: amount,
        marketCap: metadata.marketCap || 0,
        pe: metadata.pe || 0,
        pb: metadata.pb || 0,
        roe: metadata.roe || 0,
        high52w: metadata.high52w || high,
        low52w: metadata.low52w || low,
        timestamp: new Date().toISOString(),
      };

      this.realtimeCache.set(symbol, stockInfo);
      return stockInfo;
    } catch (error) {
      this.logger.error(`Failed to fetch quote for ${symbol}: ${error.message}`);
      return this.realtimeCache.get(symbol) || null;
    }
  }

  /**
   * Fetch multiple quotes at once
   */
  async fetchRealtimeQuotes(symbols: string[]): Promise<StockInfo[]> {
    const now = Date.now();
    if (now - this.lastFetchTime < this.CACHE_TTL && this.realtimeCache.size > 0) {
      const cached = symbols.map(s => this.realtimeCache.get(s)).filter((s): s is StockInfo => s !== undefined);
      if (cached.length === symbols.length) return cached;
    }

    try {
      const codes = symbols.map(s => this.getStockCode(s));
      const url = `https://hq.sinajs.cn/list=${codes.join(',')}`;
      
      const response = await fetch(url, {
        headers: {
          'Referer': 'https://finance.sina.com.cn',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      // Sina API returns GBK encoded data, convert to UTF-8
      const buffer = await response.arrayBuffer();
      const text = iconv.decode(Buffer.from(buffer), 'gbk');
      const results: StockInfo[] = [];

      const lines = text.split('\n').filter(line => line.trim());
      for (const line of lines) {
        const match = line.match(/hq_str_(\w+)="(.*)"/);
        if (!match || !match[2]) continue;

        const [, code, dataStr] = match;
        const fields = dataStr.split(',');
        if (fields.length < 10) continue;

        const symbol = code.substring(2);
        const name = fields[0];
        const open = parseFloat(fields[1]);
        const prevClose = parseFloat(fields[2]);
        const price = parseFloat(fields[3]);
        const high = parseFloat(fields[4]);
        const low = parseFloat(fields[5]);
        const volume = parseFloat(fields[8]);
        const amount = parseFloat(fields[9]);

        if (isNaN(price) || price === 0) continue;

        const change = price - prevClose;
        const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
        const metadata = STOCK_METADATA[symbol] || {};

        const stockInfo: StockInfo = {
          symbol,
          name,
          market: metadata.market || 'A',
          industry: metadata.industry || '未知',
          price: +price.toFixed(2),
          change: +change.toFixed(2),
          changePercent: +changePercent.toFixed(2),
          volume: amount,
          marketCap: metadata.marketCap || 0,
          pe: metadata.pe || 0,
          pb: metadata.pb || 0,
          roe: metadata.roe || 0,
          high52w: metadata.high52w || high,
          low52w: metadata.low52w || low,
          timestamp: new Date().toISOString(),
        };

        results.push(stockInfo);
        this.realtimeCache.set(symbol, stockInfo);
      }

      this.lastFetchTime = now;
      this.logger.log(`Fetched ${results.length} real-time quotes`);
      return results;
    } catch (error) {
      this.logger.error(`Failed to fetch quotes: ${error.message}`);
      return symbols.map(s => this.realtimeCache.get(s)).filter((s): s is StockInfo => s !== undefined);
    }
  }

  /**
   * Convert symbol to Sina stock code
   */
  private getStockCode(symbol: string): string {
    if (symbol.startsWith('6') || symbol.startsWith('9')) {
      return `sh${symbol}`;
    }
    if (symbol.startsWith('0') || symbol.startsWith('3') || symbol.startsWith('2')) {
      return `sz${symbol}`;
    }
    return `sh${symbol}`;
  }

  /**
   * Search stocks (by code or name)
   */
  searchStocks(query: string): StockInfo[] {
    if (!query || query.trim() === '') {
      return Object.keys(STOCK_NAMES).slice(0, 10).map(symbol => ({
        symbol,
        name: STOCK_NAMES[symbol],
        market: 'A' as const,
        industry: STOCK_METADATA[symbol]?.industry || '未知',
        price: 0,
        change: 0,
        changePercent: 0,
        volume: 0,
        marketCap: STOCK_METADATA[symbol]?.marketCap || 0,
        pe: STOCK_METADATA[symbol]?.pe || 0,
        pb: STOCK_METADATA[symbol]?.pb || 0,
        roe: STOCK_METADATA[symbol]?.roe || 0,
        high52w: STOCK_METADATA[symbol]?.high52w || 0,
        low52w: STOCK_METADATA[symbol]?.low52w || 0,
      }));
    }

    const q = query.toLowerCase().trim();
    const results = Object.entries(STOCK_NAMES)
      .filter(([symbol, name]) => 
        symbol.includes(q) || name.toLowerCase().includes(q)
      )
      .map(([symbol, name]) => ({
        symbol,
        name,
        market: 'A' as const,
        industry: STOCK_METADATA[symbol]?.industry || '未知',
        price: 0,
        change: 0,
        changePercent: 0,
        volume: 0,
        marketCap: STOCK_METADATA[symbol]?.marketCap || 0,
        pe: STOCK_METADATA[symbol]?.pe || 0,
        pb: STOCK_METADATA[symbol]?.pb || 0,
        roe: STOCK_METADATA[symbol]?.roe || 0,
        high52w: STOCK_METADATA[symbol]?.high52w || 0,
        low52w: STOCK_METADATA[symbol]?.low52w || 0,
      }));

    return results;
  }

  /**
   * Get stock quote (real-time)
   */
  async getStockQuote(symbol: string): Promise<StockInfo | null> {
    return this.fetchRealtimeQuote(symbol);
  }

  /**
   * Get K-line data (simulated based on real price)
   */
  async getKlineData(symbol: string, period: string = 'daily', limit: number = 60): Promise<KlineData[]> {
    const stock = await this.fetchRealtimeQuote(symbol);
    if (!stock || stock.price === 0) return [];

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
   * Get all supported stocks
   */
  getAllStocks(): StockInfo[] {
    return Object.entries(STOCK_NAMES).map(([symbol, name]) => ({
      symbol,
      name,
      market: 'A' as const,
      industry: STOCK_METADATA[symbol]?.industry || '未知',
      price: 0,
      change: 0,
      changePercent: 0,
      volume: 0,
      marketCap: STOCK_METADATA[symbol]?.marketCap || 0,
      pe: STOCK_METADATA[symbol]?.pe || 0,
      pb: STOCK_METADATA[symbol]?.pb || 0,
      roe: STOCK_METADATA[symbol]?.roe || 0,
      high52w: STOCK_METADATA[symbol]?.high52w || 0,
      low52w: STOCK_METADATA[symbol]?.low52w || 0,
    }));
  }
}
