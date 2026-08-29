# Agent 量化投资小程序 — SPEC 开发计划与 TDD 规范

> 参考业界优秀开源项目的工程流程：Freqtrade（pytest + CI 矩阵 + 回测用例）、Jesse（Jest 风格测试）、Backtrader（策略单元测试）、Superalgos（模块测试）。

## 一、业界流程调研与复用

| 项目 | 测试实践 | 本项目复用 |
|------|---------|-----------|
| **Freqtrade** | pytest；策略用固定 fixtures 数据回放；回测结果断言胜率/收益；CI 矩阵跑全量 | 测试用固定行情 fixtures，避免依赖网络；回测断言关键指标 |
| **Jesse** | Jest；模块单元测试 + 集成测试；squawk 错误上报 | 后端 NestJS 用 Jest + Supertest；E2E 全流程 |
| **Backtrader** | 策略/指标用已知数据点断言（如均线交叉点） | 指标计算用确定性数据断言 |
| **Hummingbot** | 单元测试 + connector 测试 + 网络 mock | 行情数据源用 mock，测试不依赖外部 API |
| **OctoBot** | pytest + 异步测试；交易决策用 mock | Agent 决策逻辑用 mock 数据测试 |

**TDD 原则（RED-GREEN-REFACTOR）**：
1. RED：先写失败的测试
2. GREEN：写最小实现让测试通过
3. REFACTOR：重构并保持测试通过

**网络/外部依赖隔离**：所有真实行情 API 在测试中 mock，保证测试确定性与离线可运行（CI 友好）。

## 二、技术选型

- **测试框架**：Jest（NestJS 官方推荐）+ ts-jest + Supertest（HTTP 集成测试）
- **持久化**：better-sqlite3（沙箱/CI 零配置；生产可替换为 Postgres via drizzle，仓储层抽象）
- **单元测试**：`*.spec.ts`（服务层，mock 外部依赖）
- **E2E 测试**：`test/*.e2e-spec.ts`（Supertest 打完整 Nest app）

## 三、分阶段计划

### 阶段 0：测试基础设施
- 安装 jest / ts-jest / supertest / @types
- `jest-e2e.json` 配置
- `server/test/` 目录与 fixtures
- `pnpm test` / `pnpm test:e2e` 脚本
- 验收：示例测试可运行

### 阶段 1：数据持久化层（P0）
**功能**：策略、交易记录、回测结果、模拟账户持久化到 SQLite，重启不丢失。
**模块**：`server/src/persistence/`（DatabaseService + Repository 抽象）
**测试用例**：
- C1.1 策略 CRUD：创建 → 查询 → 更新 → 删除
- C1.2 交易记录：写入 → 按账户查询 → 统计字段正确
- C1.3 回测结果：保存 → 按 id 查询 → 指标完整
- C1.4 持久化：关闭重连后数据仍存在
- C1.5 唯一约束/空表查询不报错

### 阶段 2：定时行情轮询（P0）
**功能**：后台定时刷新行情缓存，前端获取最新价；行情服务有刷新生命周期。
**模块**：`QuoteRefreshScheduler`（@nestjs/schedule 或可注入定时器）
**测试用例**：
- C2.1 定时器可启动/停止
- C2.2 触发刷新时调用行情服务并更新缓存
- C2.3 数据源失败时降级到缓存不崩溃
- C2.4 刷新间隔可配置
- E2E：`GET /api/market/list` 返回新鲜数据

### 阶段 3：策略参数优化（P1）
**功能**：网格搜索（grid search）遍历参数组合，基于回测选出最优夏普组合。
**模块**：`server/src/optimize/`
**测试用例**：
- C3.1 网格生成：参数空间 → 完整组合（笛卡尔积）
- C3.2 每组跑回测并返回指标
- C3.3 按夏普排序返回最优
- C3.4 空参数空间返回错误
- C3.5 组合数量上限保护

### 阶段 4：信号通知服务（P1）
**功能**：Agent 触发信号时生成通知（站内），支持已读/未读、列表查询。
**模块**：`server/src/notification/`
**测试用例**：
- C4.1 信号事件 → 生成通知
- C4.2 通知列表按时间倒序
- C4.3 标记已读
- C4.4 未读计数
- C4.5 通知级别（info/buy/sell/risk）

### 阶段 5：E2E 集成测试
**全流程**：选股 → 创建策略 → 回测 → 参数优化 → 启动模拟交易 → 触发信号 → 通知 → 持久化验证
- E5.1 `POST /api/backtest/run` → 200 + 指标
- E5.2 `POST /api/strategies/custom` → 201 + 落库
- E5.3 `POST /api/paper-trading/start` + `simulate` → 产生交易并落库
- E5.4 `GET /api/notifications` → 信号通知
- E5.5 重启后数据仍在（持久化 E2E）

### 阶段 6：校验交付
- `pnpm validate`、`pnpm build`、`pnpm test`、`pnpm test:e2e`

## 四、验收标准（DoD）
- 每个阶段：单元测试 + E2E 通过，且遵循 TDD（先红后绿）
- 测试不依赖外部网络（mock 行情）
- 覆盖率：核心服务关键路径 100% 断言
- `pnpm test` 与 `pnpm test:e2e` 全绿
