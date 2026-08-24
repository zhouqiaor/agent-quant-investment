import { Controller, Get, Query } from '@nestjs/common';
import { AgentAnalysisService } from './agent-analysis.service';

@Controller('agent-analysis')
export class AgentAnalysisController {
  constructor(private readonly agentAnalysisService: AgentAnalysisService) {}

  @Get('analyze')
  analyze(@Query('symbol') symbol: string) {
    if (!symbol) {
      return { code: 400, msg: '请提供股票代码', data: null };
    }
    const result = this.agentAnalysisService.analyze(symbol);
    if (!result) {
      return { code: 404, msg: '股票不存在', data: null };
    }
    return { code: 200, msg: 'success', data: result };
  }
}
