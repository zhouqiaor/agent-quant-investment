# 收尾 + P2 实时盯盘 / 模拟实盘 · 方案

## 概述

两阶段：

- **阶段一（收尾）**：把 P0+P1 升级后遗留的 `seed` 字段透传 + `multi-seed-summary.json` 多 seed 报告收口、validate、并原子提交。
- **阶段二（P2 实时盯盘）**：策略不再只跑历史，而是接 mock 实时价格流 → 现有策略按 tick 触发信号 → 模拟撮合 → 持仓/订单/P&L 实时更新 → 移动端"Live Tab"可视化。核心新增 `MockFeedService`（价格流）+ `LiveSimulationEngine`（编排）+ `MockMatchEngine`（撮合）+ `LivePortfolio`（持仓账本）+ `/api/live/*` 路由族 + 前端 live tab。

| 参数 | 值 |
|---|---|
| 平台 | `mobile`（Taro 小程序，复用现有仿真 4 tab 的"实时" 第 5 tab 或新页） |
| 数据源 | 复用 `data/year-kline.json`，按 tick 间隔（默认 500ms）逐根推送，模拟实时行情 |
| 策略 | 复用 P0+P1 的 5 个策略（momentum / ma_cross / breakout / reversal / trend_follow），新增 onTick 适配层 |
| 推送方式 | 短轮询 `/api/live/state`（2 秒/次），移动端友好；后续可升级 SSE/WS |
| 撮合 | 市价单即时按当前价成交；持仓/现金/已实现盈亏实时更新 |
| 验收 | `pnpm validate` + 后端 mini 跑（启动→运行 30 秒→停止） + 前端 Live Tab 联调 |

## 技术方案

| 维度 | 选择 | 理由 |
|---|---|---|
| 价格源 | 复用 `year-kline.json` + tick 加速器 | 不依赖外部数据，已有数据可信；mock 实时可用「随机游走」后续扩展 |
| 策略适配 | 新增 `LiveStrategyAdapter`，内部维护滚动 K 线缓冲，tick 时调用策略 onTick | 不破坏现有 K 线策略接口（momentum 等仍以 K 线为输入） |
| 撮合 | `MockMatchEngine`：市价单立即成交，限价单等穿越 | 优先市价单（满足实时演示），限价单后续扩展 |
| 持仓账本 | `LivePortfolio`：每账户维护 cash / positions[] / realizedPnl / unrealizedPnl | 复用现有 SimAccount 结构，最小侵入 |
| 推送方式 | 短轮询 `/api/live/state`（2s） | 移动端无需 WebSocket 长连接；3 秒心跳够演示 |
| 状态保存 | 内存 `Map<runId, LiveState>`（不落 SQLite） | Live 是过程性数据，重启即丢失；与回测的持久化区分 |
| 前端 | 仿真页加 "Live" tab：实时 P&L 卡片 + 持仓列表 + 订单流 + 启动/停止/暂停按钮 | 复用 4 tab 容器（总览/月度/热力/轨迹）框架；UI 风格沿用 design_guidelines.md |
| 持久化 | 不新增 SQLite 表；live run 元信息写 `simulation_runs.config.live=true` 标记 | 复用现有 schema |
| 验收 | 后端 mini 跑：启动→跑 30 秒→断言 P&L/订单数 > 0；前端 Live Tab 联调截图 | 与 P0+P1 一致 |

## 功能模块

### 阶段一：收尾
- `server/src/simulation/simulation.controller.ts`：已有 `seed?: number` 字段（uncommitted），无新增
- `docs/report/multi-seed-summary.json`：548 行多 seed 统计报告（uncommitted）
- 提交信息：`docs(simulation): 提交 multi-seed 报告 + seed 字段透传`

### 阶段二：实时盯盘

#### `MockFeedService`（`server/src/simulation/mock-feed.service.ts`）
- 输入：`runId` + `startMonth` + `tickMs`（默认 500ms）
- 启动后从 `data/year-kline.json` 取当月 K 线，按 `tickMs` 间隔推送
- 输出：`TickEvent { symbol, ts, open/high/low/close, volume }` 推入 LiveEngine
- 控制：`start()` / `resume()` / `pause()` / `stop()`

#### `LiveStrategyAdapter`（`server/src/simulation/live-strategy-adapter.ts`）
- 输入：策略 + tick 流
- 内部维护滚动 K 线缓冲（窗口大小随策略：ma_cross=20 / momentum=10 等）
- 每 tick 触发策略 `onTick(rollingCandles)` → 返回 `Signal { side: buy|sell|hold }`
- 复用现有 5 个策略

#### `MockMatchEngine`（`server/src/simulation/mock-match-engine.ts`）
- 输入：`Signal` + `currentPrice` + `Portfolio`
- 规则：
  - 市价买单：用 cash 按 currentPrice 全仓买入，扣手续费 0.1%
  - 市价卖单：卖出持仓中的对应股票，按 currentPrice 成交
  - 持仓不足时部分成交
- 输出：`Order { id, side, symbol, price, qty, status: filled, ts }`

#### `LivePortfolio`（`server/src/simulation/live-portfolio.ts`）
- 字段：`cash / positions[] / realizedPnl / unrealizedPnl / equityCurve[]`
- 方法：`applyFill(order)` / `markToMarket(currentPrices)` / `snapshot()`
- 每个 live run 一个 portfolio（单账户起步，可扩展多账户）

#### `LiveSimulationEngine`（`server/src/simulation/live-simulation.engine.ts`）
- 编排：`MockFeed → Adapter → MatchEngine → Portfolio`
- 状态机：`idle / running / paused / stopped`
- API：`start({ month, strategy?, seed? }) / pause() / resume() / stop() / getState()`
- 单例：进程内 `Map<runId, LiveState>`

#### `LiveController`（`server/src/simulation/live-simulation.controller.ts`）
- `POST /api/live/start`：`{ month, strategy?, seed? }` → `{ runId }`
- `POST /api/live/:runId/pause` / `resume` / `stop`
- `GET /api/live/:runId/state`：返回 `{ status, currentTick, currentPrices, portfolio, recentOrders, equityCurve }`（前端每 2 秒拉一次）

#### `simulation.module.ts` 注册
- 注册 `MockFeedService`、`MockMatchEngine`、`LiveSimulationEngine`、`LiveController`
- 导出 engine（供 controller 注入）

#### 前端 Live Tab（`src/pages/simulation/index.tsx` 新增第 5 tab）
- 区块：
  1. 控制栏：策略选择 + 月份选择 + 启动/暂停/停止按钮
  2. P&L 卡片：累计收益 / 已实现 / 未实现 / 持仓数
  3. 持仓列表：股票 / 数量 / 成本 / 现价 / 浮动盈亏
  4. 订单流：最近 20 笔订单滚动列表
  5. 价格图（可选 mini 折线）：当前月 tick 价格走势
- 实时刷新：useEffect + 2 秒 setInterval 拉 `/api/live/:runId/state`
- 跨端兼容：定时器在 onUnload 清理；用 `Taro.getEnv()` 检测平台（H5 用 `setInterval`，小程序端用 `Taro.setInterval`）

## 是否有原型设计

**否**。本次仍以后端为主，前端 Live Tab 是已有 4 tab 框架内的延续，无独立原型页面。

## 实施步骤

1. **收尾 commit**：把 `simulation.controller.ts` 的 `seed?: number` 字段 + `docs/report/multi-seed-summary.json` 一起原子提交 → `pnpm validate` 终检 → 提交信息 `docs(simulation): 提交 multi-seed 报告 + seed 字段透传`
2. **Live 核心三件套**：新增 `MockFeedService`（按 tick 推 K 线）+ `LiveStrategyAdapter`（现有策略 onTick 适配）+ `MockMatchEngine`（市价单撮合）→ 在 `simulation.module.ts` 注册 → 写 node script 验证：启动 mock feed → 触发 ma_cross 策略 → 断言订单生成 + portfolio 状态正确
3. **LiveSimulationEngine + LiveController + LivePortfolio**：新增 `LiveSimulationEngine`（编排 + 状态机）+ `LivePortfolio`（持仓账本）+ `live-simulation.controller.ts`（4 个路由：`/start /pause /resume /stop /state`）→ `pnpm validate` + curl mini 跑：启动 → 等 5 秒 → 拉 state → 断言 `status=running` 且 orders.length > 0
4. **前端 Live Tab**：`src/pages/simulation/index.tsx` 新增"实时"第 5 tab → 控制栏（策略 + 月份 + 启动/暂停/停止） → P&L 卡片 + 持仓列表 + 订单流（每 2 秒拉 state）→ H5 / 小程序跨端兼容（定时器清理 + 平台判断）→ 与后端联调验证（curl 启动 + 浏览器打开前端 tab）
5. **文档 + 收尾 commit**：更新 `docs/report/simulation-year-iter-2026.md` 加一段"实时盯盘模式"说明 → 拆 3 个原子提交（live core、live routes + frontend、docs）→ `pnpm validate` 终检

## 关键文件清单

| 文件 | 状态 | 改动 |
|---|---|---|
| `server/src/simulation/mock-feed.service.ts` | 新增 | tick 价格流 |
| `server/src/simulation/live-strategy-adapter.ts` | 新增 | 策略 onTick 适配层 |
| `server/src/simulation/mock-match-engine.ts` | 新增 | 市价单撮合 |
| `server/src/simulation/live-portfolio.ts` | 新增 | 持仓账本 |
| `server/src/simulation/live-simulation.engine.ts` | 新增 | 编排 + 状态机 |
| `server/src/simulation/live-simulation.controller.ts` | 新增 | 5 个 REST 路由 |
| `server/src/simulation/simulation.module.ts` | 修改 | 注册 Live 5 件套 |
| `src/pages/simulation/index.tsx` | 修改 | 新增第 5 tab |
| `docs/report/simulation-year-iter-2026.md` | 修改 | 加"实时盯盘模式"段 |