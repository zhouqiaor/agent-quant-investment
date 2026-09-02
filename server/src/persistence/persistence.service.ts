import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import Database = require('better-sqlite3');

export interface CustomStrategyRecord {
  id?: string;
  name: string;
  symbol: string;
  indicators?: any;
  indicatorParams?: any;
  buyConditions?: any;
  sellConditions?: any;
  positionSize?: number;
  stopLoss?: number;
  takeProfit?: number;
  autoTrade?: boolean;
  monitorEnabled?: boolean;
  isRunning?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TradeRecord {
  id: string;
  type: string;
  code?: string;
  symbol?: string;
  name?: string;
  price?: number;
  quantity?: number;
  amount?: number;
  reason?: string;
  time?: string;
  [key: string]: any;
}

export interface BacktestResultRecord {
  id?: string;
  symbol?: string;
  code?: string;
  name?: string;
  startDate?: string;
  endDate?: string;
  initialCapital?: number;
  finalCapital?: number;
  strategyReturn?: number;
  benchmarkReturn?: number;
  totalReturn?: number;
  annualizedReturn?: number;
  maxDrawdown?: number;
  volatility?: number;
  sharpe?: number;
  sortino?: number;
  winRate?: number;
  profitLossRatio?: number;
  totalTrades?: number;
  equityCurve?: any;
  trades?: any;
  createdAt?: string;
}

export interface CustomStockRecord {
  symbol: string;
  name: string;
  market?: string;
  createdAt?: number;
}

export interface OptimizationRecord {
  id?: string;
  symbol?: string;
  code?: string;
  name?: string;
  paramSpace?: any;
  bestParams?: any;
  bestScore?: number;
  totalCombos?: number;
  testedCombos?: number;
  results?: any;
  status?: string;
  createdAt?: string;
}

export interface NotificationRecord {
  id?: string;
  type?: string;
  title?: string;
  content?: string;
  symbol?: string;
  signalType?: string;
  price?: number;
  source?: string;
  read?: boolean;
  createdAt?: string;
}


/**
 * 数据持久化服务（SQLite）
 * 参考 Freqtrade 的 SQLite 存储模式：所有核心实体(策略/交易/回测)落盘，
 * 重启后数据不丢失。开发/沙箱环境使用本地文件，生产可平滑切换到 Postgres。
 */
@Injectable()
export class PersistenceService implements OnModuleInit {
  onModuleInit() {
    this.init();
  }
  private readonly logger = new Logger(PersistenceService.name);
  private db: Database.Database;
  private dbPath: string;

  constructor(@Optional() dbPath?: string) {
    this.dbPath = dbPath || process.env.SQLITE_PATH || 'data/quant.db';
  }

  /** 测试基建：切换存储路径并重新初始化（关闭旧连接，建新库） */
  setDbPath(path: string): void {
    if (this.db) {
      this.db.close();
      this.db = null as unknown as Database.Database;
    }
    this.dbPath = path;
    this.init();
  }

  init() {
    if (this.db) return;
    const dir = dirname(this.dbPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.createTables();
    this.logger.log(`SQLite 持久化已初始化: ${this.dbPath}`);
  }

  private createTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS custom_strategies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        symbol TEXT NOT NULL,
        indicators TEXT,
        indicatorParams TEXT,
        buyConditions TEXT,
        sellConditions TEXT,
        positionSize REAL,
        stopLoss REAL,
        takeProfit REAL,
        autoTrade INTEGER,
        monitorEnabled INTEGER,
        isRunning INTEGER DEFAULT 0,
        createdAt TEXT,
        updatedAt TEXT
      );

      CREATE TABLE IF NOT EXISTS trades (
        id TEXT PRIMARY KEY,
        type TEXT,
        code TEXT,
        symbol TEXT,
        name TEXT,
        price REAL,
        quantity REAL,
        amount REAL,
        reason TEXT,
        time TEXT,
        extra TEXT
      );

      CREATE TABLE IF NOT EXISTS backtest_results (
        id TEXT PRIMARY KEY,
        symbol TEXT,
        code TEXT,
        name TEXT,
        startDate TEXT,
        endDate TEXT,
        initialCapital REAL,
        finalCapital REAL,
        strategyReturn REAL,
        benchmarkReturn REAL,
        totalReturn REAL,
        annualizedReturn REAL,
        maxDrawdown REAL,
        volatility REAL,
        sharpe REAL,
        sortino REAL,
        winRate REAL,
        profitLossRatio REAL,
        totalTrades INTEGER,
        equityCurve TEXT,
        trades TEXT,
        createdAt TEXT
      );

      CREATE TABLE IF NOT EXISTS optimizations (
        id TEXT PRIMARY KEY,
        symbol TEXT,
        code TEXT,
        name TEXT,
        paramSpace TEXT,
        bestParams TEXT,
        bestScore REAL,
        totalCombos INTEGER,
        testedCombos INTEGER,
        results TEXT,
        status TEXT,
        createdAt TEXT,
        extra TEXT
      );

      CREATE TABLE IF NOT EXISTS custom_stocks (
        symbol TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        market TEXT DEFAULT 'A',
        createdAt INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS stock_directory (
        symbol TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        market TEXT NOT NULL,
        price REAL DEFAULT 0,
        changePercent REAL DEFAULT 0,
        pe REAL,
        pb REAL,
        mktcap REAL,
        updatedAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_directory_name ON stock_directory(name);
      CREATE TABLE IF NOT EXISTS watch_stocks (
        symbol TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        createdAt INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS beta_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updatedAt INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        type TEXT,
        title TEXT,
        content TEXT,
        symbol TEXT,
        signalType TEXT,
        price REAL,
        source TEXT,
        read INTEGER DEFAULT 0,
        createdAt TEXT,
        extra TEXT
      );
    `);
  }

  // ==================== 自定义策略 ====================
  saveCustomStrategy(strategy: CustomStrategyRecord & { id?: string }): string {
    const id = strategy.id || `cs_${Date.now()}`;
    const now = new Date().toISOString();
    const existing = this.getCustomStrategyRaw(id);
    const s = {
      id,
      name: strategy.name,
      symbol: strategy.symbol,
      indicators: JSON.stringify(strategy.indicators || []),
      indicatorParams: JSON.stringify(strategy.indicatorParams || {}),
      buyConditions: JSON.stringify(strategy.buyConditions || []),
      sellConditions: JSON.stringify(strategy.sellConditions || []),
      positionSize: strategy.positionSize ?? 10,
      stopLoss: strategy.stopLoss ?? 5,
      takeProfit: strategy.takeProfit ?? 15,
      autoTrade: strategy.autoTrade ? 1 : 0,
      monitorEnabled: strategy.monitorEnabled ? 1 : 0,
      isRunning: strategy.isRunning ? 1 : 0,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    this.db
      .prepare(
        `INSERT OR REPLACE INTO custom_strategies
         (id, name, symbol, indicators, indicatorParams, buyConditions, sellConditions,
          positionSize, stopLoss, takeProfit, autoTrade, monitorEnabled, isRunning, createdAt, updatedAt)
         VALUES (@id, @name, @symbol, @indicators, @indicatorParams, @buyConditions, @sellConditions,
          @positionSize, @stopLoss, @takeProfit, @autoTrade, @monitorEnabled, @isRunning, @createdAt, @updatedAt)`,
      )
      .run(s);
    return id;
  }

  // ==================== 优化结果 ====================
  saveOptimization(record: OptimizationRecord): string {
    const id = record.id || `opt_${Date.now()}`;
    const code = record.code || record.symbol;
    this.db
      .prepare(
        `INSERT OR REPLACE INTO optimizations
         (id, symbol, code, name, paramSpace, bestParams, bestScore, totalCombos,
          testedCombos, results, status, createdAt)
         VALUES (@id, @symbol, @code, @name, @paramSpace, @bestParams, @bestScore, @totalCombos,
          @testedCombos, @results, @status, @createdAt)`,
      )
      .run({
        id,
        symbol: record.symbol || code,
        code,
        name: record.name || null,
        paramSpace: JSON.stringify(record.paramSpace || {}),
        bestParams: JSON.stringify(record.bestParams || {}),
        bestScore: record.bestScore ?? null,
        totalCombos: record.totalCombos ?? null,
        testedCombos: record.testedCombos ?? null,
        results: JSON.stringify(record.results || []),
        status: record.status || 'completed',
        createdAt: new Date().toISOString(),
      });
    return id;
  }

  listOptimizations(symbol?: string): OptimizationRecord[] {
    if (symbol) {
      const code = symbol;
      return this.db
        .prepare('SELECT * FROM optimizations WHERE symbol = ? OR code = ? ORDER BY createdAt DESC')
        .all(code, code)
        .map((r: any) => this.mapOptimization(r));
    }
    return this.db
      .prepare('SELECT * FROM optimizations ORDER BY createdAt DESC')
      .all()
      .map((r: any) => this.mapOptimization(r));
  }

  // ==================== 自定义股票 ====================
  saveCustomStock(stock: { symbol: string; name: string; market?: string; createdAt?: number }): void {
    this.db
      .prepare(
        'INSERT OR REPLACE INTO custom_stocks (symbol, name, market, createdAt) VALUES (?, ?, ?, ?)'
      )
      .run(stock.symbol, stock.name, stock.market || 'A', stock.createdAt || Date.now());
  }

  listCustomStocks(): Array<{ symbol: string; name: string; market: string; createdAt: number }> {
    return this.db
      .prepare('SELECT symbol, name, market, createdAt FROM custom_stocks ORDER BY createdAt DESC')
      .all() as Array<{ symbol: string; name: string; market: string; createdAt: number }>;
  }

  deleteCustomStock(symbol: string): boolean {
    return this.db.prepare('DELETE FROM custom_stocks WHERE symbol = ?').run(symbol).changes > 0;
  }

  // ==================== 股票目录（全量A股+北交所） ====================
  /** 批量 upsert 全量目录（事务写入，幂等） */
  upsertDirectoryBatch(
    rows: Array<{
      symbol: string;
      name: string;
      market: string;
      price: number;
      changePercent: number;
      pe: number | null;
      pb: number | null;
      mktcap: number | null;
    }>,
  ): void {
    if (rows.length === 0) return;
    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO stock_directory
       (symbol, name, market, price, changePercent, pe, pb, mktcap, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const now = Date.now();
    this.db.transaction((batch: typeof rows) => {
      for (const r of batch) {
        stmt.run(r.symbol, r.name, r.market, r.price, r.changePercent, r.pe, r.pb, r.mktcap, now);
      }
    })(rows);
  }

  /** 搜索目录：代码前缀优先 + 名称包含，去重合并 */
  searchDirectory(
    q: string,
    limit = 20,
  ): Array<{
    symbol: string;
    name: string;
    market: string;
    price: number;
    changePercent: number;
  }> {
    const query = q.trim();
    if (!query) return [];
    const byCode = this.db
      .prepare(
        'SELECT symbol, name, market, price, changePercent FROM stock_directory WHERE symbol LIKE ? ORDER BY symbol LIMIT ?',
      )
      .all(`${query}%`, limit) as Array<{
      symbol: string;
      name: string;
      market: string;
      price: number;
      changePercent: number;
    }>;
    const byName = this.db
      .prepare(
        'SELECT symbol, name, market, price, changePercent FROM stock_directory WHERE name LIKE ? ORDER BY symbol LIMIT ?',
      )
      .all(`%${query}%`, limit) as Array<{
      symbol: string;
      name: string;
      market: string;
      price: number;
      changePercent: number;
    }>;
    const seen = new Set(byCode.map((r) => r.symbol));
    return [...byCode, ...byName.filter((r) => !seen.has(r.symbol))].slice(0, limit);
  }

  directoryCount(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS c FROM stock_directory').get() as { c: number };
    return row.c;
  }

  getDirectoryMeta(
    symbol: string,
  ): { symbol: string; name: string; market: string; price: number } | null {
    const row = this.db
      .prepare('SELECT symbol, name, market, price FROM stock_directory WHERE symbol = ?')
      .get(symbol) as { symbol: string; name: string; market: string; price: number } | undefined;
    return row || null;
  }

  /** 目录同步时间存于 beta_config（clearAllData 会重置触发重新同步，目录数据本身保留） */
  getDirectoryLastSyncAt(): number {
    return this.getBetaConfig<number>('directory_last_sync_at') || 0;
  }

  setDirectoryLastSyncAt(ts: number): void {
    this.saveBetaConfig('directory_last_sync_at', ts);
  }

  // ==================== 关注列表（Watchlist） ====================
  saveWatch(w: { symbol: string; name: string; enabled?: boolean; createdAt?: number }): void {
    this.db
      .prepare(
        'INSERT OR REPLACE INTO watch_stocks (symbol, name, enabled, createdAt) VALUES (?, ?, ?, ?)'
      )
      .run(w.symbol, w.name, w.enabled === false ? 0 : 1, w.createdAt || Date.now());
  }

  listWatches(): Array<{ symbol: string; name: string; enabled: boolean; createdAt: number }> {
    return this.db
      .prepare('SELECT symbol, name, enabled, createdAt FROM watch_stocks')
      .all()
      .map((r: any) => ({
        symbol: r.symbol,
        name: r.name,
        enabled: !!r.enabled,
        createdAt: r.createdAt,
      })) as Array<{ symbol: string; name: string; enabled: boolean; createdAt: number }>;
  }

  updateWatchEnabled(symbol: string, enabled: boolean): boolean {
    return this.db
      .prepare('UPDATE watch_stocks SET enabled = ? WHERE symbol = ?')
      .run(enabled ? 1 : 0, symbol).changes > 0;
  }

  deleteWatch(symbol: string): boolean {
    return this.db.prepare('DELETE FROM watch_stocks WHERE symbol = ?').run(symbol).changes > 0;
  }

  // ==================== 内测配置（BetaConfig） ====================
  /** 一键清空全部业务数据（从零重置用），保留表结构 */
  clearAllData(): void {
    const tables = [
      'watch_stocks',
      'custom_strategies',
      'custom_stocks',
      'trades',
      'backtest_results',
      'notifications',
      'optimizations',
      'beta_config',
    ];
    for (const t of tables) {
      this.db.prepare(`DELETE FROM ${t}`).run();
    }
  }

  /** 测试辅助：执行原始 SQL（E2E 种子数据用） */
  execRaw(sql: string): void {
    this.db.exec(sql);
  }

  saveBetaConfig(key: string, value: unknown): void {
    this.db
      .prepare('INSERT OR REPLACE INTO beta_config (key, value, updatedAt) VALUES (?, ?, ?)')
      .run(key, JSON.stringify(value), Date.now());
  }

  getBetaConfig<T>(key: string): T | null {
    const row = this.db.prepare('SELECT value FROM beta_config WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    if (!row) return null;
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return null;
    }
  }

  // ==================== 通知 ====================
  saveNotification(record: NotificationRecord & { id?: string }): string {
    const id = record.id || `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.db
      .prepare(
        `INSERT INTO notifications (id, title, content, symbol, signalType, price, source, read, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        record.title || '',
        record.content || '',
        record.symbol || '',
        record.signalType || '',
        record.price ?? null,
        record.source || '',
        record.read ? 1 : 0,
        record.createdAt || new Date().toISOString()
      );
    return id;
  }

  listNotifications(options?: { limit?: number; unreadOnly?: boolean }): NotificationRecord[] {
    const limit = options?.limit || 50;
    const rows = options?.unreadOnly
      ? this.db.prepare('SELECT * FROM notifications WHERE read = 0 ORDER BY createdAt DESC LIMIT ?').all(limit)
      : this.db.prepare('SELECT * FROM notifications ORDER BY createdAt DESC LIMIT ?').all(limit);
    return rows.map((r: any) => this.mapNotification(r));
  }

  markNotificationRead(id: string): boolean {
    const res = this.db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(id);
    return res.changes > 0;
    this.db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(id);
  }

  markAllNotificationsRead(): void {
    this.db.prepare('UPDATE notifications SET read = 1').run();
  }

  private mapNotification(r: any): NotificationRecord {
    return {
      id: r.id,
      title: r.title,
      content: r.content,
      symbol: r.symbol,
      signalType: r.signalType,
      price: r.price,
      source: r.source,
      read: !!r.read,
      createdAt: r.createdAt,
    };
  }

  private mapOptimization(r: any): OptimizationRecord {
    const { code: _code, extra, ...rest } = r;
    return {
      ...rest,
      ...(extra ? JSON.parse(extra) : {}),
      paramSpace: JSON.parse(r.paramSpace || '{}'),
      bestParams: JSON.parse(r.bestParams || '{}'),
      results: JSON.parse(r.results || '[]'),
      extra: undefined,
    } as unknown as OptimizationRecord;
  }

  private getCustomStrategyRaw(id: string): any {
    return this.db.prepare('SELECT * FROM custom_strategies WHERE id = ?').get(id) as any;
  }

  getCustomStrategy(id: string): (CustomStrategyRecord & { id: string }) | null {
    const row = this.getCustomStrategyRaw(id);
    return row ? this.hydrateStrategy(row) : null;
  }

  getAllCustomStrategies(): (CustomStrategyRecord & { id: string })[] {
    const rows = this.db
      .prepare('SELECT * FROM custom_strategies ORDER BY createdAt DESC')
      .all() as any[];
    return rows.map((r) => this.hydrateStrategy(r));
  }

  private hydrateStrategy(row: any): CustomStrategyRecord & { id: string } {
    return {
      id: row.id,
      name: row.name,
      symbol: row.symbol,
      indicators: JSON.parse(row.indicators || '[]'),
      indicatorParams: JSON.parse(row.indicatorParams || '{}'),
      buyConditions: JSON.parse(row.buyConditions || '[]'),
      sellConditions: JSON.parse(row.sellConditions || '[]'),
      positionSize: row.positionSize,
      stopLoss: row.stopLoss,
      takeProfit: row.takeProfit,
      autoTrade: !!row.autoTrade,
      monitorEnabled: !!row.monitorEnabled,
      isRunning: !!row.isRunning,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  deleteCustomStrategy(id: string): boolean {
    const result = this.db.prepare('DELETE FROM custom_strategies WHERE id = ?').run(id);
    return result.changes > 0;
  }

  setStrategyRunning(id: string, running: boolean): void {
    this.db
      .prepare('UPDATE custom_strategies SET isRunning = ?, updatedAt = ? WHERE id = ?')
      .run(running ? 1 : 0, new Date().toISOString(), id);
  }

  // ==================== 交易记录 ====================
  saveTrade(trade: TradeRecord): void {
    const code = trade.code || trade.symbol;
    const { id, type, name, price, quantity, amount, reason, time } = trade;
    const extra = JSON.stringify(
      Object.fromEntries(
        Object.entries(trade).filter(
          ([k]) =>
            ![
              'id',
              'type',
              'code',
              'symbol',
              'name',
              'price',
              'quantity',
              'amount',
              'reason',
              'time',
            ].includes(k),
        ),
      ),
    );
    this.db
      .prepare(
        `INSERT OR REPLACE INTO trades (id, type, code, symbol, name, price, quantity, amount, reason, time, extra)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        type,
        code,
        trade.symbol || code,
        name || null,
        price ?? null,
        quantity ?? null,
        amount ?? null,
        reason || null,
        time || new Date().toISOString(),
        extra,
      );
  }

  getTrades(filter?: { code?: string; limit?: number }): TradeRecord[] {
    let rows: any[];
    if (filter?.code) {
      rows = this.db
        .prepare('SELECT * FROM trades WHERE code = ? ORDER BY time DESC LIMIT ?')
        .all(filter.code, filter.limit || 200) as any[];
    } else {
      rows = this.db
        .prepare('SELECT * FROM trades ORDER BY time DESC LIMIT ?')
        .all(filter?.limit || 200) as any[];
    }
    return rows.map((r) => {
      const extra = r.extra ? JSON.parse(r.extra) : {};
      return { ...extra, ...r, extra: undefined };
    });
  }

  // ==================== 回测结果 ====================
  saveBacktestResult(result: BacktestResultRecord): string {
    const id = result.id || `bt_${Date.now()}`;
    const code = result.code || result.symbol;
    this.db
      .prepare(
        `INSERT OR REPLACE INTO backtest_results
         (id, symbol, code, name, startDate, endDate, initialCapital, finalCapital,
          strategyReturn, benchmarkReturn, totalReturn, annualizedReturn, maxDrawdown,
          volatility, sharpe, sortino, winRate, profitLossRatio, totalTrades,
          equityCurve, trades, createdAt)
         VALUES (@id, @symbol, @code, @name, @startDate, @endDate, @initialCapital, @finalCapital,
          @strategyReturn, @benchmarkReturn, @totalReturn, @annualizedReturn, @maxDrawdown,
          @volatility, @sharpe, @sortino, @winRate, @profitLossRatio, @totalTrades,
          @equityCurve, @trades, @createdAt)`,
      )
      .run({
        id,
        symbol: result.symbol || code,
        code,
        name: result.name || null,
        startDate: result.startDate || null,
        endDate: result.endDate || null,
        initialCapital: result.initialCapital ?? null,
        finalCapital: result.finalCapital ?? null,
        strategyReturn: result.strategyReturn ?? result.totalReturn ?? null,
        benchmarkReturn: result.benchmarkReturn ?? null,
        totalReturn: result.totalReturn ?? result.strategyReturn ?? null,
        annualizedReturn: result.annualizedReturn ?? null,
        maxDrawdown: result.maxDrawdown ?? null,
        volatility: result.volatility ?? null,
        sharpe: result.sharpe ?? null,
        sortino: result.sortino ?? null,
        winRate: result.winRate ?? null,
        profitLossRatio: result.profitLossRatio ?? null,
        totalTrades: result.totalTrades ?? null,
        equityCurve: JSON.stringify(result.equityCurve || []),
        trades: JSON.stringify(result.trades || []),
        createdAt: new Date().toISOString(),
      });
    return id;
  }

  getBacktestHistory(): BacktestResultRecord[] {
    const rows = this.db
      .prepare(
        `SELECT id, symbol, code, name, startDate, endDate, initialCapital, finalCapital,
                strategyReturn, benchmarkReturn, totalReturn, annualizedReturn, maxDrawdown,
                volatility, sharpe, sortino, winRate, profitLossRatio, totalTrades, createdAt
         FROM backtest_results ORDER BY createdAt DESC LIMIT 100`,
      )
      .all() as any[];
    return rows;
  }

  getBacktestResult(id: string): BacktestResultRecord | null {
    const row = this.db.prepare('SELECT * FROM backtest_results WHERE id = ?').get(id) as any;
    if (!row) return null;
    return {
      ...row,
      equityCurve: JSON.parse(row.equityCurve || '[]'),
      trades: JSON.parse(row.trades || '[]'),
    };
  }

  close() {
    try {
      this.db?.close();
    } catch (e) {
      // ignore
    }
  }
}
