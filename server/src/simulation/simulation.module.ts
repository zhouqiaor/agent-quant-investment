import { Module } from '@nestjs/common'
import { PersistenceModule } from '../persistence/persistence.module'
import { SimulationFactory } from './simulation.factory'
import { SimulationScheduler } from './simulation.scheduler'
import { SimulationReportService } from './simulation-report.service'
import { SimulationController } from './simulation.controller'
import { MarkdownReportRenderer } from './markdown-report.service'

@Module({
  imports: [PersistenceModule],
  providers: [SimulationFactory, SimulationScheduler, SimulationReportService, MarkdownReportRenderer],
  controllers: [SimulationController],
  exports: [SimulationScheduler, SimulationReportService, MarkdownReportRenderer],
})
export class SimulationModule {}