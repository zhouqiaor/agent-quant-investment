import { Module } from '@nestjs/common'
import { PersistenceModule } from '../persistence/persistence.module'
import { SimulationFactory } from './simulation.factory'
import { SimulationScheduler } from './simulation.scheduler'
import { SimulationReportService } from './simulation-report.service'
import { SimulationController } from './simulation.controller'

@Module({
  imports: [PersistenceModule],
  providers: [SimulationFactory, SimulationScheduler, SimulationReportService],
  controllers: [SimulationController],
  exports: [SimulationScheduler, SimulationReportService],
})
export class SimulationModule {}