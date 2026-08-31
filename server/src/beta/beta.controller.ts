import { Body, Controller, Get, HttpCode, Post, Put } from '@nestjs/common';
import { BetaConfigService, BetaConfig } from './beta-config.service';
import { LivePnlService } from './live-pnl.service';
import { PaperTradingService } from '../paper-trading/paper-trading.service';

/**
 * 内测体验控制器：从零配置 → 一键开启投资
 * GET  /api/beta/config   读取配置（未配置返回默认草稿）
 * PUT  /api/beta/config   保存配置（校验后置为 active）
 * POST /api/beta/start    一键开启：保存配置 + 重置账户 + 启动模拟交易
 * GET  /api/beta/status   实时看盘状态（账户收益 + 监听状态）
 */
@Controller('beta')
export class BetaController {
  constructor(
    private readonly betaConfig: BetaConfigService,
    private readonly livePnl: LivePnlService,
    private readonly paperTrading: PaperTradingService,
  ) {}

  @Get('config')
  getConfig() {
    return { code: 200, msg: 'ok', data: { config: this.betaConfig.getConfig(), default: this.betaConfig.getDefaultConfig() } };
  }

  @Put('config')
  @HttpCode(200)
  saveConfig(@Body() body?: Partial<BetaConfig>) {
    const saved = this.betaConfig.saveConfig(body ?? {});
    return { code: 200, msg: '配置已保存', data: saved };
  }

  @Post('start')
  @HttpCode(200)
  start(@Body() body?: Partial<BetaConfig>) {
    const config = this.betaConfig.saveConfig(body ?? {});
    // 一键开启：重置模拟账户为配置金额并启动交易引擎
    this.paperTrading.resetAccount('default', config.initialCapital);
    const strategies = config.strategyId ? [config.strategyId] : ['s1'];
    const account = this.paperTrading.startTrading('default', strategies);
    return { code: 200, msg: '内测投资已开启', data: { config, account } };
  }

  @Post('tick')
  @HttpCode(200)
  tick(@Body() body?: { marketData?: Array<{ symbol: string; price: number; changePercent: number }> }) {
    const marketData = body?.marketData ?? [];
    return this.livePnl.onTick(marketData).then((stats) => ({
      code: 200,
      msg: 'ok',
      data: { stats },
    }));
  }

  @Get('status')
  getStatus() {
    const account = this.paperTrading.getAccount();
    const live = this.livePnl.getStatus();
    return {
      code: 200,
      msg: 'ok',
      data: {
        configured: !!this.betaConfig.getConfig(),
        lastTickAt: live.lastTickAt,
        watchedEnabled: live.watchedEnabled,
        totalValue: account.totalValue,
        totalPnl: account.totalPnl,
        totalPnlRate: account.totalPnlRate,
        isRunning: account.isRunning,
        positions: account.positions,
      },
    };
  }
}
