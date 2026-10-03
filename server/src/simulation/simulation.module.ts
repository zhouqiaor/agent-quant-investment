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
import { GlossaryService } from './glossary.service'
import { GlossaryController } from './glossary.controller'
import { ScenarioKlineService } from './scenario-kline.service'
import { ScenarioReplayService } from './scenario-replay.service'
import { ScenarioController } from './scenario.controller'
import { StrategyTemplateService } from './strategy-template.service'
import { TryoutReplayService } from './tryout-replay.service'
import { StrategyTemplateController } from './strategy-template.controller'

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
    GlossaryService,
    ScenarioKlineService,
    ScenarioReplayService,
    StrategyTemplateService,
    TryoutReplayService,
  ],
  controllers: [SimulationController, LiveController, GlossaryController, ScenarioController, StrategyTemplateController],
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
    GlossaryService,
    ScenarioKlineService,
    ScenarioReplayService,
    StrategyTemplateService,
    TryoutReplayService,
  ],
})
export class SimulationModule {}