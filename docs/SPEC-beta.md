# SPEC — 初版内测体验（从零到自动投资）

> 目标：让内测用户从零开始，3 步完成「投入金额 → 关注股票 → 配置策略」，
> 开启后自动监听实时价格、实时看盘收益，并支持指定时间段模拟回测。

## 1. 用户旅程（Beta Journey）

1. 首次进入：首页检测无内测配置 → 显示「开始内测体验」入口
2. 向导步骤1：设定投入金额（1万 ~ 1000万，实时联动展示）
3. 向导步骤2：搜索并关注股票（内置库 + 自定义添加），逐只开关「参与投资」
4. 向导步骤3：选择策略（内置/自定义），开启「自动模拟交易」
5. 一键开启：保存配置 → 重置模拟账户（初始资金=投入金额）→ 启动行情轮询 + 策略监听
6. 实时看盘：总资产/总收益实时刷新，持仓价格随行情跳动，信号产生即通知（自动下单）

## 2. 契约定义与可测试性分析

### 2.1 关注列表 Watchlist（阶段1）— `src/stock/watchlist.service.ts`

| 操作 | 规则 | 失败语义 |
|------|------|---------|
| addWatch(symbol, name?, enabled=true) | 6位A股校验；重复添加=幂等更新 enabled | 非法代码 → 400 |
| toggleWatch(symbol, enabled) | 开关「参与投资」 | 不存在 → 400 |
| removeWatch(symbol) | 移除关注 | 不存在 → false |
| listWatch() | enabled 优先，createdAt 倒序 | — |
| getEnabledSymbols() | 参与投资的 symbol 数组 | — |

- 存储：persistence 新表 `watch_stocks(symbol PK, name, enabled, createdAt)`
- 联动：添加关注时自动写入 custom_stocks（保证搜索可见、回测可用）

### 2.2 内测配置 BetaConfig（阶段2）— `src/beta/beta-config.service.ts`

单例配置（表 `beta_config(key PK='default', value JSON)`）：

| 字段 | 类型 | 校验 |
|------|------|------|
| initialCapital | number | >0 且 ≤1e9 |
| watchSymbols | string[] | 非空；每只须已在关注列表 |
| strategyId | string \| null | 空则用内置默认；非空须存在（自定义策略） |
| autoTrade | boolean | 默认 true |
| status | 'draft' \| 'active' | 状态机：保存即 active |

API：`GET /api/beta/config`（未配置返回 null）、`PUT /api/beta/config`（校验失败 400，成功 status='active'）

### 2.3 实时收益联动（阶段3）— `src/paper-trading` + `src/beta/live-pnl.service.ts`

| 能力 | 可测试断言 |
|------|-----------|
| `markPrices(prices: Record<symbol, price>)` 重估持仓 | 持仓 marketValue = qty×最新价；totalValue/totalPnl/totalPnlRate 同步；浮盈 pnl 更新 |
| `LivePnlService.onTick(marketData)` | ① 按最新价重估账户 ② 只对 enabled 关注标的评估策略信号 ③ 信号写入通知 ④ autoTrade=true 时信号直接 executeSignal 下单 ⑤ autoTrade=false 仅通知 |
| 一键开启 `POST /api/beta/start` | 重置账户（资金=配置金额）→ 启动轮询 → 返回 running 状态 |

信号引擎复用 `StrategyService.checkMonitorSignals(marketData)`（已测试覆盖）。

### 2.4 API 汇总

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/stock/watchlist | 关注列表 |
| POST | /api/stock/watchlist | 添加关注（@HttpCode 200） |
| PUT | /api/stock/watchlist/toggle | 开关参与投资 |
| DELETE | /api/stock/watchlist/:symbol | 取消关注 |
| GET | /api/beta/config | 读取内测配置 |
| PUT | /api/beta/config | 保存配置（3步向导提交） |
| POST | /api/beta/start | 一键开启投资 |
| GET | /api/paper-trading/account | 实时收益（含 mark 后市值） |

### 2.5 前端（阶段4）

- 新页面 `pages/onboarding/index`：3 步向导（金额 → 关注股票 → 策略+自动投资 → 开启）
- 首页改造：未配置显示引导入口；已配置显示实时看盘（账户总览 + 持仓实时价 + 开启/停止）
- `app.config.ts`：H5/小程序双分支 pages 补齐 onboarding/create/backtest/paper-trading

## 3. 测试计划（先测后码）

| 套件 | 用例 | 覆盖 |
|------|------|------|
| `watchlist.spec.ts` | 10 | 添加校验/幂等/开关/删除/排序/自定义联动/getEnabled |
| `beta-config.spec.ts` | 8 | 默认值/金额校验/关注非空/策略存在性/保存即active/覆盖更新 |
| `live-pnl.spec.ts` | 9 | 价格重估/浮盈/信号过滤(enabled)/通知/自动下单/autoTrade开关/一键开启 |
| `e2e-beta-flow.spec.ts` | 6 | 从零配置→开启→注入行情→收益与通知→查询→重置 |

每阶段 DoD：RED 确认 → GREEN 全绿 → 全量回归无破坏 → HTTP 联测通过。

## 4. 部署

完成后 `pnpm validate` + `pnpm build` + 公网域名验证（/api/beta/config 200、前端 200）。
