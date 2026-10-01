# 计划：100 账户仿真 9 月投资复盘

## 概述

基于已有的「100 账户实时仿真系统」（server/src/simulation/*）和真实 9 月行情数据，复盘 100 个仿真账户在 2026-09 月的投资表现，并产出 Markdown 复盘报告。平台：mobile（Taro + NestJS）。涉及 nest 服务端脚本与一次性 K 线导入工具，无需前端改动。

## 技术方案

| 维度 | 选择 | 理由 |
|---|---|---|
| 仿真系统 | 复用现有 SimulationScheduler / SimulationFactory / SimulationReportService | 代码完整、跑过单测，无须重写 |
| 数据落盘 | 现有 `server/data/quant.db`（已含 simulation_runs/sim_accounts/sim_trades/sim_snapshots 四张表） | 实测已有 run 在跑，无需新建库 |
| 9 月行情数据 | 新增 `KLineImporter` 服务：从本地 JSON/CSV 导入 9 月日 K 线 → 写入 `history_kline` | 沙箱 Sina API 不可达，必须支持离线导入 |
| 仿真价格源 | 改造 scheduler：增加 `priceSource: 'synthetic' \| 'history'` 配置；history 模式按 ts 推进读 K 线 close | 现有代码用合成 walk，无法复现 9 月真实涨跌 |
| 9 月回放 | 新增 `replayMode` 调度：每 N 秒推进 1 个交易日，2 小时跑完 9 月 22 个交易日 | 实时 30s/tick 太慢；回放模式提速 600 倍 |
| 报告输出 | 复用 `SimulationReportService.generate()` + 新增 Markdown 渲染层 | 接口已存在，只缺格式化输出 |
| 一键脚本 | `scripts/run-sept-replay.ts`：导入 K 线 → 创建 run → 启动回放 → 等完成 → 生成报告 | 端到端可复现 |

## 功能模块

### 模块 A · 9 月 K 线导入（KLineImporter）

- **新增** `server/src/stock/kline-importer.service.ts`：读取 `data/sept-kline.json`（项目级约定），按 `{ symbol, date, open, high, low, close, volume }` 批量 INSERT OR IGNORE 到 `history_kline`
- **示例数据**：由用户/我手工准备 9 月 22 个交易日 × 16 只仿真股票（共 352 条）
- **新增** `POST /api/stock/kline/import`：接受 `{ source: 'local' }`，从约定路径导入，返回 `{ inserted, skipped, errors }`
- **校验**：导入前用唯一索引 `(symbol, date)` 防止重复；导入后抽样 5 条做 OHLC 合理性检查

### 模块 B · scheduler 支持历史 K 线驱动（核心改造）

- **修改** `SimulationScheduler`：
  - 增加 `priceSource` 字段（默认 `'synthetic'`）
  - 新增 `private getHistoryPrice(symbol, date): Promise<{ close, changePct } | null>`：从 history_kline 按 symbol + 当前虚拟日期查
  - `walkPrice` 改为：在 history 模式下读 K 线；否则保留原合成逻辑
  - 新增 `replayMode`：tick 间隔为 `REPLAY_TICK_MS = 60_000`（1 分钟），每 tick 推进 1 个虚拟日
- **修改** `SimulationFactory`：接受 `month?: string` 配置，决定是否启动回放模式
- **新增** `SimulationController.replayMonth(body: { month, accountCount, capitalMin, capitalMax })`：一键创建 + 启动 9 月回放 run

### 模块 C · 一键复盘脚本（run-sept-replay）

- **新增** `server/scripts/run-sept-replay.ts`：
  1. 检查 `data/sept-kline.json` 是否存在，不存在则给出错误提示
  2. 调 KLineImporter 导入 9 月 K 线
  3. 调 simulation 启动 9 月回放 run（accountCount 默认 100）
  4. 轮询 run status，等到 status=stopped 或超时（默认 4h）
  5. 调 `/api/simulation/runs/:id/report` 拿到聚合报告
  6. 调 MarkdownReportRenderer 输出到 `docs/report/simulation-sept-replay.md`
- **超时保护**：超过 4h 自动 stop + 仍生成已有 snapshot 的部分报告

### 模块 D · 复盘报告 Markdown 渲染（MarkdownReportRenderer）

- **新增** `server/src/simulation/markdown-report.service.ts`：
  - 输入：`SimulationReportService.generate()` 输出 + 交易明细（top trades by pnl）
  - 输出 Markdown：
      1. **概览**：账户数、整体收益率均值/中位数、胜率、Top/Bottom 10
      2. **行业分布**：每个 INDUSTRIES 的 mean return / win rate
      3. **策略分布**：每个 STRATEGY 的 mean return / win rate
      4. **资金规模分布**：small/medium/large 三档
      5. **关键洞察**：基于数据自动生成（胜率最高/最低的策略、最佳/最差行业、极端账户）
      6. **附录**：方法说明 + 数据口径 + 已知限制（合成价格片段 + K 线样本股说明）
- **保存路径**：`docs/report/simulation-sept-replay-YYYYMMDD.md`

## 是否有原型设计

否（纯后端脚本 + 一次性报告产出；仿真页面 `src/pages/simulation/index.tsx` 暂不补，不在本轮范围）。

## 实施步骤

1. **现状核查与数据准备**：进入 `server/data/quant.db` → 检查 simulation_runs/sim_accounts/sim_trades/sim_snapshots 四张表存在性与最新 run 状态 → 准备 9 月 K 线 JSON 数据 → 在 simulation_runs 列出当前在跑的 3 个 run 作为清理目标
2. **KLineImporter 服务**：新增 `server/src/stock/kline-importer.service.ts` + 注册到 persistence.module → 实现 `importLocal()` / `validateOHLC()` 方法 → 新增 `POST /api/stock/kline/import` 路由 → curl 验证导入 352 条无错误
3. **scheduler 历史模式改造**：修改 `simulation.scheduler.ts`，增加 `priceSource` + `replayMode` + `getHistoryPrice` + 虚拟日期推进 → 修改 `simulation.factory.ts` 接受 month 配置 → 修改 `simulation.controller.ts` 加 `replayMonth` 路由 → 用 curl 启动 1 个 mini 回放 run（5 账户、9 月 1 周）验证 K 线驱动生效
4. **一键脚本 + 报告渲染**：新增 `server/scripts/run-sept-replay.ts` 串联 importKline → startReplay → poll → renderReport → 新增 `markdown-report.service.ts` 输出 Markdown → 执行脚本 → 产出 `docs/report/simulation-sept-replay-YYYYMMDD.md`
5. **验证 + 收尾**：`pnpm validate`（必须 0 error）→ curl 测试 KLineImporter + replayMonth + report 三个端点 → 检查报告内容完整性 → git commit（拆为：feat(stock): K线导入服务 / feat(simulation): 历史回放模式 / docs: 9月100账户仿真复盘报告）

## 页面规格

不适用（本轮纯后端，无 UI 改动）。