import { BadRequestException, Injectable } from '@nestjs/common';
import {
  DEFAULT_INDICATOR_CONFIG,
  IndicatorBundle,
  IndicatorCalcService,
  IndicatorConfig,
} from '@/indicators';
import type { KlineData } from '@/stock/stock.service';

export interface Strategy {
  id: string;
  name: string;
  type: string;
  status: 'running' | 'stopped' | 'backtesting';
  pnl: number;
  pnlRate: number;
  winRate: number;
  trades: number;
  description: string;
  isCustom?: boolean;
  symbol?: string;
  monitorEnabled?: boolean;
  autoTrade?: boolean;
}

export interface Condition {
  id: string;
  indicator: string;
  operator: string;
  value: number;
  description: string;
}

export interface CustomStrategy {
  id: string;
  name: string;
  symbol: string;
  indicators: string[];
  indicatorParams: Record<string, Record<string, number>>;
  buyConditions: Condition[];
  sellConditions: Condition[];
  positionSize: number;
  stopLoss: number;
  takeProfit: number;
  autoTrade: boolean;
  monitorEnabled: boolean;
  status: 'running' | 'stopped';
  pnl: number;
  pnlRate: number;
  winRate: number;
  trades: number;
  createdAt: string;
  lastSignal?: string;
}

export interface MonitorSignal {
  id: string;
  strategyId: string;
  strategyName: string;
  symbol: string;
  type: 'buy' | 'sell';
  price: number;
  reason: string;
  time: string;
  executed: boolean;
}

@Injectable()
export class StrategyService {
  constructor(private readonly indicatorCalc: IndicatorCalcService) {}
  private strategies: Strategy[] = [
    {
      id: 's1',
      name: 'MACD 金叉策略',
      type: '趋势跟踪',
      status: 'stopped',
      pnl: 0,
      pnlRate: 0,
      winRate: 0,
      trades: 142,
      description: '基于 MACD 指标金叉/死叉信号进行多空操作',
    },
    {
      id: 's2',
      name: '布林带突破策略',
      type: '均值回归',
      status: 'stopped',
      pnl: 0,
      pnlRate: 0,
      winRate: 0,
      trades: 98,
      description: '价格突破布林带上下轨时反向操作，回归均值获利',
    },
    {
      id: 's3',
      name: 'RSI 超买超卖',
      type: '震荡策略',
      status: 'stopped',
      pnl: 0,
      pnlRate: 0,
      winRate: 0,
      trades: 67,
      description: 'RSI 指标超买区做空，超卖区做多',
    },
    {
      id: 's4',
      name: '网格交易策略',
      type: '网格策略',
      status: 'stopped',
      pnl: 0,
      pnlRate: 0,
      winRate: 0,
      trades: 356,
      description: '在设定价格区间内自动高抛低吸',
    },
  ];

  private customStrategies: CustomStrategy[] = [];
  private monitorSignals: MonitorSignal[] = [];

  getStrategies(): Strategy[] {
    // Merge custom strategies into the list
    const customList: Strategy[] = this.customStrategies.map((cs) => ({
      id: cs.id,
      name: cs.name,
      type: '自定义',
      status: cs.status,
      pnl: cs.pnl,
      pnlRate: cs.pnlRate,
      winRate: cs.winRate,
      trades: cs.trades,
      description: `自定义策略 | 标的: ${cs.symbol} | 指标: ${cs.indicators.join(', ')}`,
      isCustom: true,
      symbol: cs.symbol,
      monitorEnabled: cs.monitorEnabled,
      autoTrade: cs.autoTrade,
    }));
    return [...this.strategies, ...customList];
  }

  toggleStrategy(id: string, action: 'start' | 'stop'): Strategy | null {
    // Check built-in strategies
    const strategy = this.strategies.find((s) => s.id === id);
    if (strategy) {
      strategy.status = action === 'start' ? 'running' : 'stopped';
      return strategy;
    }
    // Check custom strategies
    const custom = this.customStrategies.find((s) => s.id === id);
    if (custom) {
      custom.status = action === 'start' ? 'running' : 'stopped';
      return {
        id: custom.id,
        name: custom.name,
        type: '自定义',
        status: custom.status,
        pnl: custom.pnl,
        pnlRate: custom.pnlRate,
        winRate: custom.winRate,
        trades: custom.trades,
        description: `自定义策略 | 标的: ${custom.symbol}`,
        isCustom: true,
        symbol: custom.symbol,
        monitorEnabled: custom.monitorEnabled,
        autoTrade: custom.autoTrade,
      };
    }
    return null;
  }

  // Custom Strategy CRUD
  createCustomStrategy(data: Partial<CustomStrategy>): CustomStrategy {
    const id = `cs_${Date.now()}`;
    const newStrategy: CustomStrategy = {
      id,
      name: data.name || '未命名策略',
      symbol: data.symbol || '',
      indicators: data.indicators || [],
      indicatorParams: data.indicatorParams || {},
      buyConditions: data.buyConditions || [],
      sellConditions: data.sellConditions || [],
      positionSize: data.positionSize || 10,
      stopLoss: data.stopLoss || 5,
      takeProfit: data.takeProfit || 15,
      autoTrade: data.autoTrade || false,
      monitorEnabled: data.monitorEnabled !== false,
      status: data.status || 'stopped',
      pnl: 0,
      pnlRate: 0,
      winRate: 0,
      trades: 0,
      createdAt: new Date().toISOString(),
    };
    this.customStrategies.push(newStrategy);
    return newStrategy;
  }

  updateCustomStrategy(id: string, data: Partial<CustomStrategy>): CustomStrategy | null {
    const idx = this.customStrategies.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    this.customStrategies[idx] = {
      ...this.customStrategies[idx],
      ...data,
      id, // prevent id change
    };
    return this.customStrategies[idx];
  }

  getCustomStrategy(id: string): CustomStrategy | null {
    return this.customStrategies.find((s) => s.id === id) || null;
  }

  deleteCustomStrategy(id: string): boolean {
    const idx = this.customStrategies.findIndex((s) => s.id === id);
    if (idx === -1) return false;
    this.customStrategies.splice(idx, 1);
    return true;
  }

  /**
   * Fork 现有策略为新版本（不修改原记录，返回新 id）
   * - parentId = 原策略 id
   * - version = 同 root 下最大 version + 1
   * - rootId = parent.rootId（若有），否则 = parentId
   * - 仅 overrides 指定字段覆盖，其余继承父策略
   */
  forkCustomStrategy(
    parentId: string,
    name: string,
    overrides: Partial<CustomStrategy> = {},
  ): (CustomStrategy & { parentId?: string; rootId?: string; version?: number; forkedAt?: number }) | null {
    const parent = this.getCustomStrategy(parentId);
    if (!parent) return null;
    const siblings = this.customStrategies.filter(
      (s) => (s as any).rootId === (parent as any).rootId || s.id === parent.id,
    );
    const rootId = (parent as any).rootId || parent.id;
    const maxVersion = siblings.reduce((m, s) => Math.max(m, (s as any).version || 1), 1);
    const id = `cs_${Date.now()}`;
    const now = new Date().toISOString();
    const forked: CustomStrategy = {
      ...parent,
      ...overrides,
      id,
      name,
      pnl: 0,
      pnlRate: 0,
      winRate: 0,
      trades: 0,
      status: 'stopped',
      createdAt: now,
    };
    (forked as any).parentId = parentId;
    (forked as any).rootId = rootId;
    (forked as any).version = maxVersion + 1;
    (forked as any).forkedAt = Date.now();
    this.customStrategies.push(forked);
    return forked;
  }

  /** 列出同一 root 下的全部历史版本，按 version 升序 */
  listStrategyVersions(rootOrId: string): CustomStrategy[] {
    const target = this.getCustomStrategy(rootOrId);
    if (!target) return [];
    const rootId = (target as any).rootId || target.id;
    return this.customStrategies
      .filter((s) => s.id === rootId || (s as any).rootId === rootId)
      .sort((a, b) => (((a as any).version || 1) as number) - (((b as any).version || 1) as number));
  }

  getCustomStrategies(): CustomStrategy[] {
    return this.customStrategies;
  }

  // Monitoring Engine - simulate checking conditions against market data
  checkMonitorSignals(marketData: Array<{ symbol: string; price: number; changePercent: number }>): MonitorSignal[] {
    const newSignals: MonitorSignal[] = [];

    for (const strategy of this.customStrategies) {
      if (!strategy.monitorEnabled || strategy.status !== 'running') continue;

      const market = marketData.find((m) => m.symbol === strategy.symbol);
      if (!market) continue;

      // Simulate condition checking based on indicators
      for (const condition of strategy.buyConditions) {
        const triggered = this.evaluateCondition(condition, market, 'buy');
        if (triggered) {
          const signal: MonitorSignal = {
            id: `sig_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            strategyId: strategy.id,
            strategyName: strategy.name,
            symbol: strategy.symbol,
            type: 'buy',
            price: market.price,
            reason: this.generateReason(condition, market, 'buy'),
            time: new Date().toISOString(),
            executed: strategy.autoTrade,
          };
          newSignals.push(signal);
          strategy.lastSignal = signal.time;
          strategy.trades += 1;
        }
      }

      for (const condition of strategy.sellConditions) {
        const triggered = this.evaluateCondition(condition, market, 'sell');
        if (triggered) {
          const signal: MonitorSignal = {
            id: `sig_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            strategyId: strategy.id,
            strategyName: strategy.name,
            symbol: strategy.symbol,
            type: 'sell',
            price: market.price,
            reason: this.generateReason(condition, market, 'sell'),
            time: new Date().toISOString(),
            executed: strategy.autoTrade,
          };
          newSignals.push(signal);
          strategy.lastSignal = signal.time;
        }
      }
    }

    this.monitorSignals = [...newSignals, ...this.monitorSignals].slice(0, 50);
    return newSignals;
  }

  private evaluateCondition(condition: Condition, market: { symbol: string; price: number; changePercent: number }, type: 'buy' | 'sell'): boolean {
    // 确定性求值（可测试性）：价格阈值条件直接比较；非价格条件按涨跌幅规则
    if (condition.indicator === 'price') {
      return type === 'buy'
        ? market.price <= condition.value
        : market.price >= condition.value;
    }
    // 兜底规则：跌 0.5% 触发买入，涨 0.5% 触发卖出（确定性，无随机）
    if (type === 'buy') {
      return market.changePercent < -0.5;
    }
    return market.changePercent > 0.5;
  }

  private generateReason(condition: Condition, market: { symbol: string; price: number; changePercent: number }, type: 'buy' | 'sell'): string {
    const indicatorName = condition.indicator;
    const operatorLabel = this.getOperatorLabel(condition.operator);
    const direction = type === 'buy' ? '买入' : '卖出';
    return `${indicatorName} ${operatorLabel} 触发${direction}信号 | 当前跌幅 ${market.changePercent.toFixed(2)}%`;
  }

  private getOperatorLabel(op: string): string {
    const labels: Record<string, string> = {
      cross_above: '上穿',
      cross_below: '下穿',
      above: '大于',
      below: '小于',
      equal: '等于',
      greater: '强于',
      less: '弱于',
    };
    return labels[op] || op;
  }

  getMonitorSignals(limit = 10): MonitorSignal[] {
    return this.monitorSignals.slice(0, limit);
  }

  /**
   * 信号原因增强：在原有 reason 基础上，附加最新一日的指标信号标签（MACD金叉/KDJ超卖等）
   *
   * - 无 klines：原样返回 baseReason（向后兼容）
   * - 有 klines：计算 indicators，识别最新一日的 cross/break/extreme，附加为 " · 标签"
   *
   * indicatorConfig：可选指标配置（来自 customStrategy.indicatorParams）。
   * 缺省/非法 → 静默回退 DEFAULT_INDICATOR_CONFIG（不抛错，reason 仍增强）。
   *
   * 注意：本方法为公开 API，便于外部（如 LivePnlService）调用以丰富已生成的信号
   */
  enrichSignalReason(
    baseReason: string,
    klines: KlineData[] | undefined,
    indicatorConfig?: IndicatorConfig,
  ): string {
    if (!klines || klines.length === 0) return baseReason;
    let config = DEFAULT_INDICATOR_CONFIG;
    if (indicatorConfig) {
      try {
        config = this.normalizeStrategyConfig(indicatorConfig);
      } catch {
        // 校验失败 → 静默回退默认（不阻塞 reason 增强）
        config = DEFAULT_INDICATOR_CONFIG;
      }
    }
    const indicators: IndicatorBundle = this.indicatorCalc.computeAll(klines, config);
    const last = klines.length - 1;
    const tags: string[] = [];

    const macdCross = indicators.macd.crosses.find((c) => c.index === last);
    if (macdCross?.type === 'golden') tags.push('MACD金叉');
    if (macdCross?.type === 'death') tags.push('MACD死叉');

    const bollBreak = indicators.boll.breaks.find((b) => b.index === last);
    if (bollBreak?.type === 'upper') tags.push('BOLL突破上轨');
    if (bollBreak?.type === 'lower') tags.push('BOLL跌破下轨');

    const kdjExtreme = indicators.kdj.extremes.find((k) => k.index === last);
    if (kdjExtreme?.type === 'oversold') tags.push('KDJ超卖');
    if (kdjExtreme?.type === 'overbought') tags.push('KDJ超买');

    if (tags.length === 0) return baseReason;
    return `${baseReason} · ${tags.join(' · ')}`;
  }

  /**
   * 从 customStrategy.indicatorParams 构造 IndicatorConfig
   *
   * 形态约定（兼容旧代码）：
   *   indicatorParams: {
   *     ma?:  { periods: number[] }      // 或 { period: number } 单值
   *     macd?: { fast, slow, signal }
   *     boll?: { period, k }
   *     kdj?:  { n, m1, m2 }
   *   }
   *
   * 任何字段缺省/非法 → 抛 BadRequestException，由调用方决定回退策略
   * （enrichSignalReason 内部捕获并回退默认；外部直接调用 buildStrategyConfig 则不 catch）。
   */
  buildStrategyConfig(
    indicatorParams: Record<string, Record<string, unknown>> | undefined | null,
  ): IndicatorConfig {
    if (!indicatorParams || typeof indicatorParams !== 'object') {
      return DEFAULT_INDICATOR_CONFIG;
    }
    const cfg: Partial<IndicatorConfig> = {};

    if (indicatorParams.ma && typeof indicatorParams.ma === 'object') {
      const ma = indicatorParams.ma as { periods?: unknown; period?: unknown };
      if (Array.isArray(ma.periods)) {
        cfg.maPeriods = ma.periods.map((p) => Number(p));
      } else if (typeof ma.period === 'number') {
        cfg.maPeriods = [ma.period];
      }
    }
    if (indicatorParams.macd && typeof indicatorParams.macd === 'object') {
      const m = indicatorParams.macd as { fast?: number; slow?: number; signal?: number };
      cfg.macd = {
        fast: Number(m.fast ?? DEFAULT_INDICATOR_CONFIG.macd.fast),
        slow: Number(m.slow ?? DEFAULT_INDICATOR_CONFIG.macd.slow),
        signal: Number(m.signal ?? DEFAULT_INDICATOR_CONFIG.macd.signal),
      };
    }
    if (indicatorParams.boll && typeof indicatorParams.boll === 'object') {
      const b = indicatorParams.boll as { period?: number; k?: number };
      cfg.boll = {
        period: Number(b.period ?? DEFAULT_INDICATOR_CONFIG.boll.period),
        k: Number(b.k ?? DEFAULT_INDICATOR_CONFIG.boll.k),
      };
    }
    if (indicatorParams.kdj && typeof indicatorParams.kdj === 'object') {
      const k = indicatorParams.kdj as { n?: number; m1?: number; m2?: number };
      cfg.kdj = {
        n: Number(k.n ?? DEFAULT_INDICATOR_CONFIG.kdj.n),
        m1: Number(k.m1 ?? DEFAULT_INDICATOR_CONFIG.kdj.m1),
        m2: Number(k.m2 ?? DEFAULT_INDICATOR_CONFIG.kdj.m2),
      };
    }

    return this.normalizeStrategyConfig(cfg);
  }

  /**
   * 校验 + 规范化指标配置。
   * 校验失败抛 BadRequestException。
   */
  private normalizeStrategyConfig(input: Partial<IndicatorConfig>): IndicatorConfig {
    const cfg: Partial<IndicatorConfig> = input;

    let maPeriods: number[] = cfg.maPeriods ?? DEFAULT_INDICATOR_CONFIG.maPeriods;
    if (!Array.isArray(maPeriods) || maPeriods.length === 0) {
      maPeriods = DEFAULT_INDICATOR_CONFIG.maPeriods;
    }
    const cleaned: number[] = [];
    for (const p of maPeriods) {
      if (typeof p !== 'number' || !Number.isInteger(p) || p < 1 || p > 200) {
        throw new BadRequestException(`maPeriods 非法：每个元素必须是 1..200 的正整数`);
      }
      if (!cleaned.includes(p)) cleaned.push(p);
    }
    cleaned.sort((a, b) => a - b);
    if (cleaned.length === 0) {
      throw new BadRequestException('maPeriods 不能为空');
    }
    maPeriods = cleaned;

    const macd = cfg.macd ?? DEFAULT_INDICATOR_CONFIG.macd;
    if (
      typeof macd.fast !== 'number' || !Number.isInteger(macd.fast) || macd.fast < 1 || macd.fast > 200 ||
      typeof macd.slow !== 'number' || !Number.isInteger(macd.slow) || macd.slow < 1 || macd.slow > 200 ||
      typeof macd.signal !== 'number' || !Number.isInteger(macd.signal) || macd.signal < 1 || macd.signal > 200
    ) {
      throw new BadRequestException('macd 参数非法（必须 1..200 正整数）');
    }
    if (macd.fast >= macd.slow) {
      throw new BadRequestException(
        `macd.fast (${macd.fast}) 必须 < slow (${macd.slow})`,
      );
    }

    const boll = cfg.boll ?? DEFAULT_INDICATOR_CONFIG.boll;
    if (typeof boll.period !== 'number' || !Number.isInteger(boll.period) || boll.period < 1 || boll.period > 200) {
      throw new BadRequestException('boll.period 非法（必须 1..200 正整数）');
    }
    if (typeof boll.k !== 'number' || !Number.isFinite(boll.k) || boll.k < 0.1 || boll.k > 5) {
      throw new BadRequestException('boll.k 非法（必须 0.1..5）');
    }

    const kdj = cfg.kdj ?? DEFAULT_INDICATOR_CONFIG.kdj;
    if (
      typeof kdj.n !== 'number' || !Number.isInteger(kdj.n) || kdj.n < 1 || kdj.n > 200 ||
      typeof kdj.m1 !== 'number' || !Number.isInteger(kdj.m1) || kdj.m1 < 1 || kdj.m1 > 200 ||
      typeof kdj.m2 !== 'number' || !Number.isInteger(kdj.m2) || kdj.m2 < 1 || kdj.m2 > 200
    ) {
      throw new BadRequestException('kdj 参数非法（必须 1..200 正整数）');
    }

    return { maPeriods, macd, boll, kdj };
  }
}
