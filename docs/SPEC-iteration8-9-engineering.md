# SPEC：第8-9轮迭代——工程诚信：红灯根治 / 字段补全 / CI 与覆盖率门禁

> 两轮主题一致：**工程诚信**。不再让长期红灯被 ignore 参数掩盖，不再让选股字段停留在
> "契约有、数据假"的状态，并把质量保障固化进 CI。
>
> - 第8轮 commit `b607ef2`：server 300 + web 107 = 407 测试全绿
> - 第9轮 commit `5cd7364`：server 309 + web 107 = 416 测试全绿

---

## 一、目标与价值

| 维度 | 之前 | 两轮后 |
|---|---|---|
| server 测试 | watchlist 6 个长期失败，靠 ignore 绕过 | 300+ 测试无需任何 ignore 参数全绿 |
| 选股字段 | 换手率/连板/量比契约在、数据不实 | 12 字段全部真实可用 |
| 质量保障 | 只靠本地自觉 | GitHub Actions 五 job 流水线，失败即红 |
| 覆盖率 | 无统计、无门禁 | server 阈值门禁 + 双端覆盖率 artifact |
| CI 可信度 | 无 | 静态预审 + 实测修参，测试真跑、套件数可见 |

---

## 二、范围界定

### In Scope

**第8轮**
- watchlist.spec 6 个长期失败根治
- `turnoverRate`：新浪目录 `turnoverratio` 落盘 `stock_directory`（含旧库 ALTER 迁移）
- `consecutiveLimitUp`：基于日K收盘序列判定连板
- GitHub Actions CI：setup / validate / test-server / test-web / build 五个 job

**第9轮**
- `volumeRatio` 量比：EOD 口径 = 最新日 volume / 前5日均量，零均量回退 undefined；
  `requiresKline` 纳入 sort.field
- 覆盖率门禁：server 阈值 lines/branches/functions/statements = 70/55/72/70；
  web 基线 5/3/5/5（只升不降）
- CI 加 `--coverage` + upload-artifact（coverage-server / coverage-web，保留 14 天）
- `collectCoverageFrom` 补全；`.gitignore` 忽略 coverage
- 修复 `test:web` 参数 bug：pnpm 透传多余 `--` 使 jest 将其当作路径 pattern，导致 0 套件

### Out of Scope

- 开启组合模式默认（仍按第7轮灰度策略）
- 提升 web 覆盖率基线到与 server 同级（当前基线很低，先建立"只升不降"机制）
- 多平台 CI（Windows/macOS matrix）、nightly / 定时构建
- 覆盖率 PR 评论、Codecov 等第三方集成

---

## 三、关键技术决策

1. **先定位红灯根因，而不是删测试**
   watchlist 6 个失败的根因是**测试 db 复用 + Windows 下文件句柄未释放**，并非 service 有 bug。
   改为每个用例使用唯一 db，并在删除前先 close 释放句柄。结论：service 无 bug，测试隔离有 bug。

2. **旧库平滑迁移**
   `turnoverRate` 落盘 `stock_directory` 时对已存在的库走 ALTER TABLE 迁移，不要求重建库。

3. **连板判定按板块分阈值**
   主板 10%、创业/科创/北交 20%、ST 5%；收盘涨幅判定容差 0.3pct，连板数封顶 5。

4. **量比用 EOD 口径而非盘中口径**
   日级数据下量比 = 最新日成交量 / 前5日均量；前5日零均量时返回 undefined（不制造伪 0）。

5. **CI 五 job 拆分 + 失败即红**
   setup 作为可复用安装节点，validate / test-server / test-web / build 各自独立，
   pnpm 缓存、并发取消（concurrency cancel-in-progress）、frozen-lockfile。

6. **覆盖率门禁双轨**
   server 已成熟，设硬阈值；web 基线低，先设极低基线锁"只升不降"，避免一上来卡死。

7. **静态预审后再信 CI**
   第9轮逐项实测 action 版本、frozen-lockfile、外网兜底、postinstall；
   并抓出 `test:web` 透传 `--` 导致 jest 0 套件的假绿灯——CI 必须证明测试真跑了。

---

## 四、测试增量

| 轮次 | 新增/修复 | 规模 |
|---|---|---|
| 第8轮 | watchlist 6 红灯根治；consecutiveLimitUp +12 用例；turnoverRate 落盘校验 | 407（server 300 + web 107） |
| 第9轮 | volumeRatio +9 测试；12 字段全真实；覆盖率门禁生效 | 416（server 309 + web 107） |

关键不是数字，而是：**全量 server 测试无需任何 ignore 参数**，且 CI 中前后端测试都真实执行。

---

## 五、遗留 / P2

- web 覆盖率基线仅 5/3/5/5，需随迭代持续抬升（门禁保证只升不降）
- 覆盖率只产 artifact，未做 PR 评论 / 趋势看板
- CI 仅 ubuntu 单平台；Windows 句柄类问题在 Linux CI 上无法复现，仍需本地注意
- 组合模式默认开启、组合再平衡/归因仍未做
- 无并发压测、无接口性能基准（benchmark）纳入 CI
