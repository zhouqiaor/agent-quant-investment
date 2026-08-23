import { Controller, Get, Post, Param, HttpCode } from '@nestjs/common';
import { StrategyService } from './strategy.service';

@Controller('strategies')
export class StrategyController {
  constructor(private readonly strategyService: StrategyService) {}

  @Get()
  @HttpCode(200)
  getStrategies() {
    return {
      code: 200,
      msg: 'success',
      data: this.strategyService.getStrategies(),
    };
  }

  @Post(':id/start')
  @HttpCode(200)
  startStrategy(@Param('id') id: string) {
    const result = this.strategyService.toggleStrategy(id, 'start');
    return {
      code: 200,
      msg: 'success',
      data: result,
    };
  }

  @Post(':id/stop')
  @HttpCode(200)
  stopStrategy(@Param('id') id: string) {
    const result = this.strategyService.toggleStrategy(id, 'stop');
    return {
      code: 200,
      msg: 'success',
      data: result,
    };
  }
}
