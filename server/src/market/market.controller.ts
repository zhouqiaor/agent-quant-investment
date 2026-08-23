import { Controller, Get, HttpCode } from '@nestjs/common';
import { MarketService } from './market.service';

@Controller('market')
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @Get('list')
  @HttpCode(200)
  getMarketList() {
    return {
      code: 200,
      msg: 'success',
      data: this.marketService.getMarketList(),
    };
  }
}
