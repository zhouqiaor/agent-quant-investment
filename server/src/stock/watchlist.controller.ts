import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { WatchlistService } from './watchlist.service';

@Controller('stock/watchlist')
export class WatchlistController {
  constructor(private readonly watchlistService: WatchlistService) {}

  @Get()
  listWatch() {
    const items = this.watchlistService.listWatch();
    return { code: 200, msg: 'success', data: items };
  }

  @Post()
  @HttpCode(200)
  addWatch(@Body() body?: { symbol?: string; name?: string; enabled?: boolean }) {
    const b = body ?? {};
    const item = this.watchlistService.addWatch(b.symbol || '', b.name, b.enabled ?? true);
    return { code: 200, msg: 'success', data: item };
  }

  @Put('toggle')
  @HttpCode(200)
  toggleWatch(@Body() body?: { symbol?: string; enabled?: boolean }) {
    const b = body ?? {};
    const item = this.watchlistService.toggleWatch(b.symbol || '', b.enabled ?? true);
    return { code: 200, msg: 'success', data: item };
  }

  @Delete(':symbol')
  removeWatch(@Param('symbol') symbol: string) {
    const ok = this.watchlistService.removeWatch(symbol || '');
    return { code: 200, msg: ok ? 'success' : 'not found', data: { removed: ok } };
  }
}
