# SPEC：第5轮迭代——技术指标 + 信号通知中心

> 本轮目标：在真实日K线之上补齐"看得懂"的两层能力——技术指标（MA/EMA/MACD/BOLL/KDJ）
> 让图表会说话；信号通知中心让策略信号不再沉没在日志里。commit `12db59b`，TDD 207 测试全绿。

---

## 一、目标与价值

| 维度 | 迭代前 | 本轮后 |
|---|---|---|
| K线图 | 只有蜡烛实体，无指标参照 | MA/BOLL 主图叠加 + MACD/KDJ 副图，买卖有据 |
| 策略信号 | 命中后只写日志/通知，原因不明 | 信号原因由指标引擎生成，可追溯 |
| 通知 | 散落、无中心入口、dedup 失效 | 独立通知中心 + 类型筛选 + 批量已读 + 角标 |
| 回测 | 指标计算与回测各写一份 | 复用统一 indicators 模块，消除分叉 |

核心价值：把第3轮"能看见K线"升级为"看得懂K线"，并打通"信号产生 → 通知触达"闭环。

---

## 二、范围界定

### In Scope

**后端**
- `server/src/indicators/`：MA/EMA/MACD/BOLL/KDJ 纯函数模块 + 统一 `types.ts` + `index.ts` 聚合
- `IndicatorCalcService`：一次K线输入批量产出全部指标，避免重复遍历
- K线接口扩展 `indicators` 字段（`withIndicators=true`）
- `StrategyService.enrichSignalReason`：把指标状态翻译成人话的信号原因
- `backtest.service` 重构为复用 indicators 模块（行为不变）
- persistence notifications 表新增 `signalId` 列，修复通知 dedup 失效 bug
- 通知中心后端接口

**前端**
- `CandleChart` 扩展：MA/BOLL 主图叠加 + 买卖信号三角标记
- 新增 `macd-chart.tsx` / `kdj-chart.tsx` 副图组件（延续零依赖 SVG 路线）
- `src/pages/notifications/` 独立页：Tab、类型筛选、批量已读
- Zustand notification store：60s 轮询 + TabBar 角标
- 首页通知卡片作为通知中心入口；持仓K线请求带 `withIndicators=true`

### Out of Scope

- 指标参数 UI 可配置（留待第6轮）
- 条件选股器（依赖指标体系就位后才做，第6轮）
- 分钟线 / 实时分时（数据源不支持）
- 通知推送（短信/微信/邮件）等站外触达

---

## 三、关键技术决策

1. **指标纯函数化、与框架解耦**
   每个指标是 `(values: number[], ...params) => IndicatorSeries` 的纯函数，不读 DB、不依赖 Nest。
   单测可直接喂数组断言，回测/实时/K线接口三方共用同一份实现。

2. **IndicatorCalcService 做批量编排**
   指标之间共享同一段K线输入，由 service 统一计算一次返回，避免调用方各自遍历、参数漂移。

3. **信号原因 enrich 而非替换**
   `enrichSignalReason` 在既有策略信号上附加指标解释，不改变信号触发逻辑，回归风险最小。

4. **零依赖 SVG 图表继续**
   MACD/KDJ 副图沿用第3轮自研 SVG，包体积零增长，红涨绿跌语义与全应用一致。

5. **顺手修真实 bug：notifications.dedup**
   原表缺 `signalId` 列导致同一信号重复通知。新增列后 dedup 才真正生效，并以 E2E 锁定。

6. **轮询而非 WebSocket**
   通知中心用 60s 轮询 + TabBar 角标，内测阶段成本最低；实时推送列为 P2。

---

## 四、测试增量

| 套件 | 测试数 | 覆盖内容 |
|---|---|---|
| indicators 各纯函数（ma/ema/macd/boll/kdj） | 35 | 空序列/短序列/窗口边界/已知值 |
| indicator-calc.service.spec | （含上） | 批量编排、缺数据降级 |
| kline-indicators.e2e | 5 | `withIndicators` 开关、字段结构 |
| strategy-signal-reason.spec | 6 | 指标 → 人话原因映射 |
| notification-center.e2e | 6 | 列表/筛选/已读/`signalId` dedup |

合计全仓 **207 测试全绿**（较第3轮约 150+ 显著增长）。前端图表以纯函数逻辑 + 手工视觉验证为主。

---

## 五、遗留 / P2

- 指标参数（周期等）仍写死，UI 不可调 → 第6轮解决
- 通知仅站内 + 60s 轮询，无站外推送、无实时通道
- K线指标只在日级，无分钟级
- 前端图表组件缺 jsdom 单测（当时前端单测基建尚未建立，第7轮补齐）
- 通知无分级/免打扰/订阅偏好
