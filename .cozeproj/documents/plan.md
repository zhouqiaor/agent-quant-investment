# 计划：检视待提交变更 + 头脑风暴 + 业界调研 + 下一步规划

## 概述

针对当前已 stage 待提交（7 文件 / +314 行 / 涉及 paper-trading 对账功能）的代码，本计划串起四项产出：
① **代码检视报告**（沉淀改动语义、风险点、可改进项）→ ② **Commit**（按 Commitlint 规范一次性提交）
→ ③ **头脑风暴 IDEA**（基于现有项目瓶颈衍生 5-8 个新方向）→ ④ **业界开源项目调研**（Freqtrade/Jesse/Zipline/Backtrader/Lean/Hummingbot/CCXT 横向对比，识别可复用模块）
→ ⑤ **下一步路线规划**（V1.1/V1.2/V2.0 优先级与工程量）。

平台：mobile（Taro 跨端小程序 + NestJS 后端）。

## 技术方案

| 维度 | 选择 | 理由 |
|---|---|---|
| 代码检视方式 | 静态分析（git diff + 文件阅读） + 参考 README/SPEC 上下文 | 沙箱无 `claude` / `opencode` CLI，预装的代码检视工具不可用时降级为人工精读 |
| Commit 策略 | 单次提交 `fix: 数据一致性对账 reconcile`，遵循 Conventional Commits | 改动语义单一（一个 bug 修复 + 配套测试 + UI 兜底），不分拆 |
| 头脑风暴方法 | SCAMPER + 痛点 → 机会矩阵，从现有 V1.1/V1.2 路线延伸 | 与 plan.md 已有路线互补，重点输出**新方向**而非重复已规划项 |
| 业界调研 | 拉齐开源量化项目核心特性表 + GitHub Star/最近活跃度 + 借鉴点 | Freqtrade/Jesse 是回测事实标准；CCXT 是交易所抽象标准；Backtrader/Zipline/Lean 是回测引擎三强 |
| 路线规划 | 价值/成本矩阵 + 工程量估算 → 输出 V1.1/V1.2/V2.0 优先级 | 与现有 plan.md 视角三（PM/技术/用户）一致 |

## 功能模块

### 模块 A · 代码检视报告（doc）
- **产物路径**：`docs/code-review/reconcile-2025-09.md`
- **结构**：① 变更摘要（7 文件清单 + 行数 + 用途）② 关键代码解读（FIFO 加权平均算法 / 不一致检测规则 / UI 兜底）③ 风险点（幂等性 / 数据迁移 / 测试覆盖盲区）④ 改进项（5 条以内）⑤ 验证清单（pnpm validate / 新增测试 / 一致性核对）

### 模块 B · Git Commit
- **提交信息**：`fix: 修复"交易记录与持仓不匹配"历史脏数据 + UI 对账兜底`
- **包含文件**：service +101 行、controller +15 行、spec +125 行、trades 页面 +77 行、3 个 db 文件
- **操作**：`git commit -m "..."` → 验证 `git log -1` 输出

### 模块 C · 头脑风暴 IDEA（doc）
- **产物路径**：`docs/ideas/next-round-brainstorm.md`
- **结构**：① 现有瓶颈清单（数据/AI/推送/性能/合规 5 维度）② 8-10 个候选 IDEA（每个含：痛点 / 方案 / 价值 / 成本 / 是否复用品类）③ Top-3 推荐（与 V1.1/V1.2 互补）
- **输出侧重**：推送通道（WebSocket/SSE）、多账户（实盘+模拟盘并行）、策略市场、社交跟单、语音播报、暗色主题切换、键盘快捷键（H5）、离线缓存（Service Worker）、AI 自动调参、风控规则可视化

### 模块 D · 业界开源项目调研（doc）
- **产物路径**：`docs/research/open-source-quant-landscape.md`
- **覆盖项目**：
  - **Freqtrade**（Python / 21k+ Star）— 回测+实盘+策略市场的事实标准
  - **Jesse**（Python / 6k+ Star）— 更现代的回测框架
  - **Backtrader**（Python / 15k+ Star）— 老牌回测引擎
  - **Zipline**（Python / 18k+ Star）— Quantopian 遗产，机构级回测
  - **Lean**（C#/Python / 12k+ Star）— QuantConnect 开源版，多资产回测
  - **Hummingbot**（Python / 8k+ Star）— 做市/套利专用
  - **CCXT**（JS/Python/PHP / 35k+ Star）— 交易所统一抽象（≥100 家）
  - **vnpy**（Python / 25k+ Star）— 国内量化平台龙头
  - **QMT / PTrade**（国内券商内置）— 国内合规实盘
- **对比维度**：语言/Star/最近活跃度/回测引擎/实盘能力/策略语言/UI/移动端/可借鉴到本项目的模块
- **复用候选**：CCXT 的交易所适配器思想 → 我们做行情源适配层；Freqtrade 的策略市场模型 → V2.0 策略市场；Jesse 的可视化 → 回测页升级

### 模块 E · 下一步路线规划（doc）
- **产物路径**：合并到 `docs/ideas/next-round-brainstorm.md` 末尾或独立 `docs/roadmap/next-quarter.md`
- **输出**：基于调研 + 头脑风暴，重新校准 V1.1/V1.2/V2.0 优先级（不与现有 plan.md 冲突，作为"再决策"输入）

## 是否有原型设计

否（全程为**文档产出 + 一次 Git commit**，不涉及 UI 改动；现有 plan.md 已锁定暗色量化终端风格 + shadcn/ui 组件库，新工作流无需原型阶段）。

## 实施步骤

1. **代码检视**：读取已 stage 的 4 个非 db 改动文件（service / controller / spec / trades page）→ 输出 `docs/code-review/reconcile-2025-09.md` 检视报告（包含变更摘要、算法解读、风险点、改进项）
2. **Git Commit**：执行 `git commit -m "fix: 修复\"交易记录与持仓不匹配\"历史脏数据 + UI 对账兜底"`（沿用项目已建立的 Conventional Commits 规范，db 文件因 .gitignore 默认不入库，需先确认是否保留；如要保留则用 `git add -f`）
3. **头脑风暴**：基于已有 plan.md 的"待补短板"清单（推送/可观测/E2E/性能/国际化/i18n/可扩展性）→ 用 SCAMPER 法衍生 8-10 个新 IDEA → 写入 `docs/ideas/next-round-brainstorm.md`
4. **业界调研**：横向调研 Freqtrade/Jesse/Backtrader/Zipline/Lean/Hummingbot/CCXT/vnpy 8 个项目（CCXT 优先深度，因其"统一抽象"思想契合本项目"行情源适配层"方向）→ 输出对比表 + 借鉴清单 → 写入 `docs/research/open-source-quant-landscape.md`
5. **路线规划**：合并头脑风暴 + 调研结论 → 重新校准 V1.1/V1.2/V2.0 优先级 → 输出 Markdown 决策表
6. **收尾**：`pnpm validate`（若有代码改动才需要，本次无新增代码可跳过；若新建多个 .md 文件需要 lint 检查）→ `git add` 新文档 → `git commit -m "docs: ..."` → 输出最终摘要

## 页面规格

不适用（本轮无 UI 改动；纯文档产出 + 一次提交）。