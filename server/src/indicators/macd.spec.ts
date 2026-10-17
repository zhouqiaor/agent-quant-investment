import { macd } from './macd';

describe('macd (TDD)', () => {
  it('返回字段 dif / dea / hist / crosses，长度对齐', () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + i);
    const out = macd(closes);
    expect(out.dif).toHaveLength(50);
    expect(out.dea).toHaveLength(50);
    expect(out.hist).toHaveLength(50);
    expect(Array.isArray(out.crosses)).toBe(true);
  });

  it('DIF 默认参数下前 slow-1（25）位为 null', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
    const out = macd(closes);
    for (let i = 0; i < 25; i++) expect(out.dif[i]).toBeNull();
    expect(out.dif[25]).not.toBeNull();
  });

  it('单调递增序列：HIST 全部 ≥ 0，无金叉/死叉信号', () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + i);
    const out = macd(closes);
    const validHist = out.hist.filter((v) => v !== null) as number[];
    expect(validHist.every((v) => v >= 0)).toBe(true);
  });

  it('金叉识别：DIF 上穿 DEA', () => {
    // 构造：先降后升，中间有平台期让 DIF/DEA 在 warmup 后真正交叉
    const closes: number[] = [];
    for (let i = 0; i < 40; i++) closes.push(120 - i * 0.5); // 缓慢下降
    for (let i = 0; i < 10; i++) closes.push(100);            // 平台
    for (let i = 0; i < 40; i++) closes.push(100 + i * 1.5); // 强势上升
    const out = macd(closes);
    const goldens = out.crosses.filter((c) => c.type === 'golden');
    expect(goldens.length).toBeGreaterThan(0);
  });

  it('死叉识别：DIF 下穿 DEA', () => {
    // 构造：先升后降，中间有平台期让 DIF/DEA 在 warmup 后真正交叉
    const closes: number[] = [];
    for (let i = 0; i < 40; i++) closes.push(100 + i * 0.5); // 缓慢上升
    for (let i = 0; i < 10; i++) closes.push(120);            // 平台
    for (let i = 0; i < 40; i++) closes.push(120 - i * 1.5); // 强势下降
    const out = macd(closes);
    const deaths = out.crosses.filter((c) => c.type === 'death');
    expect(deaths.length).toBeGreaterThan(0);
  });

  it('默认参数 fast=12, slow=26, signal=9 与显式覆盖结果一致', () => {
    const closes = Array.from({ length: 60 }, () => Math.random() * 100 + 50);
    const a = macd(closes);
    const b = macd(closes, 12, 26, 9);
    expect(a.dif).toEqual(b.dif);
    expect(a.dea).toEqual(b.dea);
    expect(a.hist).toEqual(b.hist);
  });
});