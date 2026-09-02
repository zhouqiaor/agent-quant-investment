# 第2轮迭代 SPEC：交易明细 + 持仓详情 + 首次引导

> 目标：解决"看不懂钱怎么没了"的核心焦虑，提升内测留存
> 调研参考：Freqtrade Trade Log / 券商 App 持仓页 / 东方财富流水

## 阶段1：模拟盘强标识 + 交易记录查询
- **新增字段**：PaperAccount.mode('SIMULATED' | 'LIVE' —— 内测固定 SIMULATED)
- **新增路由**：
  - `GET /api/paper-trading/trades?symbol=xxx&type=BUY|SELL&limit=N&offset=N`（分页筛选）
  - `GET /api/paper-trading/trades/:id`（单条详情）
  - `GET /api/paper-trading/summary`（汇总：成交次数/胜率/总手续费）
- **可测试性**：红=涨绿=跌 语义、分页边界、symbol/type 筛选
- **测试数**：7

## 阶段2：持仓详情 + 手动下单/平仓
- **新增接口**：
  - `GET /api/paper-trading/position/:symbol`（单只持仓详情）
  - `POST /api/paper-trading/order`（手动下单：type/symbol/price/quantity/reason）
  - `POST /api/paper-trading/close/:symbol`（一键平仓：按市价或指定价）
- **约束**：卖出不超过持仓、买入不超过现金、零股处理（浮点份额）
- **测试数**：8

## 阶段3：前端交易记录页
- 路径：`pages/trades/index`
- 列表项：股票名/方向红绿色/成交价格/数量/金额/时间/原因标签
- 顶部筛选 Tab：全部 / 买入 / 卖出
- 空状态："还没有成交记录 去开启自动交易"引导
- 参考：东方财富成交流水

## 阶段4：前端持仓详情页
- 路径：`pages/position-detail/index?symbol=600519`
- 顶部卡片：当前价/成本价/持仓市值/浮盈/收益率（红涨绿跌）
- 迷你 K 线（最近 30 个 tick 形成的迷你柱图）
- 操作区：手动买入 / 卖出 / 一键平仓
- 交易记录 Tab：该股票的历史成交
- 参考：同花顺个股持仓页

## 阶段5：首次使用引导 Tour
- 3 步蒙层引导：
  - Step1：首页资产卡片说明（总资产/实时收益）
  - Step2：TabBar 导航介绍
  - Step3：开始内测引导
- 使用 localStorage 记录是否已展示，配置完成后不再出现
- 半透明黑色蒙层 + 聚光灯 + 下一步按钮 + 跳过

## 阶段6：E2E 全链路
- 从零配置 → 开启自动交易 → tick 产生成交 → 查交易列表 → 查持仓详情 → 手动平仓 → 收益归零
- 测试数：6

## 阶段7：验证部署
- pnpm validate + pnpm build + 公网验证 + git 上库
