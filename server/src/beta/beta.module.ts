import { Module } from '@nestjs/common';
import { PersistenceModule } from '../persistence/persistence.module';
import { StrategyModule } from '../strategy/strategy.module';
import { PaperTradingModule } from '../paper-trading/paper-trading.module';
import { NotificationModule } from '../notification/notification.module';
import { StockModule } from '../stock/stock.module';
import { BetaConfigService } from './beta-config.service';
import { LivePnlService } from './live-pnl.service';
import { BetaController } from './beta.controller';

@Module({
  imports: [PersistenceModule, StrategyModule, PaperTradingModule, NotificationModule, StockModule],
  controllers: [BetaController],
  providers: [BetaConfigService, LivePnlService],
  exports: [BetaConfigService, LivePnlService],
})
export class BetaModule {}
