import { Module } from '@nestjs/common';
import { BacktestService } from './backtest.service';
import { BacktestController } from './backtest.controller';
import { PortfolioBacktestService } from './portfolio-backtest.service';
import { StrategyModule } from '../strategy/strategy.module';
import { MarketModule } from '../market/market.module';
import { StockModule } from '../stock/stock.module';
import { PaperTradingModule } from '../paper-trading/paper-trading.module';

@Module({
  imports: [StrategyModule, MarketModule, StockModule, PaperTradingModule],
  providers: [BacktestService, PortfolioBacktestService],
  controllers: [BacktestController],
  exports: [BacktestService, PortfolioBacktestService],
})
export class BacktestModule {}
