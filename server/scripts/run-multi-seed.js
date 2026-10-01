// 多 seed × 12 月并行跑仿真
// 用法：node scripts/run-multi-seed.js [seeds=5] [accountCount=100]
// 输出：每 seed 一组 12 run，全部跑完输出 JSON 报告（含置信区间）

const SEEDS = Number(process.argv[2] ?? 5)
const ACCOUNT_COUNT = Number(process.argv[3] ?? 100)
const BASE = 'http://localhost:3000'

async function http(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(json)}`)
  return json
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function waitForRun(runId, maxMs = 600_000) {
  const t0 = Date.now()
  while (Date.now() - t0 < maxMs) {
    try {
      const r = await http('GET', `/api/simulation/runs/${runId}/status`)
      if (r?.data?.run?.status === 'completed' && !r?.data?.scheduler?.running) {
        return r.data
      }
    } catch (_) {}
    await sleep(2000)
  }
  throw new Error(`timeout waiting for ${runId}`)
}

async function runOneMonthSeed(month, seed, accountCount) {
  const name = `${month} s${seed}-${accountCount}账户`
  const replayRes = await http('POST', '/api/simulation/replay', {
    month,
    accountCount,
    replayTickMs: 800,
    name,
    seed,
  })
  const runId = replayRes?.data?.runId
  if (!runId) throw new Error(`no runId for ${name}: ${JSON.stringify(replayRes)}`)
  await waitForRun(runId)
  const sumRes = await http('GET', `/api/simulation/year-report`)
  const my = sumRes.data.summaries.find((r) => r.runId === runId)
  if (!my) throw new Error(`runId ${runId} not in year-report summaries`)
  return my
}

async function main() {
  const months = []
  for (let m = 1; m <= 12; m++) months.push(`2026-${String(m).padStart(2, '0')}`)
  console.log(`running ${SEEDS} seeds × ${months.length} months × ${ACCOUNT_COUNT} accounts = ${SEEDS * months.length} runs`)

  const results = []
  for (let s = 1; s <= SEEDS; s++) {
    const seedResults = []
    for (const m of months) {
      try {
        const r = await runOneMonthSeed(m, s, ACCOUNT_COUNT)
        seedResults.push(r)
        console.log(`seed=${s} month=${m} ret=${(r.aggregateReturn * 100).toFixed(2)}% win=${(r.winRate * 100).toFixed(0)}%`)
      } catch (e) {
        console.error(`seed=${s} month=${m} FAILED:`, e.message)
        seedResults.push({ month: m, error: e.message })
      }
    }
    results.push({ seed: s, runs: seedResults })
  }

  const flat = results.flatMap((sr) => sr.runs.filter((r) => !r.error))
  const aggregateByMonth = {}
  for (const m of months) {
    const cells = flat.filter((r) => r.month === m)
    if (!cells.length) continue
    const rets = cells.map((r) => r.aggregateReturn)
    const wrs = cells.map((r) => r.winRate)
    const mean = rets.reduce((s, v) => s + v, 0) / rets.length
    const variance = rets.reduce((s, v) => s + (v - mean) ** 2, 0) / rets.length
    const std = Math.sqrt(variance)
    aggregateByMonth = aggregateByMonth || {}
    aggregateByMonth[m] = {
      mean: Math.round(mean * 10000) / 10000,
      std: Math.round(std * 10000) / 10000,
      winRate: wrs.reduce((s, v) => s + v, 0) / wrs.length,
      n: cells.length,
      ci95Low: mean - 1.96 * std / Math.sqrt(cells.length),
      ci95High: mean + 1.96 * std / Math.sqrt(cells.length),
    }
  }

  const totalRet = flat.reduce((s, r) => s + r.aggregateReturn, 0)
  const avgWR = flat.reduce((s, r) => s + r.winRate, 0) / flat.length

  const out = {
    timestamp: new Date().toISOString(),
    seeds: SEEDS,
    accountCount: ACCOUNT_COUNT,
    totalRuns: flat.length,
    totalAggregateReturn: Math.round(totalRet * 10000) / 10000,
    avgWinRate: Math.round(avgWR * 10000) / 10000,
    byMonth: aggregateByMonth,
    seedsDetail: results,
  }
  require('fs').writeFileSync(
    require('path').resolve(__dirname, '../../docs/report/multi-seed-summary.json'),
    JSON.stringify(out, null, 2),
  )
  console.log('saved: docs/report/multi-seed-summary.json')
  console.log('total aggregate return:', (totalRet * 100).toFixed(2) + '%', 'avg win rate:', (avgWR * 100).toFixed(2) + '%')
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
})