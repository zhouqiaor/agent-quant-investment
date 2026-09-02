/**
 * 阶段1 TDD：自定义股票服务
 * RED → GREEN → REFACTOR
 */
import { BadRequestException } from '@nestjs/common';
import { StockService } from '@/stock/stock.service';
import { PersistenceService } from '@/persistence/persistence.service';

describe('StockService - 自定义股票', () => {
  let service: StockService;
  let persistence: PersistenceService;
  let dbPath: string;
  const originalFetch = globalThis.fetch;

  beforeAll(() => {
    // 隔离网络：目录同步/行情兜底一律 mock 为空
    (globalThis as { fetch: unknown }).fetch = async () => ({
      ok: true,
      json: async () => [],
      text: async () => '',
      arrayBuffer: async () => new ArrayBuffer(0),
    });
  });

  afterAll(() => {
    (globalThis as { fetch: unknown }).fetch = originalFetch;
  });

  beforeEach(async () => {
    dbPath = `/tmp/test-custom-stock-${Date.now()}-${Math.floor(Math.random() * 1e6)}.db`;
    persistence = new PersistenceService(dbPath);
    persistence.init();
    service = new StockService(persistence);
  });

  afterEach(() => {
    persistence.close?.();
  });

  it('T1 添加合法沪市股票（6开头→sh，名称自动识别）', async () => {
    const stock = await service.addCustomStock('600519');
    expect(stock.symbol).toBe('600519');
    expect(stock.market).toBe('A');
    expect(stock.isCustom).toBe(true);
    expect(stock.name).toBeTruthy();
  });

  it('T2 添加深市股票（0/3开头→sz）', async () => {
    const stock = await service.addCustomStock('000858');
    expect(stock.symbol).toBe('000858');
  });

  it('T3 非法代码（非6位）→ 400', async () => {
    await expect(service.addCustomStock('60051')).rejects.toThrow(BadRequestException);
    await expect(service.addCustomStock('6005199')).rejects.toThrow(BadRequestException);
  });

  it('T4 非法代码（非A股前缀）→ 400', async () => {
    await expect(service.addCustomStock('900001')).rejects.toThrow(BadRequestException);
    await expect(service.addCustomStock('abcdef')).rejects.toThrow(BadRequestException);
  });

  it('T5 提供自定义名称时优先使用', async () => {
    const stock = await service.addCustomStock('600519', '我的茅台');
    expect(stock.name).toBe('我的茅台');
  });

  it('T6 重复添加幂等（返回已有记录）', async () => {
    const first = await service.addCustomStock('601318', '平安A');
    const second = await service.addCustomStock('601318');
    expect(second.name).toBe('平安A');
    expect(service.listCustomStocks().length).toBe(1);
    expect(first.symbol).toBe(second.symbol);
  });

  it('T7 删除自定义股票', async () => {
    await service.addCustomStock('600036');
    const ok = service.removeCustomStock('600036');
    expect(ok).toBe(true);
    expect(service.listCustomStocks().length).toBe(0);
    const again = service.removeCustomStock('600036');
    expect(again).toBe(false);
  });

  it('T8 列表返回全部自定义股票（含 isCustom 标记）', async () => {
    await service.addCustomStock('600036');
    await service.addCustomStock('300750');
    const list = service.listCustomStocks();
    expect(list.length).toBe(2);
    expect(list.every(s => s.isCustom === true)).toBe(true);
  });

  it('T9 搜索合并：自定义股票出现在搜索结果中', async () => {
    await service.addCustomStock('688981', '中芯自定义');
    const results = await service.searchStocks('688981');
    const customHits = results.filter((s) => s.isCustom);
    expect(customHits.length).toBeGreaterThanOrEqual(1);
    expect(customHits[0].name).toBe('中芯自定义');
    expect(customHits[0].isCustom).toBe(true);
  });

  it('T10 持久化：重新实例化后数据仍在', async () => {
    await service.addCustomStock('600036', '招行持久化');
    const persistence2 = new PersistenceService(dbPath);
    persistence2.init();
    const service2 = new StockService(persistence2);
    const list = service2.listCustomStocks();
    expect(list.length).toBe(1);
    expect(list[0].name).toBe('招行持久化');
    persistence2.close?.();
  });
});
