/**
 * 全量股票目录 + 真实K线 TDD
 * - syncAllStocks：分页拉取新浪全量A股目录（沪深A+北交所），幂等/懒刷新/force
 * - searchStocks：目录合并搜索（002378 等全市场可搜可选）
 * - addCustomStock：名称自动从目录解析
 * - isValidSymbol/getStockCode：北交所支持
 * - getKlineData：真实日K（新浪 JSONP），替换模拟数据
 *
 * 网络请求全部 mock（global.fetch），离线可跑、稳定。
 */
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { PersistenceService } from '../persistence/persistence.service';
import { StockService, STOCK_NAMES } from '../stock/stock.service';

// 新浪 clist 单页样例（真实字段结构）
const makeClistPage = (rows: Array<[prefix: string, code: string, name: string]>) =>
  rows.map(([prefix, code, name]) => ({
    symbol: `${prefix}${code}`,
    code,
    name,
    trade: '10.00',
    pricechange: '0.10',
    changepercent: '1.01',
    settlement: '9.90',
    open: '9.95',
    high: '10.20',
    low: '9.88',
    volume: 1000000,
    amount: 10000000,
    ticktime: '15:00:00',
    per: 12.5,
    pb: 1.8,
    mktcap: 500000, // 万元
  }));

describe('全量股票目录 + 真实K线', () => {
  let app: INestApplication;
  let http: any;
  let persistence: PersistenceService;
  let stockService: StockService;
  const dbPath = `/tmp/stock-dir-${Date.now()}.db`;
  let fetchMock: jest.Mock;
  const originalFetch = globalThis.fetch;

  const pageUrl = (page: number) =>
    `https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeData?page=${page}&num=100&sort=symbol&asc=1&node=hs_a`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    persistence = app.get(PersistenceService);
    persistence.setDbPath(dbPath);
    persistence.init();
    persistence.execRaw('DELETE FROM stock_directory; DELETE FROM custom_stocks;');
    await app.init();
    http = app.getHttpServer();
    stockService = app.get(StockService);

    // 默认 fetch mock：第1页返回4只（含深市002378/北交所920009），第2页返回空数组（终止分页）
    fetchMock = jest.fn(async (url: any) => {
      const u = String(url);
      if (u.includes('Market_Center.getHQNodeData')) {
        if (u.includes('page=1')) {
          return {
            ok: true,
            json: async () =>
              makeClistPage([
                ['sz', '002378', '章源钨业'],
                ['sh', '600519', '贵州茅台'],
                ['bj', '920009', '同心传动'],
                ['sz', '300750', '宁德时代'],
              ]),
          };
        }
        return { ok: true, json: async () => [] };
      }
      if (u.includes('CN_MarketDataService.getKLineData')) {
        return {
          ok: true,
          text: async () =>
            `var _=([{"day":"2026-08-31","open":"25.150","high":"25.630","low":"24.760","close":"25.620","volume":"25822670"},` +
            `{"day":"2026-09-01","open":"25.610","high":"25.670","low":"24.620","close":"24.730","volume":"25141729"},` +
            `{"day":"2026-09-02","open":"24.300","high":"24.300","low":"23.600","close":"24.100","volume":"19907643"}]);`,
        };
      }
      // 行情接口兜底（不应被本套测试依赖）
      return { ok: true, text: async () => 'var hq_str_sz002378="";' };
    });
    (globalThis as { fetch: unknown }).fetch = fetchMock;
  }, 30000);

  afterAll(async () => {
    (globalThis as { fetch: unknown }).fetch = originalFetch;
    jest.restoreAllMocks();
    await app.close();
    try {
      require('fs').unlinkSync(dbPath);
    } catch (e) {
      /* ignore */
    }
  });

  it('T1 syncAllStocks：分页拉取全量 → 目录入库（含深市/北交所），记录同步时间', async () => {
    const res = await stockService.syncAllStocks(true);
    expect(res.skipped).toBe(false);
    expect(res.count).toBe(4);
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('Market_Center.getHQNodeData'))).toBe(true);
    expect(persistence.directoryCount()).toBe(4);

    const meta = persistence.getDirectoryMeta('002378');
    expect(meta).toBeTruthy();
    expect(meta!.name).toBe('章源钨业');
    expect(meta!.market).toBe('sz');
    expect(persistence.getDirectoryMeta('920009')!.market).toBe('bj');
    expect(persistence.getDirectoryLastSyncAt()).toBeGreaterThan(0);
  });

  it('T2 懒刷新：24h 内重复同步跳过网络请求', async () => {
    const before = fetchMock.mock.calls.length;
    const res = await stockService.syncAllStocks(false);
    expect(res.skipped).toBe(true);
    expect(fetchMock.mock.calls.length).toBe(before);
  });

  it('T3 force=true 强制重新同步', async () => {
    const res = await stockService.syncAllStocks(true);
    expect(res.skipped).toBe(false);
    expect(res.count).toBe(4);
  });

  it('T4 searchStocks("002378")：目录命中章源钨业（核心用户诉求）', async () => {
    const list = await stockService.searchStocks('002378');
    const hit = list.find((s) => s.symbol === '002378');
    expect(hit).toBeTruthy();
    expect(hit!.name).toBe('章源钨业');
  });

  it('T5 searchStocks("章源")：按名称命中', async () => {
    const list = await stockService.searchStocks('章源');
    expect(list.some((s) => s.symbol === '002378' && s.name === '章源钨业')).toBe(true);
  });

  it('T6 addCustomStock("002378")：名称自动从目录解析，无需行情接口', async () => {
    const before = fetchMock.mock.calls.length;
    const stock = await stockService.addCustomStock('002378');
    expect(stock.name).toBe('章源钨业');
    expect(stock.isCustom).toBe(true);
    // 不应触发行情请求（名称来自目录）
    expect(fetchMock.mock.calls.length).toBe(before);
  });

  it('T7 北交所代码支持校验与行情前缀', async () => {
    // isValidSymbol 通过 addCustomStock 验证
    const stock = await stockService.addCustomStock('920009');
    expect(stock.symbol).toBe('920009');
    expect(stock.name).toBe('同心传动');
    // getStockCode 映射 bj 前缀
    expect((stockService as any).getStockCode('920009')).toBe('bj920009');
    expect((stockService as any).getStockCode('430047')).toBe('bj430047');
    expect((stockService as any).getStockCode('832566')).toBe('bj832566');
    // 沪深不受影响
    expect((stockService as any).getStockCode('600519')).toBe('sh600519');
    expect((stockService as any).getStockCode('002378')).toBe('sz002378');
    expect((stockService as any).getStockCode('300750')).toBe('sz300750');
  });

  it('T8 非法代码仍被拒绝', async () => {
    await expect(stockService.addCustomStock('123456')).rejects.toThrow();
    await expect(stockService.addCustomStock('abc')).rejects.toThrow();
  });

  it('T9 getKlineData：解析新浪真实日K（字段/顺序/数值类型）', async () => {
    const klines = await stockService.getKlineData('002378', 'daily', 3);
    expect(klines.length).toBe(3);
    expect(klines[0].date).toBe('2026-08-31');
    expect(klines[2].date).toBe('2026-09-02');
    expect(klines[2].close).toBeCloseTo(24.1, 2);
    expect(typeof klines[0].open).toBe('number');
    expect(typeof klines[0].volume).toBe('number');
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('symbol=sz002378'))).toBe(true);
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('scale=240'))).toBe(true);
  });

  it('T10 K线接口失败 → 返回空数组（不回退假数据、不抛错）', async () => {
    fetchMock.mockImplementationOnce(async () => ({
      ok: false,
      status: 503,
      json: async () => [],
      text: async () => '',
    }));
    const klines = await stockService.getKlineData('600519', 'daily', 10);
    expect(Array.isArray(klines)).toBe(true);
    expect(klines.length).toBe(0);
  });

  it('T11 searchStocks("")：空查询返回静态热门兜底（行为不变）', async () => {
    const list = await stockService.searchStocks('');
    expect(list.length).toBeGreaterThan(0);
    expect(list.length).toBeLessThanOrEqual(10);
    expect(Object.keys(STOCK_NAMES)).toContain(list[0].symbol);
  });

  it('T12 E2E-HTTP：POST /api/stock/sync + GET /api/stock/search 全链路', async () => {
    const sync = await request(http).post('/api/stock/sync').send({ force: true }).expect(200);
    expect(sync.body.data.count).toBe(4);

    const search = await request(http).get('/api/stock/search?q=002378').expect(200);
    const hit = (search.body.data || []).find((s: { symbol: string }) => s.symbol === '002378');
    expect(hit).toBeTruthy();
    expect(hit.name).toBe('章源钨业');
  });
});
