import { Module } from '@nestjs/common';
import { OptimizerService } from './optimizer.service';
import { OptimizerController } from './optimizer.controller';
import { PersistenceModule } from '@/persistence/persistence.module';
import { MarketModule } from '@/market/market.module';
import { BacktestModule } from '@/backtest/backtest.module';

@Module({
  imports: [PersistenceModule, MarketModule, BacktestModule],
  controllers: [OptimizerController],
  providers: [OptimizerService],
  exports: [OptimizerService],
})
export class OptimizerModule {}
