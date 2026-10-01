# 仿真复盘报告 · 100账户仿真-9月回放-2026-10-01

- **Run ID**: `sim_mupfgqsp`
- **生成时间**: 2026-10-01T11:08:50.259Z
- **运行状态**: completed
- **账户数**: 100
- **交易日数**: 2300 条
- **交易笔数**: 200 笔

## 1. 整体表现

| 指标 | 数值 |
|------|------|
| 账户数 | 100 |
| 平均收益率 | -0.25% |
| 中位收益率 | -0.05% |
| 收益率标准差 | 0.92% |
| 盈利账户数 | 27 (27.00%) |
| 亏损账户数 | 57 |
| 最高收益率 | 4.75% |
| 最低收益率 | -3.83% |

## 2. 行业分布（按 INDUSTRIES）

| 行业 | 账户数 | 平均收益 | 中位收益 | 胜率 |
|------|--------|----------|----------|------|
| industrial | 8 | 0.99% | 0.51% | 87.50% |
| media | 9 | 0.17% | 0.00% | 44.44% |
| consumer | 7 | -0.01% | 0.00% | 42.86% |
| telecom | 8 | -0.14% | -0.02% | 25.00% |
| tech | 9 | -0.17% | -0.03% | 22.22% |
| energy | 11 | -0.29% | 0.00% | 27.27% |
| material | 12 | -0.36% | -0.19% | 16.67% |
| finance | 6 | -0.51% | -0.39% | 0.00% |
| pharma | 13 | -0.55% | -0.40% | 15.38% |
| auto | 10 | -0.79% | -0.28% | 10.00% |
| utility | 7 | -0.89% | -0.22% | 14.29% |

## 3. 策略分布

| 策略 | 账户数 | 平均收益 | 胜率 |
|------|--------|----------|------|
| trend_follow | 16 | 0.21% | 50.00% |
| momentum | 15 | -0.15% | 0.00% |
| ma_cross | 22 | -0.24% | 22.73% |
| breakout | 17 | -0.43% | 35.29% |
| reversal | 30 | -0.45% | 26.67% |

## 4. 资金规模分布

| 档位 | 标准 | 账户数 | 平均收益 |
|------|------|--------|----------|
| 小额 (<10万) | — | 51 | -0.25% |
| 中额 (10-50万) | — | 35 | -0.28% |
| 大额 (≥50万) | — | 14 | -0.17% |

## 5. Top 10 账户

| # | 账户名 | 行业 | 策略 | 收益率 | 收益额 |
|---|--------|------|------|--------|--------|
| 1 | 工业-trend_follow-084 | industrial | trend_follow | 4.75% | 523 元 |
| 2 | 传媒-reversal-073 | media | reversal | 1.44% | 144 元 |
| 3 | 汽车-trend_follow-030 | auto | trend_follow | 1.28% | 523 元 |
| 4 | 科技-ma_cross-029 | tech | ma_cross | 1.00% | 1124 元 |
| 5 | 工业-reversal-076 | industrial | reversal | 0.85% | 153 元 |
| 6 | 工业-ma_cross-036 | industrial | ma_cross | 0.85% | 781 元 |
| 7 | 传媒-reversal-050 | media | reversal | 0.80% | 144 元 |
| 8 | 工业-trend_follow-024 | industrial | trend_follow | 0.61% | 540 元 |
| 9 | 工业-breakout-091 | industrial | breakout | 0.42% | 553 元 |
| 10 | 工业-reversal-082 | industrial | reversal | 0.24% | 688 元 |

## 6. Bottom 10 账户

| # | 账户名 | 行业 | 策略 | 收益率 | 收益额 |
|---|--------|------|------|--------|--------|
| 1 | 公用事业-reversal-089 | utility | reversal | -3.83% | -727 元 |
| 2 | 汽车-reversal-006 | auto | reversal | -2.89% | -4127 元 |
| 3 | 汽车-breakout-004 | auto | breakout | -2.45% | -4015 元 |
| 4 | 医药-reversal-005 | pharma | reversal | -1.99% | -3805 元 |
| 5 | 汽车-breakout-003 | auto | breakout | -1.76% | -4164 元 |
| 6 | 能源-ma_cross-064 | energy | ma_cross | -1.76% | -741 元 |
| 7 | 医药-ma_cross-085 | pharma | ma_cross | -1.60% | -321 元 |
| 8 | 汽车-breakout-056 | auto | breakout | -1.47% | -3492 元 |
| 9 | 金融-reversal-061 | finance | reversal | -1.40% | -617 元 |
| 10 | 公用事业-trend_follow-009 | utility | trend_follow | -1.35% | -149 元 |

## 7. 关键洞察

- **行业分化**：最佳行业「industrial」平均收益 0.99%，最差「utility」-0.89%，差距 1.88%
- **策略对比**：策略「trend_follow」平均收益 0.21% 胜率 50.00%；「reversal」-0.45% 胜率 26.67%
- **资金规模**：小额账户平均 -0.25% vs 大额账户 -0.17%
- **极端表现**：Top1「工业-trend_follow-084」4.75%；Bottom1「公用事业-reversal-089」-3.83%

## 8. 附录

### 8.1 数据口径
- **账户收益**：基于 sim_snapshots 最新快照的 totalPnl / initialCapital
- **行业**：引用 simulation.constants.ts INDUSTRIES 定义
- **策略**：固定 5 类（ma_cross / momentum / reversal / breakout / trend_follow）
- **价格源**：history_kline 真实 K 线 close（回放模式）

### 8.2 已知限制
- K 线样本仅 16 只仿真股票，非全 A 股；不代表真实大盘
- 价格驱动基于历史 K 线 close，未引入分时/盘前盘后波动
- 策略决策仅依赖日内 changePct，未使用多日均线/真实 K 线形态
- 单次回放约 60000ms/tick × 交易日数
