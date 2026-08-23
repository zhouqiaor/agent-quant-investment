import { Controller, Get, Query, HttpCode } from '@nestjs/common';
import { TradeService } from './trade.service';

@Controller('trades')
export class TradeController {
  constructor(private readonly tradeService: TradeService) {}

  @Get('history')
  @HttpCode(200)
  getTradeHistory(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return {
      code: 200,
      msg: 'success',
      data: this.tradeService.getTradeHistory(limitNum),
    };
  }
}
