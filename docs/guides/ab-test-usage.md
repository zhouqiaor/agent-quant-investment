# A/B 策略对比实验 — 使用指南

> 状态：✅ 已交付（commit `51ef497` + `78f452d`）  
> 适用版本：QuantPilot V1.1+

---

## 一、它解决什么问题？

传统策略调参只能"猜+一次次回测"，没有**可对比、可追溯、可回放**的版本管理。A/B 对比系统提供：

| 能力 | 之前 | 现在 |
|------|------|------|
| 派生新策略 | 直接修改原策略 → 历史丢失 | `fork` 一键派生，原版不动 |
| 对比两策略 | 凭记忆对比数字 | 并行运行 + 自动算 Δ 收益/夏普 |
| 数据来源 | 一次性回测，无历史 | TickRecorder 5s 持续录制到 `market_ticks` |
| 结果可视化 | 命令行看 JSON | 前端双策略对比页 + 指标并排 |

---

## 二、5 步快速上手

### 第 1 步：进入策略管理页

**前端入口**：底部 TabBar → 「策略」 → 顶部右侧紫色 **"A/B 对比"** 按钮。

（路径：`pages/strategy/index` → `pages/strategy/ab-test`）

### 第 2 步：创建基线策略（v1）

```bash
curl -X POST http://localhost:3000/api/strategies/custom \
  -H "Content-Type: application/json" \
  -d '{
    "id": "",
    "name": "均线突破 - 激进",
    "description": "MA5/MA20,止盈10%止损5%",
    "params": {
      "ma_short": 5,
      "ma_long": 20,
      "take_profit": 0.10,
      "stop_loss": 0.05
    }
  }'
# → 返回 { data: { id: "cs_xxxxxxxxx", version: 1, rootId: "cs_xxx..." } }
```

或在「策略」页用表单创建。

### 第 3 步：派生新版本（v2、v3...）

```bash
curl -X POST http://localhost:3000/api/strategies/custom/cs_xxxxxxxxx/fork \
  -H "Content-Type: application/json" \
  -d '{
    "name": "均线突破 - 稳健",
    "description": "止盈收紧到7%、止损放宽到7%",
    "paramsOverride": {
      "take_profit": 0.07,
      "stop_loss": 0.07
    }
  }'
```

**可继续 fork**，无限次：`v1 → v2 → v3 → ...`

**`paramsOverride` 留空**则继承所有父版本参数，只需改名/描述用于实验。

### 第 4 步：查看版本树

```bash
curl http://localhost:3000/api/strategies/custom/cs_xxxxxxxxx/versions
```

返回同一 `rootId` 下的所有版本（含父、子、孙...），按 `version ASC` 排序：

```json
{
  "data": [
    { "id": "cs_854660", "name": "激进", "version": 1, "parentId": null,      "rootId": "cs_854660" },
    { "id": "cs_854670", "name": "稳健", "version": 2, "parentId": "cs_854660", "rootId": "cs_854660" },
    { "id": "cs_854688", "name": "极致", "version": 3, "parentId": "cs_854660", "rootId": "cs_854660" }
  ]
}
```

### 第 5 步：启动 A/B 对比实验

```bash
curl -X POST http://localhost:3000/api/ab-test/run \
  -H "Content-Type: application/json" \
  -d '{
    "name": "激进 vs 稳健 Q3",
    "v1StrategyId": "cs_854660",
    "v2StrategyId": "cs_854670",
    "symbols": ["sh600519", "sh600036"],
    "startDate": "2024-09-01",
    "endDate": "2024-12-01",
    "initialCapital": 100000,
    "benchmarkStrategyId": ""   // 可选：选一个第三策略作为基准
  }'
```

**返回值（关键字段）**：

```json
{
  "data": {
    "id": "ab_xxxxxxxxx",
    "name": "激进 vs 稳健 Q3",
    "status": "completed",
    "v1StrategyId": "cs_854660",
    "v2StrategyId": "cs_854670",
    "winner": "v1",          // ← 系统判定胜出方
    "v1Metrics": {
      "totalReturn": 0.142,  // 总收益率 14.2%
      "sharpe": 1.82,
      "maxDrawdown": -0.087,
      "winRate": 0.56,
      "tradeCount": 23
    },
    "v2Metrics": { "...": "..." },
    "delta": {
      "totalReturn": 0.018,  // v1 - v2
      "sharpe": 0.31,
      "maxDrawdown": 0.014,
      "winRate": 0.04
    },
    "equityCurve": {
      "v1": [{ "t": 1725148800000, "equity": 100000 }, ...],
      "v2": [{ "t": 1725148800000, "equity": 100000 }, ...]
    }
  }
}
```

前端页面会渲染为双净值曲线 + 4 指标并排 + 胜者徽章。

---

## 三、所有 API 速查

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/api/strategies/custom` | 列出所有自定义策略 |
| POST | `/api/strategies/custom` | 新建策略（v1） |
| POST | `/api/strategies/custom/:id/fork` | 派生新版本 |
| GET | `/api/strategies/custom/:id/versions` | 列出同 root 的所有版本 |
| GET | `/api/strategies/custom/:id` | 读取单个策略 |
| PUT | `/api/strategies/custom/:id` | 更新策略（不影响版本号） |
| DELETE | `/api/strategies/custom/:id` | 删除策略（不影响同 root 其他版本） |
| GET | `/api/market/ticks?symbol=&limit=&offset=` | 查询实时录制数据 |
| GET | `/api/market/ticks/stats` | 录制统计（已录制条数 / 时间范围） |
| POST | `/api/ab-test/run` | 启动 A/B 对比实验 |
| GET | `/api/ab-test` | 列出所有实验 |
| GET | `/api/ab-test/:id` | 读取单个实验（含净值曲线） |
| DELETE | `/api/ab-test/:id` | 删除实验 |

---

## 四、典型工作流（4 个常见场景）

### 场景 A：参数调优（寻找最优止盈止损）

```
v1: 止盈10% / 止损5%（原始）
 ↓ fork
v2: 止盈12% / 止损5%（延长盈利）
 ↓ fork
v3: 止盈10% / 止损7%（放宽止损）
 ↓ A/B v1 vs v2 vs v3（连续启动两次实验）
观察 Δ Sharpe / Δ MaxDD，挑胜者作为下个版本的父
```

### 场景 B：策略对比（选 A 还是 B）

```
模板 A: 均线突破（趋势跟踪）
模板 B: RSI 反转（均值回归）
 ├ A v1 (cs_AAA...)
 └ B v1 (cs_BBB...)
A/B A vs B → 看总收益 / 夏普 / 适用行情
```

### 场景 C：多标的并行验证

```
v1 (激进) ─┬─ sh600519
           ├─ sh600036
           └─ sz000858

v2 (稳健) ─┬─ sh600519
           ├─ sh600036
           └─ sz000858

A/B 实验 symbols: ["sh600519","sh600036","sz000858"]
→ 资金在 3 个标的内按权重分配，更接近真实投资组合
```

### 场景 D：灰度上线前评估

```
生产版 v1 + 实验版 v2 跑 A/B 1 周
  ↓ 看 v2 是否显著胜出
  ├ 显著胜出 → 把 v2 设为新生产版（v3 = fork(v2, name="生产版-2025Q4")）
  └ 不显著   → 保留 v1，把 v2 标记废弃
```

---

## 五、数据流全景图

```
                  ┌─────────────────────────────────────────────┐
                  │  Sina Finance API（每 5s polling）            │
                  └────────────────────┬────────────────────────┘
                                       │
                  MarketPollingService.tick()  ──────►┐
                                       │            │
                                       ▼            ▼
                          notify subscribers    LivePnlService
                                       │
                ┌──────────────────────┼──────────────────────┐
                ▼                      ▼                      ▼
        TickRecorder        行情展示页（前端）         其他订阅者
   (本次新增，每 tick 落库)
                │
                ▼
        market_ticks 表（SQLite）
                │
                ▼
        BacktestService.run()  ←──── ABTestRunner.runBoth()
                                       │
                                ┌──────┴──────┐
                                ▼             ▼
                          v1 paper-acct   v2 paper-acct
                          (隔离账户)      (隔离账户)
                                │             │
                                └──────┬──────┘
                                       ▼
                              ab_equity_points
                              ab_experiments (summary)
                                       │
                                       ▼
                              /api/ab-test/:id
                                       │
                                       ▼
                              前端对比页渲染
```

---

## 六、判断胜出的标准

`ABTestRunner.computeWinner(v1Metrics, v2Metrics)` 采用**复合目标函数**：

```
score = 0.4 × totalReturn
      + 0.3 × sharpe / 3        # 夏普归一化到 [0,1]
      + 0.2 × (1 + maxDrawdown)  # 回撤越小分越高
      + 0.1 × winRate            # 胜率
```

`score_v1 > score_v2` ⇒ 胜者为 v1，否则 v2，平局则 `"tie"`。

权重可在 `server/src/ab-test/ab-test-runner.service.ts` 顶部调整。

---

## 七、数据库表结构

```sql
-- 1. 策略版本化字段（新增列）
ALTER TABLE custom_strategies ADD COLUMN parent_id TEXT;
ALTER TABLE custom_strategies ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE custom_strategies ADD COLUMN root_id TEXT;
ALTER TABLE custom_strategies ADD COLUMN forked_at INTEGER;

-- 2. 实时行情录制表（新增）
CREATE TABLE IF NOT EXISTS market_ticks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  ts INTEGER NOT NULL,
  price REAL NOT NULL,
  open REAL,
  prev_close REAL,
  change_pct REAL,
  volume REAL,
  recorded_at INTEGER NOT NULL,
  UNIQUE(symbol, ts)
);
CREATE INDEX IF NOT EXISTS idx_ticks_symbol_ts ON market_ticks(symbol, ts);

-- 3. 实验元数据（新增）
CREATE TABLE IF NOT EXISTS ab_experiments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  v1_strategy_id TEXT NOT NULL,
  v2_strategy_id TEXT NOT NULL,
  benchmark_strategy_id TEXT,
  symbols TEXT NOT NULL,    -- JSON 数组
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  initial_capital REAL NOT NULL,
  status TEXT NOT NULL,      -- pending / running / completed / failed
  v1_metrics TEXT,           -- JSON
  v2_metrics TEXT,           -- JSON
  delta TEXT,                -- JSON
  winner TEXT,               -- v1 / v2 / tie
  created_at INTEGER NOT NULL,
  completed_at INTEGER
);

-- 4. 净值曲线（新增）
CREATE TABLE IF NOT EXISTS ab_equity_points (
  experiment_id TEXT NOT NULL,
  variant TEXT NOT NULL,     -- 'v1' / 'v2'
  t INTEGER NOT NULL,
  equity REAL NOT NULL,
  PRIMARY KEY (experiment_id, variant, t)
);
```

---

## 八、常见问题

**Q1：fork 后修改 v1，v2 会跟着变吗？**  
A：不会。v1 与 v2 是独立行，修改 v1 不影响 v2。`fork` 是"值拷贝"不是"引用"。

**Q2：能 fork 一个 fork 的 fork 吗？**  
A：可以，无限层级。但只有根（root）的版本号 = 子孙数 +1 链式计算，跨 fork 链的版本号互相独立。

**Q3：A/B 实验结果是实时更新的吗？**  
A：当前版本是"实验跑完一次 → 写入结果"。不支持流式更新。下个版本会加入"实时 tick 驱动 v1/v2 同时模拟交易"。

**Q4：TickRecorder 数据保留多久？**  
A：当前无 TTL 清理，会持续累积。建议每月归档一次（V1.2 加入自动归档）。

**Q5：沙箱里 A/B 实验返回 503 怎么办？**  
A：当前沙箱 Sina 实时行情 API 被限制，回测引擎拿不到 K 线数据。生产环境启用后数据将自动恢复。

**Q6：实验可以删除吗？**  
A：可以，DELETE /api/ab-test/:id 会同步删除关联的 ab_equity_points 行。

---

## 九、下一步规划

- **V1.2**：多标权重独立回测 + 参数敏感性图（仿 Jesse）
- **V2.0**：实时 tick 驱动的并行模拟（仿 Lean Algorithm Lab）
- **V2.0**：策略市场 / 社区模板（仿 Hummingbot strategies）
- **V3.0**：AI 自动调参（Bayesian Optimization）

完整路线见 `docs/roadmap/next-quarter.md`。