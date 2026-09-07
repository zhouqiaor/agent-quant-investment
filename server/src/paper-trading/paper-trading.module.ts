import { Module } from '@nestjs/common';
import { PaperTradingService } from './paper-trading.service';
import { PaperTradingController } from './paper-trading.controller';
import { StrategyModule } from '../strategy/strategy.module';
import { PersistenceModule } from '../persistence/persistence.module';

@Module({
  imports: [StrategyModule, PersistenceModule],
  providers: [PaperTradingService],
  controllers: [PaperTradingController],
  exports: [PaperTradingService],
})
export class PaperTradingModule {}
