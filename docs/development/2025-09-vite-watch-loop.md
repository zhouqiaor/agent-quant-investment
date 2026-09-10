# Vite 监听 SQLite WAL 引发页面循环刷新 - 修复记录

**日期**：2025-09-10
**影响**：H5 端预览体验，UI 端无法稳定操作
**严重度**：P0（直接阻塞用户交互）

## 现象

用户在 H5 预览界面操作时，每 1-3 秒页面就自动重新加载一次，无法持续浏览、填写表单、查看图表。

## 根因分析

### Vite 监听链路

Vite 在 H5 dev 模式下默认会监听整个项目目录（除 `node_modules` / `.git` 外）。当任何被监听文件发生变化，Vite 就会触发 HMR 或整页 reload。

### SQLite WAL 写入链路

后端使用 better-sqlite3，默认开启 WAL（Write-Ahead Log）模式。每次写入数据库会产生三类文件变化：

1. `quant.db`：主数据库文件
2. `quant.db-shm`：共享内存索引
3. `quant.db-wal`：预写日志（**高频写入**）

后端服务高频写入场景：

| 服务 | 频率 | 写入内容 |
|------|------|----------|
| `MarketPollingService` | 每 6 秒 | 行情快照 → `market_data` 表 |
| `LivePnlService` | 每 6 秒 | 实时盈亏计算 → `paper_trading_positions` 表 |
| `LivePnlService` tick | 每 1-2 秒 | 标记持仓、信号评估、执行追踪 |
| `PersistenceService` | 异步队列 | 订单/交易/账户变更持久化 |

### 因果链证据

修复前的 dev.log 紧密循环：

```
[server] MarketService Fetched 14 stocks from Sina Finance
[web]    [vite] page reload /workspace/projects/server/data/quant.db-wal
[server] LivePnlService tick: marked=46 signals=0 executed=0
[web]    [vite] page reload /workspace/projects/server/data/quant.db-wal
```

几乎每 1-3 秒一次 vite reload。

## 修复方案

修改 `config/index.ts` 中 H5 devServer 的 watch.ignored 配置，让 Vite 显式排除后端动态写入目录：

```typescript
devServer: {
  port: 5000,
  host: '0.0.0.0',
  // ...
  watch: {
    ignored: [
      '**/server/data/**',
      '**/*.db',
      '**/*.db-shm',
      '**/*.db-wal',
      '**/dist/**',
      '**/dist-*/**',
      '**/.cozeproj/**',
    ],
  },
},
```

### 排除规则说明

| 模式 | 排除原因 |
|------|----------|
| `**/server/data/**` | SQLite 数据库 + WAL 文件（**根因**） |
| `**/*.db*` | 任何 .db / .db-shm / .db-wal 变种文件 |
| `**/dist/**` | 构建产物（每次重建会变） |
| `**/dist-*/**` | 微信/抖音/H5 平台构建产物 |
| `**/.cozeproj/**` | Coze 平台元数据目录 |

## 验证结果

| 指标 | 修复前 | 修复后 |
|------|--------|--------|
| 30 秒内 vite reload 次数 | ~15 次 | **0 次** |
| 数据库写入 | 正常 | 正常（WAL 持续在写） |
| MarketPollingService | 正常 | 正常 |
| LivePnlService tick | 正常 | 正常 |
| HMR 业务代码更新 | 正常 | 正常 |

## 配置类修改的注意事项

根据 Coze 开发规范，**`vite.config.ts` / `config/index.ts` 等配置文件修改后必须手动重启 dev 服务**，热更新不会自动加载：

```bash
cd /workspace/projects && coze dev
```

## 预防建议

1. **新项目初始化时**就把 `server/data/` 加入 `.gitignore`（已配置）和 Vite `watch.ignored`
2. **任何涉及文件持久化的功能**（数据库、缓存、日志）都应在开发初期就考虑是否会影响 HMR
3. **文档化**：本类问题极易反复出现，沉淀到 `docs/development/` 目录便于检索

## 相关参考

- [Vite server.watch.ignored 文档](https://vitejs.dev/config/server-options.html#server-watch)
- [better-sqlite3 WAL 模式说明](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/performance.md)
- 项目根目录 `.gitignore` 已包含 `server/data/` 排除