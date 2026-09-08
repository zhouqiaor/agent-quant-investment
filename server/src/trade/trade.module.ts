import { Module } from '@nestjs/common';
import { TradeController } from './trade.controller';
import { TradeService } from './trade.service';
import { PaperTradingModule } from '../paper-trading/paper-trading.module';

@Module({
  imports: [PaperTradingModule],
  controllers: [TradeController],
  providers: [TradeService],
})
export class TradeModule {}
