import { Module } from '@nestjs/common';
import { StrategyController } from './strategy.controller';
import { StrategyService } from './strategy.service';
import { IndicatorCalcService } from '@/indicators';

@Module({
  controllers: [StrategyController],
  providers: [StrategyService, IndicatorCalcService],
  exports: [StrategyService, IndicatorCalcService],
})
export class StrategyModule {}
