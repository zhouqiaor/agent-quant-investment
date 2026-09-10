# SPEC：实时行情录制 + 策略版本化 + A/B 对比测试

> 目标：让项目既能持续积累真实行情数据，又能对同一策略的不同参数版本（或两个不同策略）进行并行对比，从而支持"持续录制 → 快速迭代 → 数据驱动优化"的闭环。

## 一、背景与价值

### 现状盘点（已有能力）
| 模块 | 已具备 | 缺口 |
|------|--------|------|
| `MarketPollingService` | 每 5s 拉取关注股实时价 | **无持久化**，进程重启即丢 |
| `BacktestService` / `PortfolioBacktestService` | 真实日 K 全局回测 | 仅日 K 粒度，缺分钟级 |
| `OptimizerService` | 参数网格搜索 | 单策略单目标，缺多版本对比视图 |
| `StrategyService` | 自定义策略增删改查 | **无版本字段**，修改即覆盖 |
| `LivePnlService` | tick → 信号 → 下单 | 单实例，无法并行多版本 |
| `PaperTradingService` | 多账户（已支持 `backtest_<ts>`） | 缺 A/B 协调器 |

### 痛点
1. 行情数据只能"用过即焚"，无法做"事后回放"或"用昨天数据重测今天的策略参数"
2. 调参只能等日 K 出齐后才能跑回测，迭代周期 1 天+
3. 没有"两个版本同台对比"的可视化手段
4. 策略改了参数后无法回滚到上一版

## 二、目标（V1 范围）

1. **持续录制**：每个 polling tick 落库到 `market_ticks`（轻量、只存关键列）
2. **策略版本化**：自定义策略支持 `parentId + version`，改一份即派生新版本
3. **A/B 对比引擎**：在同一窗口、同一账户并行跑 v1 + v2，落库两个独立 `paper_account`
4. **对比可视化**：前端页面 `pages/ab-test/index` 展示两条净值曲线、指标并排、胜率差、卡方显著性
5. **可保留迭代历史**：所有 A/B 实验入 `ab_experiments` 表，可回看任意历史实验

## 三、架构设计

```
┌──────────────────────────────────────────────────────────────┐
│                  MarketPollingService（已有）                  │
│   5s tick ──┬──▶ LivePnlService（已有）                      │
│             │                                                  │
│             └──▶ NEW: TickRecorderService                     │
│                  └─▶ market_ticks 表（time/symbol/price/...）  │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│                  StrategyVersionRegistry（新）                  │
│   POST /strategy/fork {parentId, name}                        │
│   GET  /strategy/versions/:id  → 全部历史版本                 │
│   任意 CustomStrategy 行新增 parentId + version 字段           │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│                  ABTestRunner（新）                              │
│   POST /ab-test/run {v1Id, v2Id, symbols, days}              │
│   ├─ 复刻历史 tick 数据（mock LivePnlService 注入）           │
│   ├─ 创建 paper_account_v1 / paper_account_v2（隔离）          │
│   ├─ 逐 tick 跑两个策略，下单入各自账户                        │
│   └─ 产出 equity_curve_v1/v2 + 指标 + 差异分析                  │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│                  ab_experiments / ab_equity_points 表            │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│                  pages/ab-test/index（新）                      │
│   选择两个版本 → 后端取数据 → 画两条曲线 + 指标对比             │
└──────────────────────────────────────────────────────────────┘
```

## 四、数据模型

### 1. `market_ticks`（新增）
```sql
CREATE TABLE market_ticks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  price REAL NOT NULL,
  open REAL, prev_close REAL,
  change_percent REAL,
  volume INTEGER,
  recorded_at INTEGER NOT NULL,   -- ms 时间戳
  INDEX idx_market_ticks_symbol_time (symbol, recorded_at)
);
```

### 2. `custom_strategies` 扩字段
```sql
ALTER TABLE custom_strategies ADD COLUMN parent_id TEXT;
ALTER TABLE custom_strategies ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE custom_strategies ADD COLUMN forked_at INTEGER;
```

### 3. `ab_experiments`（新增）
```sql
CREATE TABLE ab_experiments (
  id TEXT PRIMARY KEY,
  v1_strategy_id TEXT NOT NULL,
  v2_strategy_id TEXT NOT NULL,
  symbols TEXT NOT NULL,           -- JSON 数组
  start_at INTEGER NOT NULL,
  end_at INTEGER NOT NULL,
  initial_capital REAL NOT NULL,
  status TEXT NOT NULL,            -- 'running' | 'completed' | 'failed'
  v1_account_id TEXT,
  v2_account_id TEXT,
  created_at INTEGER NOT NULL,
  finished_at INTEGER,
  summary_metrics TEXT             -- JSON: {v1Metrics, v2Metrics, delta}
);
```

### 4. `ab_equity_points`（新增）
```sql
CREATE TABLE ab_equity_points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  experiment_id TEXT NOT NULL,
  side TEXT NOT NULL,              -- 'v1' | 'v2'
  ts INTEGER NOT NULL,
  equity REAL NOT NULL,
  INDEX idx_ab_eq_exp_side (experiment_id, side, ts)
);
```

## 五、API 汇总

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/market/ticks?symbol=...&fromTs=...&toTs=...&limit=500` | 历史 tick 查询（供回放 + 可视化） |
| GET | `/api/market/ticks/stats` | 录制统计（条数 / 覆盖标的 / 最早时间） |
| POST | `/api/strategy/fork` | fork 一个策略为新版本 `{parentId, name}` |
| GET | `/api/strategy/versions/:baseId` | 列出同一基线策略的全部历史版本 |
| POST | `/api/ab-test/run` | 启动 A/B 实验（异步，返回 experimentId） |
| GET | `/api/ab-test/list?limit=20` | 历史实验列表 |
| GET | `/api/ab-test/:id` | 实验详情（含两侧曲线 + 指标） |
| DELETE | `/api/ab-test/:id` | 删除实验（清理账户、保留聚合结果） |

## 六、复用与不重复造轮子

| 业界参考 | 本项目借鉴 |
|----------|-----------|
| Freqtrade Hyperopt | 目标函数 design（composite = 0.4·return + 0.3·sharpe + 0.2·winRate + 0.1·profitFactor） |
| Jesse 多标的回测 | `symbols[]` + 共享资金池思路 |
| Lean Algorithm Lab | A/B 实验元数据 + 隔离 paper account |
| Backtrader `cerebro.optstrategy` | 多策略并行同一数据流 |
| Superalgos 实验看板 | 实验列表 + 详情两级页 |

**不重复造**：回测引擎、指标计算（Sharpe/MaxDD/WinRate）、PaperTradingService 账户模型全部复用，不引入新依赖。

## 七、前端设计

`pages/ab-test/index`（新页，H5 + 小程序双端）：

```
┌────────────────────────────────┐
│ 策略 A/B 对比                   │ 标题
├────────────────────────────────┤
│ [选择 v1 ▾]   vs   [选择 v2 ▾]  │ 双下拉
│ 选定时间窗口:  [2025-09-01 ~ 09-30]  │
│ 选定标的:    [600519] [002594] [...]   │
│ [开始对比] 按钮                   │
├────────────────────────────────┤
│ ┌──── 净值曲线 ─────────────┐    │
│ │  📈 v1（绿）  vs  v2（红）   │    │
│ └────────────────────────────┘    │
├────────────────────────────────┤
│ 指标       v1       v2     Δ    │
│ 总收益    +12.3%   +8.1%  -4.2pp│
│ 最大回撤   -3.5%   -5.2%  +1.7pp│
│ 夏普       1.82     1.21  -0.61│
│ 胜率      61.5%    53.8%  -7.7pp│
│ 交易数    26       31     +5   │
│ 综合分    0.87    0.72   -0.15 │ ← composite
├────────────────────────────────┤
│ [卡方检验] p-value: 0.043 显著差异│
└────────────────────────────────┘
```

历史实验列表 `pages/ab-test/list/index`：表格 + 跳转详情。

## 八、测试计划

| 套件 | 用例 | 覆盖 |
|------|------|------|
| `tick-recorder.spec.ts` | 8 | 单标记录、批量、查区间、去重、统计、并发写入 |
| `strategy-fork.spec.ts` | 6 | fork、版本递增、字段继承、参数覆盖、列表查询 |
| `ab-runner.spec.ts` | 10 | 并行执行、账户隔离、tick 重放、信号分流、失败回滚 |
| `ab-metrics.spec.ts` | 5 | composite、胜率差、卡方、波动率、统计字段 |
| `e2e-ab-flow.spec.ts` | 4 | 配置 → fork → run → 详情 → 删除 |

## 十、阶段与优先级（首版 1 周）

| 阶段 | 交付 | 工时 | 关键风险 |
|------|------|------|---------|
| P1 | TickRecorder + market_ticks 表 + 查询 API | 1d | 写入频率控制（去抖 / 失败重试） |
| P2 | Strategy fork + version 字段 + 历史版本 API | 0.5d | 兼容已有自定义策略（无 parent） |
| P3 | ABTestRunner + ab_experiments/ab_equity_points | 2d | tick 重放性能、账户 ID 冲突 |
| P4 | 前端 ab-test 页（双下拉 + 曲线 + 指标表） | 1d | ECharts 跨端 / 性能 |
| P5 | 测试 + 验证 + 部署 | 0.5d | — |

总计 **5 天**，与 plan.md 中"V1.1 - AI 诊断日报"并行不冲突，可作为 V1.1b 子版本。

## 十一、暂不做（V2+）

- 分钟级 OHLC 聚合（V1.2）
- 实时流式 A/B（线上同时跑两个版本，Kafka 风格）
- 显著性检验（Bootstrap / Welch's t）
- 多于 2 版本的并排
- 跨账户合并报表

## 十二、风险与对策

| 风险 | 对策 |
|------|------|
| `market_ticks` 表增长过快（每标 5s × 14 标 = 2.5k 行/h） | 仅保留最近 90 天；90 天前自动归档到 `market_ticks_archive`；预估 90 天 ≈ 540 万行，单文件 SQLite 可承载 |
| tick 重放时与实时轮询竞争同一 paper account | A/B 实验必须用独立 accountId（`ab_v1_<expId>` / `ab_v2_<expId>`），跳过 LivePnlService |
| 用户频繁 fork 导致版本爆炸 | 限制同一基线最多 20 个版本，超出提示先合并再 fork |
| ECharts 在小程序端体积 | 沿用现状使用 Canvas + 手写 polyline，不引入图表库 |