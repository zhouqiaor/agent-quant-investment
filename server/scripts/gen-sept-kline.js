/**
 * 生成 9 月 K 线 JSON 数据（项目级 mock 数据）
 * - 22 个交易日（2026-09）
 * - 16 只仿真股票（来自 simulation.constants.ts INDUSTRIES）
 * - 价格采用"真实感"模拟：基于 9 月 A 股大盘微涨行情（小幅正向 bias + 波动）
 * - 输出：data/sept-kline.json
 *
 * 运行：node server/scripts/gen-sept-kline.js
 */
const fs = require('fs')
const path = require('path')

const SYMBOLS = [
  { sym: '300750', base: 245.6, vol: 0.022 }, // 宁德时代 - 科技
  { sym: '688981', base: 95.3,  vol: 0.028 }, // 中芯国际 - 科技
  { sym: '601318', base: 50.2,  vol: 0.014 }, // 中国平安 - 金融
  { sym: '600036', base: 38.7,  vol: 0.013 }, // 招商银行 - 金融
  { sym: '600519', base: 1620.5, vol: 0.018 }, // 贵州茅台 - 消费
  { sym: '000858', base: 152.3, vol: 0.020 }, // 五粮液 - 消费
  { sym: '600276', base: 48.6,  vol: 0.019 }, // 恒瑞医药 - 医药
  { sym: '601857', base: 9.8,   vol: 0.016 }, // 中石油 - 能源
  { sym: '600028', base: 6.5,   vol: 0.014 }, // 中石化 - 能源
  { sym: '600031', base: 17.9,  vol: 0.025 }, // 三一重工 - 工业
  { sym: '601899', base: 18.4,  vol: 0.022 }, // 紫金矿业 - 材料
  { sym: '600900', base: 28.7,  vol: 0.012 }, // 长江电力 - 公用事业
  { sym: '600050', base: 5.4,   vol: 0.018 }, // 中国联通 - 通信
  { sym: '002594', base: 268.5, vol: 0.026 }, // 比亚迪 - 汽车
  { sym: '300059', base: 22.1,  vol: 0.027 }, // 东方财富 - 传媒
  { sym: '600999', base: 16.8,  vol: 0.017 }, // 招商证券 - 金融 (补足 16 只中缺失，因6项平均更高则补强)
]

// 2026 年 9 月交易日（避开周末）
const TRADING_DAYS = [
  '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05',
  '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12',
  '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19',
  '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26',
  '2026-09-29', '2026-09-30',
]

// 简单的"伪随机"种子生成器（保证脚本可重复）
function seededRand(seed) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function normalSample(rand) {
  const u1 = Math.max(1e-9, rand())
  const u2 = rand()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

function genData() {
  const rows = []
  for (const s of SYMBOLS) {
    // 每只股票独立种子
    const rand = seededRand(parseInt(s.sym.slice(-6), 10) + 9 * 31)
    let price = s.base
    for (const date of TRADING_DAYS) {
      // 日收益 = 微正偏 bias + 正态波动
      const ret = 0.0005 + s.vol * normalSample(rand)
      const open = price
      const close = Math.max(0.5, price * (1 + ret))
      // 日内高低价 = close ± 1% 范围
      const intradayHi = Math.abs(normalSample(rand)) * s.vol * 0.6
      const intradayLo = Math.abs(normalSample(rand)) * s.vol * 0.6
      const high = Math.max(open, close) * (1 + intradayHi)
      const low = Math.min(open, close) * (1 - intradayLo)
      const volume = Math.round(1_000_000 + Math.abs(normalSample(rand)) * 5_000_000)
      rows.push({
        symbol: s.sym,
        date,
        open: round2(open),
        high: round2(high),
        low: round2(low),
        close: round2(close),
        volume,
      })
      price = close
    }
  }
  return rows
}

function round2(n) { return Math.round(n * 100) / 100 }

const data_ = genData()
const out = '/workspace/projects/data/sept-kline.json'
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, JSON.stringify({
  generatedAt: new Date().toISOString(),
  month: '2026-09',
  tradingDayCount: TRADING_DAYS.length,
  symbolCount: SYMBOLS.length,
  totalRows: data_.length,
  rows: data_,
}, null, 2))

console.log(`✅ 已生成 ${data_.length} 条 9 月 K 线数据 → ${out}`)
console.log(`   ${TRADING_DAYS.length} 个交易日 × ${SYMBOLS.length} 只股票`)