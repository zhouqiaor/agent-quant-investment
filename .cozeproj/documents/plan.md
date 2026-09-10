# 计划：总结回顾 + 业界调研对比 + 下一步两轮迭代（推送通知 → 多标的并行回测）

## 概述

本轮为「阶段回顾 + 下两轮迭代规划」轮，目标：① 盘点本项目已落地的能力与对标业界（Freqtrade / vnpy / Backtrader / Hummingbot / Superalgos / Jesse）的差距；② 按用户决策（选项 C）分两轮推进——**第一轮：Agent 信号推送通知（订阅消息）+ 通知中心**；**第二轮：多标的并行回测**。每轮独立交付、独立测试、独立提交。平台：mobile（Taro 跨端小程序）。

## 一、本项目能力盘点（已落地）

| 维度 | 能力 | 关键文件 / 指标 |
|---|---|---|
| 数据层 | 真实行情 + 真实股票目录 + 真实K线 | `stock/history-kline.service.ts`、`stock/directory.service.ts`、`market/quote.service.ts`（6s 轮询新浪）|
| 持久化 | SQLite + Drizzle ORM + 完整 schema | `server/src/persistence/` |
| 回测引擎 | 真实K线 + meta 标识 + 缓存增量 + 诚实失败 | `backtest/backtest.service.ts` |
| 参数优化 | 网格搜索（夏普排序）| `optimizer/optimizer.service.ts` |
| 信号通知 | 站内通知（已读/未读/级别）| `notification/notification.service.ts`（仅站内，**待升级推送**）|
| 风控 | 仓位/频率/资金限制 | `risk/risk.service.ts` |
| AI Agent | 自动分析与策略生成 | `agent/`、`agent-analysis/` |
| 模拟盘 | 完整账户/持仓/交易闭环 | `paper-trading/` |
| 数据透明化 | `GET /api/data-sources` + 前端徽标/弹层 | `data-source/` |
| 前端页面 | 6 个 TabBar 页 + 详情页 + Onboarding | `pages/{index,backtest,strategy,position,trades,profile,market,onboarding,paper-trading}/` |
| 测试覆盖 | Jest + TDD | 174/174 server 测试通过 |

## 二、业界对比与差距（回顾）

| 维度 | Freqtrade | vnpy | Backtrader | Hummingbot | Superalgos | **本项目** |
|---|---|---|---|---|---|---|
| 数据真实 | ✅ | ✅ | 多源 | ✅ | ✅ | ✅ + **透明化** |
| 回测 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ + 真实K线 |
| 多标的并行 | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ **差距 1** |
| 信号触达 | Webhook | 推送 | 自定义 | 站内 | AI | 🟡 仅站内 |
| AI Agent | — | — | — | — | ✅ | ✅ |
| **移动端** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ **差异化** |

**优先弥合的两大差距**：① 信号推送触达（P0-1）② 多标的并行回测（P0-2）。

## 三、技术方案

### 第 1 轮：Agent 信号推送通知（订阅消息）

| 维度 | 选择 | 理由 |
|---|---|---|
| 推送通道 | 微信订阅消息（小程序）/ 抖音订阅消息 | 双端原生支持；与小程序绑定天然合适；用户主动订阅 |
| 触发源 | `notification.service` 在生成站内通知时，同时入队推送 | 单一事件源、避免双写不一致 |
| 模板管理 | `subscribe_message_template` 表（key/title/content/example） | 不同信号级别（buy/sell/risk/info）映射不同模板 |
| 频控 | 同用户同模板 1 条/分钟；总上限 5 条/小时 | 防止骚扰，符合微信官方限制 |
| 用户授权 | 前端一次性订阅授权 → 存 `user_subscribe` 表 | 用户可控；可随时关闭 |
| 通知中心 | 新增 `pages/notification/index.tsx`：列表 + 全部已读 + 类型筛选 | 复用现有站内通知，未读/已读逻辑 |
| 失败兜底 | 推送失败不阻塞站内通知；记录 `pushStatus` | 推送是增强能力，不能因推送挂掉核心 |
| 跨端 | H5 无推送能力 → 降级为"打开应用查看"提示 | 检测 `Taro.getEnv()` 决定是否渲染订阅按钮 |

### 第 2 轮：多标的并行回测

| 维度 | 选择 | 理由 |
|---|---|---|
| 接口设计 | `POST /api/backtest/run-batch {symbols:[], startDate, endDate, capital, strategy}` | 与现有单标接口对称，前端易扩展 |
| 并行执行 | 进程内并发（`Promise.all` + 限流 5 并发）| 简单可靠；后续可换 worker pool |
| K线获取 | 复用 `history-kline.service.fetchRealKline`（已带缓存）| 零增量；重复股票零重复请求 |
| 响应结构 | `{ results: [{symbol, metrics, equityCurve, meta, error?}] }` | 与单标对齐；失败股票用 error 字段而非整体失败 |
| 前端结果页 | Tab 切换（每只股票一个 Tab） + 横向对比表（夏普/收益/最大回撤/胜率）| 一眼看出哪只最优 |
| 失败股票 | Tab 显示"数据不足"占位 + 原因（少于 30 交易日等）| 不阻塞其他股票 |
| 排序 | 默认按夏普降序；用户可切换按收益率/回撤 | 服务端不排，前端排即可 |

## 四、功能模块

### 第 1 轮（推送通知）模块结构
```
server/src/
  notification/                         (扩展)
    notification.service.ts              (订阅消息入队 + 重试)
    subscribe-message.service.ts         (微信/抖音双端推送封装)
    subscribe-message.controller.ts      (POST /api/subscribe-message/subscribe)
    templates/
      buy.template.json
      sell.template.json
      risk.template.json
      info.template.json
    __tests__/subscribe-message.spec.ts
src/pages/
  notification/
    index.tsx                           (通知中心：列表/筛选/全部已读)
    index.config.ts
src/app.config.ts                       (注册新页)
```

数据字段：
- `user_subscribe(userId, templateKey, openid, subscribedAt, status)`
- `notification` 表新增 `pushedAt, pushStatus, pushError`
- `push_log(id, userId, templateKey, status, errorMsg, createdAt)`

### 第 2 轮（多标的回测）模块结构
```
server/src/
  backtest/
    backtest.service.ts                  (新增 runBatch)
    backtest.controller.ts               (新增 POST /run-batch)
    __tests__/backtest-batch.spec.ts
  stock/
    history-kline.service.ts             (复用，无需改)
src/pages/
  backtest/
    index.tsx                            (表单支持多选股票；结果区 Tab 切换)
```

数据字段：复用单标的 `BacktestResult`，新增 `BatchResult{ symbols, results[], sortedBy }`。

## 五、是否有原型设计

否（两轮均为功能模块扩展，沿用现有 design_guidelines.md 的暗色量化终端风格；UI 改动仅新增通知中心页 + 回测页扩展，不属于新风格/全新页面体系）

## 六、实施步骤

> 总步骤：两轮 × 3 步 = 6 步。每轮独立"开发后端(含测试) → 开发前端 → 验证提交"。

### 第 1 轮：Agent 信号推送通知（订阅消息）

1. **后端**：订阅消息服务（subscribe-message.service + controller + 4 类模板 + TDD 测试，含双端适配、H5 降级、频控、失败兜底）
2. **前端**：通知中心页 `pages/notification/index.tsx`（列表 + 类型筛选 + 全部已读 + 订阅授权按钮），注册到 `app.config.ts`
3. **收尾**：`pnpm validate` → `pnpm build` → coze dev 端到端跑一遍 buy/sell/risk/info 四类信号 → Git 提交 `feat: 接入订阅消息推送 + 通知中心`

### 第 2 轮：多标的并行回测

4. **后端**：`backtest.service.runBatch` + `POST /api/backtest/run-batch` + TDD 测试（含并发限流、单股失败不阻塞、批量 K 线缓存命中）
5. **前端**：回测页表单支持多选股票；结果区 Tab 切换 + 横向对比表（夏普/收益/回撤/胜率）+ 失败占位
6. **收尾**：`pnpm validate` → `pnpm build` → coze dev 端到端跑 600519/000001/600036 三只对比 → Git 提交 `feat: 多标的并行回测 + 横向对比`

## 七、页面规格

##### @nav(mobile-tabbar)
> type: tabbar
> platform: mobile

- @page(/) 首页 | icon: home
- @page(/backtest) 回测 | icon: line-chart
- @page(/strategy) 策略 | icon: brain
- @page(/position) 持仓 | icon: briefcase
- @page(/profile) 我的 | icon: user
> 说明：第 1 轮新增的通知中心**不进 TabBar**（频次低），改为"我的"页入口；保持 5 个 Tab 不变。

##### @page(/notification) 通知中心（第 1 轮新增）

**核心职责**：集中查看 Agent 信号推送与站内通知，支持类型筛选与一键已读。
**访问路径**：我的页"通知中心"入口 / 推送消息点击深链 `?notification_id=xxx`。
**布局**：顶部 Tab 切换（全部/买入/卖出/风控/资讯）→ 通知列表（时间倒序）→ 底部固定"全部标记已读"按钮。
**列表项字段**：标题 | 时间 | 类型徽标 | 已读/未读圆点 | 摘要 | 关联股票代码。

**状态**：
- 空态：插画 + "暂无通知，Agent 正在盯盘"提示
- 加载态：Skeleton
- 错误态：Toast + 重试

**交互说明**

| 元素 | 动作 | 响应 | 传参 | 备注 |
|------|------|------|------|------|
| 通知项 | 点击 | 标记已读 + 跳转关联股票详情 | `notification_id` | — |
| Tab | 点击 | 筛选对应类型 | — | — |
| 全部已读 | 点击 | 一键标记 + Toast 反馈 | — | — |
| 订阅授权按钮（仅小程序端） | 点击 | 调 wx.requestSubscribeMessage → 写入 `user_subscribe` | — | H5 端降级为"打开 App 接收"提示 |

##### @page(/backtest) 回测页（第 2 轮扩展）

**核心职责**：单标/多标回测入口与结果展示。
**布局（扩展后）**：参数区（股票多选 Chip + 区间 + 资金 + 策略）→ 批量结果区（横向对比表 + Tab 切换单标详情）。
**交互说明**

| 元素 | 动作 | 响应 | 传参 | 备注 |
|------|------|------|------|------|
| 股票多选 Chip | 点击 | 弹出搜索框，支持多选 | — | 已选显示在 Chip 区 |
| 开始回测 | 点击 | 调 `run-batch` 接口 | symbols[]/range/capital/strategy | loading 态 |
| 对比表排序字段 | 点击 | 切换排序（夏普/收益/回撤）| — | 默认夏普降序 |
| 单标 Tab | 切换 | 渲染该标完整结果（来源徽标/曲线/明细）| — | — |
| 失败股票 Tab | 展示 | 占位 + "数据不足"原因 | — | 不阻塞其他 Tab |
