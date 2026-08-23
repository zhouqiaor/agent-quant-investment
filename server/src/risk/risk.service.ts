import { Injectable } from '@nestjs/common';

export interface RiskSettings {
  maxDrawdown: number;
  stopLossRate: number;
  takeProfitRate: number;
  maxPositionRate: number;
  dailyTradeLimit: number;
}

@Injectable()
export class RiskService {
  private settings: RiskSettings = {
    maxDrawdown: 10,
    stopLossRate: 5,
    takeProfitRate: 10,
    maxPositionRate: 30,
    dailyTradeLimit: 20,
  };

  getSettings(): RiskSettings {
    return this.settings;
  }

  saveSettings(data: RiskSettings): RiskSettings {
    this.settings = { ...this.settings, ...data };
    return this.settings;
  }
}
