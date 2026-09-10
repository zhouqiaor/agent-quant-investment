import { Controller, Get, Query, Post, HttpCode, Body, BadRequestException } from '@nestjs/common';
import { MarketService } from './market.service';
import { TickRecorderService } from './tick-recorder.service';

@Controller('market')
export class MarketController {
  constructor(
    private readonly marketService: MarketService,
    private readonly tickRecorder: TickRecorderService,
  ) {}

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

  // ==================== Ticks 录制管理 ====================

  @Get('ticks')
  @HttpCode(200)
  getTicks(
    @Query('symbol') symbol?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    const data = this.tickRecorder.queryTicks({
      symbol,
      fromTs: from ? Number(from) : undefined,
      toTs: to ? Number(to) : undefined,
      limit: limit ? Number(limit) : 500,
    });
    return {
      code: 200,
      msg: 'success',
      data,
    };
  }

  @Get('ticks/stats')
  @HttpCode(200)
  getTickStats() {
    const data = this.tickRecorder.getStats();
    return {
      code: 200,
      msg: 'success',
      data,
    };
  }

  @Post('ticks/recording')
  @HttpCode(200)
  setRecording(@Body() body: { enabled?: boolean }) {
    if (typeof body.enabled !== 'boolean') {
      throw new BadRequestException('enabled (boolean) is required');
    }
    this.tickRecorder.setRecording(body.enabled);
    return {
      code: 200,
      msg: 'success',
      data: this.tickRecorder.getStats(),
    };
  }
}