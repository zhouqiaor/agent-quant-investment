/**
 * 12 个月度宏观偏置 + 4224 行 K 线生成器
 * 复用 gen-sept-kline.js 的随机游走 + 月度偏置
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..', '..')
const OUT = path.join(ROOT, 'data/year-kline.json')

// 16 只仿真股票（与 simulation.constants.STOCKS 一致）
const SYMBOLS = [
  { symbol: '600519', name: '贵州茅台', industry: 'consumer', basePrice: 1800 },
  { symbol: '601318', name: '中国平安', industry: 'finance', basePrice: 50 },
  { symbol: '600036', name: '招商银行', industry: 'finance', basePrice: 35 },
  { symbol: '000858', name: '五粮液', industry: 'consumer', basePrice: 160 },
  { symbol: '600276', name: '恒瑞医药', industry: 'healthcare', basePrice: 50 },
  { symbol: '000333', name: '美的集团', industry: 'industrial', basePrice: 60 },
  { symbol: '601012', name: '隆基绿能', industry: 'energy', basePrice: 30 },
  { symbol: '002594', name: '比亚迪', industry: 'industrial', basePrice: 240 },
  { symbol: '600900', name: '长江电力', industry: 'utility', basePrice: 22 },
  { symbol: '601398', name: '工商银行', industry: 'finance', basePrice: 5.5 },
  { symbol: '600028', name: '中国石化', industry: 'energy', basePrice: 6 },
  { symbol: '000651', name: '格力电器', industry: 'industrial', basePrice: 38 },
  { symbol: '600887', name: '伊利股份', industry: 'consumer', basePrice: 27 },
  { symbol: '601628', name: '中国人寿', industry: 'finance', basePrice: 28 },
  { symbol: '600585', name: '海螺水泥', industry: 'industrial', basePrice: 25 },
  { symbol: '688981', name: '中芯国际', industry: 'tech', basePrice: 55 },
]

// 12 个月度宏观偏置：模拟真实市场月度差异
const MONTHLY_BIAS = [
  { month: '2026-01', name: '年初杀跌', bias: -0.008, volScale: 1.3 },  // 1 月杀跌
  { month: '2026-02', name: '春节反弹', bias: +0.004, volScale: 1.1 },
  { month: '2026-03', name: '两会行情', bias: +0.012, volScale: 1.2 },  // 3 月强势
  { month: '2026-04', name: '业绩披露', bias: +0.003, volScale: 1.0 },
  { month: '2026-05', name: '红五月', bias: +0.006, volScale: 0.9 },
  { month: '2026-06', name: '震荡筑底', bias: -0.002, volScale: 0.8 },
  { month: '2026-07', name: '暑期平淡', bias: +0.001, volScale: 0.9 },
  { month: '2026-08', name: '中报行情', bias: +0.005, volScale: 1.0 },
  { month: '2026-09', name: '金九银十', bias: +0.008, volScale: 1.1 },  // 9 月旺季
  { month: '2026-10', name: '国庆后回调', bias: -0.004, volScale: 1.2 },
  { month: '2026-11', name: '年底估值切换', bias: +0.003, volScale: 0.9 },
  { month: '2026-12', name: '收官调整', bias: -0.005, volScale: 1.1 },
]

// 生成每个月的交易日（周一至周五，跳过简单节假日）
function generateTradingDays(monthStr) {
  const [y, m] = monthStr.split('-').map(Number)
  const days = []
  const daysInMonth = new Date(y, m, 0).getDate()
  // 简单节假日集合（避开）
  const holidays = new Set([`${y}-01-01`, `${y}-02-09`, `${y}-02-10`, `${y}-02-11`, `${y}-02-12`, `${y}-04-04`, `${y}-04-05`, `${y}-05-01`, `${y}-05-02`, `${y}-10-01`, `${y}-10-02`, `${y}-10-03`])
  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const date = new Date(y, m - 1, d)
    const wday = date.getDay()
    if (wday === 0 || wday === 6) continue
    if (holidays.has(dayStr)) continue
    days.push(dayStr)
  }
  return days
}

function genMonthKline(monthMeta, symbols) {
  const tradingDays = generateTradingDays(monthMeta.month)
  const rows = []
  for (const sym of symbols) {
    let lastClose = sym.basePrice
    for (const date of tradingDays) {
      // 日收益 = 月度偏置 + 个股噪声 + 跨日 walk
      const symNoise = (Math.random() - 0.5) * 0.04 * monthMeta.volScale
      const ret = monthMeta.bias + symNoise
      const open = lastClose * (1 + (Math.random() - 0.5) * 0.005)
      const close = lastClose * (1 + ret)
      const high = Math.max(open, close) * (1 + Math.random() * 0.01)
      const low = Math.min(open, close) * (1 - Math.random() * 0.01)
      const volume = Math.floor(1_000_000 + Math.random() * 50_000_000)
      rows.push({
        symbol: sym.symbol, name: sym.name,
        date, open: round(open), high: round(high),
        low: round(low), close: round(close),
        volume, amount: round(close * volume),
      })
      lastClose = close
    }
  }
  return rows
}

function round(n) { return Math.round(n * 100) / 100 }

const allRows = []
const monthlyMeta = []
for (const mm of MONTHLY_BIAS) {
  const monthRows = genMonthKline(mm, SYMBOLS)
  allRows.push(...monthRows)
  monthlyMeta.push({
    month: mm.month, name: mm.name,
    bias: mm.bias, volScale: mm.volScale,
    tradingDays: generateTradingDays(mm.month).length,
    rowCount: monthRows.length,
  })
}

const output = {
  generatedAt: new Date().toISOString(),
  totalRows: allRows.length,
  symbolCount: SYMBOLS.length,
  tradingDayCount: monthlyMeta.reduce((s, m) => s + m.tradingDays, 0),
  monthly: monthlyMeta,
  rows: allRows,
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(output))
console.log(`✅ 已生成 ${OUT}`)
console.log(`   totalRows=${output.totalRows} (${output.symbolCount} 股 × ${output.tradingDayCount} 日)`)
console.log(`   monthly: ${monthlyMeta.map((m) => `${m.month}(${m.rowCount})`).join(' ')}`)