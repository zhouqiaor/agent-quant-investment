import { Body, Controller, Get, HttpCode, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { BacktestService } from './backtest.service';
import { PortfolioBacktestService } from './portfolio-backtest.service';

@Controller('backtest')
export class BacktestController {
  constructor(
    private readonly backtestService: BacktestService,
    private readonly portfolioBacktestService: PortfolioBacktestService,
  ) {}

  @HttpCode(200)
  @Post('run')
  async runBacktest(@Body() body: {
    strategyId?: string;
    symbol: string;
    startDate: string;
    endDate: string;
    initialCapital: number;
    indicators?: string[];
    buyConditions?: any[];
    sellConditions?: any[];
  }) {
    const result = await this.backtestService.runBacktest(body);
    return {
      code: 200,
      msg: 'success',
      data: result,
    };
  }

  @Get('quick')
  async quickBacktest(
    @Query('symbol') symbol: string,
    @Query('days') days: string = '90',
    @Query('capital') capital: string = '100000',
  ) {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    const startDateStr = startDate.toISOString().split('T')[0];

    const result = await this.backtestService.runBacktest({
      symbol,
      startDate: startDateStr,
      endDate,
      initialCapital: parseInt(capital),
      indicators: ['MA', 'MACD'],
    });

    return {
      code: 200,
      msg: 'success',
      data: result,
    };
  }

  /**
   * 全局组合回测（方案B 共享资金池账户回放）
   * 覆盖关注列表全部股票 + 各自策略 + 共享资金池，用真实历史行情回放
   */
  @HttpCode(200)
  @Post('portfolio')
  async runPortfolioBacktest(@Body() body: {
    initialCapital?: number;
    symbols?: string[];
    startDate: string;
    endDate: string;
    autoTrade?: boolean;
  }) {
    const result = await this.portfolioBacktestService.runPortfolioBacktest({
      initialCapital: body.initialCapital ?? 100000,
      symbols: body.symbols,
      startDate: body.startDate,
      endDate: body.endDate,
      autoTrade: body.autoTrade ?? true,
    });
    return {
      code: 200,
      msg: 'success',
      data: result,
    };
  }
}
