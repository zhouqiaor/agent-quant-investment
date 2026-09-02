# SPEC：全量股票目录 + 真实K线数据

## 问题
1. **选不了 002378**：搜索仅在 24 只硬编码股票（STOCK_NAMES）中匹配；行情接口与代码校验本身支持深市，瓶颈是缺全量股票目录
2. **K线是假数据**：`getKlineData` 用 `sin+noise` 生成模拟K线，非真实历史

## 业界方案调研（最小成本选型）

| 数据源 | 覆盖 | 成本 | 实测 | 结论 |
|---|---|---|---|---|
| 新浪 `Market_Center.getHQNodeData` (node=hs_a) | 沪深A+北交所 ~5400只，含名称/现价/涨跌幅/PE/PB/市值 | 免费无Key | ✅ JSON可达 | ✅ **全量目录源** |
| 新浪 `CN_MarketDataService.getKLineData` | 真实日K（收盘价与行情吻合） | 免费 | ✅ JSONP可达 | ✅ **真实K线源** |
| 新浪 `hq.sinajs.cn` 实时行情 | 全市场（已接入） | 免费 | ✅ | 保持 |
| 东方财富 push2 clist | 全A | 免费 | ❌ 本环境不可达 | 备选 |
| tushare/akshare | 全量 | 需token/Python | - | 不符合最小成本 |

结论：**全走新浪系**（零成本、零Key、已验证可达），SQLite 缓存目录。

## 设计

### 1. 持久层：`stock_directory` 表
- 字段：symbol(PK 6位代码), name, market(sh/sz/bj), price, changePercent, pe, pb, mktcap, updatedAt
- API：`upsertDirectoryBatch(rows)` / `searchDirectory(q, limit)`（代码前缀优先+名称包含）/ `directoryCount()` / `getDirectoryMeta(symbol)` / kv 存 `directory_last_sync_at`

### 2. StockService.syncAllStocks()
- 分页拉 hs_a（num=100 × ~54页，页间 120ms 限速，失败页跳过重试1次）
- symbol 去前缀（bj/sh/sz → 6位代码），market 保留归属
- 写入目录 + 记录 lastSyncAt；24h 内已同步 → 跳过（懒刷新）
- `POST /api/stock/sync` 手动触发（force 可选）；启动时 OnModuleInit 异步预热（无网不 crash）

### 3. 搜索改造（searchStocks）
- 目录为空/过期 → 先同步（await，整体超时保护）
- 结果 = 自定义股票 ∪ 目录命中（代码前缀优先、名称包含，limit 20）∪ 静态热门兜底
- `addCustomStock` 名称解析：目录表优先 → 实时行情兜底

### 4. 代码校验放宽（isValidSymbol）
- 沪深A：`^(0|3|6)\d{5}$`（原有）
- 北交所：`^(43|83|87|88)\d{4}$`、`^920\d{3}$`
- getStockCode 增加 bj 分支（4/8/92 开头）

### 5. 真实K线（getKlineData）
- 调新浪 JSONP K线（scale=240 日K，datalen=limit），解析 `var _=([...])`
- 字段映射 day/open/high/low/close/volume → KlineData[]
- 失败返回 []（诚实数据，不回退假K线）

## 可测试性
- 单测 mock `global.fetch`（离线可跑）：同步解析/懒刷新/搜索合并/名称解析/北交所校验/K线解析
- E2E：真实网络 POST /api/stock/sync → 搜索 002378 → 加自定义 → 拉行情/日K
- 交付时 curl 公网验证
