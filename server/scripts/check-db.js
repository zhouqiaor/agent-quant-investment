const Database = require('better-sqlite3');
const db = new Database('/workspace/projects/data/quant.db', { readonly: true });

for (const t of ['trades','paper_accounts','paper_positions','history_kline','stock_directory']) {
  console.log('=== ' + t + ' schema ===');
  try {
    const cols = db.prepare("PRAGMA table_info(" + t + ")").all();
    cols.forEach(c => console.log('  ' + c.name + ' ' + c.type));
    console.log('');
  } catch(e) { console.log('err:', e.message); }
}

console.log('=== trades 总数 + 9月样本 ===');
try {
  const total = db.prepare("SELECT COUNT(*) as n FROM trades").get();
  console.log('总:', total);
  const sep = db.prepare("SELECT COUNT(*) as n FROM trades WHERE time LIKE '2026-09%'").get();
  console.log('2026-09:', sep);
  const recent = db.prepare("SELECT time, code, name, type, price, quantity, reason FROM trades ORDER BY time DESC LIMIT 10").all();
  console.log('最近 10 条:', JSON.stringify(recent, null, 2));
  const byReason = db.prepare("SELECT reason, COUNT(*) as n FROM trades WHERE time LIKE '2026-09%' GROUP BY reason ORDER BY n DESC LIMIT 10").all();
  console.log('9月触发原因分布:', JSON.stringify(byReason, null, 2));
} catch(e) { console.log('err:', e.message); }

console.log('=== paper_positions 总数 + 9月新建 ===');
try {
  const total = db.prepare("SELECT COUNT(*) as n FROM paper_positions").get();
  console.log('总:', total);
  const byAcc = db.prepare("SELECT accountId, COUNT(*) as n FROM paper_positions GROUP BY accountId").all();
  console.log('按账户:', JSON.stringify(byAcc, null, 2));
  const top10 = db.prepare("SELECT symbol, name, quantity, avgCost, currentPrice, marketValue, pnl FROM paper_positions ORDER BY ABS(marketValue) DESC LIMIT 10").all();
  console.log('top10 by mkt value:', JSON.stringify(top10, null, 2));
} catch(e) { console.log('err:', e.message); }

console.log('=== history_kline 总数 + 9月样本 ===');
try {
  const total = db.prepare("SELECT COUNT(*) as n FROM history_kline").get();
  console.log('总:', total);
  const sep = db.prepare("SELECT COUNT(*) as n FROM history_kline WHERE date LIKE '2026-09%'").get();
  console.log('2026-09:', sep);
  const symbols = db.prepare("SELECT COUNT(DISTINCT symbol) as n FROM history_kline").get();
  console.log('股票数:', symbols);
  const symSep = db.prepare("SELECT COUNT(DISTINCT symbol) as n FROM history_kline WHERE date LIKE '2026-09%'").get();
  console.log('9月股票数:', symSep);
  const sepSymbols = db.prepare("SELECT symbol, COUNT(*) as n FROM history_kline WHERE date LIKE '2026-09%' GROUP BY symbol ORDER BY n DESC LIMIT 15").all();
  console.log('9月股票样本:', JSON.stringify(sepSymbols, null, 2));
  const sample = db.prepare("SELECT * FROM history_kline WHERE date LIKE '2026-09%' ORDER BY date DESC LIMIT 3").all();
  console.log('最近 9月 K线:', JSON.stringify(sample, null, 2));
} catch(e) { console.log('err:', e.message); }