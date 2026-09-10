import { Body, Controller, Get, HttpCode, Post, Put } from '@nestjs/common';
import { BetaConfigService, BetaConfig } from './beta-config.service';
import { LivePnlService } from './live-pnl.service';
import { PaperTradingService } from '../paper-trading/paper-trading.service';
import { MarketPollingService } from '../market/market-polling.service';

/**
 * 内测体验控制器：从零配置 → 一键开启投资
 * GET  /api/beta/config   读取配置（未配置返回默认草稿）
 * PUT  /api/beta/config   保存配置（校验后置为 active）
 * POST /api/beta/start    一键开启：保存配置 + 重置账户 + 启动模拟交易 + 启动实时行情轮询
 * GET  /api/beta/status   实时看盘状态（账户收益 + 监听状态 + 轮询状态 + 自动成交数）
 * POST /api/beta/polling/start   手动开启实时行情轮询（不重置账户）
 * POST /api/beta/polling/stop    手动停止实时行情轮询
 */
@Controller('beta')
export class BetaController {
  constructor(
    private readonly betaConfig: BetaConfigService,
    private readonly livePnl: LivePnlService,
    private readonly paperTrading: PaperTradingService,
    private readonly marketPolling: MarketPollingService,
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
  async start(@Body() body?: Partial<BetaConfig>) {
    const config = this.betaConfig.saveConfig(body ?? {});
    // 一键开启：重置模拟账户为配置金额并启动交易引擎
    this.paperTrading.resetAccount('default', config.initialCapital);
    const strategies = config.strategyId ? [config.strategyId] : ['s1'];
    const account = this.paperTrading.startTrading('default', strategies);
    // 同步启动实时行情轮询（5 秒一次，自动喂 LivePnlService → onTick）
    if (!this.marketPolling.isPolling()) {
      await this.marketPolling.start(5000);
    }
    return { code: 200, msg: '内测投资已开启（含实时行情监听）', data: { config, account, polling: true } };
  }

  @Post('reset-all')
  @HttpCode(200)
  resetAll() {
    this.betaConfig.resetAll();
    return { code: 200, msg: '已重置为从零配置状态', data: null };
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
        polling: {
          isRunning: this.marketPolling.isPolling(),
          intervalMs: this.marketPolling.getIntervalMs(),
          lastTickAt: this.marketPolling.getLastTickAt(),
        },
      },
    };
  }

  @Post('polling/start')
  @HttpCode(200)
  async startPolling() {
    const wasRunning = this.marketPolling.isPolling();
    if (!wasRunning) {
      await this.marketPolling.start(5000);
    }
    return {
      code: 200,
      msg: wasRunning ? '实时行情已在运行中' : '实时行情已开启（5 秒一次）',
      data: {
        polling: {
          isRunning: this.marketPolling.isPolling(),
          intervalMs: this.marketPolling.getIntervalMs(),
          lastTickAt: this.marketPolling.getLastTickAt(),
        },
      },
    };
  }

  @Post('polling/stop')
  @HttpCode(200)
  stopPolling() {
    const wasRunning = this.marketPolling.isPolling();
    this.marketPolling.stop();
    return {
      code: 200,
      msg: wasRunning ? '实时行情已停止' : '实时行情本就未运行',
      data: { polling: { isRunning: false, intervalMs: 0, lastTickAt: null } },
    };
  }
}
