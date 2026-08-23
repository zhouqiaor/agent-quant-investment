import { Controller, Get, Post, Body, HttpCode } from '@nestjs/common';
import { RiskService, RiskSettings } from './risk.service';

@Controller('risk')
export class RiskController {
  constructor(private readonly riskService: RiskService) {}

  @Get('settings')
  @HttpCode(200)
  getSettings(): { code: number; msg: string; data: RiskSettings } {
    return {
      code: 200,
      msg: 'success',
      data: this.riskService.getSettings(),
    };
  }

  @Post('settings')
  @HttpCode(200)
  saveSettings(@Body() body: Partial<RiskSettings>): { code: number; msg: string; data: RiskSettings } {
    return {
      code: 200,
      msg: 'success',
      data: this.riskService.saveSettings(body as RiskSettings),
    };
  }
}
