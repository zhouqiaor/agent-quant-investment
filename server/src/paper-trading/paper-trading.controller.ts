import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
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

  /**
   * 一致性对账：重建指定账户的 positions（按 trades 历史）
   * 用于修复"交易记录跟持仓不匹配"等历史脏数据问题
   */
  @Post('reconcile')
  @HttpCode(200)
  reconcile(@Query('accountId') accountId?: string) {
    const result = this.paperTradingService.reconcilePositionsForAccount(accountId);
    return {
      code: 200,
      msg: result.fixed ? '已对账' : '无需对账（数据已一致）',
      data: result,
    };
  }

  /**
   * 列出所有模拟账户（实盘 + 回测）
   */
  @Get('accounts')
  listAccounts() {
    const accounts = this.paperTradingService.listAccounts();
    return {
      code: 200,
      msg: 'success',
      data: accounts.map(a => ({
        ...a,
        totalPnl: Math.round(a.totalPnl * 100) / 100,
        totalPnlRate: Math.round(a.totalPnlRate * 100) / 100,
        totalValue: Math.round(a.totalValue * 100) / 100,
      })),
    };
  }

  /**
   * 创建新账户（用于回测前手动指定目标账户）
   */
  @HttpCode(200)
  @Post('accounts/create')
  createAccount(@Body() body: {
    accountId: string;
    name?: string;
    type?: 'live' | 'backtest';
    initialCapital?: number;
    meta?: any;
  }) {
    if (!body.accountId) {
      return { code: 400, msg: 'accountId 必填' };
    }
    const account = this.paperTradingService.ensureAccount(body.accountId, {
      name: body.name,
      type: body.type,
      initialCapital: body.initialCapital,
      meta: body.meta,
    });
    return { code: 200, msg: 'success', data: { id: account.id, name: account.name, type: account.type } };
  }

  /**
   * 删除账户（包括其持仓和交易）
   */
  @HttpCode(200)
  @Delete('accounts/:id')
  deleteAccount(@Param('id') id: string) {
    this.paperTradingService.removeAccount(id);
    return { code: 200, msg: 'success', data: { id } };
  }

  @HttpCode(200)
  @Post('reset')
  resetAccount(@Body() body?: { accountId?: string; initialCapital?: number }) {
    const b = body ?? {};
    const account = this.paperTradingService.resetAccount(b.accountId, b.initialCapital);
    return {
      code: 200,
      msg: 'success',
      data: account,
    };
  }

  @HttpCode(200)
  @Post('start')
  startTrading(@Body() body?: { accountId?: string; strategyIds?: string[] }) {
    const b = body ?? {};
    const account = this.paperTradingService.startTrading(b.accountId, b.strategyIds);
    return {
      code: 200,
      msg: 'success',
      data: { isRunning: account.isRunning, message: '模拟交易已启动' },
    };
  }

  @HttpCode(200)
  @Post('stop')
  stopTrading(@Body() body?: { accountId?: string }) {
    const b = body ?? {};
    const account = this.paperTradingService.stopTrading(b.accountId);
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

  @Get('summary')
  getSummary(@Query('accountId') accountId?: string) {
    const summary = this.paperTradingService.getTradeSummary(accountId);
    return { code: 200, msg: 'success', data: summary };
  }

  @Get('trade/:id')
  getTrade(@Param('id') id: string, @Query('accountId') accountId?: string) {
    const trade = this.paperTradingService.getTrade(id, accountId);
    if (!trade) {
      return { code: 404, msg: '交易记录不存在', data: null };
    }
    return { code: 200, msg: 'success', data: trade };
  }

  @Get('trades')
  getTrades(
    @Query('accountId') accountId?: string,
    @Query('symbol') symbol?: string,
    @Query('type') type?: 'BUY' | 'SELL',
    @Query('strategyId') strategyId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const result = this.paperTradingService.getTrades({
      accountId,
      symbol,
      type,
      strategyId,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
    });
    return { code: 200, msg: 'success', data: { list: result.list, total: result.total } };
  }

  @Get('position/:symbol')
  getPosition(@Param('symbol') symbol: string, @Query('accountId') accountId?: string) {
    const pos = this.paperTradingService.getPosition(symbol, accountId);
    return { code: 200, msg: 'success', data: pos };
  }

  @Post('manual/buy')
  @HttpCode(200)
  manualBuy(
    @Body()
    body: {
      symbol: string;
      name?: string;
      price: number;
      quantity: number;
      reason?: string;
      accountId?: string;
    },
  ) {
    const result = this.paperTradingService.manualBuy(
      body.symbol,
      body.name || body.symbol,
      body.price,
      body.quantity,
      body.reason,
      body.accountId,
    );
    return {
      code: result.success ? 200 : 400,
      msg: result.message,
      data: result.trade ?? null,
    };
  }

  @Post('manual/sell')
  @HttpCode(200)
  manualSell(
    @Body()
    body: {
      symbol: string;
      price: number;
      quantity?: number;
      reason?: string;
      accountId?: string;
    },
  ) {
    const result = this.paperTradingService.manualSell(
      body.symbol,
      body.price,
      body.quantity,
      body.reason,
      body.accountId,
    );
    return {
      code: result.success ? 200 : 400,
      msg: result.message,
      data: result.trade ?? null,
    };
  }

  @HttpCode(200)
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

  @HttpCode(200)
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
