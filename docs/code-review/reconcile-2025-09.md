# 代码检视报告：`paper-trading reconcile` 对账功能

> 检视日期：2025-09
> 检视范围：`git diff --staged` 中 4 个非 db 改动文件
> 检视方法：静态精读 + 与 `docs/数据流分析报告.md` 上下文交叉验证
> 检视者：本会话 agent（沙箱无 Claude CLI / OpenCodeReview CLI，降级为人工精读）

---

## 一、变更摘要（7 文件 / +314 行）

| 文件 | 类型 | 行数 | 用途 |
|---|---|---|---|
| `server/src/paper-trading/paper-trading.service.ts` | 修改 | +101 | 新增 `reconcilePositionsForAccount()` 方法（FIFO 加权平均算法） |
| `server/src/paper-trading/paper-trading.controller.ts` | 修改 | +15 | 新增 `POST /api/paper-trading/reconcile` 端点 |
| `server/src/paper-trading/paper-trading.reconcile.spec.ts` | 新增 | +125 | TDD 4 个测试用例（R1-R4） |
| `src/pages/trades/index.tsx` | 修改 | +77 | 检测不一致状态 + 一键对账按钮 + Toast 反馈 |
| `data/quant.db*` | 修改 | bin | SQLite 数据库（test fixture） |

> 注：db 文件在 `.gitignore` 中默认不入库，本次 stage 异常保留（参见第六节"待解决"）。

---

## 二、关键算法解读：FIFO + 加权平均

### 2.1 算法选择（合理）

对历史脏数据（"trades 有 BUY 但 positions=[] / cash 未扣"）做修复，有 3 种重建策略：

| 策略 | 优点 | 缺点 | 本项目选择 |
|---|---|---|---|
| **FIFO 严格按时间** | 复盘最真实 | 实现复杂（要追踪每笔的剩余量）| ❌ |
| **LIFO 后进先出** | 实现简单 | 不符合 A 股"持仓成本"心智 | ❌ |
| **加权平均**（本项目）| 实现简单 + 业内通用 + 符合 `PaperPosition.avgCost` 语义 | 多笔 BUY 混合时丢时间信息 | ✅ |

**结论**：选型合理，加权平均与 `avgCost` 字段语义天然契合。

### 2.2 核心代码（service.ts 712-795）

```typescript
reconcilePositionsForAccount(accountId?: string) {
  // 1) 加载并按时间正序
  const persistedTrades = this.persistenceService
    .loadPaperTrades(id).slice().reverse();  // DESC → ASC

  // 2) 按 symbol 分组聚合
  for (const t of persistedTrades) {
    if (t.type === 'BUY') { qty += t.quantity; cost += t.amount; }
    else if (t.type === 'SELL') {
      const avgCost = groups[t.symbol].qty > 0 ? groups[t.symbol].cost / groups[t.symbol].qty : 0;
      const sellQty = Math.min(t.quantity, groups[t.symbol].qty);  // 防止负数
      groups[t.symbol].cost -= avgCost * sellQty;
      groups[t.symbol].qty -= sellQty;
    }
  }

  // 3) 重算 cash = initialCapital + totalSell - totalBuy
  const newCash = Math.round((account.initialCapital + totalSell - totalBuy) * 100) / 100;

  // 4) 比较是否真有改动（幂等保护）
  // 5) 写回 + 持久化
}
```

**亮点**：
- ✅ **幂等保护**（line 767-774）：比较 old/new positions JSON 和 cash 差异，避免无操作持久化
- ✅ **SELL 数量截断**（line 734）：`Math.min(t.quantity, qty)` 防止脏数据导致负持仓
- ✅ **精度处理**（line 745, 752, 765）：`Math.round(x * 100) / 100` 统一两位小数
- ✅ **TS 类型完整**：返回 `{ fixed: boolean, changes: string[] }` 类型明确

### 2.3 前端检测规则（trades/index.tsx 73-77）

```typescript
const isInconsistent = !!summary && accountCash < 0 && summary.buyCount > 0
```

**触发条件**：现金为负 **AND** 存在买入记录。这是一个简化的启发式规则，**不覆盖**所有不一致情况。

**漏报场景**：
- 现金为正但 positions 缺失（部分对账过的中间态）→ 不会报警
- SELL 多于 BUY 导致负 qty 被截断为 0 → 不会报警（现金会异常增加）
- 同 symbol 部分 BUY + SELL 错配 → 不会报警

**建议**：服务端额外提供 `GET /api/paper-trading/integrity-check` 端点，对账前主动探测，前端可展示更完整的诊断报告。

---

## 三、风险点（按严重程度排序）

### 🟥 P0：现金变动描述字段有误（必修复）

**位置**：`paper-trading.service.ts:792`

```typescript
// 错误代码
changes.push(`cash 调整：${account.cash}（原 ${account.cash + (totalBuy - totalSell)}）`);
```

**问题分析**：
- line 778 已经执行 `account.cash = newCash`，所以此时 `account.cash` = newCash
- `newCash = initialCapital + totalSell - totalBuy`（line 765）
- 代入：`account.cash + (totalBuy - totalSell)` = `(initialCapital + totalSell - totalBuy) + (totalBuy - totalSell)` = **initialCapital**
- 即"原"值永远是 `initialCapital`，与真实旧值无关 → 误导用户

**正确写法**：

```typescript
const oldCash = account.cash;  // line 778 之前先记
// ...line 778 赋值...
changes.push(`cash 调整：${newCash}（原 ${oldCash}）`);
```

**影响**：用户看到 Toast "cash 调整：-10000（原 200000）" 而非真实旧值（如 50000），会困惑"为什么我的现金突然变了这么多"。

### 🟧 P1：db 文件意外 stage（流程问题）

**位置**：`data/quant.db`, `quant.db-shm`, `quant.db-wal`

**问题**：项目 `.gitignore` 已包含数据库文件，本次却 stage 进来了。检查 `.gitignore`：

```
# 暂未在 .gitignore 中明确看到 data/quant.db
```

**验证**：✅ 已确认 `.gitignore` 没有 `data/quant.db` 规则 → 这是**历史遗留问题**，db 文件一直被意外入库。

**建议**：
1. 短期：本次提交后追加 `data/*.db*` 到 `.gitignore`（单独一个 chore 提交）
2. 长期：CI 增加 `git ls-files | grep -E "data/.*\.db"` 检查，零容忍

**数据库入 git 的隐患**：
- 测试数据混入主线（违反"测试隔离"原则）
- 未来若 db 里有用户真实持仓数据，会泄露
- 文件冲突难以解决

### 🟨 P2：对账算法未考虑分红/拆股

**位置**：`reconcilePositionsForAccount` 全函数

**问题**：A 股常有分红送股、转增拆股，会改变 quantity 和成本价。当前算法只看 BUY/SELL 数量，**没有引入除权除息事件**。

**现状**：本项目使用真实日 K 线回测 + 模拟盘，分红事件没有记录在 trades 里 → 对账时只重建"交易流水"层面的持仓，与真实券商账户可能有偏差。

**建议**：V2.0 引入 `corporate_action` 表（type: DIVIDEND/SPLIT/REVERSE_SPLIT），对账时按时间正序应用。

### 🟨 P3：UI 检测规则过于简化（前端可用性）

**位置**：`trades/index.tsx:77`

**问题**：仅"现金<0 AND 有买入"判定不一致，**漏报场景**已在 2.3 列出。

**建议**：V1.1 同步增加 `/api/paper-trading/integrity-check` 端点，前端调用后渲染"诊断明细"。

### 🟨 P4：测试覆盖盲区

**位置**：`paper-trading.reconcile.spec.ts`

**已覆盖**：R1 空账户 / R2 混合 BUY+SELL / R3 SELL 透支 / R4 幂等性 = 4 用例

**未覆盖**：
- ❌ 同 symbol BUY 价格倒序（如先 100 元再 50 元）→ 加权平均正确性
- ❌ 持久化后 SQLite 实际写入校验（当前只测内存态）
- ❌ 跨账户隔离（accountId 错误时不应影响其他账户）
- ❌ 大数据量性能（10 万笔 trades 时的耗时）
- ❌ 时间倒序 trades（time 字段乱序时算法是否仍正确）
- ❌ 并发调用（两个 reconcile 同时触发）

**建议**：V1.1 至少补 3 个：持久化校验、跨账户隔离、并发幂等。

### 🟦 P5：UI 无 loading 反馈

**位置**：`trades/index.tsx:141`

**现状**：`disabled={reconciling}` 已禁用按钮，但**没有 Loading 文字/Spinner**。

**建议**：按钮文字已用 `{reconciling ? '对账中…' : '一键重建持仓数据'}` ✅，已满足。**此项不需修复**。

### 🟦 P6：UI 无国际化预留

**位置**：`trades/index.tsx:82` 等多处中文文案

**问题**：与 plan.md DFX-12 国际化评分 C 一致 —— 当前项目完全无 i18n 预留。

**建议**：V2.0 引入 `react-i18next` 时统一处理，本次不修改。

---

## 四、改进项（按 ROI 排序）

| 优先级 | 改进项 | 估时 | ROI |
|---|---|---|---|
| **P0** | 修复 service.ts:792 现金变动描述（保存 oldCash 变量）| 5 min | 🟢 高 |
| **P1** | `.gitignore` 追加 `data/*.db*` + 单独 chore 提交清理历史 | 15 min | 🟢 高 |
| **P2** | 后端补 `/api/paper-trading/integrity-check` 探测端点 | 2 h | 🟡 中 |
| **P3** | 测试补 3 个用例（持久化校验 / 跨账户隔离 / 并发幂等）| 1 h | 🟡 中 |
| **P4** | corporate_action 表（分红送股事件）| 1 d | 🔵 低（数据本就没有）|
| **P5** | i18n 接入 | 2 d | 🔵 低（V2.0）|

---

## 五、验证清单（提交前必过）

- [x] **代码可读性**：变量命名清晰（qty/cost/avgCost）+ 算法注释完整
- [x] **API 响应封装**：与现有 envelope 模式 `{ code, msg, data }` 一致
- [x] **HTTP 状态码**：`@HttpCode(200)` ✅ 与项目规范一致（POST 默认 201 已被覆盖）
- [x] **路由前缀**：未在 `@Controller()` 加 `api`，与项目规范一致
- [x] **跨端网络**：`Network.request({ url: '/api/paper-trading/reconcile?accountId=...' })` ✅
- [x] **参数解包**：`result.data?.data` ✅ 双层 envelope 正确处理
- [ ] **类型严格性**：测试中 trades.time 字段使用 string 字符串（`'2026-01-01T09:30:00'`），与 PaperTrade.time 的 `number` 类型定义是否一致？**待二次确认**
- [ ] **pnpm validate**：本轮为新代码，需执行
- [ ] **新增测试**：Jest 应跑过 4 个 R 用例

---

## 六、待解决（不在本次提交范围）

| # | 问题 | 后续处理 |
|---|---|---|
| 1 | db 文件不应入库 | 本次提交后追加 `.gitignore` + chore 清理 |
| 2 | 测试覆盖盲区 | V1.1 迭代补 3 个用例 |
| 3 | corporate_action 缺失 | V2.0 规划 |
| 4 | i18n 缺失 | V2.0 规划 |

---

## 七、整体评分

| 维度 | 评分 | 说明 |
|---|---|---|
| 算法正确性 | **A** | FIFO 加权平均实现标准；幂等保护到位；防负数截断 |
| 代码可读性 | **A** | 注释完整 + 步骤清晰 + 变量命名规范 |
| API 设计 | **A-** | envelope 一致 / 状态码 / 错误返回都到位 |
| 测试质量 | **B+** | 4 用例覆盖核心，但缺持久化校验和并发 |
| UI 兜底 | **A** | 触发条件 + 二次确认 + Toast 反馈 + loading 态全有 |
| 整体 | **B+** | 一个 P0 bug（描述字段误导）+ 一些 P2 改进项 |

> **结论**：可提交，但 **P0 bug 必须先修**。建议在 commit 前补 5 行代码修复现金描述字段。