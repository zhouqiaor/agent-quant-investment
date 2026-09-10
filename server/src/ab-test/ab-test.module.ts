import { Module } from '@nestjs/common';
import { ABTestRunnerService } from './ab-test-runner.service';
import { ABTestController } from './ab-test.controller';
import { BacktestModule } from '../backtest/backtest.module';
import { PersistenceModule } from '../persistence/persistence.module';
import { StrategyModule } from '../strategy/strategy.module';

@Module({
  imports: [BacktestModule, PersistenceModule, StrategyModule],
  controllers: [ABTestController],
  providers: [ABTestRunnerService],
  exports: [ABTestRunnerService],
})
export class ABTestModule {}