# SPEC：自定义股票与自定义金额投入、指定时间段策略收益模拟

> 版本 v1.0 · TDD 驱动 · 参考 Freqtrade/Jesse 回测契约规范

## 1. 需求分析

| # | 需求 | 现状 | 目标 |
|---|------|------|------|
| R1 | 增加自定义股票 | `searchStocks` 仅静态库 12 只，无法添加任意代码 | 用户可添加/删除任意 A股代码（持久化），搜索自动合并 |
| R2 | 自定义金额投入 | `initialCapital` 无校验 | 100 ~ 1e9 校验，收益随金额等比缩放 |
| R3 | 指定时间段收益模拟 | 日期无校验，收益正确性未验证 | 起止日期校验（顺序/跨度/格式），同策略不同区间收益不同 |

## 2. API 契约

### 2.1 自定义股票（阶段1）
| Method | Path | Body/Query | 200 响应 data |
|--------|------|-----------|---------------|
| POST | `/api/stock/custom` | `{ symbol, name? }` | `{ symbol, name, market, isCustom: true }` |
| GET | `/api/stock/custom` | — | `StockInfo[]`（含 isCustom 标记） |
| DELETE | `/api/stock/custom/:symbol` | — | `{ deleted: boolean }` |
| GET | `/api/stock/search?q=` | q | 静态库 ∪ 自定义库合并结果，`isCustom` 标记 |

校验规则：
- symbol 必须为 6 位数字；A股：6 开头=沪（sh），0/3 开头=深（sz），其余 400 `只支持A股6位代码`
- name 缺省时自动从新浪实时行情拉取名称，拉取失败降级为 `自定义_600519`
- 重复添加幂等（返回已有记录）
- 持久化：SQLite `custom_stocks` 表（重启不丢）

### 2.2 回测金额/时间段（阶段2）
| 参数 | 规则 | 违规 |
|------|------|------|
| initialCapital | >0 且 ≤1e9 | 400 |
| startDate/endDate | YYYY-MM-DD | 400 `日期格式...` |
| 区间顺序 | start < end | 400 |
| 跨度 | ≤ 3650 天 | 400 |

收益正确性断言（TDD 核心）：
- 同策略同区间，金额 A vs 10A → `totalReturn`（百分比）相等，`finalCapital` 成 10 倍
- 同策略同金额，区间 T1 ≠ T2 → 收益率可不同（基准/策略曲线按区间生成）
- equityCurve[0].value === initialCapital

## 3. 测试计划（先测后码）

| 套件 | 用例数 | 覆盖 |
|------|--------|------|
| `stock-custom.spec.ts` | 10 | 添加/校验/幂等/名称识别/删除/列表/搜索合并/持久化 |
| `backtest-params.spec.ts` | 8 | 金额校验/日期校验/收益等比/区间差异/曲线起点 |
| E2E `e2e-custom-flow.spec.ts` | 5 | 添加自定义股票→搜索可见→自定义金额区间回测→金额等比→模拟交易 |

## 4. 阶段与 DoD

| 阶段 | 内容 | DoD |
|------|------|-----|
| 0 | 本 SPEC | 文档评审通过 |
| 1 | 自定义股票 TDD | 10 测试绿 |
| 2 | 回测参数 TDD | 8 测试绿 |
| 3 | 前端接入 | 创建页/回测页可用 |
| 4 | E2E | 5 用例绿 |
| 5 | validate+build+部署 | 全绿，公网 200 |

## 5. 前端改动清单

- `src/pages/strategy/create.tsx`：股票选择区新增「输入代码添加」入口，选中自定义股票后标 `自定义` 徽标
- `src/pages/backtest/index.tsx`：新增初始资金数字输入、起止日期输入（YYYY-MM-DD）
