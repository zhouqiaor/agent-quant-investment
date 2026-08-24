import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { PaperTradingService } from './paper-trading.service';

@Controller('paper-trading')
export class PaperTradingController {
  constructor(private readonly paperTradingService: PaperTradingService) {}

  @Get('account')
  getAccount(@Query('accountId') accountId?: string) {
    const account = this.paperTradingService.getAccount(accountId);
    return {
      code: 200,
      msg: 'success',
      data: {
        ...account,
        positions: account.positions.map(p => ({
          ...p,
          pnl: Math.round(p.pnl * 100) / 100,
          pnlRate: Math.round(p.pnlRate * 100) / 100,
        })),
        totalPnl: Math.round(account.totalPnl * 100) / 100,
        totalPnlRate: Math.round(account.totalPnlRate * 100) / 100,
      },
    };
  }

  @Post('reset')
  resetAccount(@Body() body: { accountId?: string; initialCapital?: number }) {
    const account = this.paperTradingService.resetAccount(body.accountId, body.initialCapital);
    return {
      code: 200,
      msg: 'success',
      data: account,
    };
  }

  @Post('start')
  startTrading(@Body() body: { accountId?: string; strategyIds?: string[] }) {
    const account = this.paperTradingService.startTrading(body.accountId, body.strategyIds);
    return {
      code: 200,
      msg: 'success',
      data: { isRunning: account.isRunning, message: '模拟交易已启动' },
    };
  }

  @Post('stop')
  stopTrading(@Body() body: { accountId?: string }) {
    const account = this.paperTradingService.stopTrading(body.accountId);
    return {
      code: 200,
      msg: 'success',
      data: { isRunning: account.isRunning, message: '模拟交易已停止' },
    };
  }

  @Get('positions')
  getPositions(@Query('accountId') accountId?: string) {
    const positions = this.paperTradingService.getPositions(accountId);
    return {
      code: 200,
      msg: 'success',
      data: positions.map(p => ({
        ...p,
        pnl: Math.round(p.pnl * 100) / 100,
        pnlRate: Math.round(p.pnlRate * 100) / 100,
      })),
    };
  }

  @Get('trades')
  getTrades(@Query('accountId') accountId?: string, @Query('limit') limit?: string) {
    const trades = this.paperTradingService.getTrades(accountId, limit ? parseInt(limit) : 20);
    return {
      code: 200,
      msg: 'success',
      data: trades,
    };
  }

  @Post('execute')
  executeSignal(@Body() body: {
    accountId?: string;
    type: 'BUY' | 'SELL';
    symbol: string;
    name: string;
    price: number;
    reason: string;
    strategyId: string;
  }) {
    const result = this.paperTradingService.executeSignal(body, body.accountId);
    return {
      code: 200,
      msg: 'success',
      data: result,
    };
  }

  @Post('simulate')
  async simulateAutoTrading(@Body() body: { accountId?: string }) {
    const result = await this.paperTradingService.simulateAutoTrading(body.accountId);
    return {
      code: 200,
      msg: 'success',
      data: result,
    };
  }
}
