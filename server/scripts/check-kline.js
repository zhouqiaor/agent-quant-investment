const Database = require('better-sqlite3');
const db = new Database('/workspace/projects/data/quant.db', { readonly: true });

console.log('=== history_kline 总览 ===');
const total = db.prepare('SELECT COUNT(*) as n FROM history_kline').get();
console.log('总:', total);

const dates = db.prepare("SELECT date, COUNT(DISTINCT symbol) as sym, COUNT(*) as n FROM history_kline GROUP BY substr(date,1,7) ORDER BY date DESC").all();
console.log('按月:', JSON.stringify(dates, null, 2));

const syms = db.prepare('SELECT COUNT(DISTINCT symbol) as n FROM history_kline').get();
console.log('总股票数:', syms);

console.log('\n=== 2026-09 数据样本 ===');
const sep = db.prepare("SELECT date, COUNT(DISTINCT symbol) as sym, COUNT(*) as n FROM history_kline WHERE date LIKE '2026-09%' GROUP BY date ORDER BY date DESC LIMIT 10").all();
console.log('9月逐日:', JSON.stringify(sep, null, 2));

const sepSyms = db.prepare("SELECT symbol, COUNT(*) as n FROM history_kline WHERE date LIKE '2026-09%' GROUP BY symbol ORDER BY n DESC LIMIT 20").all();
console.log('9月股票样本(20):', JSON.stringify(sepSyms, null, 2));

console.log('\n=== 2026-09 样本行 ===');
const sample = db.prepare("SELECT * FROM history_kline WHERE date LIKE '2026-09%' ORDER BY date DESC, symbol LIMIT 3").all();
console.log(JSON.stringify(sample, null, 2));

console.log('\n=== sim-related 表 ===');
const simTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%sim%'").all();
console.log('sim-related:', JSON.stringify(simTables));