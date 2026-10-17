import { Module } from '@nestjs/common';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { MarketModule } from '@/market/market.module';
import { AssetModule } from '@/assets/asset.module';
import { StrategyModule } from '@/strategy/strategy.module';
import { AgentModule } from '@/agent/agent.module';
import { TradeModule } from '@/trade/trade.module';
import { RiskModule } from '@/risk/risk.module';
import { StockModule } from '@/stock/stock.module';
import { AgentAnalysisModule } from '@/agent-analysis/agent-analysis.module';
import { BacktestModule } from '@/backtest/backtest.module';
import { PaperTradingModule } from '@/paper-trading/paper-trading.module';
import { PersistenceModule } from '@/persistence/persistence.module';
import { OptimizerModule } from '@/optimizer/optimizer.module';
import { NotificationModule } from '@/notification/notification.module';
import { BetaModule } from '@/beta/beta.module';
import { DataSourceModule } from '@/data-source/data-source.module';
import { ABTestModule } from '@/ab-test/ab-test.module';
import { SimulationModule } from '@/simulation/simulation.module';
import { ScreenerModule } from '@/screener/screener.module';
import { PortfolioModule } from '@/portfolio/portfolio.module';

@Module({
  imports: [PersistenceModule, MarketModule, AssetModule, StrategyModule, AgentModule, TradeModule, RiskModule, StockModule, AgentAnalysisModule, BacktestModule, PaperTradingModule, OptimizerModule, NotificationModule, BetaModule, DataSourceModule, ABTestModule, SimulationModule, ScreenerModule, PortfolioModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
