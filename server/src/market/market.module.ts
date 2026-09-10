import { Module } from '@nestjs/common';
import { MarketController } from './market.controller';
import { MarketService } from './market.service';
import { MarketPollingService } from './market-polling.service';
import { TickRecorderService } from './tick-recorder.service';
import { StrategyModule } from '../strategy/strategy.module';
import { PersistenceModule } from '../persistence/persistence.module';

@Module({
  imports: [StrategyModule, PersistenceModule],
  controllers: [MarketController],
  providers: [MarketService, MarketPollingService, TickRecorderService],
  exports: [MarketService, MarketPollingService, TickRecorderService],
})
export class MarketModule {}
