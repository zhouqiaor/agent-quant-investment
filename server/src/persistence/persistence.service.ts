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
  signalId?: string;
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
    this.migrate();
    this.logger.log(`SQLite 持久化已初始化: ${this.dbPath}`);
  }

  /**
   * 数据库迁移：为已有表增加新列（SQLite 不支持 ADD COLUMN IF NOT EXISTS）
   */
  private migrate() {
    // paper_accounts 增加 type / meta 列（v2 架构升级）
    const accountCols = this.db.prepare("PRAGMA table_info(paper_accounts)").all() as any[];
    const hasType = accountCols.some(c => c.name === 'type');
    const hasMeta = accountCols.some(c => c.name === 'meta');
    if (!hasType) {
      this.db.exec("ALTER TABLE paper_accounts ADD COLUMN type TEXT DEFAULT 'live'");
      this.logger.log('migrated: paper_accounts.type');
    }
    if (!hasMeta) {
      this.db.exec("ALTER TABLE paper_accounts ADD COLUMN meta TEXT");
      this.logger.log('migrated: paper_accounts.meta');
    }
    // custom_strategies 增加 parentId / version / forkedAt（v3 架构升级：策略版本化）
    const stratCols = this.db.prepare("PRAGMA table_info(custom_strategies)").all() as any[];
    if (!stratCols.some((c) => c.name === 'parent_id')) {
      this.db.exec('ALTER TABLE custom_strategies ADD COLUMN parent_id TEXT');
      this.logger.log('migrated: custom_strategies.parent_id');
    }
    if (!stratCols.some((c) => c.name === 'version')) {
      this.db.exec('ALTER TABLE custom_strategies ADD COLUMN version INTEGER DEFAULT 1');
      this.logger.log('migrated: custom_strategies.version');
    }
    if (!stratCols.some((c) => c.name === 'forked_at')) {
      this.db.exec('ALTER TABLE custom_strategies ADD COLUMN forked_at INTEGER');
      this.logger.log('migrated: custom_strategies.forked_at');
    }
    if (!stratCols.some((c) => c.name === 'root_id')) {
      this.db.exec('ALTER TABLE custom_strategies ADD COLUMN root_id TEXT');
      this.logger.log('migrated: custom_strategies.root_id');
    }
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

      CREATE TABLE IF NOT EXISTS paper_accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT DEFAULT 'live',
        initialCapital REAL NOT NULL,
        cash REAL NOT NULL,
        totalValue REAL NOT NULL,
        totalPnl REAL NOT NULL,
        totalPnlRate REAL NOT NULL,
        isRunning INTEGER DEFAULT 0,
        startDate TEXT NOT NULL,
        strategies TEXT,
        meta TEXT,
        createdAt TEXT,
        updatedAt TEXT
      );

      CREATE TABLE IF NOT EXISTS paper_positions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        accountId TEXT NOT NULL,
        symbol TEXT NOT NULL,
        name TEXT NOT NULL,
        quantity REAL NOT NULL,
        avgCost REAL NOT NULL,
        currentPrice REAL NOT NULL,
        marketValue REAL NOT NULL,
        pnl REAL NOT NULL,
        pnlRate REAL NOT NULL,
        openDate TEXT NOT NULL,
        createdAt TEXT,
        updatedAt TEXT
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

      CREATE TABLE IF NOT EXISTS risk_settings (
        id TEXT PRIMARY KEY,
        maxDrawdown REAL,
        stopLossRate REAL,
        takeProfitRate REAL,
        maxPositionRate REAL,
        dailyTradeLimit INTEGER
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
        turnoverratio REAL,
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
        signalId TEXT,
        signalType TEXT,
        price REAL,
        source TEXT,
        read INTEGER DEFAULT 0,
        createdAt TEXT,
        extra TEXT
      );

      CREATE TABLE IF NOT EXISTS history_kline (
        symbol TEXT NOT NULL,
        date TEXT NOT NULL,
        open REAL NOT NULL,
        high REAL NOT NULL,
        low REAL NOT NULL,
        close REAL NOT NULL,
        volume REAL NOT NULL,
        source TEXT NOT NULL,
        updatedAt INTEGER NOT NULL,
        PRIMARY KEY (symbol, date)
      );
      CREATE INDEX IF NOT EXISTS idx_history_kline_symbol ON history_kline(symbol);

      CREATE TABLE IF NOT EXISTS market_ticks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        price REAL NOT NULL,
        open REAL,
        prev_close REAL,
        change_percent REAL,
        volume INTEGER,
        recorded_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_market_ticks_symbol_time ON market_ticks(symbol, recorded_at);

      CREATE TABLE IF NOT EXISTS ab_experiments (
        id TEXT PRIMARY KEY,
        v1_strategy_id TEXT NOT NULL,
        v2_strategy_id TEXT NOT NULL,
        symbols TEXT NOT NULL,
        start_at INTEGER NOT NULL,
        end_at INTEGER NOT NULL,
        initial_capital REAL NOT NULL,
        status TEXT NOT NULL,
        v1_account_id TEXT,
        v2_account_id TEXT,
        summary_metrics TEXT,
        created_at INTEGER NOT NULL,
        finished_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_ab_exp_created ON ab_experiments(created_at);

      CREATE TABLE IF NOT EXISTS ab_equity_points (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        experiment_id TEXT NOT NULL,
        side TEXT NOT NULL,
        ts INTEGER NOT NULL,
        equity REAL NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_ab_eq_exp_side_ts ON ab_equity_points(experiment_id, side, ts);

      -- ========= 100 账户仿真 =========
      CREATE TABLE IF NOT EXISTS simulation_runs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        account_count INTEGER NOT NULL,
        industries TEXT,
        strategies TEXT,
        status TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        finished_at INTEGER,
        config TEXT,
        aggregate_metrics TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_sim_runs_status ON simulation_runs(status);

      CREATE TABLE IF NOT EXISTS sim_accounts (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        seq INTEGER NOT NULL,
        name TEXT NOT NULL,
        industry TEXT NOT NULL,
        strategy TEXT NOT NULL,
        initial_capital REAL NOT NULL,
        cash REAL NOT NULL,
        risk_preference TEXT NOT NULL,
        trades_per_hour INTEGER NOT NULL,
        param_overrides TEXT,
        watchlist TEXT,
        frozen INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sim_acc_run ON sim_accounts(run_id);

      CREATE TABLE IF NOT EXISTS sim_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        ts INTEGER NOT NULL,
        cash REAL NOT NULL,
        equity REAL NOT NULL,
        position_value REAL NOT NULL,
        total_pnl REAL NOT NULL,
        total_pnl_rate REAL NOT NULL,
        trade_count INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sim_snap_run_acc_ts ON sim_snapshots(run_id, account_id, ts);

      CREATE TABLE IF NOT EXISTS sim_trades (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        symbol TEXT NOT NULL,
        side TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        price REAL NOT NULL,
        amount REAL NOT NULL,
        reason TEXT,
        pnl REAL,
        ts INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sim_trades_run_acc ON sim_trades(run_id, account_id, ts);

      CREATE TABLE IF NOT EXISTS kline_cache (
        symbol TEXT,
        period TEXT,
        limit_n INTEGER,
        payload TEXT,
        indicators TEXT,
        fetched_at INTEGER,
        PRIMARY KEY (symbol, period, limit_n)
      );
      CREATE INDEX IF NOT EXISTS idx_kline_cache_fetched ON kline_cache(fetched_at);
    `);

    // 旧库迁移：stock_directory 补充 turnoverratio 列（已存在则忽略）
    try {
      this.db.exec('ALTER TABLE stock_directory ADD COLUMN turnoverratio REAL');
    } catch {
      /* 列已存在 */
    }

    // 旧库迁移：notifications 补充 signalId 列（dedup 必需）
    try {
      this.db.exec('ALTER TABLE notifications ADD COLUMN signalId TEXT');
    } catch {
      /* 列已存在 */
    }
  }

  // ==================== K 线缓存（5 分钟 TTL，StockService 写入） ====================
  /** 读取单条 K 缓存；未命中返回 null */
  getKlineCache(
    symbol: string,
    period: string,
    limit: number,
  ): { payload: string; indicators: string | null; fetched_at: number } | null {
    const row = this.db
      .prepare(
        'SELECT payload, indicators, fetched_at FROM kline_cache WHERE symbol = ? AND period = ? AND limit_n = ?',
      )
      .get(symbol, period, limit) as
      | { payload: string; indicators: string | null; fetched_at: number }
      | undefined;
    if (!row) return null;
    return {
      payload: row.payload,
      indicators: row.indicators,
      fetched_at: row.fetched_at,
    };
  }

  /**
   * 写入/覆盖 K 缓存
   * @param fetchedAt 可选；不传则使用 Date.now()，便于测试覆写历史时间
   */
  setKlineCache(
    symbol: string,
    period: string,
    limit: number,
    payload: string,
    indicators: string | null,
    fetchedAt?: number,
  ): void {
    const ts = typeof fetchedAt === 'number' ? fetchedAt : Date.now();
    this.db
      .prepare(
        `INSERT OR REPLACE INTO kline_cache (symbol, period, limit_n, payload, indicators, fetched_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(symbol, period, limit, payload, indicators, ts);
  }

  // ==================== 自定义策略 ====================
  saveCustomStrategy(strategy: CustomStrategyRecord & { id?: string; parentId?: string; rootId?: string; version?: number; forkedAt?: number }): string {
    const id = strategy.id || `cs_${Date.now()}`;
    const now = new Date().toISOString();
    const existing = this.getCustomStrategyRaw(id);
    const version = strategy.version ?? existing?.version ?? 1;
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
      parentId: strategy.parentId ?? existing?.parent_id ?? null,
      rootId: strategy.rootId ?? existing?.root_id ?? id,
      version,
      forkedAt: strategy.forkedAt ?? existing?.forked_at ?? null,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    this.db
      .prepare(
        `INSERT OR REPLACE INTO custom_strategies
         (id, name, symbol, indicators, indicatorParams, buyConditions, sellConditions,
          positionSize, stopLoss, takeProfit, autoTrade, monitorEnabled, isRunning,
          parent_id, root_id, version, forked_at, createdAt, updatedAt)
         VALUES (@id, @name, @symbol, @indicators, @indicatorParams, @buyConditions, @sellConditions,
          @positionSize, @stopLoss, @takeProfit, @autoTrade, @monitorEnabled, @isRunning,
          @parentId, @rootId, @version, @forkedAt, @createdAt, @updatedAt)`,
      )
      .run(s);
    return id;
  }

  /**
   * Fork 现有策略为新版本（不修改原记录，返回新 id）
   * - parentId = 原策略 id
   * - rootId = 原策略 rootId（如有），否则 = parentId
   * - version = 同 root 下最大 version + 1
   * - 仅当 overrides 指定的字段会覆盖，其他字段继承父策略
   */
  forkCustomStrategy(
    parentId: string,
    name: string,
    overrides: Partial<CustomStrategyRecord> = {},
  ): (CustomStrategyRecord & { id: string; parentId: string | null; rootId: string; version: number; forkedAt: number }) | null {
    const parent = this.getCustomStrategyRaw(parentId);
    if (!parent) return null;
    const rootId = parent.root_id || parent.id;
    const maxVersionRow = this.db
      .prepare('SELECT MAX(version) as v FROM custom_strategies WHERE root_id = ?')
      .get(rootId) as { v: number | null };
    const nextVersion = (maxVersionRow.v || parent.version || 1) + 1;
    const now = Date.now();
    const newId = `cs_${now}`;
    const merged: any = {
      name,
      symbol: parent.symbol,
      indicators: JSON.parse(parent.indicators || '[]'),
      indicatorParams: JSON.parse(parent.indicatorParams || '{}'),
      buyConditions: JSON.parse(parent.buyConditions || '[]'),
      sellConditions: JSON.parse(parent.sellConditions || '[]'),
      positionSize: parent.positionSize,
      stopLoss: parent.stopLoss,
      takeProfit: parent.takeProfit,
      autoTrade: !!parent.autoTrade,
      monitorEnabled: !!parent.monitorEnabled,
      isRunning: 0,
      ...overrides,
    };
    this.db
      .prepare(
        `INSERT INTO custom_strategies
         (id, name, symbol, indicators, indicatorParams, buyConditions, sellConditions,
          positionSize, stopLoss, takeProfit, autoTrade, monitorEnabled, isRunning,
          parent_id, root_id, version, forked_at, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        newId,
        merged.name,
        merged.symbol,
        JSON.stringify(merged.indicators),
        JSON.stringify(merged.indicatorParams),
        JSON.stringify(merged.buyConditions),
        JSON.stringify(merged.sellConditions),
        merged.positionSize,
        merged.stopLoss,
        merged.takeProfit,
        merged.autoTrade ? 1 : 0,
        merged.monitorEnabled ? 1 : 0,
        0,
        parentId,
        rootId,
        nextVersion,
        now,
        new Date(now).toISOString(),
        new Date(now).toISOString(),
      );
    return this.getCustomStrategy(newId) as any;
  }

  /** 列出同一 root 下的全部历史版本，按 version 升序 */
  listStrategyVersions(rootId: string): (CustomStrategyRecord & { id: string; parentId: string | null; rootId: string; version: number; forkedAt: number | null })[] {
    // rootId 可以是 id 或 root_id，向上找祖先
    const anchor = this.db
      .prepare('SELECT root_id FROM custom_strategies WHERE id = ?')
      .get(rootId) as { root_id: string | null } | undefined;
    const actualRoot = anchor?.root_id || rootId;
    const rows = this.db
      .prepare('SELECT * FROM custom_strategies WHERE root_id = ? OR id = ? ORDER BY version ASC')
      .all(actualRoot, actualRoot) as any[];
    return rows.map((r) => this.hydrateStrategy(r) as any);
  }

  // ==================== Market Ticks（实时行情录制） ====================
  recordTicks(
    ticks: Array<{
      symbol: string;
      price: number;
      open?: number | null;
      prevClose?: number | null;
      changePercent?: number | null;
      volume?: number | null;
      recordedAt?: number;
    }>,
  ): number {
    if (ticks.length === 0) return 0;
    const stmt = this.db.prepare(
      `INSERT INTO market_ticks (symbol, price, open, prev_close, change_percent, volume, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    let n = 0;
    const tx = this.db.transaction((batch: typeof ticks) => {
      for (const t of batch) {
        stmt.run(
          t.symbol,
          t.price,
          t.open ?? null,
          t.prevClose ?? null,
          t.changePercent ?? null,
          t.volume ?? null,
          t.recordedAt ?? Date.now(),
        );
        n++;
      }
    });
    tx(ticks);
    return n;
  }

  queryTicks(opts: {
    symbol?: string;
    fromTs?: number;
    toTs?: number;
    limit?: number;
  }): Array<{ symbol: string; price: number; open: number | null; prevClose: number | null; changePercent: number | null; volume: number | null; recordedAt: number }> {
    const limit = Math.min(opts.limit ?? 500, 5000);
    const where: string[] = [];
    const params: any[] = [];
    if (opts.symbol) {
      where.push('symbol = ?');
      params.push(opts.symbol);
    }
    if (opts.fromTs !== undefined) {
      where.push('recorded_at >= ?');
      params.push(opts.fromTs);
    }
    if (opts.toTs !== undefined) {
      where.push('recorded_at <= ?');
      params.push(opts.toTs);
    }
    const sql = `SELECT symbol, price, open, prev_close as prevClose, change_percent as changePercent, volume, recorded_at as recordedAt
                 FROM market_ticks
                 ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                 ORDER BY recorded_at DESC
                 LIMIT ?`;
    params.push(limit);
    return this.db.prepare(sql).all(...params) as any;
  }

  tickStats(): { total: number; symbols: number; earliest: number | null; latest: number | null } {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) as total, COUNT(DISTINCT symbol) as symbols, MIN(recorded_at) as earliest, MAX(recorded_at) as latest FROM market_ticks`,
      )
      .get() as any;
    return {
      total: row.total || 0,
      symbols: row.symbols || 0,
      earliest: row.earliest,
      latest: row.latest,
    };
  }

  // ==================== A/B 实验 ====================
  saveAbExperiment(exp: {
    id?: string;
    v1StrategyId: string;
    v2StrategyId: string;
    symbols: string[];
    startAt: number;
    endAt: number;
    initialCapital: number;
    status: string;
    v1AccountId?: string | null;
    v2AccountId?: string | null;
    summaryMetrics?: any;
    createdAt?: number;
    finishedAt?: number | null;
  }): string {
    const id = exp.id || `ab_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.db
      .prepare(
        `INSERT OR REPLACE INTO ab_experiments
         (id, v1_strategy_id, v2_strategy_id, symbols, start_at, end_at, initial_capital,
          status, v1_account_id, v2_account_id, summary_metrics, created_at, finished_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        exp.v1StrategyId,
        exp.v2StrategyId,
        JSON.stringify(exp.symbols),
        exp.startAt,
        exp.endAt,
        exp.initialCapital,
        exp.status,
        exp.v1AccountId ?? null,
        exp.v2AccountId ?? null,
        exp.summaryMetrics ? JSON.stringify(exp.summaryMetrics) : null,
        exp.createdAt ?? Date.now(),
        exp.finishedAt ?? null,
      );
    return id;
  }

  getAbExperiment(id: string): any {
    const row = this.db.prepare('SELECT * FROM ab_experiments WHERE id = ?').get(id) as any;
    if (!row) return null;
    return {
      ...row,
      symbols: JSON.parse(row.symbols || '[]'),
      summaryMetrics: row.summary_metrics ? JSON.parse(row.summary_metrics) : null,
      createdAt: row.created_at,
      finishedAt: row.finished_at,
      v1StrategyId: row.v1_strategy_id,
      v2StrategyId: row.v2_strategy_id,
      initialCapital: row.initial_capital,
      v1AccountId: row.v1_account_id,
      v2AccountId: row.v2_account_id,
      startAt: row.start_at,
      endAt: row.end_at,
    };
  }

  listAbExperiments(limit = 20): any[] {
    const rows = this.db
      .prepare('SELECT * FROM ab_experiments ORDER BY created_at DESC LIMIT ?')
      .all(limit) as any[];
    return rows.map((r) => ({
      ...r,
      symbols: JSON.parse(r.symbols || '[]'),
      summaryMetrics: r.summary_metrics ? JSON.parse(r.summary_metrics) : null,
      createdAt: r.created_at,
      finishedAt: r.finished_at,
      v1StrategyId: r.v1_strategy_id,
      v2StrategyId: r.v2_strategy_id,
      initialCapital: r.initial_capital,
      v1AccountId: r.v1_account_id,
      v2AccountId: r.v2_account_id,
      startAt: r.start_at,
      endAt: r.end_at,
    }));
  }

  deleteAbExperiment(id: string): boolean {
    const tx = this.db.transaction((expId: string) => {
      this.db.prepare('DELETE FROM ab_equity_points WHERE experiment_id = ?').run(expId);
      this.db.prepare('DELETE FROM ab_experiments WHERE id = ?').run(expId);
    });
    const before = this.db.prepare('SELECT id FROM ab_experiments WHERE id = ?').get(id);
    if (!before) return false;
    tx(id);
    return true;
  }

  // ========== 100 账户仿真 ==========
  saveSimulationRun(run: {
    id: string; name: string; accountCount: number; industries: string[];
    strategies: string[]; status: string; startedAt: number; config: any;
  }): void {
    this.db.prepare(`INSERT OR REPLACE INTO simulation_runs
      (id, name, account_count, industries, strategies, status, started_at, config)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(run.id, run.name, run.accountCount,
        JSON.stringify(run.industries), JSON.stringify(run.strategies),
        run.status, run.startedAt, JSON.stringify(run.config))
  }

  updateSimulationRun(id: string, patch: Partial<{ status: string; finishedAt: number; aggregateMetrics: any }>): void {
    const fields: string[] = []
    const values: any[] = []
    if (patch.status !== undefined) { fields.push('status = ?'); values.push(patch.status) }
    if (patch.finishedAt !== undefined) { fields.push('finished_at = ?'); values.push(patch.finishedAt) }
    if (patch.aggregateMetrics !== undefined) { fields.push('aggregate_metrics = ?'); values.push(JSON.stringify(patch.aggregateMetrics)) }
    if (fields.length === 0) return
    values.push(id)
    this.db.prepare(`UPDATE simulation_runs SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  }

  getSimulationRun(id: string): any | null {
    const row: any = this.db.prepare('SELECT * FROM simulation_runs WHERE id = ?').get(id)
    if (!row) return null
    return this.hydrateSimulationRun(row)
  }

  listSimulationRuns(limit = 20): any[] {
    const rows: any[] = this.db.prepare('SELECT * FROM simulation_runs ORDER BY started_at DESC LIMIT ?').all(limit)
    return rows.map(r => this.hydrateSimulationRun(r))
  }

  private hydrateSimulationRun(row: any): any {
    try { row.industries = JSON.parse(row.industries || '[]') } catch { row.industries = [] }
    try { row.strategies = JSON.parse(row.strategies || '[]') } catch { row.strategies = [] }
    try { row.config = JSON.parse(row.config || '{}') } catch { row.config = {} }
    try { row.aggregateMetrics = row.aggregate_metrics ? JSON.parse(row.aggregate_metrics) : null } catch { row.aggregateMetrics = null }
    return row
  }

  saveSimAccount(acc: {
    id: string; runId: string; seq: number; name: string; industry: string;
    strategy: string; initialCapital: number; cash: number; riskPreference: string;
    tradesPerHour: number; paramOverrides: any; watchlist: string[];
  }): void {
    this.db.prepare(`INSERT OR REPLACE INTO sim_accounts
      (id, run_id, seq, name, industry, strategy, initial_capital, cash, risk_preference, trades_per_hour, param_overrides, watchlist, frozen, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`)
      .run(acc.id, acc.runId, acc.seq, acc.name, acc.industry, acc.strategy,
        acc.initialCapital, acc.cash, acc.riskPreference, acc.tradesPerHour,
        JSON.stringify(acc.paramOverrides), JSON.stringify(acc.watchlist), Date.now())
  }

  updateSimAccount(id: string, patch: Partial<{ cash: number; frozen: number }>): void {
    const fields: string[] = []
    const values: any[] = []
    if (patch.cash !== undefined) { fields.push('cash = ?'); values.push(patch.cash) }
    if (patch.frozen !== undefined) { fields.push('frozen = ?'); values.push(patch.frozen) }
    if (fields.length === 0) return
    values.push(id)
    this.db.prepare(`UPDATE sim_accounts SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  }

  listSimAccounts(runId: string): any[] {
    const rows: any[] = this.db.prepare('SELECT * FROM sim_accounts WHERE run_id = ? ORDER BY seq').all(runId)
    return rows.map((r: any) => {
      try { r.paramOverrides = JSON.parse(r.param_overrides || '{}') } catch { r.paramOverrides = {} }
      try { r.watchlist = JSON.parse(r.watchlist || '[]') } catch { r.watchlist = [] }
      // 关键：snake_case → camelCase 映射，让上层代码能直接用 runId / initialCapital / riskPreference
      r.runId = r.run_id
      r.initialCapital = r.initial_capital
      r.riskPreference = r.risk_preference
      r.tradesPerHour = r.trades_per_hour
      return r
    })
  }

  saveSimSnapshot(s: {
    runId: string; accountId: string; ts: number; cash: number; equity: number;
    positionValue: number; totalPnl: number; totalPnlRate: number; tradeCount: number;
  }): void {
    this.db.prepare(`INSERT INTO sim_snapshots
      (run_id, account_id, ts, cash, equity, position_value, total_pnl, total_pnl_rate, trade_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(s.runId, s.accountId, s.ts, s.cash, s.equity, s.positionValue,
        s.totalPnl, s.totalPnlRate, s.tradeCount)
  }

  saveSimTrade(t: {
    id: string; runId: string; accountId: string; symbol: string; side: 'BUY' | 'SELL';
    quantity: number; price: number; amount: number; reason: string; pnl: number | null; ts: number;
  }): void {
    this.db.prepare(`INSERT INTO sim_trades
      (id, run_id, account_id, symbol, side, quantity, price, amount, reason, pnl, ts)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(t.id, t.runId, t.accountId, t.symbol, t.side, t.quantity,
        t.price, t.amount, t.reason, t.pnl, t.ts)
  }

  listSimTrades(runId: string, accountId?: string): any[] {
    const sql = accountId
      ? 'SELECT * FROM sim_trades WHERE run_id = ? AND account_id = ? ORDER BY ts DESC LIMIT 200'
      : 'SELECT * FROM sim_trades WHERE run_id = ? ORDER BY ts DESC LIMIT 200'
    const rows: any[] = this.db.prepare(sql).all(...(accountId ? [runId, accountId] : [runId]))
    return rows
  }

  saveAbEquityPoints(points: Array<{ experimentId: string; side: 'v1' | 'v2'; ts: number; equity: number }>): number {
    if (points.length === 0) return 0;
    const stmt = this.db.prepare(
      'INSERT INTO ab_equity_points (experiment_id, side, ts, equity) VALUES (?, ?, ?, ?)',
    );
    let n = 0;
    const tx = this.db.transaction((batch: typeof points) => {
      for (const p of batch) {
        stmt.run(p.experimentId, p.side, p.ts, p.equity);
        n++;
      }
    });
    tx(points);
    return n;
  }

  getAbEquityCurve(experimentId: string, side: 'v1' | 'v2'): Array<{ ts: number; equity: number }> {
    const rows = this.db
      .prepare('SELECT ts, equity FROM ab_equity_points WHERE experiment_id = ? AND side = ? ORDER BY ts ASC')
      .all(experimentId, side) as any[];
    return rows.map((r) => ({ ts: r.ts, equity: r.equity }));
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
      turnoverratio: number | null;
    }>,
  ): void {
    if (rows.length === 0) return;
    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO stock_directory
       (symbol, name, market, price, changePercent, pe, pb, mktcap, turnoverratio, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const now = Date.now();
    this.db.transaction((batch: typeof rows) => {
      for (const r of batch) {
        stmt.run(r.symbol, r.name, r.market, r.price, r.changePercent, r.pe, r.pb, r.mktcap, r.turnoverratio, now);
      }
    })(rows);
  }

  /**
   * 搜索目录：代码前缀优先 + 名称包含，去重合并
   *
   * 当 q 为空字符串时返回全量目录（按 symbol 排序），上限 limit 条。
   * 这样选股器等需要"全集"的下游不必再走额外 SQL 路径。
   */
  searchDirectory(
    q: string,
    limit = 20,
  ): Array<{
    symbol: string;
    name: string;
    market: string;
    price: number;
    changePercent: number;
    turnoverratio: number | null;
  }> {
    const query = q.trim();
    if (!query) {
      const rows = this.db
        .prepare(
          'SELECT symbol, name, market, price, changePercent, turnoverratio FROM stock_directory ORDER BY symbol LIMIT ?',
        )
        .all(limit) as Array<{
        symbol: string;
        name: string;
        market: string;
        price: number;
        changePercent: number;
        turnoverratio: number | null;
      }>;
      return rows;
    }
    const byCode = this.db
      .prepare(
        'SELECT symbol, name, market, price, changePercent, turnoverratio FROM stock_directory WHERE symbol LIKE ? ORDER BY symbol LIMIT ?',
      )
      .all(`${query}%`, limit) as Array<{
      symbol: string;
      name: string;
      market: string;
      price: number;
      changePercent: number;
      turnoverratio: number | null;
    }>;
    const byName = this.db
      .prepare(
        'SELECT symbol, name, market, price, changePercent, turnoverratio FROM stock_directory WHERE name LIKE ? ORDER BY symbol LIMIT ?',
      )
      .all(`%${query}%`, limit) as Array<{
      symbol: string;
      name: string;
      market: string;
      price: number;
      changePercent: number;
      turnoverratio: number | null;
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

  /** 目录统计：count + lastSyncAt 聚合 */
  getDirectoryStats(): { count: number; lastSyncAt: string | null } {
    const count = this.directoryCount();
    const ts = this.getDirectoryLastSyncAt();
    return {
      count,
      lastSyncAt: ts > 0 ? new Date(ts).toISOString() : null,
    };
  }

  /** 历史K线缓存统计 */
  getHistoryKlineRangeStats(): {
    totalRows: number;
    symbolCount: number;
    oldestDate: string | null;
    newestDate: string | null;
  } {
    const row = this.db
      .prepare(
        'SELECT COUNT(*) AS totalRows, COUNT(DISTINCT symbol) AS symbolCount, MIN(date) AS oldestDate, MAX(date) AS newestDate FROM history_kline',
      )
      .get() as { totalRows: number; symbolCount: number; oldestDate: string | null; newestDate: string | null };
    return row || { totalRows: 0, symbolCount: 0, oldestDate: null, newestDate: null };
  }

  // ==================== 历史K线缓存 ====================
  /**
   * 读取 [start, end] 区间内的K线（按日期升序）。
   * 用于增量补拉前先查库，已存在则不请求上游。
   */
  getHistoryKline(
    symbol: string,
    start: string,
    end: string,
  ): Array<{
    symbol: string;
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    source: string;
    updatedAt: number;
  }> {
    return this.db
      .prepare(
        'SELECT symbol, date, open, high, low, close, volume, source, updatedAt FROM history_kline WHERE symbol = ? AND date >= ? AND date <= ? ORDER BY date ASC',
      )
      .all(symbol, start, end) as any[];
  }

  /**
   * 单股已缓存的日期集合（用于判断哪些日期还缺）。
   */
  getHistoryKlineDates(symbol: string, start: string, end: string): Set<string> {
    const rows = this.db
      .prepare('SELECT date FROM history_kline WHERE symbol = ? AND date >= ? AND date <= ?')
      .all(symbol, start, end) as Array<{ date: string }>;
    return new Set(rows.map((r) => r.date));
  }

  /**
   * 获取某月所有已落库的交易日（YYYY-MM-DD 字符串数组，去重排序）。
   * 用于仿真回放模式 — 按月推进虚拟日期。
   */
  getTradingDaysForMonth(month: string): string[] {
    const start = `${month}-01`
    const end = `${month}-31`
    const rows = this.db
      .prepare(
        `SELECT DISTINCT date FROM history_kline
         WHERE date >= ? AND date <= ?
         ORDER BY date ASC`,
      )
      .all(start, end) as Array<{ date: string }>;
    return rows.map((r) => r.date);
  }

  /**
   * 单股历史K线缓存总数（用于 data-sources 状态探测）。
   */
  historyKlineCount(symbol?: string): number {
    if (symbol) {
      const row = this.db
        .prepare('SELECT COUNT(*) AS c FROM history_kline WHERE symbol = ?')
        .get(symbol) as { c: number };
      return row.c;
    }
    const row = this.db.prepare('SELECT COUNT(*) AS c FROM history_kline').get() as { c: number };
    return row.c;
  }

  /**
   * 批量 upsert K线（同 symbol+date 唯一，更新价格/来源/updatedAt）。
   */
  upsertHistoryKline(
    rows: Array<{
      symbol: string;
      date: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
      source: string;
    }>,
  ): number {
    if (rows.length === 0) return 0;
    const stmt = this.db.prepare(
      `INSERT INTO history_kline (symbol, date, open, high, low, close, volume, source, updatedAt)
       VALUES (@symbol, @date, @open, @high, @low, @close, @volume, @source, @updatedAt)
       ON CONFLICT(symbol, date) DO UPDATE SET
         open = excluded.open,
         high = excluded.high,
         low = excluded.low,
         close = excluded.close,
         volume = excluded.volume,
         source = excluded.source,
         updatedAt = excluded.updatedAt`,
    );
    const now = Date.now();
    const tx = this.db.transaction((items: typeof rows) => {
      for (const r of items) stmt.run({ ...r, updatedAt: now });
    });
    tx(rows);
    return rows.length;
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

  // ==================== 模拟交易账户/持仓/交易 ====================
  savePaperAccount(account: {
    id: string;
    name: string;
    type?: 'live' | 'backtest';
    initialCapital: number;
    cash: number;
    totalValue: number;
    totalPnl: number;
    totalPnlRate: number;
    isRunning: boolean;
    startDate: string;
    strategies: string[];
    meta?: any;
  }): void {
    this.init();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT OR REPLACE INTO paper_accounts
         (id, name, type, initialCapital, cash, totalValue, totalPnl, totalPnlRate, isRunning, startDate, strategies, meta, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        account.id,
        account.name,
        account.type || 'live',
        account.initialCapital,
        account.cash,
        account.totalValue,
        account.totalPnl,
        account.totalPnlRate,
        account.isRunning ? 1 : 0,
        account.startDate,
        JSON.stringify(account.strategies || []),
        account.meta ? JSON.stringify(account.meta) : null,
        now,
        now,
      );
  }

  loadPaperAccount(accountId: string): any {
    this.init();
    const row = this.db.prepare('SELECT * FROM paper_accounts WHERE id = ?').get(accountId) as any;
    if (!row) return null;
    return {
      ...row,
      isRunning: row.isRunning === 1,
      strategies: JSON.parse(row.strategies || '[]'),
      meta: row.meta ? JSON.parse(row.meta) : undefined,
    };
  }

  /**
   * 加载所有模拟账户（按类型分组、按时倒序）
   */
  loadPaperAccounts(): any[] {
    this.init();
    return this.db
      .prepare('SELECT * FROM paper_accounts ORDER BY type ASC, updatedAt DESC')
      .all()
      .map((r: any) => ({
        ...r,
        isRunning: r.isRunning === 1,
        strategies: JSON.parse(r.strategies || '[]'),
        meta: r.meta ? JSON.parse(r.meta) : undefined,
      }));
  }

  /**
   * 删除账户（包括持仓、交易）
   */
  deletePaperAccount(accountId: string): void {
    this.init();
    this.db.prepare('DELETE FROM paper_trades WHERE accountId = ?').run(accountId);
    this.db.prepare('DELETE FROM paper_positions WHERE accountId = ?').run(accountId);
    this.db.prepare('DELETE FROM paper_accounts WHERE id = ?').run(accountId);
  }

  savePaperPosition(accountId: string, position: {
    symbol: string;
    name: string;
    quantity: number;
    avgCost: number;
    currentPrice: number;
    marketValue: number;
    pnl: number;
    pnlRate: number;
    openDate: string;
  }): void {
    this.init();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT OR REPLACE INTO paper_positions
         (accountId, symbol, name, quantity, avgCost, currentPrice, marketValue, pnl, pnlRate, openDate, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        accountId,
        position.symbol,
        position.name,
        position.quantity,
        position.avgCost,
        position.currentPrice,
        position.marketValue,
        position.pnl,
        position.pnlRate,
        position.openDate,
        now,
        now,
      );
  }

  loadPaperPositions(accountId: string): any[] {
    this.init();
    return this.db
      .prepare('SELECT * FROM paper_positions WHERE accountId = ? ORDER BY openDate DESC')
      .all(accountId)
      .map((r: any) => ({
        symbol: r.symbol,
        name: r.name,
        quantity: r.quantity,
        avgCost: r.avgCost,
        currentPrice: r.currentPrice,
        marketValue: r.marketValue,
        pnl: r.pnl,
        pnlRate: r.pnlRate,
        openDate: r.openDate,
      }));
  }

  deletePaperPosition(accountId: string, symbol: string): void {
    this.init();
    this.db.prepare('DELETE FROM paper_positions WHERE accountId = ? AND symbol = ?').run(accountId, symbol);
  }

  savePaperTrade(accountId: string, trade: {
    id: string;
    type: string;
    symbol: string;
    name: string;
    price: number;
    quantity: number;
    amount: number;
    reason: string;
    strategyId: string;
    time: string;
  }): void {
    this.init();
    this.db
      .prepare(
        `INSERT OR REPLACE INTO trades
         (id, type, symbol, code, name, price, quantity, amount, reason, time, extra)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        trade.id,
        trade.type,
        trade.symbol,
        trade.symbol,
        trade.name,
        trade.price,
        trade.quantity,
        trade.amount,
        trade.reason,
        trade.time,
        JSON.stringify({ accountId }),
      );
  }

  loadPaperTrades(accountId: string): any[] {
    this.init();
    return this.db
      .prepare(
        `SELECT id, type, symbol, name, price, quantity, amount, reason, time FROM trades 
         WHERE extra LIKE ? ORDER BY time DESC`,
      )
      .all(`%${accountId}%`)
      .map((r: any) => ({
        id: r.id,
        type: r.type,
        symbol: r.symbol,
        name: r.name,
        price: r.price,
        quantity: r.quantity,
        amount: r.amount,
        reason: r.reason,
        time: r.time,
        timestamp: new Date(r.time).getTime(),
      }));
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
      'paper_accounts',
      'paper_positions',
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

  // ==================== 风控设置 ====================
  saveRiskSettings(settings: {
    maxDrawdown: number;
    stopLossRate: number;
    takeProfitRate: number;
    maxPositionRate: number;
    dailyTradeLimit: number;
  }): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO risk_settings (id, maxDrawdown, stopLossRate, takeProfitRate, maxPositionRate, dailyTradeLimit)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'default',
        settings.maxDrawdown,
        settings.stopLossRate,
        settings.takeProfitRate,
        settings.maxPositionRate,
        settings.dailyTradeLimit,
      );
  }

  loadRiskSettings(): {
    maxDrawdown: number;
    stopLossRate: number;
    takeProfitRate: number;
    maxPositionRate: number;
    dailyTradeLimit: number;
  } | null {
    const row = this.db
      .prepare(
        'SELECT maxDrawdown, stopLossRate, takeProfitRate, maxPositionRate, dailyTradeLimit FROM risk_settings WHERE id = ?',
      )
      .get('default') as
      | {
          maxDrawdown: number;
          stopLossRate: number;
          takeProfitRate: number;
          maxPositionRate: number;
          dailyTradeLimit: number;
        }
      | undefined;
    if (!row) return null;
    return row;
  }

  // ==================== 通知 ====================
  saveNotification(record: NotificationRecord & { id?: string; signalId?: string }): string {
    const id = record.id || `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.db
      .prepare(
        `INSERT INTO notifications (id, title, content, symbol, signalId, signalType, price, source, read, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        record.title || '',
        record.content || '',
        record.symbol || '',
        (record as any).signalId || '',
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
      signalId: r.signalId,
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

  private hydrateStrategy(row: any): CustomStrategyRecord & { id: string; parentId?: string | null; rootId?: string | null; version?: number; forkedAt?: number | null } {
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
      parentId: row.parent_id || null,
      rootId: row.root_id || row.id,
      version: row.version || 1,
      forkedAt: row.forked_at || null,
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
