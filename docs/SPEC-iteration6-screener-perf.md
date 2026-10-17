# SPEC：第6轮迭代——条件选股器 + 性能体验六件套

> 本轮目标：把指标体系转化为生产力工具——条件选股器；同时集中偿还性能与体验债。
> commit `ab42f7d`，TDD 264 测试全绿。是迄今改动最大的一轮（50 文件，约 8900 行新增）。

---

## 一、目标与价值

| 维度 | 迭代前 | 本轮后 |
|---|---|---|
| 选股 | 只能翻 5553 只行情列表 | 12 字段条件组合、preset 持久化、结果表 |
| 行情页性能 | 5553 项全量 DOM | 虚拟列表，DOM 节点收敛到约 20 个 |
| K线接口 | 每次请求打数据源 | SQLite 5分钟缓存 + in-flight 并发合并 |
| 异常/离线 | 单点报错白屏 | ErrorBoundary 分级兜底 + stale 离线兜底 |
| 指标参数 | 写死 | 设置页可调，9 个 query 联动 |
| 视觉/观感 | 仅亮色、数字硬切 | 暗色跟随系统 + 数字滚动动画 |

---

## 二、范围界定

### In Scope

**条件选股器**
- `server/src/screener/schema.ts`：Zod 契约层 + 12 字段字段字典（单一事实源）
- `ScreenerService`：基本面 / 行情 / 技术 / 形态四类求值，8 路并发，全集结果 5 分钟缓存
- `screener.controller` + module + E2E
- 前端 `src/pages/screener/`：条件构建器 + 结果表 + preset 持久化
- `src/lib/screener/types.ts` 前端类型契约 + Zustand screener store

**组合管理 Part 1（仅后端基础设施）**
- `PortfolioService`：资金守恒 invariant + 双层风控 + 同股多策略 BUY 去重
  （落地与接口在第7轮，本轮先建内核）

**性能与体验六件套**
1. K线 SQLite 5分钟缓存 + in-flight 并发合并
2. 行情虚拟列表（5553 项 → 约 20 DOM 节点）
3. ErrorBoundary 统一包裹 + 图表级 fallback
4. 数字滚动动画 hook `useAnimatedNumber`
5. 离线兜底 `useStaleQuery` + stale banner（`stale-cache`）
6. 暗色模式跟随系统 `useColorScheme`

**指标可配置**：9 个 query 参数 + 指标设置页 + indicator-settings store

### Out of Scope

- 组合管理的接口/前端落地（第7轮）
- 前端单测真正在 Node 跑通（本轮 spec 已写，但 jsdom 基建第7轮才建）
- `turnoverRate` / `consecutiveLimitUp` / `volumeRatio` 的真实数据补全（第8、9轮）
- 选股结果导出、自选股联动、历史选股快照

---

## 三、关键技术决策

1. **契约先行：schema 作为单一事实源**
   `schema.ts` 不依赖任何服务/DB，声明每字段的 category / dataSource / ops / valueType，
   `Condition` 用 superRefine 校验 value 与字段类型匹配。service/controller/前端全部以此为准。

2. **字段全集 12 个，分四类四数据源**
   - fundamental：pe / pb / marketCap
   - quote：changePct / turnoverRate / volumeRatio / consecutiveLimitUp
   - technical：macdSignal / kdjZone / bollBand
   - pattern：maAlignment / resonance
   操作符 `> < >= <= = between in`，组合符 AND/OR；groups ≤ 8、pageSize ≤ 100 防大查询。

3. **8 路并发求值 + 5 分钟全集缓存**
   各数据源并发拉取，全集结果缓存，重复筛选不再回源。

4. **缓存设计区分两层**
   K线缓存落 SQLite（跨进程/重启有效）+ in-flight Promise 合并（同一瞬并发只打一次）。

5. **虚拟列表自研通用组件**
   `src/components/ui/virtual-list.tsx` 只渲染可视区，窗口化把 DOM 压到约 20 节点。

6. **离线兜底 stale-while-revalidate**
   `useStaleQuery` 先返回缓存数据并挂 stale banner，后台再刷新，弱网/断网不白屏。

7. **组合内核先 TDD 后接线**
   `PortfolioService` 先以纯服务形态验证资金守恒与风控，再在第7轮暴露接口/页面。

---

## 四、测试增量

| 套件 | 测试数 |
|---|---|
| screener schema（契约/校验/边界） | 29 |
| screener.service（四类求值/并发/缓存） | 14 |
| screener E2E | 6 |
| 前端选股页 + screener types + store | 25 |
| portfolio.service（守恒/风控/去重） | 9 |
| kline-cache | 6 |
| virtual-list | 16 |
| error-boundary | 6 |
| use-animated-number | 19 |
| use-stale-query + stale-cache | 13 |
| use-color-scheme | 8 |
| 指标可配置（query + 设置页 + store + 后端 custom-config） | 15+ |

全仓 **207 → 264 测试全绿**。
注：本轮前端 spec 文件已大量编写，但真正在根级 jsdom 跑通要等第7轮基建落地。

---

## 五、遗留 / P2

- 三个行情字段当时"接了契约但数据未真实落盘"：换手率、连板、量比 → 第8、9轮补全
- 前端 spec 在本轮尚未由 Node 执行（jsdom 基建缺位）→ 第7轮
- 组合管理只有服务内核，无接口/页面/开关 → 第7轮
- 选股结果无导出、无回测联动、无选股历史
- 暗色模式为跟随系统，暂无手动强制切换
