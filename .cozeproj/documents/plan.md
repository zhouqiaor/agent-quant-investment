# 计划：代码检视 → 头脑风暴 → 业界调研 → 下一步规划

## 概述

本轮分四步：① 用本地工具替代 Claude CLI / OpenCodeReview 做完整代码检视（沙箱不可用外部 CLI）；② 头脑风暴可落地的产品/工程 IDEA；③ 业界 6 个开源项目（Freqtrade / vnpy / Backtrader / Hummingbot / Superalgos / Jesse）调研对比与可复用点；④ 排序 IDEA 给下一步具体方向。平台：mobile（Taro 跨端小程序）。

## 一、Claude CLI / OpenCodeReview 替代检视报告

> 沙箱环境无 `claude` / `opencode-review` 可执行文件。改用本地等价手段：① `pnpm validate`（lint + tsc，exit 0）② Jest 单元测试（174/174 通过）③ 静态扫描（TODO/FIXME/any/硬编码 px）④ 文件体量统计。

### 1.1 健康度总览（exit code 与测试）

| 检查项 | 命令 | 结果 | 判定 |
|---|---|---|---|
| Lint + TS 严格类型 | `pnpm validate` | exit 0 | ✅ |
| Jest 单元测试 | `pnpm test`（server）| 174/174 通过（前几轮已确认）| ✅ |
| 提交状态 | `git status` | working tree clean | ✅ |
| 服务端代码体量 | `wc -l server/src/**/*.ts` | 10099 行（含 21 个 spec 文件）| 🟡 中等 |
| 前端页面体量 | `wc -l src/pages/*/index.tsx` | 4399 行（9 个页面）| 🟡 中等 |
| 模块/测试比 | `for d in src/*/` | 见下表 | 部分模块 0 测试 |

### 1.2 模块覆盖度（src 文件数 vs spec 文件数）

| 模块 | 源文件 | 测试文件 | 覆盖度 | 备注 |
|---|---|---|---|---|
| backtest | 4 | 3 | ✅ 75% | 核心引擎覆盖好 |
| stock | 6 | 4 | ✅ 67% | 历史K线/目录均有测试 |
| paper-trading | 3 | 2 | ✅ 67% | — |
| beta | 4 | 3 | ✅ 75% | — |
| market | 4 | 1 | 🟡 25% | 行情轮询需补 E2E |
| notification | 3 | 1 | 🟡 33% | 推送升级时会扩 |
| persistence | 2 | 1 | ✅ 50% | — |
| optimizer | 3 | 1 | ✅ 33% | 后续可补 |
| **agent** | 3 | **0** | ❌ **0%** | AI Agent 决策无单测，需补 |
| **agent-analysis** | 3 | **0** | ❌ **0%** | 同上 |
| **data-source** | 3 | **0** | ❌ **0%** | 接口聚合层无测试（手测过）|
| **risk** | 3 | **0** | ❌ **0%** | 风控核心无单测，**高风险** |
| **strategy** | 3 | **0** | ❌ **0%** | — |
| **trade** | 3 | **0** | ❌ **0%** | — |
| interceptors | 1 | 0 | — | — |

**结论**：4 个零测试模块集中在 `agent / agent-analysis / risk / strategy / trade / data-source`，其中 **risk（风控）和 agent（AI 决策）是最高风险点**。下一轮建议补齐。

### 1.3 代码质量热点（grep 扫描）

| 问题 | 数量 | 文件 | 风险 |
|---|---|---|---|
| `: any` 类型注解 | 5 处 | `backtest/index.tsx` ×2、`position/index.tsx` ×3 | 🟡 中（业务逻辑，编译过但类型保护失效）|
| `console.log` 前端页面 | 19 处 | 网络层/调试用 | 🟢 低（规范允许）|
| `w-[xx]`/`text-[xx]` 硬编码 | 22 处 | 全部位于 `src/components/ui/*`（组件库内部）| 🟢 低（组件库内允许）|
| `text-[10px]` 页面硬编码 | 4 处 | `index.tsx`、`market.tsx`、`onboarding.tsx` | 🟡 低（小字号特殊场景）|
| TODO / FIXME / HACK | 0 处 | — | ✅ 干净 |

### 1.4 架构热度（文件体量 Top 5）

| 页面 | 行数 | 评级 |
|---|---|---|
| `pages/backtest/index.tsx` | **1003** | 🔴 严重超长（需拆分）|
| `pages/profile/index.tsx` | 601 | 🟡 偏长（可拆配置/数据/关于三区）|
| `pages/strategy/index.tsx` | 586 | 🟡 偏长（可拆列表/详情/分析）|
| `pages/index/index.tsx` | 519 | 🟡 偏长（首页多区，可拆 Watchlist / Position / Notify 子组件）|
| `pages/onboarding/index.tsx` | 458 | 🟢 可接受 |

**结论**：`backtest/index.tsx`（1003 行）必须拆分，单文件承担表单 + 结果可视化 + 交易明细 + 失败态 + 横向对比 5 个职责。

### 1.5 检视结论（替代 CLI 工具的产出）

| 维度 | 等级 | 行动 |
|---|---|---|
| 测试通过率 | ✅ A | 维持 |
| 代码静态质量 | ✅ A- | 修复 5 处 `: any`、4 处 `text-[10px]` |
| 架构清晰度 | 🟡 B | 拆分 backtest（1003 行）|
| 测试覆盖度 | 🟡 B | 补 agent/risk/strategy 单测 |
| 工程规范 | ✅ A | 维持 |

## 二、头脑风暴：可落地 IDEA 清单

### 2.1 产品方向（用户价值）

| # | IDEA | 一句话价值 | 与业界对标 |
|---|---|---|---|
| **P-A** | **AI 持仓诊断日报**：每日 21:30 自动分析持仓股（基本面/技术面/资金面），生成可读报告推送 | 让用户每天 30 秒看完持仓健康度 | 借鉴 Freqtrade 的 trade journal + Superalgos 的 AI 报告 |
| **P-B** | **策略对比模式**：同一区间跑两个策略横向对比（双收益曲线叠加）| 直接看出策略差异 | 借鉴 Backtrader multi-strategy |
| **P-C** | **回测一键收藏为策略**：回测参数保存为可复用策略模板 | 降低重复配置成本 | 借鉴 Freqtrade 的策略复用 |
| **P-D** | **行情异动雷达**：实时监控自选股，涨跌幅 >N% 或量比 >M 倍自动推送 | 从被动看盘 → 主动告警 | 借鉴 vnpy 行情事件订阅 |
| **P-E** | **行业/概念板块联动**：输入"新能源" → 列出板块成分股 → 批量看行情 | 主题投资必备 | 借鉴 OctoBot 插件市场 |
| **P-F** | **风险敞口看板**：组合维度行业/市值/风格分布饼图 | 看组合风险暴露 | 借鉴 vnpy 独立风控 |
| **P-G** | **策略绩效归因**：拆解收益来源（择时 vs 选股 vs 行业 Beta）| 让用户理解收益从哪来 | 借鉴 Brinson 归因模型 |
| **P-H** | **微信/抖音社群分享**：回测结果生成海报分享 | 拉新裂变 | 借鉴 Superalgos 社交交易 |

### 2.2 工程方向（开发者价值）

| # | IDEA | 价值 | 成本 |
|---|---|---|---|
| **E-A** | **backtest 页拆分**：1003 行拆为 5 个子组件（FormPanel/ResultOverview/EquityCurve/TradeTable/CompareTable）| 可维护性 ↑↑ | 中 |
| **E-B** | **API Mock 模式**：dev 环境支持 OFFLINE_MOCK=true，全部返回 fixtures，离线可开发体验 | 离线开发友好 | 中 |
| **E-C** | **统一错误码字典**：后端定义 ErrorCode 枚举，前端 Toast 国际化映射 | 用户体验 ↑ | 中 |
| **E-D** | **请求级日志追踪**：Network.request 自动生成 requestId，前后端串起来 | 排查效率 ↑ | 低 |
| **E-E** | **Playwright E2E**：H5 端用 Playwright 跑核心路径（看盘→回测→下单→通知）| 回归保障 ↑ | 高 |
| **E-F** | **数据库迁移版本化**：drizzle-kit migrations 替代 push 同步 | 生产安全 ↑ | 低 |
| **E-G** | **OpenAPI 文档自动生成**：NestJS Swagger + 前端 TS 类型生成 | 联调效率 ↑ | 中 |
| **E-H** | **CI 流水线**：GitHub Actions 跑 validate + test + build | 协作安全 ↑ | 中 |

### 2.3 IDEA 优先级矩阵（价值 / 成本）

| 优先级 | 候选 |
|---|---|
| **P0（必做）** | E-A（拆 backtest）、P-A（AI 持仓诊断）、P-D（异动雷达） |
| P1（高价值） | P-B（策略对比）、P-F（风险敞口看板）、E-B（Mock 模式）、E-G（OpenAPI） |
| P2（长期） | P-E（板块联动）、P-G（归因）、E-E（Playwright）、E-H（CI） |

## 三、业界开源项目调研（补充分析）

### 3.1 共性架构模式（来自 quant-research.md）

| 模式 | 代表项目 | 本项目现状 |
|---|---|---|
| 事件驱动 | vnpy | 🟡 行情 6s 轮询，事件总线未抽象 |
| 策略即代码 | Freqtrade / Jesse / Backtrader | ❌ 当前是"参数化策略"，未提供代码 hook |
| 策略配置化 | Superalgos / OctoBot | ✅ UI 配置策略参数（已实现）|
| 多时间框架 | FreqTrade / Jesse | ❌ 仅日 K 线 |
| 多标的并行 | Jesse / vnpy | ❌（P0-2 已纳入下一轮）|
| 独立风控引擎 | vnpy / FreqTrade | 🟡 risk 模块存在但测试为 0 |
| AI Agent | Superalgos | ✅ agent + agent-analysis 模块 |
| 参数优化 | FreqTrade Hyperopt | 🟡 仅网格，缺遗传算法 |

### 3.2 差异化定位（vs 业界 6 项目）

| 维度 | Freqtrade | vnpy | Backtrader | Hummingbot | Superalgos | Jesse | **本项目** |
|---|---|---|---|---|---|---|---|
| 真实数据 | ✅ | ✅ | 多源 | ✅ | ✅ | ✅ | ✅ + 透明化 |
| 真实回测 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ + 真实K线 |
| 多标的 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 下一轮 |
| AI Agent | — | — | — | — | ✅ | — | ✅ |
| 风控 | 内置 | 独立 | 自定义 | 做市 | 内置 | 内置 | 🟡 模块在但无测试 |
| 移动端 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **代码即策略 hook** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌（P-A/差异化卖点）|

### 3.3 可复用工程实践（业界最佳实践）

| 实践 | 来源 | 本项目借鉴 |
|---|---|---|
| pytest + CI 矩阵 | Freqtrade | 🟡 已有 Jest，缺 CI（E-H）|
| 策略 fixtures 回放 | Freqtrade | 🟡 已用合成数据测试，但未沉淀 fixtures |
| 独立风控引擎 | vnpy | ✅ risk/ 已分离，但测试为 0 |
| 事件引擎统一抽象 | vnpy | 🟡 缺事件总线抽象（可借鉴）|
| 可视化策略编辑器 | Superalgos | P2（拖拽工作量大）|
| 多策略并行 | vnpy / Freqtrade | 🟡 模拟盘已多策略并行，但前端无总览 |

## 四、技术方案（下一轮候选）

### 方案 1：AI 持仓诊断日报（P-A）+ 异动雷达（P-D）

| 维度 | 选择 | 理由 |
|---|---|---|
| AI 分析 | 复用 `agent-analysis`（已有）+ 接入 `llm` 技能 | 与既有 AI 模块复用 |
| 数据源 | 持仓数据 + 当日行情 + 7 日 K 线 + 财务摘要（已有）| 零数据新建 |
| 调度 | NestJS `@nestjs/schedule` cron 21:30 | 框架内置 |
| 推送 | 复用方案 A 的订阅消息通道 | 与下一轮推送合并 |
| 异动阈值 | 涨跌幅 ±3%、量比 ≥2（可配置）| 行业经验值 |
| 报告格式 | Markdown 摘要 + 关键评分卡 | 易读 |

### 方案 2：backtest 拆分（E-A）+ 策略对比（P-B）

| 维度 | 选择 | 理由 |
|---|---|---|
| backtest 拆分 | 5 个子组件（FormPanel/ResultOverview/EquityCurve/TradeTable/CompareTable）| 单文件职责单一 |
| 策略对比 | 回测结果接口新增 `benchmarkStrategyId`，前端双曲线叠加 | 增量小 |
| 复用曲线组件 | 新建 `src/components/charts/equity-curve.tsx` | 多处复用 |
| 复用徽标组件 | 已有 `Badge`，直接复用 | 零成本 |

## 五、功能模块（推荐方案 1）

```
server/src/
  notification/                     (扩展)
    notification.service.ts          (推送通道接入)
  agent-analysis/
    daily-diagnosis.service.ts       (持仓诊断日报)
    radar.service.ts                 (异动雷达)
    __tests__/
      daily-diagnosis.spec.ts        (TDD)
      radar.spec.ts                  (TDD)
  scheduler/
    scheduler.module.ts              (cron 入口)
src/pages/
  diagnosis/
    index.tsx                        (诊断日报列表/详情)
    index.config.ts
src/app.config.ts                    (注册新页)
src/components/
  charts/
    equity-curve.tsx                 (收益曲线组件，后续多页复用)
src/pages/backtest/index.tsx         (后续重构：拆 5 子组件)
```

数据字段：
- `daily_diagnosis(id, userId, date, portfolioId, content, scores, createdAt)`
- `radar_event(id, symbol, type, threshold, value, pushedAt)`
- `user_radar_config(userId, symbol, changeThreshold, volumeRatio)`

## 六、是否有原型设计

否（诊断日报为数据列表 + 详情 Markdown 渲染，沿用现有暗色量化终端风格；异动雷达为 Banner 推送；均无需独立原型设计阶段）

## 七、实施步骤

> 总步骤：3 步（AI 诊断 + 异动雷达合并为一轮交付）

1. **后端 TDD**：`agent-analysis/daily-diagnosis.service.ts` + `agent-analysis/radar.service.ts` + scheduler cron + Jest 测试（含 LLM 调用 mock、阈值边界、单股失败不阻塞）
2. **前端**：诊断日报页 `pages/diagnosis/index.tsx`（列表 + 详情 Markdown 渲染）+ 异动雷达 Banner（首页/我的页右上角小红点）+ `equity-curve` 公共曲线组件（先不做 backtest 拆分，留作下轮）
3. **收尾**：`pnpm validate` → `pnpm build` → coze dev 端到端（创建诊断 → 触发 radar 推送 → 收到订阅消息）→ Git 提交 `feat: AI 持仓诊断日报 + 异动雷达`

## 八、补充建议（不在本轮范围，但记录在案）

- **下下轮**：backtest 拆分（E-A，1003 行 → 5 子组件）+ 策略对比（P-B）
- **再下轮**：补齐 risk / agent / strategy 单测覆盖率（0% → 60%+）
- **未来**：CI 流水线（E-H）、OpenAPI 自动生成（E-G）

## 九、检视总结（替代 CLI 输出）

> 本地工具检视结论：项目处于**生产可用状态**，主要矛盾是 **测试覆盖度不均**（4 个核心模块 0 测试）和 **单文件膨胀**（backtest 1003 行）。建议按优先级：① 补齐 risk/agent 单测（最高风险）② 拆分 backtest ③ 推进 AI 诊断/异动雷达等新功能。
