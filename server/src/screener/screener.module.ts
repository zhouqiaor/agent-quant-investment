import { Module } from '@nestjs/common';
import { ScreenerController } from './screener.controller';
import { ScreenerService } from './screener.service';
import { StockModule } from '@/stock/stock.module';
import { PersistenceModule } from '@/persistence/persistence.module';

/**
 * ScreenerModule
 *
 * 依赖链：
 *   ScreenerController → ScreenerService → PersistenceService / StockService / IndicatorCalcService
 *   StockModule 已导出 StockService + IndicatorCalcService
 *   PersistenceModule 提供全量目录（persistence.searchDirectory('', N)）作为候选集
 */
@Module({
  imports: [StockModule, PersistenceModule],
  controllers: [ScreenerController],
  providers: [ScreenerService],
  exports: [ScreenerService],
})
export class ScreenerModule {}
