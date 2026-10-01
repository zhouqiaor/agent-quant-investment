#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs')
const path = require('path')
const http = require('http')

const ROOT = path.resolve(__dirname, '..', '..')
const BASE = process.env.SIM_BASE || 'http://localhost:3000'
const RULES_PATH = path.join(ROOT, 'data', 'tuning-rules.json')

const months = [
  '2026-01', '2026-02', '2026-03', '2026-04',
  '2026-05', '2026-06', '2026-07', '2026-08',
  '2026-09', '2026-10', '2026-11', '2026-12',
]

function post(url, body) {
  const u = new URL(BASE + url)
  const data = Buffer.from(JSON.stringify(body))
  return new Promise((resolve, reject) => {
    const req = http.request({
      method: 'POST',
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    }, (res) => {
      let chunks = ''
      res.on('data', (c) => (chunks += c))
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(chunks) })
        } catch (e) {
          resolve({ status: res.statusCode, body: chunks })
        }
      })
    })
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

function get(url) {
  const u = new URL(BASE + url)
  return new Promise((resolve, reject) => {
    const req = http.request({
      method: 'GET',
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
    }, (res) => {
      let chunks = ''
      res.on('data', (c) => (chunks += c))
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(chunks) })
        } catch (e) {
          resolve({ status: res.statusCode, body: chunks })
        }
      })
    })
    req.on('error', reject)
    req.end()
  })
}

async function waitForRun(runId, maxMs = 600000) {
  const t0 = Date.now()
  while (Date.now() - t0 < maxMs) {
    const r = await get(`/api/simulation/runs/${runId}/status`)
    if (r.status === 200 && r.body) {
      const status = r.body?.data?.run?.status
      if (status === 'completed' || status === 'stopped' || status === 'failed') {
        // 取 snapshot 数据计算总览
        const agg = await get(`/api/simulation/runs/${runId}/accounts`)
        const accs = agg.body?.data ?? []
        const totals = accs.reduce(
          (s, a) => {
            const pnlRate = a.totalReturn ?? a.total_pnl_rate ?? 0
            s.sum += pnlRate
            if (pnlRate > 0) s.wins += 1
            return s
          },
          { sum: 0, wins: 0 },
        )
        return {
          totalAccounts: accs.length,
          aggregateReturn: accs.length ? totals.sum / accs.length : 0,
          winRate: accs.length ? totals.wins / accs.length : 0,
        }
      }
    }
    await new Promise((res) => setTimeout(res, 3000))
  }
  throw new Error(`run ${runId} timeout`)
}

function pluckRunId(body) {
  return body?.data?.runId ?? body?.runId
}
function pluckData(body) {
  return body?.data ?? body
}

async function main() {
  const rules = JSON.parse(fs.readFileSync(RULES_PATH, 'utf8'))
  const defaultWeights = rules.weightAdjustments
  let industryWeights = Object.fromEntries(rules.industries.map((i) => [i, 1]))
  let strategyWeights = Object.fromEntries(rules.strategies.map((s) => [s, 1]))

  const summary = []

  for (let i = 0; i < months.length; i++) {
    const month = months[i]
    console.log(`\n=== ${month} (iter ${i + 1}/${months.length}) ===`)
    const isLast = i === months.length - 1
    const start = Date.now()

    const body = {
      month,
      accountCount: isLast ? 200 : 100,
      replayTickMs: isLast ? 3000 : 1500,
      name: `${month} 月-100账户`,
      industryWeights,
      strategyWeights,
    }
    const replayRes = await post('/api/simulation/replay', body)
    if (replayRes.status !== 201 && replayRes.status !== 200) {
      console.error('replay create failed:', replayRes)
      throw new Error('replay create failed')
    }
    const runId = pluckRunId(replayRes.body)
    console.log(`run ${runId} created, wait for completion...`)
    const done = await waitForRun(runId)
    const durMs = Date.now() - start

    const monthRow = {
      month,
      runId,
      durationMs: durMs,
      totalAccounts: done.totalAccounts,
      aggregateReturn: done.aggregateReturn,
      winRate: done.winRate,
      industryWeights: { ...industryWeights },
      strategyWeights: { ...strategyWeights },
    }
    summary.push(monthRow)

    if (isLast) break

    const tuneRes = await post('/api/simulation/strategy-tune', { runId })
    if (tuneRes.status !== 201 && tuneRes.status !== 200) {
      console.error('tune failed:', tuneRes)
      throw new Error('tune failed')
    }
    const tuneData = pluckData(tuneRes.body)
    industryWeights = tuneData.industryWeights
    strategyWeights = tuneData.strategyWeights
    console.log('tuned:',
      'industry top3 =',
      Object.entries(industryWeights).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>`${k}:${v.toFixed(2)}`).join(','),
      'strategy top2 =',
      Object.entries(strategyWeights).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([k,v])=>`${k}:${v.toFixed(2)}`).join(','),
    )
  }

  const outDir = path.join(ROOT, 'docs', 'report')
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, 'year-iter-summary.json')
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2))
  console.log(`\nsummary saved to ${outPath}`)

  const agg = await get('/api/simulation/year-report')
  if (agg.status === 200) {
    const mdPath = path.join(outDir, 'simulation-year-iter-2026.md')
    fs.writeFileSync(mdPath, agg.body.markdown)
    console.log(`year report saved to ${mdPath}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})