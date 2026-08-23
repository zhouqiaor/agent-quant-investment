import { Controller, Get, Post, Put, Delete, Param, Body, Query, HttpCode } from '@nestjs/common';
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

  // Custom Strategy CRUD
  @Get('custom')
  @HttpCode(200)
  getCustomStrategies() {
    return {
      code: 200,
      msg: 'success',
      data: this.strategyService.getCustomStrategies(),
    };
  }

  @Get('custom/:id')
  @HttpCode(200)
  getCustomStrategy(@Param('id') id: string) {
    const strategy = this.strategyService.getCustomStrategy(id);
    if (!strategy) {
      return { code: 404, msg: '策略不存在', data: null };
    }
    return {
      code: 200,
      msg: 'success',
      data: strategy,
    };
  }

  @Post('custom')
  @HttpCode(200)
  createCustomStrategy(@Body() body: Record<string, unknown>) {
    const strategy = this.strategyService.createCustomStrategy(body);
    return {
      code: 200,
      msg: '策略创建成功',
      data: strategy,
    };
  }

  @Put('custom')
  @HttpCode(200)
  updateCustomStrategy(@Body() body: Record<string, unknown>) {
    const id = body.id as string;
    if (!id) {
      return { code: 400, msg: '缺少策略ID', data: null };
    }
    const strategy = this.strategyService.updateCustomStrategy(id, body);
    if (!strategy) {
      return { code: 404, msg: '策略不存在', data: null };
    }
    return {
      code: 200,
      msg: '策略更新成功',
      data: strategy,
    };
  }

  @Delete('custom/:id')
  @HttpCode(200)
  deleteCustomStrategy(@Param('id') id: string) {
    const success = this.strategyService.deleteCustomStrategy(id);
    return {
      code: success ? 200 : 404,
      msg: success ? '策略已删除' : '策略不存在',
      data: { success },
    };
  }

  // Monitor signals
  @Get('monitor/signals')
  @HttpCode(200)
  getMonitorSignals(@Query('limit') limit?: string) {
    const signals = this.strategyService.getMonitorSignals(limit ? parseInt(limit, 10) : 10);
    return {
      code: 200,
      msg: 'success',
      data: signals,
    };
  }
}
