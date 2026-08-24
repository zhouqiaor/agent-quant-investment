import { Module } from '@nestjs/common';
import { AgentAnalysisService } from './agent-analysis.service';
import { AgentAnalysisController } from './agent-analysis.controller';
import { StockModule } from '../stock/stock.module';

@Module({
  imports: [StockModule],
  providers: [AgentAnalysisService],
  controllers: [AgentAnalysisController],
  exports: [AgentAnalysisService],
})
export class AgentAnalysisModule {}
