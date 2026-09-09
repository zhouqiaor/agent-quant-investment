import { Module } from '@nestjs/common';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import { WatchlistService } from './watchlist.service';
import { WatchlistController } from './watchlist.controller';
import { HistoryKlineService } from './history-kline.service';
import { PersistenceModule } from '@/persistence/persistence.module';

@Module({
  imports: [PersistenceModule],
  providers: [StockService, WatchlistService, HistoryKlineService],
  controllers: [StockController, WatchlistController],
  exports: [StockService, WatchlistService, HistoryKlineService],
})
export class StockModule {}
