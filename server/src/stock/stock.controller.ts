import { Controller, Get, Query } from '@nestjs/common';
import { StockService } from './stock.service';

@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get('search')
  searchStocks(@Query('q') query: string) {
    const stocks = this.stockService.searchStocks(query || '');
    return { code: 200, msg: 'success', data: stocks };
  }

  @Get('quote')
  getStockQuote(@Query('symbol') symbol: string) {
    const stock = this.stockService.getStockQuote(symbol);
    if (!stock) {
      return { code: 404, msg: '股票不存在', data: null };
    }
    return { code: 200, msg: 'success', data: stock };
  }

  @Get('kline')
  getKlineData(
    @Query('symbol') symbol: string,
    @Query('period') period: string = 'daily',
    @Query('limit') limit: string = '60',
  ) {
    const data = this.stockService.getKlineData(symbol, period, parseInt(limit) || 60);
    return { code: 200, msg: 'success', data };
  }

  @Get('list')
  getAllStocks() {
    const stocks = this.stockService.getAllStocks();
    return { code: 200, msg: 'success', data: stocks };
  }
}
