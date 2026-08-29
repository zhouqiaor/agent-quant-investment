import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { PersistenceModule } from '@/persistence/persistence.module';
import { AgentModule } from '@/agent/agent.module';
import { MarketModule } from '@/market/market.module';

@Module({
  imports: [PersistenceModule, AgentModule, MarketModule],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
