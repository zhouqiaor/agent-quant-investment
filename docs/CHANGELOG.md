# CHANGELOG

> 按迭代轮次汇总。测试规模为该轮交付时全仓全绿用例数（server + web 口径自第7轮起拆分）。

---

## 第9轮——量比字段补全 + 覆盖率门禁/artifact

- **一句话**：选股器量比（volumeRatio）落地、12 字段全部真实可用；建立 server 覆盖率硬阈值门禁与双端覆盖率 artifact。
- **测试规模**：416（server 309 + web 107）
- **commit**：`5cd7364`
- **详见**：[SPEC-iteration8-9-engineering.md](./SPEC-iteration8-9-engineering.md)

## 第8轮——工程诚信：watchlist 红灯根治 / 选股字段补全 / CI 流水线

- **一句话**：根治 watchlist 6 个长期红灯（测试隔离问题，service 无 bug），换手率/连板字段真实落盘，GitHub Actions 五 job 流水线落地。
- **测试规模**：407（server 300 + web 107），全量 server 测试无需 ignore 参数
- **commit**：`b607ef2`
- **详见**：[SPEC-iteration8-9-engineering.md](./SPEC-iteration8-9-engineering.md)

## 第7轮——组合管理落地 + 前端 jsdom 测试基建

- **一句话**：组合接口/live-pnl 双路径/组合页落地（默认 legacy 灰度），根级 jest+jsdom+RTL 让 107 个前端用例首次真正跑通。
- **测试规模**：385（server 278 + web 107）
- **commit**：`d19b1aa`
- **详见**：[SPEC-iteration7-portfolio.md](./SPEC-iteration7-portfolio.md)

## 第6轮——条件选股器 + 性能体验六件套

- **一句话**：12 字段条件选股器（契约先行/8路并发/全集缓存）+ 虚拟列表、K线缓存、ErrorBoundary、数字动画、离线兜底、暗色模式。
- **测试规模**：264
- **commit**：`ab42f7d`
- **详见**：[SPEC-iteration6-screener-perf.md](./SPEC-iteration6-screener-perf.md)

## 第5轮——技术指标 + 信号通知中心

- **一句话**：MA/EMA/MACD/BOLL/KDJ 纯函数指标引擎与主副图叠加，策略信号原因 enrich，独立通知中心；顺手修复 notifications dedup 失效。
- **测试规模**：207
- **commit**：`12db59b`
- **详见**：[SPEC-iteration5-indicators-notifications.md](./SPEC-iteration5-indicators-notifications.md)

---

## 测试规模趋势

| 轮次 | 全仓测试 | 增量 |
|---|---|---|
| 第5轮 | 207 | — |
| 第6轮 | 264 | +57 |
| 第7轮 | 385（278 + 107 web） | +121（前端基建打通） |
| 第8轮 | 407（300 + 107） | +22 |
| 第9轮 | 416（309 + 107） | +9 |

---

## 更早轮次

- 第3轮：回测可视化 & 持仓K线图（SVG 零依赖）—— [SPEC-iteration3-charts.md](./SPEC-iteration3-charts.md)
- 第2轮：交易明细 / 持仓详情 / 手动交易 / 首次引导（132 测试）—— [SPEC-iteration2.md](./SPEC-iteration2.md)
- 全量股票目录对接（5553 只沪深A + 北交所）+ 真实日K线 —— [SPEC-stock-directory.md](./SPEC-stock-directory.md)
