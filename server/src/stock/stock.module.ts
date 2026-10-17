import { Module } from '@nestjs/common';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import { WatchlistService } from './watchlist.service';
import { WatchlistController } from './watchlist.controller';
import { HistoryKlineService } from './history-kline.service';
import { KLineImporterService } from './kline-importer.service';
import { PersistenceModule } from '@/persistence/persistence.module';
import { IndicatorCalcService } from '@/indicators';

@Module({
  imports: [PersistenceModule],
  providers: [StockService, WatchlistService, HistoryKlineService, KLineImporterService, IndicatorCalcService],
  controllers: [StockController, WatchlistController],
  exports: [StockService, WatchlistService, HistoryKlineService, KLineImporterService, IndicatorCalcService],
})
export class StockModule {}
