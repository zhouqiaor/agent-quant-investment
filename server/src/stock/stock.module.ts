import { Module } from '@nestjs/common';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import { PersistenceModule } from '@/persistence/persistence.module';

@Module({
  imports: [PersistenceModule],
  providers: [StockService],
  controllers: [StockController],
  exports: [StockService],
})
export class StockModule {}
