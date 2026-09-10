import { Controller, Get, Post, Delete, Param, Body, Query, HttpCode, BadRequestException } from '@nestjs/common';
import { ABTestRunnerService } from './ab-test-runner.service';

@Controller('ab-test')
export class ABTestController {
  constructor(private readonly runner: ABTestRunnerService) {}

  @Post('run')
  @HttpCode(200)
  async runExperiment(@Body() body: any) {
    const { v1StrategyId, v2StrategyId, symbols, startDate, endDate, initialCapital } = body || {};
    if (!v1StrategyId || !v2StrategyId) {
      throw new BadRequestException('v1StrategyId 与 v2StrategyId 必填');
    }
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate 与 endDate 必填 (YYYY-MM-DD)');
    }
    if (!Number.isFinite(Number(initialCapital)) || Number(initialCapital) <= 0) {
      throw new BadRequestException('initialCapital 必须大于 0');
    }
    const result = await this.runner.runExperiment({
      v1StrategyId,
      v2StrategyId,
      symbols: Array.isArray(symbols) ? symbols : symbols ? [symbols] : [],
      startDate,
      endDate,
      initialCapital: Number(initialCapital),
    });
    return {
      code: 200,
      msg: 'success',
      data: {
        id: result.id,
        summary: result.summary,
        // 不在 run 响应中返回完整 equity（避免双份），前端按需单独查询
      },
    };
  }

  @Get(':id')
  @HttpCode(200)
  getExperiment(@Param('id') id: string) {
    const data = this.runner.getExperiment(id);
    if (!data) {
      return { code: 404, msg: '实验不存在', data: null };
    }
    return { code: 200, msg: 'success', data };
  }

  @Get()
  @HttpCode(200)
  listExperiments(@Query('limit') limit?: string) {
    return {
      code: 200,
      msg: 'success',
      data: this.runner.listExperiments(limit ? Number(limit) : 20),
    };
  }

  @Delete(':id')
  @HttpCode(200)
  deleteExperiment(@Param('id') id: string) {
    const success = this.runner.deleteExperiment(id);
    return {
      code: success ? 200 : 404,
      msg: success ? '已删除' : '实验不存在',
      data: { success },
    };
  }
}