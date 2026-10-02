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
import { MockFeedService } from './mock-feed.service'
import { LiveStrategyAdapter } from './live-strategy-adapter'
import { MockMatchEngine } from './mock-match-engine'
import { LiveSimulationEngine } from './live-simulation.engine'
import { LiveController } from './live-simulation.controller'

@Module({
  imports: [PersistenceModule],
  providers: [
    SimulationFactory,
    SimulationScheduler,
    SimulationReportService,
    MarkdownReportRenderer,
    StrategyTunerService,
    YearReportService,
    MetaTunerService,
    MockFeedService,
    LiveStrategyAdapter,
    MockMatchEngine,
    LiveSimulationEngine,
  ],
  controllers: [SimulationController, LiveController],
  exports: [
    SimulationScheduler,
    SimulationReportService,
    MarkdownReportRenderer,
    StrategyTunerService,
    YearReportService,
    MetaTunerService,
    MockFeedService,
    LiveStrategyAdapter,
    MockMatchEngine,
    LiveSimulationEngine,
  ],
})
export class SimulationModule {}