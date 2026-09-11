# QuantPilot · 技术视角总结

> 文档版本 v1.0 | 适用于架构评审、技术晋升答辩、技术招聘

---

## 1. 架构设计

### 1.1 整体分层

```
┌─────────────────────────────────────────────────────┐
│  表现层：Taro 3.x（React 18）                       │
│   ├── 6 个主 Tab 页面（index / market / strategy /  │
│   │   trades / report / profile）                   │
│   ├── 1 个 A/B 子页面（strategy/ab-test）          │
│   ├── 30+ 业务组件（paper/strategy/backtest/agent）│
│   └── 60+ UI 原子组件（shadcn/ui for Taro）        │
└──────────┬──────────────────────────────────────────┘
           │ Network.request / Network.uploadFile
           │ （vite proxy 5000 → nest 3000）
┌──────────▼──────────────────────────────────────────┐
│  网关层：NestJS 10.x（Fastify adapter）             │
│   ├── 全局前缀 /api（main.ts setGlobalPrefix）     │
│   ├── CORS / ValidationPipe / HttpCode 200 统一     │
│   └── 9 个业务模块（见下）                          │
└──────────┬──────────────────────────────────────────┘
           │ TypeORM-less：自研 PersistenceService
┌──────────▼──────────────────────────────────────────┐
│  数据层：SQLite + WAL（开发）/ Postgres（生产可选）│
│   ├── 16 张业务表（strategy/trade/position/tick/...）│
│   ├── 自研 Repository（无 ORM 依赖）              │
│   └── IF NOT EXISTS 幂等迁移                        │
└─────────────────────────────────────────────────────┘
```

### 1.2 模块拓扑

```
[Market]        行情抓取 + 轮询 + tick 录制
[Strategy]      策略 CRUD + Fork 派生 + 版本树
[PaperTrading]  模拟账户 + 自动下单 + 对账
[Backtest]      历史 K 线回放 + 多标的并行
[Optimizer]     Grid/Genetic 参数搜索
[ABTest]        A/B 并行对比 + 指标计算  ← 本轮新增
[AgentAnalysis] LLM 智能体 + 异动雷达
[DataSource]    多行情源适配（新浪/腾讯/东财）
[Beta]          实验功能开关管理
[Persistence]   唯一 DB 访问入口（所有模块依赖）
```

**关键设计原则**：
- **单向依赖**：所有模块 → PersistenceService → SQLite
- **无 ORM**：手写 SQL + Repository 模式，避免 ORM 黑盒
- **强隔离**：ABTest 与 Backtest 共用算法，但账户隔离

### 1.3 核心数据流

```
                     MarketService
                          ↓ 5s poll
                  MarketPollingService
                          ↓ notify()
            ┌─────────────┴──────────────┐
            ↓                            ↓
       TickRecorder               (订阅者 1)
            ↓ flush 5s                  ↓
       market_ticks               ABTestRunner
            ↓                            ↓
       /api/market/ticks           隔离账户 v1/v2
                                         ↓
                                   ab_equity_points
                                         ↓
                                   /api/ab-test/:id
```

---

## 2. 技术选型

### 2.1 关键技术决策表

| 维度 | 选择 | 理由 | 替代方案及放弃理由 |
|------|------|------|-------------------|
| 跨端框架 | **Taro 3.x** | 一码多端 + React 生态 | Uni-app（团队不熟）<br>Flutter（包体大） |
| UI 库 | **shadcn/ui for Taro** | 可改源码 + 主题化 | Ant Design（重）<br>Vant（颜值一般） |
| 后端框架 | **NestJS 10.x** | 模块化 + DI + 测试友好 | Express（无架构）<br>Fastify（生态弱） |
| 数据库 | **SQLite + WAL** | 零运维 + 单文件易备份 | Postgres（生产再上）<br>MongoDB（无事务） |
| ORM | **不引入** | 完全掌控 SQL + 包体小 | TypeORM（迁移复杂）<br>Prisma（运行时重） |
| 行情源 | **新浪 Hq.sinajs.cn** | 免费 + A 股覆盖 | 第三方 API（贵） |
| 测试 | **Jest（NestJS 默认）** | 已有 nestjs/testing 集成 | Vitest（生态缺） |
| 包管理 | **pnpm** | 节省空间 + 锁文件严格 | npm（慢）yarn（不稳） |
| 构建 | **Coze CLI** | 平台标准 + H5/小程序/抖音一体 | Taro CLI（跨端弱） |
| AI 接入 | **Coze Coding Dev SDK** | 平台托管 + 多模型 | 直连 OpenAI（贵 + 风险） |

### 2.2 借鉴业界的设计

| 来源 | 借鉴内容 | 落地位置 |
|------|---------|---------|
| Freqtrade | Hyperopt 目标函数 | OptimizerService composite |
| Jesse | 多标共享资金池 | BacktestService 多标并行 |
| Lean | 实验元数据 + 隔离账户 | ABTestRunner |
| Backtrader `optstrategy` | 多策略并行 | ABTestRunner.runBoth |
| CCXT | 统一交易所适配器 | QuoteAdapter（V1.1） |
| Wealthfront | AI 给出建议的交互范式 | AgentAnalysis UI |

---

## 3. 方案设计亮点

### 3.1 策略 Fork 版本化

```typescript
// 关键设计：派生而非覆盖
interface CustomStrategy {
  id: string
  parentId: string | null    // 父版本
  rootId: string             // 根版本
  version: number            // 自增
  forkedAt: number           // 派生时间
  // ...原有字段
}

// Fork 操作 = 复制父版本 + 新 ID + parentId + version++ + rootId 继承
```

**收益**：策略迭代不会"破坏"历史版本，形成天然版本树。

### 3.2 A/B 并行回测

```typescript
// 关键设计：独立账户隔离
const result1 = await runBacktest({ strategy: v1, account: 'paper-A' })
const result2 = await runBacktest({ strategy: v2, account: 'paper-B' })
const comparison = compare(result1, result2)
```

**收益**：两个策略的资金曲线互不干扰，胜出判定清晰。

### 3.3 行情自启录制

```typescript
// 关键设计：模块 init 时自启，无外部依赖
async onModuleInit() {
  if (!this.polling.isPolling()) {
    this.polling.start(5000)
  }
}
```

**收益**：保持"后台部署 → 自动录制"的用户期望。

### 3.4 数据对账兜底

```typescript
// 关键设计：FIFO + 加权平均 + 历史脏数据修复
function reconcilePositionsForAccount(account, trades) {
  const oldCash = account.cash  // ← 修复 P0 字段名错位 bug
  const sortedTrades = [...trades].sort(byTimestampAsc)
  // ... 重算 cash + positions + cost
}
```

### 3.5 Vite 排除 WAL 文件监听

```typescript
// 关键设计：避免轮询触发页面刷新
h5: {
  devServer: {
    watch: { ignored: ['**/server/data/**', '**/*.db*'] }
  }
}
```

---

## 4. 可测试性

### 4.1 测试覆盖现状

| 模块 | 测试文件 | 用例数 | 覆盖范围 |
|------|---------|--------|---------|
| strategy | strategy.spec.ts | 8 | CRUD + Fork + 版本 |
| paper-trading | reconcile.spec.ts + main.spec | 12 | 对账 + 主流程 |
| backtest | backtest.spec.ts | 6 | K 线回放 |
| optimizer | optimizer.spec.ts | 4 | Grid + Composite |
| **ab-test** | runner.spec.ts + metrics.spec | 6 | 并行 + 指标计算 |
| **总计** | — | **36+** | 核心逻辑 |

### 4.2 测试模式

```typescript
// 风格 1：行为驱动
describe('reconcilePositionsForAccount', () => {
  it('R1: 空账户 + 无交易 → 保持原状', () => {})
  it('R2: 混合 BUY/SELL → 计算正确', () => {})
  it('R3: SELL > BUY → 现金不被钳为 0', () => {})
  it('R4: 重复调用 → 幂等', () => {})
})

// 风格 2：表驱动
const cases: [params, expected][] = [
  [{ ma_short: 5 }, { signals: 3 }],
  [{ ma_short: 10 }, { signals: 2 }],
]
for (const [params, expected] of cases) {
  it(`should handle ${JSON.stringify(params)}`, () => {})
}
```

### 4.3 测试结果（最新）

```
pnpm validate
├── tsc --noEmit  ✅ 0 errors
├── eslint         ✅ 0 errors
└── jest           ✅ 36/36 passed
```

---

## 5. DFX（Design for X）可维护性分析

### 5.1 可维护性 Maintainability ⭐⭐⭐⭐⭐

| 实践 | 体现 |
|------|------|
| 模块边界清晰 | 每个 module 独立 NestJS module |
| 命名一致 | camelCase 变量 / PascalCase 类 / UPPER_SNAKE_CASE 常量 |
| TypeScript 严格模式 | `strict: true` + `noImplicitAny` |
| 提交规范 | Commitlint（feat/fix/docs/refactor/...） |
| 文档沉淀 | docs/SPEC-*.md / docs/recap/ / docs/research/ |
| 代码清洁 | 禁止未使用 import/state（lint 兜底） |

### 5.2 可扩展性 Scalability ⭐⭐⭐⭐

| 实践 | 体现 |
|------|------|
| 策略可 Fork | 任何现有策略可派生新版本 |
| 行情源适配层（V1.1） | 借鉴 CCXT 抽象 |
| 模块化 | 新增功能加 module 即可 |
| 数据库迁移 | IF NOT EXISTS 幂等 |
| **风险**：SQLite 单文件 → V2.0 需迁 Postgres |

### 5.3 可靠性 Reliability ⭐⭐⭐⭐

| 实践 | 体现 |
|------|------|
| 数据对账（reconcile） | 历史脏数据可修复 |
| 单元测试 36+ | 核心逻辑覆盖 |
| 集成测试 | 端到端 curl 验证 |
| 错误兜底 | try-catch + 用户友好提示 |
| WAL 模式 | SQLite 读写并发安全 |

### 5.4 安全性 Security ⭐⭐⭐

| 实践 | 体现 |
|------|------|
| 后端响应统一 HTTP 200 | 状态码不暴露细节 |
| 模拟盘隔离 | 用户不会接触实盘 |
| LLM 输出水印 | "非投资建议" |
| **待补**：鉴权 / 限流 / 防注入（V2.0 引入） |

### 5.5 可测试性 Testability ⭐⭐⭐⭐

| 实践 | 体现 |
|------|------|
| NestJS 内置 testing | jest + supertest |
| Repository 抽象 | DB 可 Mock |
| 表驱动测试 | 边界清晰 |
| 行为驱动测试 | 易于理解 |

### 5.6 可观测性 Observability ⭐⭐

| 实践 | 体现 |
|------|------|
| console.log（Network） | 请求可追溯 |
| dev.log 完整 | 服务端日志 |
| bypass/console.log | 浏览器端日志 |
| **待补**：OpenTelemetry（V2.0）<br>**待补**：结构化日志 + 指标（V2.0） |

### 5.7 可部署性 Deployability ⭐⭐⭐⭐

| 实践 | 体现 |
|------|------|
| Coze CLI 一键 | dev / build / start |
| 跨端一致 | H5 + 微信 + 抖音 |
| 健康检查 | 端口探测 |
| 数据库迁移自动 | 服务启动时执行 |
| **待补**：CI/CD（GitHub Actions） |

### 5.8 可复用性 Reusability ⭐⭐⭐⭐⭐

| 实践 | 体现 |
|------|------|
| 60+ UI 组件 | shadcn/ui for Taro |
| 30+ 业务组件 | 策略/回测/AI 等可复用 |
| 模板策略 | 内置 5 个经典策略 |
| docs 体系 | SPEC/recap/research/roadmap |

---

## 6. 技术债清单

| 编号 | 内容 | 优先级 | 计划 |
|------|------|--------|------|
| TD-1 | SQLite 写并发 | 低 | 单用户场景可接受 |
| TD-2 | 无鉴权 | 中 | V2.0 引入 |
| TD-3 | 无 WebSocket 推送 | 中 | V1.1 引入（推送增强） |
| TD-4 | 无 OpenTelemetry | 低 | V2.0 引入 |
| TD-5 | 单元测试覆盖率未量化 | 中 | V1.1 引入 c8/istanbul |
| TD-6 | 行情源未抽象 | 高 | V1.1 引入 QuoteAdapter |
| TD-7 | db 文件曾误入库 | 已修 | 已加 .gitignore + chore 清理 |

---

## 7. 下一步技术演进

按 `docs/roadmap/next-quarter.md`：

| 版本 | 关键技术演进 | DFX 价值 |
|------|------------|---------|
| V1.1 | QuoteAdapter 抽象 | 可扩展性 ↑ |
| V1.1 | WebSocket/SSE 推送 | 可靠性 ↑ |
| V1.1 | 暗色主题 | 用户体验 ↑ |
| V1.2 | 多标并行回测 | 性能 ↑ |
| V2.0 | Postgres 迁移 | 可扩展性 ↑↑ |
| V2.0 | OpenTelemetry | 可观测性 ↑↑ |
| V2.0 | NestJS Guards/拦截器 | 安全性 ↑↑ |
| V2.0 | 多账户 UI | 商业化 ↑ |
| V3.0 | Web 后台 | 可维护性 ↑↑ |

---

## 8. 关键技术指标

| 指标 | 当前 | 目标 |
|------|------|------|
| TypeScript 严格度 | strict: true | 保持 |
| ESLint 错误数 | 0 | 0 |
| 单元测试数 | 36+ | 60+ |
| API 数 | 50+ | 80+ |
| 模块数 | 9 | 12 |
| 数据库表数 | 16 | 20 |
| 文档沉淀 | 20+ docs | 50+ |
| 包大小（H5） | < 2MB | < 3MB |
| 首屏渲染 | < 1.5s | < 1s |
