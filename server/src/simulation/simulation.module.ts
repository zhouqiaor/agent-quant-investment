import { Module } from '@nestjs/common'
import { PersistenceModule } from '../persistence/persistence.module'
import { SimulationFactory } from './simulation.factory'
import { SimulationScheduler } from './simulation.scheduler'
import { SimulationReportService } from './simulation-report.service'
import { SimulationController } from './simulation.controller'
import { MarkdownReportRenderer } from './markdown-report.service'
import { StrategyTunerService } from './strategy-tuner.service'
import { YearReportService } from './year-report.service'
import { MetaTunerService } from './meta-tuner.service'

@Module({
  imports: [PersistenceModule],
  providers: [SimulationFactory, SimulationScheduler, SimulationReportService, MarkdownReportRenderer, StrategyTunerService, YearReportService, MetaTunerService],
  controllers: [SimulationController],
  exports: [SimulationScheduler, SimulationReportService, MarkdownReportRenderer, StrategyTunerService, YearReportService, MetaTunerService],
})
export class SimulationModule {}