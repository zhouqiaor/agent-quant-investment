# 计划：数据来源透明化 + 回测真实化（真实历史行情驱动）

## 概述

本轮解决两个问题：① 前端各处数据来源不透明，用户无法确认数据真实性；② 区间回测使用本地随机模拟K线（`generateHistoricalKline` 用 `Math.sin + random` 生成假价格），导致回测结果失真、体验差。方案：接入腾讯/新浪真实历史K线驱动回测引擎，并建立统一的数据来源清单接口与前端展示，让"哪些数据是真的、来自哪里"一目了然。平台：mobile（Taro 跨端小程序）。

## 当前进度（截至本轮开始）

| # | 任务 | 状态 | 关键产出 |
|---|---|---|---|
| 2 | 历史K线服务 | ✅ | `server/src/stock/history-kline.service.ts`（8/8 测试通过：腾讯解析/新浪降级/缓存增量/缩略限频/诚实错误/meta 标识） |
| 3 | 回测引擎改造 | ✅ | `backtest.service.ts` 接入真实K线 + `meta.{realKline, dataSource, klineCount, warnings}` + 测试环境合成数据兜底（`BACKTEST_ALLOW_SYNTHETIC=true`） |
| 4 | data-sources 接口 | ✅ | `server/src/data-source/`（动态探测实时行情/历史K线/股票目录三项；4 个测试通过；`curl /api/data-sources` 200 OK） |
| 5 | 前端集成 | ✅ | `backtest/index.tsx` 动态徽标（真实/合成/缓存）+ 503 失败态；`profile/index.tsx` 数据来源卡 + 弹层；`index/index.tsx` 首页行情状态徽标 |
| 1+6 | 项目探索 / 全量回归 | ✅ | 174/174 server 测试通过 |

**待执行收尾**：验证 → 编译 → 端到端 → Git 提交（步骤 7-10）。

## 数据来源现状盘点（探索结论）

| 数据 | 来源 | 真实性 | 说明 |
|---|---|---|---|
| 实时行情（看盘/信号/重估） | 新浪 `hq.sinajs.cn` | ✅ 真实 | 6s 轮询已有 |
| 股票目录（搜索/添加） | 新浪 `Market_Center.getHQNodeData` | ✅ 真实 | 5553 只全量已缓存 |
| 持仓K线图 | 新浪 `CN_MarketDataService` | ✅ 真实 | 第3轮已接入 |
| **回测历史价格** | 腾讯 fqkline 主源 + 新浪 datalen 兜底 + SQLite 缓存 | ✅ **真实** | **本轮已完成** |
| 持仓/交易记录 | 本地 SQLite 账本 | ✅ 真实账本 | 由真实行情驱动 tick 产生，模拟盘本应本地记账 |
| 回测结果指标 | 引擎计算 | ✅ 逻辑真实 | 输入已为真实K线 |

## 技术方案

| 维度 | 选择 | 理由 |
|---|---|---|
| 历史K线主源 | 腾讯 fqkline（按日期区间） | 长区间、前复权、稳定，JSON 好解析 |
| 历史K线兜底 | 新浪 datalen=1023 | 已验证可达，腾讯失败时降级 |
| 历史K线缓存 | SQLite `history_kline` 表（symbol+date 主键） | 同一股票重复回测零重复请求；增量补拉缺失区间 |
| 回测引擎 | `generateHistoricalKline` → `fetchRealKline` | 最小改动：仅替换数据入口，策略/撮合逻辑不动 |
| 数据不足兜底 | 明确报错 + 提示剩余可回测区间 | 不再用假数据凑数，诚实提示 |
| 来源透明化 | `GET /api/data-sources` + 前端徽标/说明页 | 单一接口聚合各源状态，前端一处展示 |

## 功能模块

### 1. 历史K线服务（server/src/stock/history-kline.service.ts）✅
- `fetchRealKline(symbol, startDate, endDate)`：腾讯区间拉取 → 解析 qfqday 数组 `[date, open, close, high, low, volume]` → 失败降级新浪 datalen
- 缓存：`history_kline(symbol, date, open, high, low, close, volume, updatedAt)`；请求前查库，只拉缺失日期段；单股全量 ≤ 3200 条
- 限速：页间/股票间 150ms；失败重试 1 次

### 2. 回测引擎改造（server/src/backtest/backtest.service.ts）✅
- 改调 `fetchRealKline`；删除假数据分支（仅在 `BACKTEST_ALLOW_SYNTHETIC=true` 时回退到合成数据，用于单元测试）
- 结果新增 `meta: { realKline, dataSource, klineCount, warnings[] }`
- 数据不足（如新股 < 30 交易日）：返回 `success: false + reason`，前端展示可回测区间

### 3. 数据来源清单（server/src/data-source/）✅
- `GET /api/data-sources`：返回各源 `{ key, name, purpose, provider, updateFrequency, status }`：实时行情/股票目录/历史K线/模拟盘账本/回测引擎，status 动态探测（目录数、K线缓存数、行情最近成功时间）

### 4. 前端展示（src/pages）✅
- 回测页：结果卡顶部动态徽标（"真实历史行情 · N根K线 · 区间"或"合成数据 · 仅供测试"或"缓存命中"）；失败时展示原因与可回测区间
- 我的页：新增"数据来源"卡片 → 数据来源说明弹层（列出各源清单与实时状态）
- 首页模拟盘胶囊旁补"实时行情"来源徽标（轻量）

### 5. 收尾验证（本轮执行）
- `pnpm validate` 修错
- `pnpm build` 编译
- `coze dev` + 浏览器端到端
- Git 提交

## 是否有原型设计

否（剩余步骤均为验证/编译/提交，不涉及新 UI 设计）

## 实施步骤

> 总步骤数：6 步（其中 1-5 已完成 ✅；本轮执行第 6 步「收尾验证」即可）

1. ✅ TDD：历史K线服务（腾讯解析+新浪降级+缓存增量，8 项测试） — `server/src/stock/history-kline.service.ts`
2. ✅ TDD：回测引擎接真实K线 + 数据不足诚实报错 + meta 标识（4 项测试） — `server/src/backtest/backtest.service.ts`
3. ✅ 实现 `GET /api/data-sources` 聚合接口（状态动态探测，4 项测试） — `server/src/data-source/`
4. ✅ 前端：回测页徽标/失败态 + 我的页数据来源卡片与弹层 + 首页徽标 — `src/pages/{backtest,profile,index}/index.tsx`
5. ✅ 全量 server 测试回归（174/174 通过）
6. **收尾**：执行 `pnpm validate`（含 lint + tsc，修复任何 error）→ `pnpm build`（验证跨端编译）→ `coze dev` 启动 + 浏览器跑一遍回测 600519 / 2024-01-02~01-05 / 校验 data-sources 弹层渲染 → Git 提交（`feat: 接入真实K线 + 数据来源透明化`）

## 页面规格

##### @nav(mobile-tabbar)
> type: tabbar
> platform: mobile

- @page(/) 首页 | icon: home
- @page(/backtest) 回测 | icon: line-chart
- @page(/profile) 我的 | icon: user

##### @page(/) 首页

**核心职责**：实时看盘与模拟盘持仓概览。
**访问路径**：App 启动直达 / TabBar 首页。
**布局**：行情滚动区 → 模拟盘胶囊（带"实时行情"来源徽标）→ 持仓列表 → 信号流。
**列表项字段**（持仓）：股票名/代码 | 现价 | 今日涨跌 | 持仓数量 | 持仓盈亏。
**交互说明**

| 元素 | 动作 | 响应 | 传参 | 备注 |
|------|------|------|------|------|
| 来源徽标（实时行情） | 展示 | "实时行情 · 新浪财经 6s 轮询" | — | 模拟盘胶囊旁 |
| 持仓卡 | 点击 | 跳转 @page(/holding-detail)?symbol | symbol | — |
| 信号卡 | 点击 | 跳转 @page(/signal-detail)?signal_id | signal_id | — |
| 添加股票 | 点击 | 跳转 @page(/search) | — | — |

##### @page(/backtest) 回测页

**核心职责**：配置区间与初始资金，用真实历史K线回测策略并可视化结果。
**访问路径**：策略页"回测"按钮进入。
**布局**：参数表单区（股票/区间/资金）→ 结果区（来源徽标 → 指标卡 → 收益曲线 → 回撤曲线 → 交易明细）。
**状态**：
- 加载态：Skeleton 骨架
- 失败态：数据不足时展示原因卡（该股可回测区间 [最早日, 最晚日]，提示调整区间）
- 空态：引导先选股票

**交互说明**

| 元素 | 动作 | 响应 | 传参 | 备注 |
|------|------|------|------|------|
| 开始回测按钮 | 点击 | 调回测接口，结果区渲染 | symbol/range/capital | — |
| 来源徽标 | 展示 | 动态："真实历史行情 · N根K线 · 区间" / "缓存命中" / "合成数据（仅测试）" | — | 真实数据才有 |
| 交易明细项 | 点击 | 展开买卖详情 | — | — |

##### @page(/profile) 我的页

**核心职责**：账户设置与系统信息入口。
**布局**：用户卡 → 数据来源卡片 → 重置内测数据 → 关于。
**交互说明**

| 元素 | 动作 | 响应 | 传参 | 备注 |
|------|------|------|------|------|
| 数据来源卡片 | 点击 | 打开底部面板 source-panel | — | — |

**底部面板 source-panel**：
- 内容：5 个数据源条目（名称/用途/提供方/更新频率/实时状态点）
- 操作：关闭