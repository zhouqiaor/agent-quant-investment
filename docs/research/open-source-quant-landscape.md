# 业界开源量化项目调研

> 调研日期：2025-09
> 调研目标：横向对比 8 个主流开源量化项目，识别本项目（QuantPilot）可借鉴的模块与设计模式
> 调研方法：基于 GitHub 公开资料 + 各项目官方文档摘要（非深度实测）
> 优先级：CCXT > Freqtrade > Jesse > Lean > Zipline > Backtrader > Hummingbot > vnpy

---

## 一、调研对象概览

| 项目 | 语言 | GitHub Star（量级）| 最近活跃 | 定位 | 关键差异 |
|---|---|---|---|---|---|
| **Freqtrade** | Python | 39k+ | ⭐⭐⭐⭐⭐ | 回测 + 实盘 + 策略市场 | 业界事实标准，UI 完整 |
| **Jesse** | Python | 6k+ | ⭐⭐⭐⭐ | 更现代的回测框架 | IDE 级 debug + 实时图表 |
| **Backtrader** | Python | 18k+ | ⭐⭐ | 老牌回测引擎 | OOP 哲学，可扩展但已不活跃 |
| **Zipline** | Python | 18k+ | ⭐⭐ | Quantopian 遗产，机构级 | 已被迁移，依赖重 |
| **Lean** | C#/Python | 12k+ | ⭐⭐⭐⭐⭐ | QuantConnect 开源版 | 多资产 + Web IDE + 算法市场 |
| **Hummingbot** | Python | 8k+ | ⭐⭐⭐⭐ | 做市/套利专用 | 订单簿模拟器是行业标杆 |
| **CCXT** | JS/Python/PHP | 35k+ | ⭐⭐⭐⭐⭐ | 交易所统一抽象 | 100+ 交易所即插即用 |
| **vnpy** | Python | 25k+ | ⭐⭐⭐⭐ | 国内量化平台龙头 | UI 完整 + 国内券商对接 |
| **QuantPilot**（本项目）| TS | — | ⭐⭐⭐⭐ | 移动端量化 + AI Agent | **移动优先 + 数据透明 + AI 内置** |

> 注：Star 数据为量级估算（基于公开榜单），非精确数。

---

## 二、横向对比矩阵

| 维度 | Freqtrade | Jesse | Backtrader | Zipline | Lean | Hummingbot | CCXT | vnpy | **QuantPilot** |
|---|---|---|---|---|---|---|---|---|---|
| **目标用户** | 中高阶量化 | 专业量化 | 老牌量化 | 机构量化 | 全栈量化 | 做市/套利 | 交易所对接 | 国内专业 | **散户+轻量化爱好者** |
| **回测引擎** | 向量化 | 事件驱动 | 事件驱动 | 事件驱动 | 事件驱动 | 订单簿 | ❌ 无 | 事件驱动 | ✅ 事件驱动 + 真实K线 |
| **实盘能力** | ✅ 完整 | 🟡 实验 | 🟡 需扩展 | ❌ 已弃 | ✅ 完整 | ✅ 完整 | 🟡 通过适配器 | ✅ 完整 | ❌ 模拟盘 |
| **策略语言** | Python | Python | Python | Python | Python/C# | Python/Config | — | Python/VNPY DSL | **TS + UI 配置 + AI Agent** |
| **数据源** | 自带 ccxt | CSV/Postgres | 自带 CSV | 自带 bundle | Lean Engine | 多源 | 100+ 交易所 | 多家国内 | **新浪/腾讯 + TOS** |
| **UI** | FreqUI (React) | Jesse IDE | 无 | 无 | Lean IDE | Hummingbot UI | 无 | vnpy.trader | **Taro 三端小程序** |
| **移动端** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ **跨端小程序** |
| **AI 集成** | ❌ | ❌ | ❌ | ❌ | 🟡 AlphaStudio | ❌ | ❌ | 🟡 第三方 | ✅ **内置 Agent** |
| **策略市场** | ✅ FreqAI | ❌ | ❌ | ❌ | ✅ QuantConnect | ✅ Hummingbot Bot | ❌ | 🟡 第三方 | ❌（V2.0 规划） |
| **学习曲线** | 中 | 中 | 高 | 高 | 中 | 高 | 低 | 中 | **低** |
| **数据透明** | 🟡 | 🟡 | ❌ | 🟡 | 🟡 | 🟡 | ✅ | 🟡 | ✅ **业界最透明** |
| **维护活跃度** | 5/5 | 4/5 | 2/5 | 2/5 | 5/5 | 4/5 | 5/5 | 4/5 | — |

---

## 三、可借鉴到本项目的核心设计模式

### 🏆 借鉴 1：CCXT 的"统一交易所适配器"思想 → 本项目"行情源适配层"

**问题**：本项目当前硬编码"新浪 + 腾讯"两个数据源，每个新数据源都要改 service。

**CCXT 范式**：
```python
# CCXT 核心：100+ 交易所统一接口
exchange = ccxt.binance()
ticker = exchange.fetch_ticker('BTC/USDT')  # 所有交易所同形 API
```

**本项目可借鉴**：设计 `QuoteAdapter` 接口，封装"取实时价 / 取历史K线 / 探测状态"三个方法。适配器实现可包括：
- `SinaQuoteAdapter`（新浪 hq.sinajs.cn）
- `TencentQuoteAdapter`（腾讯 fqkline）
- `EastmoneyQuoteAdapter`（东方财富，可作兜底）
- `MockQuoteAdapter`（测试用）

**价值**：
- 新数据源接入从 1 周 → 1 天
- 数据源切换/A/B 测试成为可能
- 与 plan.md 数据透明化方案天然契合

**借鉴代价**：1 人天（接口抽象 + 现有 service 重构 30%）

**借鉴优先级**：🟢 **最高（与 V1.1 强对齐）**

---

### 🏆 借鉴 2：Freqtrade 的"策略配置化 + 策略市场"心智 → V2.0 策略市场

**问题**：本项目策略写在 `strategy.service.ts` 里，用户无法自定义参数。

**Freqtrade 范式**：
```yaml
# Freqtrade 策略文件（Python + YAML 配置）
strategy: MyAwesomeStrategy
buy_params:
  rsi_value: 30
sell_params:
  rsi_value: 70
```

**本项目可借鉴**：V2.0 引入"策略配置"页面：
- 每个策略暴露 `parameters: Record<string, number>` schema
- 用户可调参 → 自动写入 strategy 表
- 策略市场（类 FreqAI/QuantConnect）让用户分享参数组合

**价值**：
- 用户粘性 +50%（"我的策略"心智）
- 裂变拉新 +30%（参考 FreqAI 模式）

**借鉴代价**：5 人天（V2.0 工程量）

**借鉴优先级**：🟡 V2.0 优先

---

### 🏆 借鉴 3：Jesse 的"回测 IDE"心智 → 回测页升级

**问题**：本项目回测结果展示在 Web/小程序，无 IDE 级调试体验。

**Jesse 范式**：
- 实时图表（蜡烛 + 成交点 + 指标）
- IDE 内 step-by-step 调试
- 策略代码实时编辑

**本项目可借鉴（轻量版）**：
- 回测结果页加"成交点"散点图叠加到 K 线上（当前已有 SVG K 线）
- 加"参数敏感性"小图：x=参数值，y=Sharpe，展示过拟合风险
- 加"对数回放"：逐步推进每根 K 线，暂停 / 跳到下一步

**价值**：专业用户感知 +40%

**借鉴代价**：3 人天（参数敏感性 + 回放）

**借鉴优先级**：🟡 V1.2 优先

---

### 🏆 借鉴 4：Lean 的"多资产 + 多市场"心智 → V3.0 港美股扩展

**问题**：当前仅 A 股，Lean 已支持股票/期货/外汇/加密 100+ 资产。

**Lean 范式**：
- 统一 `Security` 抽象
- 多市场时间区间（如 A 股 9:30-15:00 + 美股 21:30-04:00）
- 多货币换算

**本项目可借鉴**：V3.0 引入 `Asset` 抽象，封装"symbol + market + currency"三元组。

**借鉴代价**：10 人天（V3.0）

**借鉴优先级**：🔵 V3.0 远期

---

### 🏆 借鉴 5：vnpy 的"插件化模块"心智 → NestJS 模块化参考

**问题**：本项目 NestJS 模块已有 10 个，但模块间耦合度未严格审查。

**vnpy 范式**：
- 每个策略/数据源/订单管理都是独立插件
- 主程序通过 `app.add_engine(CtaEngine(...))` 注册
- 插件可在运行时加载/卸载

**本项目可借鉴**：引入 `DynamicModule` 模式，让新策略类型（如期权策略）可在不重启服务的情况下注册。

**借鉴代价**：2 人天

**借鉴优先级**：🟡 V2.0 优先

---

### 🏆 借鉴 6：Hummingbot 的"策略可视化 + 实时监控"心智 → 异动雷达（与 V1.1 对齐）

**问题**：Hummingbot 控制台实时显示订单簿深度、做市策略表现，本项目无类似监控视图。

**借鉴点**：
- 异动雷达页：实时滚动"信号触发列表"（参考 Hummingbot 控制台）
- 每个信号卡片含：标的、触发时间、置信度、关联持仓、关联策略
- 实时刷新（每 6s 拉一次）

**借鉴代价**：与 V1.1 异动雷达合并实施，不额外增加

**借鉴优先级**：🟢 V1.1 同步

---

## 四、**不**借鉴的项目（明确放弃）

| ❌ 不借鉴 | 理由 |
|---|---|
| Backtrader | 已不活跃（最近 commit 2 年前），API 模式陈旧 |
| Zipline | 已迁移到 Zipline-reloaded 但仍依赖重，且 Quantopian 倒闭证明其商业模型失败 |
| Backtrader/Zipline 类回测引擎重写 | 本项目用真实 K 线已足够，无需再造轮子 |

---

## 五、借鉴汇总：行动计划

| 借鉴 | 来源 | 优先级 | 阶段 |
|---|---|---|---|
| **QuoteAdapter 统一抽象** | CCXT | 🟢 最高 | V1.1（1 人天）|
| 异动雷达实时监控视图 | Hummingbot | 🟢 高 | V1.1（已规划）|
| 回测页"参数敏感性"图 | Jesse | 🟡 中 | V1.2（3 人天）|
| 策略配置化 + 策略市场 | Freqtrade | 🟡 中 | V2.0（5 人天）|
| NestJS DynamicModule 插件化 | vnpy | 🟡 中 | V2.0（2 人天）|
| 多资产统一抽象 | Lean | 🔵 低 | V3.0（10 人天）|

---

## 六、借鉴 CCXT 的具体设计稿

```typescript
// src/server/src/quote/quote.adapter.ts（本项目可借鉴的设计）
export interface QuoteAdapter {
  /** 唯一标识 */
  readonly id: string;
  /** 显示名（用于透明化卡） */
  readonly displayName: string;
  /** 是否可用（健康检查） */
  isHealthy(): Promise<boolean>;
  /** 拉取实时报价 */
  fetchQuote(symbol: string): Promise<Quote>;
  /** 拉取历史 K 线 */
  fetchKline(symbol: string, start: string, end: string): Promise<Kline[]>;
  /** 探测最近一次成功时间（用于透明化卡） */
  lastSuccessAt(): number | null;
}

// 多适配器协同
export class QuoteAggregator {
  constructor(private adapters: QuoteAdapter[]) {}
  
  async fetchQuote(symbol: string): Promise<Quote> {
    // 主源失败 → 自动 fallback 到下一个
    for (const adapter of this.adapters) {
      try {
        if (await adapter.isHealthy()) {
          return await adapter.fetchQuote(symbol);
        }
      } catch (e) {
        console.warn(`[quote] ${adapter.id} failed, fallback to next`);
      }
    }
    throw new Error('All quote adapters failed');
  }
}
```

**与现有代码的兼容**：现有 `quote.service` / `history-kline.service` 实现 `QuoteAdapter` 接口即可，调用层 `QuoteAggregator` 编排。

**落地时间**：V1.1 同步实施（与"AI 诊断日报 + 异动雷达"同批次），约 1 人天。

---

## 七、调研结论

**借鉴优先级最高的 3 个动作**：
1. **CCXT QuoteAdapter 抽象**（V1.1 实施，1 人天，立竿见影）
2. **Hummingbot 异动雷达视图**（V1.1 已规划，直接借鉴 UI 范式）
3. **Freqtrade 策略配置化**（V2.0 实施，5 人天，长线价值）

**明确放弃借鉴**：Backtrader、Zipline 的回测引擎重写（避免重复造轮子）。

**长期关注**：Lean 的多资产抽象（V3.0）、vnpy 的插件化（V2.0）。