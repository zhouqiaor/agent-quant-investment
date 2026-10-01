/**
 * 一键脚本：9 月仿真回放 + Markdown 报告
 * 流程：
 *   1. 检查 data/sept-kline.json 存在
 *   2. POST /api/stock/kline/import 导入 K 线
 *   3. POST /api/simulation/replay 启动回放
 *   4. 轮询 GET /api/simulation/runs/:id/status，等到 running=false
 *   5. GET /api/simulation/runs/:id/report.md 拉取 Markdown
 *   6. 写到 docs/report/simulation-sept-replay-YYYYMMDD.md
 *
 * 用法：
 *   node server/scripts/run-sept-replay.js
 *   node server/scripts/run-sept-replay.js --account-count 100 --replay-tick-ms 30000
 */
const http = require('http')
const fs = require('fs')
const path = require('path')

const BASE = process.env.API_BASE ?? 'http://localhost:3000'
const ROOT = path.resolve(__dirname, '..', '..')

function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath, BASE)
    const opts = {
      hostname: u.hostname, port: u.port,
      path: u.pathname + u.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    }
    const req = http.request(opts, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf-8')
        resolve({ status: res.statusCode, body: text })
      })
    })
    req.on('error', reject)
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

async function json(method, urlPath, body) {
  const r = await request(method, urlPath, body)
  if (r.status !== 200) {
    throw new Error(`${method} ${urlPath} HTTP ${r.status}: ${r.body.slice(0, 200)}`)
  }
  return JSON.parse(r.body)
}

function parseArgs() {
  const argv = process.argv.slice(2)
  const out = { accountCount: 100, replayTickMs: 30_000, month: '2026-09' }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--account-count') out.accountCount = parseInt(argv[++i], 10)
    else if (argv[i] === '--replay-tick-ms') out.replayTickMs = parseInt(argv[++i], 10)
    else if (argv[i] === '--month') out.month = argv[++i]
    else if (argv[i] === '--api-base') out.apiBase = argv[++i]
  }
  return out
}

async function main() {
  const opts = parseArgs()
  if (opts.apiBase) process.env.API_BASE = opts.apiBase

  console.log(`\n[1/5] 检查 K 线数据...`)
  const klineFile = path.join(ROOT, 'data/sept-kline.json')
  if (!fs.existsSync(klineFile)) {
    console.error(`❌ K 线文件不存在: ${klineFile}`)
    console.error(`   请先运行: node server/scripts/gen-sept-kline.js`)
    process.exit(1)
  }
  const klineMeta = JSON.parse(fs.readFileSync(klineFile, 'utf-8'))
  console.log(`   ✅ K 线文件就绪: ${klineMeta.totalRows} 行 (${klineMeta.tradingDayCount} 日 × ${klineMeta.symbolCount} 股)`)

  console.log(`\n[2/5] 导入 K 线 → history_kline ...`)
  const importRes = await json('POST', '/api/stock/kline/import', {})
  const d = importRes.data
  console.log(`   ✅ total=${d.totalRows} inserted=${d.inserted} skipped=${d.skipped} errors=${d.errors.length}`)

  console.log(`\n[3/5] 启动 ${opts.month} 回放 run（${opts.accountCount} 账户，tick=${opts.replayTickMs}ms）...`)
  const replayRes = await json('POST', '/api/simulation/replay', {
    month: opts.month,
    accountCount: opts.accountCount,
    replayTickMs: opts.replayTickMs,
    name: `100账户仿真-9月回放-${new Date().toISOString().slice(0, 10)}`,
  })
  const runId = replayRes.data.runId
  const tradingDays = replayRes.data.tradingDays
  const totalEstimateMs = tradingDays * opts.replayTickMs
  console.log(`   ✅ runId=${runId} tradingDays=${tradingDays} estimated=${(totalEstimateMs / 1000).toFixed(0)}s`)

  console.log(`\n[4/5] 轮询 status（预计 ${(totalEstimateMs / 1000 / 60).toFixed(1)} 分钟）...`)
  let elapsed = 0
  const pollEvery = 5_000
  const timeoutMs = totalEstimateMs + 60_000
  while (elapsed < timeoutMs) {
    await new Promise((r) => setTimeout(r, pollEvery))
    elapsed += pollEvery
    const status = await json('GET', `/api/simulation/runs/${runId}/status`)
    const s = status.data.scheduler
    const dl = status.data.run
    if (!s.running) {
      console.log(`   ✅ 回放完成！dayIndex=${s.dayIndex ?? '-'}/${s.totalDays ?? '-'} virtualDate=${s.virtualDate ?? '-'}`)
      console.log(`   run status=${dl?.status ?? '-'} finishedAt=${dl?.finishedAt ? new Date(dl.finishedAt).toISOString() : '-'}`)
      break
    }
    if (elapsed % 30_000 < pollEvery) {
      console.log(`   ⏳ 进度: dayIndex=${s.dayIndex}/${s.totalDays} virtualDate=${s.virtualDate} elapsed=${(elapsed / 1000).toFixed(0)}s`)
    }
  }
  if (elapsed >= timeoutMs) {
    console.warn(`   ⚠️  超时 ${(timeoutMs / 1000).toFixed(0)}s 仍未结束，先取部分快照出报告`)
  }

  console.log(`\n[5/5] 拉取 Markdown 报告...`)
  const mdRes = await request('GET', `/api/simulation/runs/${runId}/report.md`)
  if (mdRes.status !== 200) {
    throw new Error(`GET report.md HTTP ${mdRes.status}: ${mdRes.body.slice(0, 200)}`)
  }
  const outDir = path.join(ROOT, 'docs/report')
  fs.mkdirSync(outDir, { recursive: true })
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const outFile = path.join(outDir, `simulation-sept-replay-${dateStr}.md`)
  fs.writeFileSync(outFile, mdRes.body)
  console.log(`   ✅ 报告已写入: ${outFile}`)
  console.log(`   字节数: ${mdRes.body.length}`)

  console.log(`\n========================================`)
  console.log(`✅ 全部流程完成`)
  console.log(`   runId=${runId}`)
  console.log(`   report=${outFile}`)
  console.log(`========================================\n`)
}

main().catch((err) => {
  console.error(`❌ 失败:`, err.message)
  process.exit(1)
})