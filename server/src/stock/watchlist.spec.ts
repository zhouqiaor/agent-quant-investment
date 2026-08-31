import { BadRequestException } from '@nestjs/common';
import { PersistenceService } from '../persistence/persistence.service';
import { WatchlistService } from './watchlist.service';

/**
 * 阶段1 TDD：关注列表（Watchlist）
 * SPEC: docs/SPEC-beta.md 2.1
 * 用户从零配置：关注股票 + 逐只开关「参与投资」；与自定义股票联动（搜索可见）
 */
describe('WatchlistService - 关注列表', () => {
  let persistence: PersistenceService;
  let service: WatchlistService;
  const dbPath = `/tmp/watchlist-test-${Date.now()}.db`;

  beforeEach(() => {
    persistence = new PersistenceService(dbPath);
    persistence.init();
    service = new WatchlistService(persistence);
  });

  afterEach(() => {
    try {
      require('fs').unlinkSync(dbPath);
    } catch (e) {
      /* ignore */
    }
  });

  it('T1 添加合法关注（默认 enabled=true）', () => {
    const item = service.addWatch('600519');
    expect(item).toMatchObject({ symbol: '600519', name: '贵州茅台', enabled: true });
    expect(service.listWatch().length).toBe(1);
  });

  it('T2 非法代码 → 400', () => {
    expect(() => service.addWatch('12345')).toThrow(BadRequestException);
    expect(() => service.addWatch('abcdef')).toThrow(BadRequestException);
    expect(() => service.addWatch('900001')).toThrow(BadRequestException);
  });

  it('T3 重复添加幂等（更新 enabled 不重复）', () => {
    service.addWatch('600036');
    const again = service.addWatch('600036', undefined, false);
    expect(again.enabled).toBe(false);
    expect(service.listWatch().length).toBe(1);
  });

  it('T4 toggle 开关参与投资', () => {
    service.addWatch('300750');
    expect(service.toggleWatch('300750', false).enabled).toBe(false);
    expect(service.toggleWatch('300750', true).enabled).toBe(true);
  });

  it('T5 toggle 不存在 → 400', () => {
    expect(() => service.toggleWatch('601318', false)).toThrow(BadRequestException);
  });

  it('T6 removeWatch 删除 + 不存在返回 false', () => {
    service.addWatch('000858');
    expect(service.removeWatch('000858')).toBe(true);
    expect(service.removeWatch('000858')).toBe(false);
    expect(service.listWatch().length).toBe(0);
  });

  it('T7 listWatch 排序：enabled 优先，其余按时间倒序', () => {
    service.addWatch('600036', undefined, false); // disabled
    service.addWatch('600519'); // enabled 1st
    service.addWatch('000333'); // enabled 2nd
    const list = service.listWatch();
    // enabled 优先；同为 enabled 时 createdAt 倒序（后添加在前）
    expect(list.map((s) => s.symbol).slice(0, 2)).toEqual(['000333', '600519']);
    expect(list[2].symbol).toBe('600036');
  });

  it('T8 getEnabledSymbols 只返回参与投资的标的', () => {
    service.addWatch('600519');
    service.addWatch('000333', undefined, false);
    expect(service.getEnabledSymbols()).toEqual(['600519']);
  });

  it('T9 添加关注联动写入 custom_stocks（搜索可见）', () => {
    service.addWatch('600519', '我的茅台');
    const customs = persistence.listCustomStocks();
    expect(customs.some((s) => s.symbol === '600519' && s.name === '我的茅台')).toBe(true);
  });

  it('T10 持久化：重新实例化后数据仍在', () => {
    service.addWatch('600519');
    service.toggleWatch('600519', false);
    const p2 = new PersistenceService(dbPath);
    p2.init();
    const s2 = new WatchlistService(p2);
    const list = s2.listWatch();
    expect(list.length).toBe(1);
    expect(list[0].enabled).toBe(false);
    p2.close?.();
  });
});
