import { BadRequestException, Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';

export interface CreatePortfolioBody {
  name?: string;
  cashReservePct?: number;
}

export interface ToggleStrategyBody {
  strategyId?: string;
  running?: boolean;
  maxPositionPct?: number;
}

/**
 * 多策略组合管理控制器：
 * GET  /portfolio/summary           组合账户聚合视图
 * POST /portfolio/create            创建组合（多组合预留）
 * POST /portfolio/strategy/toggle   启停策略（可选 maxPositionPct）
 *
 * 统一信封：{ code: 200, msg: 'success', data }
 * 参数错误抛 BadRequestException → HTTP 400。
 */
@Controller('portfolio')
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get('summary')
  async getSummary() {
    const data = await this.portfolioService.getSummary();
    return { code: 200, msg: 'success', data };
  }

  @Post('create')
  @HttpCode(200)
  async create(@Body() body?: CreatePortfolioBody) {
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name) {
      throw new BadRequestException('组合名称不能为空');
    }
    let cashReservePct: number | undefined;
    if (body?.cashReservePct !== undefined) {
      cashReservePct = Number(body.cashReservePct);
      if (!Number.isFinite(cashReservePct) || cashReservePct < 0 || cashReservePct > 1) {
        throw new BadRequestException('cashReservePct 必须为 0-1 之间的数值');
      }
    }
    const data = await this.portfolioService.create(name, { cashReservePct });
    return { code: 200, msg: 'success', data };
  }

  @Post('strategy/toggle')
  @HttpCode(200)
  async toggleStrategy(@Body() body?: ToggleStrategyBody) {
    const strategyId = typeof body?.strategyId === 'string' ? body.strategyId.trim() : '';
    if (!strategyId) {
      throw new BadRequestException('strategyId 不能为空');
    }
    if (typeof body?.running !== 'boolean') {
      throw new BadRequestException('running 必须为布尔值');
    }
    let maxPositionPct: number | undefined;
    if (body.maxPositionPct !== undefined) {
      maxPositionPct = Number(body.maxPositionPct);
      if (!Number.isFinite(maxPositionPct) || maxPositionPct <= 0 || maxPositionPct > 1) {
        throw new BadRequestException('maxPositionPct 必须为 0-1 之间的数值');
      }
    }
    await this.portfolioService.setStrategyRunning(strategyId, body.running, { maxPositionPct });
    const data = await this.portfolioService.getStrategyConfig(strategyId);
    return { code: 200, msg: 'success', data };
  }
}
