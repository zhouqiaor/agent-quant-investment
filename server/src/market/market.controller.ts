import { Controller, Get, Query, HttpCode } from '@nestjs/common';
import { MarketService } from './market.service';

@Controller('market')
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @Get('list')
  @HttpCode(200)
  async getMarketList() {
    const data = await this.marketService.fetchRealtimeData();
    return {
      code: 200,
      msg: 'success',
      data,
    };
  }

  @Get('quote')
  @HttpCode(200)
  async getQuote(@Query('symbol') symbol: string) {
    if (!symbol) {
      return { code: 400, msg: 'symbol is required', data: null };
    }
    const data = await this.marketService.getQuote(symbol);
    return {
      code: 200,
      msg: 'success',
      data,
    };
  }

  @Get('favorites')
  @HttpCode(200)
  async getFavorites() {
    const data = await this.marketService.getFavorites();
    return {
      code: 200,
      msg: 'success',
      data,
    };
  }

  @Get('gainers')
  @HttpCode(200)
  async getTopGainers(@Query('limit') limit?: string) {
    const data = await this.marketService.getTopGainers(limit ? parseInt(limit) : 10);
    return {
      code: 200,
      msg: 'success',
      data,
    };
  }

  @Get('losers')
  @HttpCode(200)
  async getTopLosers(@Query('limit') limit?: string) {
    const data = await this.marketService.getTopLosers(limit ? parseInt(limit) : 10);
    return {
      code: 200,
      msg: 'success',
      data,
    };
  }
}
