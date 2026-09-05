# SPEC：全局组合回测（方案B 共享资金池账户回放）

## 背景

当前回测引擎存在两个核心问题：
1. **假数据**：`generateHistoricalKline` 用伪随机游走生成价格，与真实行情无关
2. **单标的**：只支持单只股票回测，无法模拟"整个软件配置"的全局表现

用户诉求：回测需要是**全局整个软件数据回测**——覆盖关注列表全部股票 + 各自策略 + 共享资金池，用真实历史行情回放。

## 方案选型

**方案B：共享资金池账户回放**

- 复用现有模拟盘引擎（`PaperTradingService` + `StrategyService.checkMonitorSignals`）
- 用真实历史K线（新浪日K）替代实时行情
- 共享资金池：所有标的竞争同一笔初始资金，按信号下单（含加仓/减仓/清仓）
- 输出：账户级净值曲线 + 交易明细 + 指标

## 核心设计

### 1. 数据源

- **历史K线**：`StockService.getKlineData(symbol, 'daily', limit)` → 真实新浪日K
- **日期范围**：用户输入 startDate/endDate，回测引擎按交易日迭代
- **changePercent**：逐日计算（当日close vs 前日close）

### 2. 回放引擎

新增 `PortfolioBacktestService.runPortfolioBacktest(params)`：

```ts
params: {
  initialCapital: number;
  symbols: string[];          // 关注列表（enabled）
  strategyIds: string[];      // 各股票绑定的策略
  startDate: string;          // YYYY-MM-DD
  endDate: string;
  autoTrade: boolean;
}
```

流程：
1. 为每个 symbol 拉取真实日K（date range）
2. 构建日期索引的价格矩阵 `{ date: { symbol: { price, changePercent } } }`
3. 创建隔离账户：`paperTrading.resetAccount('backtest_<ts>', initialCapital)` + `startTrading`
4. 逐日回放：
   - `markPrices(prices)` → 持仓重估
   - `checkMonitorSignals(marketData)` → 信号
   - 对每个信号 `executeSignal(signal, accountId)` → 下单
   - 记录当日 equity point `{ date, value: account.totalValue }`
5. 计算指标（复用现有 metrics 逻辑）
6. 清理隔离账户

### 3. 关键复用

- `PaperTradingService`：账户模型（cash/positions/trades）、executeBuy/executeSell（80%资金、100股整数倍、加权成本、部分卖出）
- `StrategyService.checkMonitorSignals`：确定性信号求值（价格阈值 + 涨跌幅兜底）
- `StockService.getKlineData`：真实日K

### 4. 隔离性

- 使用独立 accountId（如 `backtest_<timestamp>`），不污染 live 'default' 账户
- 跳过 `LivePnlService` 的 debounce/notification（直接调用 `PaperTradingService`）

### 5. 输出

```ts
{
  equityCurve: Array<{ date: string; value: number }>;
  trades: PaperTrade[];
  metrics: {
    totalReturn: number;
    annualizedReturn: number;
    maxDrawdown: number;
    sharpeRatio: number;
    winRate: number;
    profitFactor: number;
    tradeCount: number;
  };
  meta: {
    realKline: true;
    dataSource: '新浪财经日K';
    symbols: string[];
    dateRange: { start: string; end: string };
  };
}
```

## 实施步骤

1. **TDD：历史K线批量拉取**（6 项测试）
   - 多 symbol 并行拉取
   - 日期范围过滤
   - changePercent 计算
   - 缺失数据兜底

2. **TDD：回放引擎**（8 项测试）
   - 隔离账户创建/清理
   - 逐日回放流程
   - 信号触发 → 下单
   - 共享资金池竞争
   - 净值曲线记录

3. **TDD：指标计算**（5 项测试）
   - 复用现有 metrics 逻辑
   - 验证 totalReturn/annualized/maxDrawdown/sharpe/winRate

4. **接口暴露**
   - `POST /api/backtest/portfolio` → 全局组合回测
   - 响应包含 equityCurve + trades + metrics + meta

5. **前端接入**
   - 回测页调用新接口
   - 展示"真实历史行情"徽标
   - 数据不足失败态

6. **全量回归 + 部署上库**

## 验收标准

- [ ] 回测覆盖关注列表全部股票（非单标的）
- [ ] 使用真实历史K线（新浪日K）
- [ ] 共享资金池：多标的竞争下单
- [ ] 输出账户级净值曲线
- [ ] 全量测试通过
- [ ] 公网部署验证
