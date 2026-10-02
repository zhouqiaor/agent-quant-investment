# 2026 年度仿真迭代报告

> 月度回放 + 自动调优，按月串行迭代；样本规模：每月 100 账户（12 月 200 账户），价格源：历史 K 线

## §1 月度表现总览

| 月份 | 账户数 | 累计收益 | 胜率 |
|------|--------|----------|------|
| 2026-01 | 100 | -70.74% | 2.00% |
| 2026-02 | 100 | 15.13% | 33.00% |
| 2026-03 | 100 | 125.17% | 61.00% |
| 2026-04 | 100 | 16.50% | 30.00% |
| 2026-05 | 100 | 37.30% | 46.00% |
| 2026-06 | 100 | -5.01% | 3.00% |
| 2026-07 | 100 | 18.88% | 39.00% |
| 2026-08 | 100 | 32.91% | 40.00% |
| 2026-09 | 100 | 58.55% | 48.00% |
| 2026-10 | 100 | -14.34% | 4.00% |
| 2026-11 | 100 | 19.31% | 50.00% |
| 2026-12 | 200 | -71.14% | 0.00% |

## §2 月度行业收益榜（Top 3 行业）

| 月份 | Top 1 | Top 2 | Top 3 |
|------|-------|-------|-------|
| 2026-01 | industrial -0.03% / material -0.10% / media -0.11% | | |
| 2026-02 | finance 0.54% / pharma 0.37% / media 0.25% | | |
| 2026-03 | pharma 2.27% / auto 2.09% / finance 2.07% | | |
| 2026-04 | consumer 0.73% / auto 0.19% / energy 0.16% | | |
| 2026-05 | finance 1.00% / utility 0.58% / energy 0.56% | | |
| 2026-06 | telecom 0.00% / industrial 0.00% / pharma -0.01% | | |
| 2026-07 | auto 0.73% / consumer 0.48% / finance 0.24% | | |
| 2026-08 | consumer 0.91% / finance 0.43% / energy 0.36% | | |
| 2026-09 | finance 2.67% / industrial 1.79% / utility 1.03% | | |
| 2026-10 | telecom 0.00% / media -0.01% / material -0.04% | | |
| 2026-11 | finance 1.06% / consumer 0.35% / utility 0.23% | | |
| 2026-12 | industrial -0.05% / media -0.07% / telecom -0.16% | | |

## §3 月度策略收益榜（Top 2 策略）

| 月份 | Top 1 | Top 2 |
|------|-------|-------|
| 2026-01 | momentum 0.00% / ma_cross -0.28% | |
| 2026-02 | breakout 0.30% / trend_follow 0.26% | |
| 2026-03 | reversal 2.41% / breakout 1.52% | |
| 2026-04 | reversal 0.49% / ma_cross 0.35% | |
| 2026-05 | reversal 0.95% / ma_cross 0.65% | |
| 2026-06 | breakout 0.00% / trend_follow 0.00% | |
| 2026-07 | reversal 0.37% / trend_follow 0.26% | |
| 2026-08 | reversal 0.69% / ma_cross 0.65% | |
| 2026-09 | reversal 2.03% / trend_follow 1.66% | |
| 2026-10 | breakout 0.00% / trend_follow 0.00% | |
| 2026-11 | breakout 0.38% / reversal 0.27% | |
| 2026-12 | trend_follow 0.00% / momentum 0.00% | |

## §4 月度行业收益热力（%）

| 行业 | 2026-01 | 2026-02 | 2026-03 | 2026-04 | 2026-05 | 2026-06 | 2026-07 | 2026-08 | 2026-09 | 2026-10 | 2026-11 | 2026-12 |
|------|--------|--------|--------|--------|--------|--------|--------|--------|--------|--------|--------|
| industrial | -0.03 | 0.12 | 1.61 | 0.13 | 0.45 | 0.00 | 0.05 | 0.23 | 1.79 | -0.05 | 0.16 | -0.05 |
| material | -0.10 | 0.04 | 0.42 | 0.16 | 0.11 | -0.02 | 0.00 | 0.09 | -0.51 | -0.04 | 0.09 | -0.70 |
| media | -0.11 | 0.25 | 2.01 | 0.00 | 0.05 | -0.08 | 0.05 | 0.35 | 0.08 | -0.01 | 0.03 | -0.07 |
| tech | -0.29 | 0.22 | 1.39 | 0.13 | 0.08 | -0.07 | 0.02 | 0.12 | 0.13 | -0.04 | 0.15 | -0.46 |
| utility | -0.52 | 0.14 | 1.38 | 0.08 | 0.58 | -0.05 | 0.20 | 0.23 | 1.03 | -0.29 | 0.23 | -0.69 |
| pharma | -0.85 | 0.37 | 2.27 | 0.11 | 0.06 | -0.01 | 0.15 | 0.08 | -0.94 | -0.05 | 0.07 | -0.24 |
| energy | -0.98 | 0.01 | 0.30 | 0.16 | 0.56 | -0.01 | 0.00 | 0.36 | 0.35 | -0.13 | 0.07 | -0.25 |
| telecom | -1.08 | 0.00 | 0.10 | 0.05 | 0.38 | 0.00 | -0.03 | 0.34 | 0.42 | 0.00 | -0.01 | -0.16 |
| finance | -1.20 | 0.54 | 2.07 | 0.10 | 1.00 | -0.02 | 0.24 | 0.43 | 2.67 | -0.57 | 1.06 | -0.32 |
| auto | -1.21 | -0.05 | 2.09 | 0.19 | 0.32 | -0.03 | 0.73 | 0.21 | 0.83 | -0.32 | 0.06 | -0.79 |
| consumer | -1.64 | -0.02 | 0.24 | 0.73 | 0.39 | -0.14 | 0.48 | 0.91 | 0.23 | -0.12 | 0.35 | -0.43 |

## §5 月度策略收益热力（%）

| 策略 | 2026-01 | 2026-02 | 2026-03 | 2026-04 | 2026-05 | 2026-06 | 2026-07 | 2026-08 | 2026-09 | 2026-10 | 2026-11 | 2026-12 |
|------|--------|--------|--------|--------|--------|
| momentum | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.01 | 0.00 | 0.00 | 0.00 |
| ma_cross | -0.28 | 0.17 | 0.82 | 0.35 | 0.65 | -0.06 | 0.25 | 0.65 | -1.03 | -0.24 | 0.22 | -0.52 |
| breakout | -0.69 | 0.30 | 1.52 | 0.00 | 0.00 | 0.00 | 0.01 | 0.00 | 0.26 | 0.00 | 0.38 | 0.00 |
| reversal | -1.20 | 0.09 | 2.41 | 0.49 | 0.95 | -0.13 | 0.37 | 0.69 | 2.03 | -0.55 | 0.27 | -1.13 |
| trend_follow | -1.24 | 0.26 | 1.29 | 0.05 | 0.45 | 0.00 | 0.26 | 0.24 | 1.66 | 0.00 | 0.20 | 0.00 |

## §6 年度汇总

- 总账户数：**1300**
- 累计加权收益：**162.52%**
- 平均月胜率：**29.67%**

## §7 实时盯盘模式（P2 新增）

> 把仿真从「历史回放」延伸到「实时盯盘」：策略不再只跑历史 K 线，而是接 mock 实时价格流 → 按 tick 触发信号 → 模拟撮合 → 持仓/订单/P&L 实时更新。

### 后端架构

| 模块 | 文件 | 职责 |
|---|---|---|
| MockFeedService | `server/src/simulation/mock-feed.service.ts` | 从 `data/year-kline.json` 加载指定月份 K 线，按 `tickMs` 间隔推送 TickEvent |
| LiveStrategyAdapter | `server/src/simulation/live-strategy-adapter.ts` | 复用 P0+P1 的 5 个策略，新增 onTick 适配层（滚动 30 根窗口） |
| MockMatchEngine | `server/src/simulation/mock-match-engine.ts` | 市价单撮合，0.1% 手续费，记录 realizedPnl |
| LivePortfolio | `server/src/simulation/live-portfolio.ts` | 现金/持仓/已实现 P&L/未实现 P&L/权益曲线账本 |
| LiveSimulationEngine | `server/src/simulation/live-simulation.engine.ts` | 编排 MockFeed → Adapter → MatchEngine → Portfolio |
| LiveController | `server/src/simulation/live-simulation.controller.ts` | 5 个 REST 路由：`/start /pause /resume /stop /state` |

### REST 路由

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/api/live/start` | 启动：`{month, strategy, tickMs?, initialCash?}` → `{runId, totalTicks, monthName}` |
| `POST` | `/api/live/:runId/pause` | 暂停（仅 running → paused） |
| `POST` | `/api/live/:runId/resume` | 恢复（paused → running） |
| `POST` | `/api/live/:runId/stop` | 停止并清理 |
| `GET`  | `/api/live/:runId/state` | 拉一次完整快照（前端 2 秒轮询） |
| `GET`  | `/api/live/runs` | 列出所有活跃 run |

### 验证（dev 环境）

```bash
# 启动（每月 16 支股票 × 22 交易日 = 352 tick）
curl -s -X POST http://localhost:3000/api/live/start \
  -H "Content-Type: application/json" \
  -d '{"month":"2026-09","strategy":"ma_cross","tickMs":100,"initialCash":1000000}'
# → {"code":200,"msg":"ok","data":{"runId":"live-...","totalTicks":352,"monthName":"金九银十"}}

# 2 秒后拉快照（cash 已扣、position 已建、recentOrders > 0）
curl -s http://localhost:3000/api/live/live-.../state | python3 -m json.tool
```

实测 2026-09 + ma_cross + tickMs=100，跑 4 秒已处理 154 tick、建仓 9 个、47 笔订单、totalPnl=+1249.7。

### 前端 Live Tab

仿真页新增第 5 个 Tab「实时」（`src/pages/simulation/index.tsx` 中 `LivePanel` 组件）：
- 控制栏：月份 / 策略 / tick 间隔 / 启动-暂停-恢复-停止
- P&L 卡片：累计 P&L、当前权益、已实现/未实现、订单/持仓计数
- 持仓列表：symbol / 数量 / 成本 / 现价 / 浮动盈亏（mark-to-market）
- 订单流：最近 50 笔订单滚动列表（BUY 绿 / SELL 红 / 利润列）
- 跨端兼容：`Taro.getEnv()` 区分小程序与 H5，分别用 `Taro.setInterval` 与 `setInterval`，组件卸载时统一清理

### 设计取舍

- **不持久化**：Live 是过程性数据（重启即清空），与回测的 SQLite 持久化区分
- **短轮询而非 WebSocket**：移动端友好，2 秒间隔足够演示；后续可升级 SSE
- **市价单优先**：满足实时演示；限价单、止损单等后续扩展
- **不引入新表**：live run 元信息以 `runId` 内存态持有，重启丢失
