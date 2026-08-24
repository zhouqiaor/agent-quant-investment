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

@Module({
  imports: [MarketModule, AssetModule, StrategyModule, AgentModule, TradeModule, RiskModule, StockModule, AgentAnalysisModule, BacktestModule, PaperTradingModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
