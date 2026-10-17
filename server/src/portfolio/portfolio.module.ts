import { Module } from '@nestjs/common';
import { PersistenceModule } from '../persistence/persistence.module';
import { StrategyModule } from '../strategy/strategy.module';
import { PaperTradingModule } from '../paper-trading/paper-trading.module';
import { PortfolioService } from './portfolio.service';
import { PortfolioController } from './portfolio.controller';

/**
 * 多策略组合管理（Part 2）
 *
 * PortfolioService 构造依赖：PersistenceService / StrategyService / PaperTradingService
 * （PersistenceModule 为 @Global，此处仍显式导入以明确依赖关系）。
 */
@Module({
  imports: [PersistenceModule, StrategyModule, PaperTradingModule],
  controllers: [PortfolioController],
  providers: [PortfolioService],
  exports: [PortfolioService],
})
export class PortfolioModule {}
