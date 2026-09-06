import { Module } from '@nestjs/common';
import { MarketController } from './market.controller';
import { MarketService } from './market.service';
import { MarketPollingService } from './market-polling.service';
import { StrategyModule } from '../strategy/strategy.module';
import { PersistenceModule } from '../persistence/persistence.module';

@Module({
  imports: [StrategyModule, PersistenceModule],
  controllers: [MarketController],
  providers: [MarketService, MarketPollingService],
  exports: [MarketService, MarketPollingService],
})
export class MarketModule {}
