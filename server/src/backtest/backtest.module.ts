import { Module } from '@nestjs/common';
import { BacktestService } from './backtest.service';
import { BacktestController } from './backtest.controller';
import { StrategyModule } from '../strategy/strategy.module';
import { MarketModule } from '../market/market.module';

@Module({
  imports: [StrategyModule, MarketModule],
  providers: [BacktestService],
  controllers: [BacktestController],
  exports: [BacktestService],
})
export class BacktestModule {}
