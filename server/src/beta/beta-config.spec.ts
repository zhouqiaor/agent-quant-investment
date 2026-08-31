import { BadRequestException } from '@nestjs/common';
import { PersistenceService } from '../persistence/persistence.service';
import { WatchlistService } from '../stock/watchlist.service';
import { BetaConfigService } from './beta-config.service';

/**
 * 阶段2 TDD：内测从零配置会话（BetaConfig）
 * SPEC: docs/SPEC-beta.md 2.2
 * 保存 = 校验（金额/关注/策略）→ status='active'，支持覆盖更新
 */
describe('BetaConfigService - 内测配置', () => {
  let persistence: PersistenceService;
  let watchlist: WatchlistService;
  let service: BetaConfigService;
  const dbPath = `/tmp/beta-config-test-${Date.now()}.db`;

  const validConfig = {
    initialCapital: 200000,
    watchSymbols: ['600519', '000333'],
    strategyId: null as string | null,
    autoTrade: true,
  };

  beforeEach(() => {
    persistence = new PersistenceService(dbPath);
    persistence.init();
    watchlist = new WatchlistService(persistence);
    watchlist.addWatch('600519');
    watchlist.addWatch('000333');
    service = new BetaConfigService(persistence, watchlist, {
      getCustomStrategy: () => null,
      getStrategies: () => [],
    } as any);
  });

  afterEach(() => {
    try {
      require('fs').unlinkSync(dbPath);
    } catch (e) {
      /* ignore */
    }
  });

  it('T1 未配置时 getConfig 返回 null，getDefault 返回默认草稿', () => {
    expect(service.getConfig()).toBeNull();
    const def = service.getDefaultConfig();
    expect(def).toMatchObject({ initialCapital: 100000, watchSymbols: [], autoTrade: true, status: 'draft' });
  });

  it('T2 金额 ≤0 → 400', () => {
    expect(() => service.saveConfig({ ...validConfig, initialCapital: 0 })).toThrow(BadRequestException);
    expect(() => service.saveConfig({ ...validConfig, initialCapital: -100 })).toThrow(BadRequestException);
  });

  it('T3 金额 >1e9 → 400', () => {
    expect(() => service.saveConfig({ ...validConfig, initialCapital: 1e9 + 1 })).toThrow(BadRequestException);
  });

  it('T4 watchSymbols 为空 → 400（至少关注一只）', () => {
    expect(() => service.saveConfig({ ...validConfig, watchSymbols: [] })).toThrow(BadRequestException);
  });

  it('T5 watchSymbols 含未关注股票 → 400', () => {
    expect(() => service.saveConfig({ ...validConfig, watchSymbols: ['600519', '601318'] })).toThrow(
      BadRequestException,
    );
  });

  it('T6 strategyId 不存在 → 400', () => {
    expect(() => service.saveConfig({ ...validConfig, strategyId: 'not-exist' })).toThrow(BadRequestException);
  });

  it('T7 保存成功 → status=active，读回一致', () => {
    const saved = service.saveConfig(validConfig);
    expect(saved.status).toBe('active');
    expect(saved.initialCapital).toBe(200000);
    expect(saved.watchSymbols).toEqual(['600519', '000333']);
    const loaded = service.getConfig();
    expect(loaded).toMatchObject({ initialCapital: 200000, status: 'active' });
  });

  it('T8 覆盖更新（再次保存生效）', () => {
    service.saveConfig(validConfig);
    const updated = service.saveConfig({ ...validConfig, initialCapital: 500000, autoTrade: false });
    expect(updated.initialCapital).toBe(500000);
    expect(updated.autoTrade).toBe(false);
    expect(service.getConfig()?.initialCapital).toBe(500000);
  });
});
