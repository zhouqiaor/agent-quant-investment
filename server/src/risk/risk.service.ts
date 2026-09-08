import { Injectable, OnModuleInit } from '@nestjs/common';
import { PersistenceService } from '../persistence/persistence.service';

export interface RiskSettings {
  maxDrawdown: number;
  stopLossRate: number;
  takeProfitRate: number;
  maxPositionRate: number;
  dailyTradeLimit: number;
}

const DEFAULT_SETTINGS: RiskSettings = {
  maxDrawdown: 10,
  stopLossRate: 5,
  takeProfitRate: 10,
  maxPositionRate: 30,
  dailyTradeLimit: 20,
};

/**
 * 风控设置服务（持久化到 SQLite，重启不丢失）
 */
@Injectable()
export class RiskService implements OnModuleInit {
  private settings: RiskSettings = DEFAULT_SETTINGS;

  constructor(private readonly persistenceService: PersistenceService) {}

  onModuleInit() {
    const loaded = this.persistenceService.loadRiskSettings();
    if (loaded) {
      this.settings = { ...DEFAULT_SETTINGS, ...loaded };
    } else {
      this.persistenceService.saveRiskSettings(this.settings);
    }
  }

  getSettings(): RiskSettings {
    return { ...this.settings };
  }

  saveSettings(data: Partial<RiskSettings>): RiskSettings {
    this.settings = { ...this.settings, ...data };
    this.persistenceService.saveRiskSettings(this.settings);
    return { ...this.settings };
  }
}
