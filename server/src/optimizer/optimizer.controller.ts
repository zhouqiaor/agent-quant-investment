import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { OptimizerService } from './optimizer.service';

@Controller('optimizer')
export class OptimizerController {
  constructor(private readonly optimizer: OptimizerService) {}

  @HttpCode(200)
  @Post('run')
  async run(@Body() body: any) {
    const result = await this.optimizer.optimize(body);
    return { code: 200, msg: 'success', data: result };
  }

  @Get('history')
  async history() {
    const data = await this.optimizer.getHistory();
    return { code: 200, msg: 'success', data };
  }

  @Get('history/:id')
  async detail(@Param('id') id: string) {
    const data = await this.optimizer.getOptimization(id);
    return { code: 200, msg: 'success', data };
  }
}
