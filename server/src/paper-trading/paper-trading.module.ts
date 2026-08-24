import { Module } from '@nestjs/common';
import { PaperTradingService } from './paper-trading.service';
import { PaperTradingController } from './paper-trading.controller';
import { StrategyModule } from '../strategy/strategy.module';

@Module({
  imports: [StrategyModule],
  providers: [PaperTradingService],
  controllers: [PaperTradingController],
  exports: [PaperTradingService],
})
export class PaperTradingModule {}
