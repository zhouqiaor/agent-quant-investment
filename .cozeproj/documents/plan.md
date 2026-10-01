# 2026 全年按月迭代仿真 · 方案

## 概述

不是"一次性跑完全年"，而是**按月迭代 + 规则驱动自动调优**的仿真系统：每月固定 100 个仿真账户 + 跑完一个月份 K 线 → 从账户回放结果中提炼（行业 × 策略）收益与胜率 → 按预设规则自动调整下一月的账户分布权重 → 下一月用调整后的权重重新生成 100 账户跑下一个月 K 线 → 循环 12 个月。涉及策略调优引擎、调优规则配置、累计 P&L 报告。

| 参数 | 值 |
|---|---|
| 平台 | `mobile`（后端，纯 API + 报告脚本） |
| 数据范围 | 2026-01 ~ 2026-12 |
| 每批账户数 | 100（每月独立批次） |
| 每批 Tick 速度 | `replayTickMs=3000`（22 日 × 3s ≈ **66 秒/月**） |
| 12 月总时长 | 估算 **15-18 分钟**（导入 + 回放 + 调优 + 报告） |
| 总账户记录数 | 12 × 100 = 1,200 |

## 技术方案

| 维度 | 选择 | 理由 |
|---|---|---|
| 迭代方式 | 串行按月（Jan→...→Dec） | 调优依赖前月数据；并行会断学习链 |
| 数据粒度 | 每月 22 × 16 = 352 行 K 线，单独导入 | 调度器已支持单月回放；不需扩范围 |
| 调优对象 | `(industry, strategy)` 联合权重 | 与仿真账户生成口径一致 |
| 调优规则 | `data/tuning-rules.json` 可配置：winner/loser 阈值+winner 月度收益阈值+分配增量上下限+权重地板天花板 | 可读可改，规则不硬编码 |
| 权重应用 | 注入 `SimulationFactory.createRun()` 的 `industryWeights/strategyWeights` 参数 | 工厂已支持生成权重 |
| 报告 | 月度报告（含调优轨迹段） + 年度汇总（累计 P&L 文字图 + 权重演进表 + 全年 Top/Bottom） | 月度看局部、年度看整体 |
| 状态保存 | 月度 run 元数据 `config` JSON 字段存权重快照 | 不新增表，复用 `simulation_runs.config` |
| 验收 | `pnpm validate` + 单月迷你调优跑（验证规则） + 12 月完整跑 |

## 功能模块

### 调优规则（可配置）
- 默认规则（`data/tuning-rules.json`）：
  - winner 阈值：胜率 ≥ **55%** 且 月均收益 ≥ **+0.5%** → 权重 ×1.4
  - neutral：胜率 35-55% 或 月均收益 -0.5% ~ +0.5% → 权重不变
  - loser 阈值：胜率 < **35%** 且 月均收益 < **-0.5%** → 权重 ×0.6
  - 地板 5%、天花板 60%
  - 总和归一化（保证 100%）
  - 资金档位 (small/medium/large) 保持 40/40/20 不变
  - Watchlist 轮换：把上月盈利前 3 名股票加入下月 watchlist（保留 5 只随机）

### 核心服务 `server/src/simulation/strategy-tuner.service.ts`
- 输入：prior runId + rules
- 流程：
  1. `getSimulationRun(priorRunId)` 拉元数据
  2. `listSimAccounts(priorRunId)` 拉账户表（含 industry/strategy/final_pnl_rate）
  3. 按 (industry, strategy) 聚合：账户数 / 平均收益 / 胜率（pnl_rate > 0 比例）
  4. 套用 rules → 计算 (industry, strategy) 新权重
  5. 输出：`{ industryWeights: Record<string, number>, strategyWeights: Record<string, number>, watchlist: string[], rulesApplied: [...] }`
- 输出 JSON 给工厂

### 工厂 `simulation.factory.ts`
- `SimulationConfig` 增加 `industryWeights?: Record<string, number>` + `strategyWeights?: Record<string, number>` + `watchlist?: string[]`
- 生成账户时：用传入的权重做加权抽样（替代原均匀分布）
- 若未传权重：沿用默认均匀分布（向后兼容）

### 持久化 `persistence.service.ts`
- `listSimAccounts(runId)` 方法：已存在（如不存在需新增；参考 `listSimTrades` 写法）
- 不新增表

### 报告 `markdown-report.service.ts`
- 月度报告新增段：
  - §6 本月调优轨迹：列出本次相对上月的（行业, 策略）权重变化
  - §7 月度对比：本月 vs 上月整体均值收益对比
- 新增 `aggregateYearReport(monthlyRunIds: string[], tuningHistory: any[]): string` 方法：
  - 年度汇总报告：累计 P&L 文字图 + 12 个月权重演进表 + 全年 Top 20 / Bottom 20 + 调优日志摘要

### 一键脚本 `server/scripts/run-monthly-iter.js`
- 流程：
  1. 检查 `data/year-kline.json`（4,224 行）
  2. 读取 `data/tuning-rules.json`
  3. 初始权重 = 均匀分布（首月）
  4. `for month in [2026-01 .. 2026-12]`：
     - 用现有 `POST /api/stock/kline/import`（dataset=year，按月过滤）
     - `POST /api/simulation/replay` { month, accountCount=100, replayTickMs=3000, industryWeights, strategyWeights, watchlist }
     - 轮询到完成
     - 拉月度报告 → 写入 `docs/report/simulation-2026-M{m}-iter-YYYYMMDD.md`
     - 调 `StrategyTuner` 算下月权重
  5. 调 `aggregateYearReport` 生成年度汇总 → `docs/report/simulation-2026-yearly-iter-YYYYMMDD.md`
- 输出：`docs/report/simulation-2026-M{01..12}-iter-*.md` × 12 + `simulation-2026-yearly-iter-*.md` × 1 = 13 份

### 数据生成 `server/scripts/gen-year-kline.js`
- 沿用 `gen-sept-kline.js` 算法
- 12 个月度宏观偏置表：让月度差异显著（如 1 月 -0.008、3 月 +0.012、6 月 ±0.002、9 月 +0.008、12 月 -0.005）
- 输出 `data/year-kline.json`（4,224 行 + 元信息）

### KLineImporter 扩展 `kline-importer.service.ts`
- 增加 `dataset: 'year' | 'sept'` 参数
- `dataset=year`：按月过滤导入（只导入指定月份的 K 线）
- 默认行为：保持当前全量导入（兼容旧调用）

## 是否有原型设计

**否**。本次纯后端：数据库 schema 不变、新增 `StrategyTuner` 服务与脚本。无页面规格改动。

## 实施步骤

1. **数据生成 + 调优规则配置**：写 `gen-year-kline.js`（12 月偏置 + 4224 行） → 输出 `data/year-kline.json` → 写 `data/tuning-rules.json`（默认规则 + winner/loser 阈值 + 地板天花板） → 校验文件可读
2. **StrategyTuner 服务**：新增 `server/src/simulation/strategy-tuner.service.ts`（输入 runId + rules → 输出新权重） → 在 `simulation.module.ts` 注册 → `persistence.listSimAccounts(runId)` 确保存在（如缺失则补）→ 写 5 行单元测试式 node script 验证：模拟一个 prior run → 调 tuner → 断言权重在 [0.05, 0.6] 区间且总和 = 1
3. **Factory + Controller + KLineImporter 扩展**：`simulation.factory.ts` `SimulationConfig` 加 `industryWeights/strategyWeights/watchlist` → 工厂抽样使用权重 → `simulation.controller.ts` `replay` 路由接收新参数（保留旧 month 单月兼容） → `kline-importer.service.ts` 加 `dataset: 'year'` + 按月过滤 → `pnpm validate` + curl mini 跑（Jan 单月 + 非均匀权重）验证账户分布按权重倾斜
4. **MarkdownReportRenderer 增强 + 月度报告新增段**：`markdown-report.service.ts` 月度报告新增 §6 调优轨迹 + §7 月度对比 → 新增 `aggregateYearReport()` 年度汇总（累计 P&L 文字图 + 12 月权重演进表 + Top/Bottom 20）→ `pnpm validate` + curl 拉 1 月 mini 报告验证新章节
5. **月度迭代脚本 + 全流程**：`server/scripts/run-monthly-iter.js`（按月循环 + 调优循环 + 月度+年度报告）→ 写调优日志 → 期间监控进度 → 完成后验证 13 份报告存在且内容完整 → `pnpm validate` 复跑
6. **git commit + 收尾**：拆 4 个原子提交（data+rules、tuner+factory、report、script）→ `pnpm validate` 终检

## 关键文件清单

| 文件 | 状态 | 改动 |
|---|---|---|
| `server/scripts/gen-year-kline.js` | 新增 | 月度偏置 + 4224 行生成 |
| `data/year-kline.json` | 新增 | 输出产物 |
| `data/tuning-rules.json` | 新增 | 调优规则配置 |
| `server/src/simulation/strategy-tuner.service.ts` | 新增 | 调优引擎核心 |
| `server/src/simulation/simulation.factory.ts` | 修改 | 加权抽样 |
| `server/src/simulation/simulation.controller.ts` | 修改 | 路由接权重 |
| `server/src/simulation/simulation.module.ts` | 修改 | 注册 tuner |
| `server/src/simulation/markdown-report.service.ts` | 修改 | §6/§7 + aggregateYearReport |
| `server/src/stock/kline-importer.service.ts` | 修改 | dataset='year' + 月过滤 |
| `server/scripts/run-monthly-iter.js` | 新增 | 月度迭代编排脚本 |
| `docs/report/simulation-2026-M{01..12}-iter-*.md` | 新增 × 12 | 月度报告 |
| `docs/report/simulation-2026-yearly-iter-*.md` | 新增 × 1 | 年度汇总 |