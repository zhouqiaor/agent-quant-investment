import { Controller, Get, Post, Query, HttpCode } from '@nestjs/common';
import { AgentService } from './agent.service';

@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Get('status')
  @HttpCode(200)
  getStatus() {
    return {
      code: 200,
      msg: 'success',
      data: this.agentService.getStatus(),
    };
  }

  @Get('signals')
  @HttpCode(200)
  getSignals(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 5;
    return {
      code: 200,
      msg: 'success',
      data: this.agentService.getSignals(limitNum),
    };
  }

  @Post('start')
  @HttpCode(200)
  startAgent() {
    return {
      code: 200,
      msg: 'success',
      data: this.agentService.startAgent(),
    };
  }

  @Post('stop')
  @HttpCode(200)
  stopAgent() {
    return {
      code: 200,
      msg: 'success',
      data: this.agentService.stopAgent(),
    };
  }

  @Post('signal/generate')
  @HttpCode(200)
  generateSignal() {
    return {
      code: 200,
      msg: 'success',
      data: this.agentService.generateSignal(),
    };
  }
}
