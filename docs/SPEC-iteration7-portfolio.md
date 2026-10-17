# SPEC：第7轮迭代——组合管理落地 + 前端 jsdom 测试基建

> 本轮目标：让第6轮已 TDD 完成的组合内核真正可用（接口 + live-pnl 接线 + 前端页面），
> 并补齐长期缺位的前端单测基建，让 107 个前端用例首次在 Node/jsdom 真正跑起来。
> commit `d19b1aa`，server 278 + web 107 = 385 测试全绿。

---

## 一、目标与价值

| 维度 | 迭代前 | 本轮后 |
|---|---|---|
| 组合管理 | 仅有 PortfolioService 内核 | 接口 + live-pnl 双路径 + 组合页 + 策略开关 |
| 前端测试 | spec 写了但 Node 不执行 | 根级 jest + jsdom + RTL，107 用例真正跑通 |
| 多策略 | 信号/成交各走各的 | 组合模式统一调度，同股去重、双层风控、整手 |
| 选股入口 | 只能从单独入口进 | 行情页、首页均有条件选股入口 |

核心价值：一是把"多策略资金如何安全共存"从设计变成产品；二是让前端测试从"摆设"变为"资产"。

---

## 二、范围界定

### In Scope

**组合管理落地**
- `PortfolioModule` / `PortfolioController`：summary / create / toggle 路由
- `live-pnl` 双路径改造：
  - `PORTFOLIO_MODE` 环境变量 或 `portfolio_enabled` flag 控制
  - 默认仍走 legacy 路径，保证内测既有行为不被打断
  - 组合模式下：BUY 同股多策略去重（取 min）、双层风控、100 股整手
- 前端 `src/pages/portfolio/`：总资产卡 + SVG PnL 条形图 + 策略开关矩阵
- `src/lib/portfolio.ts` + Zustand portfolio store
- profile 页新增"组合管理"入口

**选股器入口补全**
- 行情页、首页新增条件选股入口（页面本体第6轮已交付）

**前端测试基建**
- 根级 `jest.config.js` + `jest.setup.ts` + `tsconfig.jest.json`
- jsdom + @testing-library/react
- `jest.setup`：Taro mock（内存 storage）+ `requestAnimationFrame` / `matchMedia` polyfill
- `test:web` 脚本；清理 spec 的 ambient 声明

### Out of Scope

- 组合模式默认开启（本轮仍默认 legacy，灰度由 flag 控制）
- 组合层面的再平衡 / 调仓建议 / 业绩归因
- 组合收益曲线、历史净值序列
- CI 中接入前端测试（第8轮）与覆盖率门禁（第9轮）

---

## 三、关键技术决策

1. **双路径 + 默认 legacy，零打断灰度**
   live-pnl 用 `PORTFOLIO_MODE` / `portfolio_enabled` 切换。新组合路径默认不启用，
   内测用户行为不变，验证稳定后再切。这是"功能落地但不冒险替换"的关键。

2. **同股多策略 BUY 去重取 min**
   多个策略对同一股票同时出 BUY 时，组合层合并下单量取最小，配合双层风控避免重复建仓超配。

3. **双层风控在下单前截断**
   策略级 `maxPositionPct`（单策略对单股上限）+ 组合级 `cashReservePct`（现金储备阈值），
   并在落库前后做资金守恒 invariant 校验（现金 + 市值 + 已实现盈亏 对齐初始资金）。

4. **100 股整手约束**
   A 股按整手下单，组合模式下单量规整到 100 股，避免产生零手碎单。

5. **前端测试基建：mock Taro 而非跑真运行时**
   用内存 storage 模拟 Taro API，jsdom + RTL 测组件/hook/store 逻辑；
   `rAF`/`matchMedia` 等浏览器缺口用 polyfill 补齐。11 个套件 107 用例一次跑通。

6. **组合图表继续零依赖 SVG**
   PnL 条形图沿用既有 SVG 路线，与其他页面设计一致。

---

## 四、测试增量

| 套件 | 测试数 | 内容 |
|---|---|---|
| portfolio.controller.spec | 6 | summary/create/toggle 路由 |
| live-pnl-portfolio.spec | 8 | 双路径切换、同股取 min、双层风控、整手 |
| 前端组合页 + portfolio lib/store | 13 | 资产卡、PnL 图、开关矩阵、状态管理 |
| 前端全量（基建打通后首次执行） | 107（11 套件） | hooks / stores / 组件 真正跑通 |

全仓 **264 → 385（server 278 + web 107）全绿**，validate / build 通过。

---

## 五、遗留 / P2

- 组合模式默认仍关闭，需经一段时间灰度后再切默认
- 无组合级再平衡、调仓建议、业绩归因、历史净值曲线
- 前端测试只在本地脚本跑，未进 CI → 第8轮
- 无覆盖率统计与门禁 → 第9轮
- watchlist 等 server 套件仍存在长期红灯（靠 ignore 参数绕过）→ 第8轮根治
