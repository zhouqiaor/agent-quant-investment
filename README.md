# Agent 量化投资助手

AI Agent 驱动的量化投资助手：覆盖 **行情目录 → 技术指标 → 条件选股 → 策略回测 → AI Agent 自动交易 → 模拟盘组合管理 → 信号通知** 的完整闭环。基于 Taro 4 跨端，一套代码同时交付**微信小程序**与 **H5**，后端为 NestJS + SQLite。

> 本项目为模拟盘/研究用途，不构成任何投资建议。

## 功能全景

### 行情与数据

- **5,553 只股票目录**：沪深 A 股 + 北交所全量，Sina 数据源，支持搜索与自选
- **真实日 K 线**：服务端代理拉取，SQLite 本地缓存（`server/src/stock`），减少重复请求
- **K 线图**：自研 SVG 零依赖蜡烛图 + MA/EMA 均线，MACD/KDJ 副图（`src/components/chart`）

### 技术分析

- 指标：**MA / EMA / MACD / BOLL / KDJ**
- 全部参数可在「指标设置」页配置并持久化（`src/pages/indicator-settings`、`src/lib/indicators`）
- 信号识别与通知：买卖信号进入通知中心，TabBar 角标实时展示未读数

### 条件选股器

- **12 个筛选字段**，覆盖基本面、行情、技术指标、K 线形态
- 条件间支持 **AND / OR** 组合，preset（预设方案）持久化
- 代码：`src/lib/screener`、`src/pages/screener`、`server/src/screener`

### 策略、回测与 AI Agent

- 多策略管理与**回测可视化**（净值曲线、交易明细）
- **AI Agent 自动交易**：Agent 依据策略/信号在模拟盘自动下单（`server/src/agent`、`server/src/strategy`）
- 模拟盘：持仓、交易明细、手动交易、持仓详情 K 线（`server/src/paper-trading`、`src/pages/paper-trading`）

### 组合管理（feature flag 灰度）

- **多策略组合管理**：资金守恒分配、双层风控、同股跨策略去重
- 代码：`server/src/portfolio`、`src/lib/portfolio.ts`、`src/pages/portfolio`

### 性能与体验

- **虚拟列表**渲染 5,000+ 股票目录（`src/components/ui/virtual-list.tsx`）
- K 线 SQLite 缓存、离线/弱网 **stale 缓存兜底**（`src/lib/stale-cache.ts`）
- 数字**滚动动画**（`src/lib/use-animated-number.ts`）、暗色模式（`src/lib/use-color-scheme.ts`）
- 全局 **ErrorBoundary** 兜底渲染异常

## 技术架构

```
小程序/H5 (Taro 4 + React 18)
  Tailwind CSS 4 + weapp-tailwindcss 跨端原子样式
  Zustand 5 状态管理 · lucide-react-taro 图标
        │  HTTP（src/network.ts 统一封装）
        ▼
NestJS 10 后端 (server/)
  stock / indicators / screener / strategy / backtest
  agent / paper-trading / portfolio / risk / notification
        │
        ├── SQLite (better-sqlite3)：K 线缓存、模拟盘持仓/交易、配置持久化
        └── Sina 行情接口：股票目录 + 日 K 线（iconv-lite 处理 GBK 编码）
```

其他关键依赖：TypeScript 5、Vite 4、Drizzle ORM、Zod（运行时校验）、Node.js >= 18、pnpm 9。

## 项目结构

```
├── config/               # Taro 构建配置（index/dev/prod）
├── src/                  # 前端源码
│   ├── pages/            # 页面：market/screener/strategy/backtest/paper-trading/
│   │                     #       portfolio/position/notifications/indicator-settings 等
│   ├── components/
│   │   ├── chart/        # SVG K线/MACD/KDJ 图
│   │   └── ui/           # 基础 UI 组件（Button/Card/Dialog…）
│   ├── lib/              # 指标计算、选股引擎、hooks、缓存
│   ├── stores/           # Zustand stores
│   ├── network.ts        # 网络请求统一封装
│   └── app.config.ts     # 路由/TabBar 配置
├── server/src/           # NestJS 后端（模块即业务域，见上）
├── docs/                 # 各轮迭代 SPEC 与研究文档
├── .github/workflows/    # GitHub Actions CI
└── DEPLOY.md             # 部署指南
```

## 快速开始

### 安装依赖

```bash
pnpm install
```

> 项目强制使用 pnpm（preinstall only-allow），Node.js >= 18。

### 本地开发

```bash
pnpm dev          # 同时启动 H5 前端 + NestJS 后端
```

- 前端（H5）：http://localhost:5000
- 后端：http://localhost:3000

单独启动：

```bash
pnpm dev:web      # 仅 H5
pnpm dev:weapp    # 仅微信小程序（微信开发者工具打开项目根目录）
pnpm dev:server   # 仅后端（默认 3000 端口，热重载）
```

### 构建

```bash
pnpm build        # lint + 类型检查 + H5 + 微信小程序 + 抖音小程序 + 后端
pnpm build:web    # 仅 H5，输出 dist-web
pnpm build:weapp  # 仅微信小程序，输出 dist
pnpm build:tt     # 仅抖音小程序
pnpm build:server # 仅后端
```

小程序预览二维码：

```bash
pnpm preview:weapp
pnpm preview:tt
```

## 测试

前端使用 Jest 30 + jsdom + Testing Library；后端使用 Jest 30（含 supertest e2e）。

| 范围 | 命令 | 规模（2026-09 核实） |
| --- | --- | --- |
| 后端 | `cd server && pnpm test` | **309** 用例 / 36 个测试套件 |
| 前端 | `pnpm test:web` | **107** 用例 / 11 个测试套件 |

其他命令：

```bash
cd server && pnpm test:watch   # 后端 watch 模式
cd server && pnpm test:e2e     # 仅 e2e（*.e2e-spec.ts）
pnpm test:web -- --coverage    # 前端覆盖率（输出到 coverage/）
cd server && pnpm test:cov     # 后端覆盖率（输出到 server/coverage/）
```

### 覆盖率门禁

- 后端 `coverageThreshold`：statements/lines ≥ 70%，branches ≥ 55%，functions ≥ 72%
- 前端为 jsdom 测试基建初期，阈值较低（≥ 5%），随用例补强逐步收紧

## CI

GitHub Actions（`.github/workflows/ci.yml`）在 push / PR 到 `main` 时运行，同分支并发只保留最新一次：

1. **setup**：pnpm install（`--frozen-lockfile` 校验锁文件）
2. **validate**：ESLint（0 warning）+ `tsc --noEmit`
3. **test-server**：后端 Jest + 覆盖率门禁，上传 `coverage-server` artifact
4. **test-web**：前端 Jest + 覆盖率门禁，上传 `coverage-web` artifact
5. **build**：后端构建 + H5 构建产物校验

## 文档导航

- [DEPLOY.md](./DEPLOY.md) — 部署指南（直接部署 / Docker Compose）
- [docs/SPEC.md](./docs/SPEC.md) — 项目总体 SPEC
- [docs/SPEC-custom.md](./docs/SPEC-custom.md) — 自定义扩展 SPEC
- [docs/SPEC-beta.md](./docs/SPEC-beta.md) — Beta 功能 SPEC
- [docs/SPEC-stock-directory.md](./docs/SPEC-stock-directory.md) — 全量股票目录与真实 K 线对接
- [docs/SPEC-iteration2.md](./docs/SPEC-iteration2.md) — 第 2 轮：交易明细/持仓/手动交易
- [docs/SPEC-iteration3-charts.md](./docs/SPEC-iteration3-charts.md) — 第 3 轮：回测可视化与持仓 K 线
- [docs/SPEC-iteration5-indicators-notifications.md](./docs/SPEC-iteration5-indicators-notifications.md) — 第 5 轮：技术指标与信号通知中心
- [docs/SPEC-iteration6-screener-perf.md](./docs/SPEC-iteration6-screener-perf.md) — 第 6 轮：条件选股器与性能体验
- [docs/SPEC-iteration7-portfolio.md](./docs/SPEC-iteration7-portfolio.md) — 第 7 轮：多策略组合管理
- [docs/quant-research.md](./docs/quant-research.md) — 量化策略研究笔记

## 开发约定（摘要）

- **新建页面**：`src/pages/<name>/index.tsx` + `index.config.ts`，并在 `src/app.config.ts` 的 `pages` 中注册；也可用 `pnpm new` 交互式生成
- **路径别名**：`@/*` → `src/*`
- **网络请求**：统一用 `src/network.ts` 的 `Network.request/uploadFile/downloadFile`，不要直接用 `Taro.request`
- **图标**：统一用 `lucide-react-taro`（不要用 `lucide-react`）；微信 TabBar 不支持 SVG/base64，需用 `npx taro-lucide-tabbar` 生成本地 PNG，且 `iconPath` 必须以 `./` 开头
- **样式**：优先 Tailwind 原子类，必要时再 fallback CSS/Less
- 后端新增模块可在 `server/` 下用 `npx nest g resource modules/xxx` 生成样板

## 风险与免责声明

- 本项目所有交易均运行在**模拟盘**，不接入任何真实券商或资金账户
- 行情数据来自第三方公开接口（Sina），可能存在延迟、缺失或错误
- 项目内容（含 AI Agent 产生的信号与交易行为）**仅用于技术研究与学习，不构成任何投资建议或收益承诺**
- 据此投资风险自担
