import { Module } from '@nestjs/common';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import { WatchlistService } from './watchlist.service';
import { WatchlistController } from './watchlist.controller';
import { PersistenceModule } from '@/persistence/persistence.module';
import { IndicatorCalcService } from '@/indicators';

@Module({
  imports: [PersistenceModule],
  providers: [StockService, WatchlistService, IndicatorCalcService],
  controllers: [StockController, WatchlistController],
  exports: [StockService, WatchlistService, IndicatorCalcService],
})
export class StockModule {}
