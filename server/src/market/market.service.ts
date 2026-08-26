import { Injectable, Logger } from '@nestjs/common';
import { StrategyService } from '../strategy/strategy.service';
import * as iconv from 'iconv-lite';

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
  open: number;
  prevClose: number;
  timestamp: string;
}

// Default watchlist stocks
const DEFAULT_WATCHLIST = [
  { symbol: '600519', name: '贵州茅台', market: 'sh' },
  { symbol: '000858', name: '五粮液', market: 'sz' },
  { symbol: '601318', name: '中国平安', market: 'sh' },
  { symbol: '000333', name: '美的集团', market: 'sz' },
  { symbol: '600036', name: '招商银行', market: 'sh' },
  { symbol: '000001', name: '平安银行', market: 'sz' },
  { symbol: '601888', name: '中国中免', market: 'sh' },
  { symbol: '300750', name: '宁德时代', market: 'sz' },
  { symbol: '600900', name: '长江电力', market: 'sh' },
  { symbol: '002594', name: '比亚迪', market: 'sz' },
  { symbol: '601012', name: '隆基绿能', market: 'sh' },
  { symbol: '688981', name: '中芯国际', market: 'sh' },
];

// Favorite stocks (user can customize)
const FAVORITE_SYMBOLS = ['600519', '000858', '601318', '300750', '002594', '601888'];

@Injectable()
export class MarketService {
  private readonly logger = new Logger(MarketService.name);
  private cache: Map<string, MarketItem> = new Map();
  private lastFetchTime = 0;
  private readonly CACHE_TTL = 5000; // 5 seconds cache

  constructor(private readonly strategyService: StrategyService) {}

  /**
   * Fetch real-time market data from Sina Finance API
   */
  async fetchRealtimeData(symbols: string[] = []): Promise<MarketItem[]> {
    const now = Date.now();
    
    // Use cache if fresh enough
    if (now - this.lastFetchTime < this.CACHE_TTL && this.cache.size > 0) {
      return Array.from(this.cache.values());
    }

    try {
      // Build stock code list for Sina API
      const stockList = symbols.length > 0 
        ? symbols.map(s => this.getStockCode(s))
        : DEFAULT_WATCHLIST.map(s => `${s.market}${s.symbol}`);

      const url = `https://hq.sinajs.cn/list=${stockList.join(',')}`;
      
      const response = await fetch(url, {
        headers: {
          'Referer': 'https://finance.sina.com.cn',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Sina API returns GBK encoded data, convert to UTF-8
      const buffer = await response.arrayBuffer();
      const text = iconv.decode(Buffer.from(buffer), 'gbk');
      const data = this.parseSinaResponse(text);
      
      // Update cache
      data.forEach(item => this.cache.set(item.symbol, item));
      this.lastFetchTime = now;

      // Trigger monitoring engine check
      this.strategyService.checkMonitorSignals(
        data.map(d => ({ symbol: d.symbol, price: d.price, changePercent: d.changePercent })),
      );

      this.logger.log(`Fetched ${data.length} stocks from Sina Finance`);
      return data;
    } catch (error) {
      this.logger.error(`Failed to fetch market data: ${error.message}`);
      
      // Return cached data if available
      if (this.cache.size > 0) {
        return Array.from(this.cache.values());
      }
      
      // Return fallback data
      return this.getFallbackData();
    }
  }

  /**
   * Parse Sina Finance API response
   * Format: var hq_str_sh600519="贵州茅台,开盘价,昨收,当前价,最高,最低,买一,卖一,成交量,成交额,...";
   */
  private parseSinaResponse(text: string): MarketItem[] {
    const lines = text.split('\n').filter(line => line.trim());
    const result: MarketItem[] = [];

    for (const line of lines) {
      const match = line.match(/hq_str_(\w+)="(.*)"/);
      if (!match) continue;

      const [, code, dataStr] = match;
      if (!dataStr) continue;

      const fields = dataStr.split(',');
      if (fields.length < 10) continue;

      const symbol = code.substring(2); // Remove 'sh' or 'sz' prefix
      const name = fields[0];
      const open = parseFloat(fields[1]);
      const prevClose = parseFloat(fields[2]);
      const price = parseFloat(fields[3]);
      const high = parseFloat(fields[4]);
      const low = parseFloat(fields[5]);
      const volume = parseFloat(fields[8]); // Volume in shares
      const amount = parseFloat(fields[9]); // Amount in yuan

      if (isNaN(price) || price === 0) continue;

      const change = price - prevClose;
      const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

      result.push({
        symbol,
        name,
        price: +price.toFixed(2),
        change24h: +change.toFixed(2),
        changePercent: +changePercent.toFixed(2),
        volume24h: amount,
        high24h: +high.toFixed(2),
        low24h: +low.toFixed(2),
        isFavorite: FAVORITE_SYMBOLS.includes(symbol),
        open: +open.toFixed(2),
        prevClose: +prevClose.toFixed(2),
        timestamp: new Date().toISOString(),
      });
    }

    return result;
  }

  /**
   * Convert symbol to Sina stock code
   */
  private getStockCode(symbol: string): string {
    // A-shares: 6xx = Shanghai, 0xx/3xx = Shenzhen
    if (symbol.startsWith('6') || symbol.startsWith('9')) {
      return `sh${symbol}`;
    }
    if (symbol.startsWith('0') || symbol.startsWith('3') || symbol.startsWith('2')) {
      return `sz${symbol}`;
    }
    // Default to Shanghai
    return `sh${symbol}`;
  }

  /**
   * Fallback data when API is unavailable
   */
  private getFallbackData(): MarketItem[] {
    return DEFAULT_WATCHLIST.map(stock => ({
      symbol: stock.symbol,
      name: stock.name,
      price: 0,
      change24h: 0,
      changePercent: 0,
      volume24h: 0,
      high24h: 0,
      low24h: 0,
      isFavorite: FAVORITE_SYMBOLS.includes(stock.symbol),
      open: 0,
      prevClose: 0,
      timestamp: new Date().toISOString(),
    }));
  }

  /**
   * Get market list (legacy method for backward compatibility)
   */
  getMarketList(): MarketItem[] {
    // Return cached data or empty array
    if (this.cache.size > 0) {
      return Array.from(this.cache.values());
    }
    return this.getFallbackData();
  }

  /**
   * Get single stock quote
   */
  async getQuote(symbol: string): Promise<MarketItem | null> {
    const data = await this.fetchRealtimeData([symbol]);
    return data.find(d => d.symbol === symbol) || null;
  }

  /**
   * Get favorite stocks
   */
  async getFavorites(): Promise<MarketItem[]> {
    const allData = await this.fetchRealtimeData();
    return allData.filter(d => d.isFavorite);
  }

  /**
   * Get top gainers
   */
  async getTopGainers(limit = 10): Promise<MarketItem[]> {
    const data = await this.fetchRealtimeData();
    return data
      .filter(d => d.changePercent > 0)
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, limit);
  }

  /**
   * Get top losers
   */
  async getTopLosers(limit = 10): Promise<MarketItem[]> {
    const data = await this.fetchRealtimeData();
    return data
      .filter(d => d.changePercent < 0)
      .sort((a, b) => a.changePercent - b.changePercent)
      .slice(0, limit);
  }
}
