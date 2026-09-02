import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { StockService } from './stock.service';

@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  /** 添加自定义股票（A股6位代码，名称可自定义） */
  @Post('custom')
  @HttpCode(200)
  async addCustomStock(@Body() body?: { symbol?: string; name?: string }) {
    const b = body ?? {};
    const stock = await this.stockService.addCustomStock(b.symbol || '', b.name);
    return { code: 200, msg: 'success', data: stock };
  }

  @Get('custom')
  listCustomStocks() {
    const stocks = this.stockService.listCustomStocks();
    return { code: 200, msg: 'success', data: stocks };
  }

  @Delete('custom/:symbol')
  removeCustomStock(@Param('symbol') symbol: string) {
    const ok = this.stockService.removeCustomStock(symbol);
    return { code: 200, msg: ok ? 'success' : 'not found', data: { removed: ok } };
  }

  @Get('search')
  async searchStocks(@Query('q') query: string) {
    const stocks = await this.stockService.searchStocks(query || '');
    return { code: 200, msg: 'success', data: stocks };
  }

  /** 手动触发全量股票目录同步（沪深A+北交所），默认24h内跳过，force=true 强制 */
  @Post('sync')
  @HttpCode(200)
  async syncDirectory(@Body() body?: { force?: boolean }) {
    const result = await this.stockService.syncAllStocks(body?.force === true);
    return { code: 200, msg: 'success', data: result };
  }

  @Get('quote')
  async getStockQuote(@Query('symbol') symbol: string) {
    const stock = await this.stockService.getStockQuote(symbol);
    if (!stock) {
      return { code: 404, msg: '股票不存在或数据获取失败', data: null };
    }
    return { code: 200, msg: 'success', data: stock };
  }

  @Get('kline')
  async getKlineData(
    @Query('symbol') symbol: string,
    @Query('period') period: string = 'daily',
    @Query('limit') limit: string = '60',
  ) {
    const data = await this.stockService.getKlineData(symbol, period, parseInt(limit) || 60);
    return { code: 200, msg: 'success', data };
  }

  @Get('list')
  getAllStocks() {
    const stocks = this.stockService.getAllStocks();
    return { code: 200, msg: 'success', data: stocks };
  }
}
