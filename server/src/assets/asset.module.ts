import { Module } from '@nestjs/common';
import { AssetController } from './asset.controller';
import { AssetService } from './asset.service';
import { PaperTradingModule } from '../paper-trading/paper-trading.module';

@Module({
  imports: [PaperTradingModule],
  controllers: [AssetController],
  providers: [AssetService],
})
export class AssetModule {}
