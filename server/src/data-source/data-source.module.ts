import { Module } from '@nestjs/common';
import { DataSourceService } from './data-source.service';
import { DataSourceController } from './data-source.controller';
import { PersistenceModule } from '@/persistence/persistence.module';
import { StockModule } from '@/stock/stock.module';

@Module({
  imports: [PersistenceModule, StockModule],
  providers: [DataSourceService],
  controllers: [DataSourceController],
})
export class DataSourceModule {}