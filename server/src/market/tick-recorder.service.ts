import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { MarketPollingService } from './market-polling.service';
import { PersistenceService } from '../persistence/persistence.service';

interface MarketRow {
  symbol: string;
  price: number;
  open?: number | null;
  prevClose?: number | null;
  changePercent?: number | null;
  volume?: number | null;
}

const MAX_BUFFER = 500;
const FLUSH_INTERVAL_MS = 5000;

@Injectable()
export class TickRecorderService implements OnModuleInit {
  private readonly logger = new Logger(TickRecorderService.name);
  private buffer: Array<{ symbol: string; price: number; open?: number | null; prevClose?: number | null; changePercent?: number | null; volume?: number | null; recordedAt?: number }> = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private unsubscribed: (() => void) | null = null;
  private recording = true;
  private totalRecorded = 0;

  constructor(
    private readonly polling: MarketPollingService,
    private readonly persistence: PersistenceService,
  ) {}

  onModuleInit(): void {
    this.unsubscribed = this.polling.subscribe((data: unknown) => {
      if (!this.recording) return;
      const rows = (Array.isArray(data) ? data : []) as MarketRow[];
      if (rows.length === 0) return;
      const now = Date.now();
      for (const r of rows) {
        if (typeof r.symbol !== 'string' || typeof r.price !== 'number') continue;
        this.buffer.push({
          symbol: r.symbol,
          price: r.price,
          open: r.open ?? null,
          prevClose: r.prevClose ?? null,
          changePercent: r.changePercent ?? null,
          volume: r.volume ?? null,
          recordedAt: now,
        });
      }
      if (this.buffer.length >= MAX_BUFFER) {
        this.flush();
      }
    });
    this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
    this.logger.log(`TickRecorder initialized (bufferCap=${MAX_BUFFER}, flushEvery=${FLUSH_INTERVAL_MS}ms)`);
  }

  private flush(): void {
    if (this.buffer.length === 0) return;
    const batch = this.buffer;
    this.buffer = [];
    try {
      const n = this.persistence.recordTicks(batch);
      this.totalRecorded += n;
    } catch (err) {
      this.logger.error(`Flush failed, re-buffering ${batch.length} ticks`, err as Error);
      this.buffer = batch.concat(this.buffer);
    }
  }

  setRecording(enabled: boolean): void {
    this.recording = enabled;
    this.logger.log(`Recording ${enabled ? 'enabled' : 'disabled'}`);
  }

  isRecording(): boolean {
    return this.recording;
  }

  getStats(): { recording: boolean; bufferedCount: number; totalRecorded: number; marketStats: ReturnType<PersistenceService['tickStats']> } {
    const stats = this.persistence.tickStats();
    return {
      recording: this.recording,
      bufferedCount: this.buffer.length,
      totalRecorded: this.totalRecorded,
      marketStats: stats,
    };
  }

  queryTicks(opts: Parameters<PersistenceService['queryTicks']>[0]) {
    return this.persistence.queryTicks(opts);
  }

  onModuleDestroy(): void {
    if (this.flushTimer) clearInterval(this.flushTimer);
    if (this.unsubscribed) this.unsubscribed();
    this.flush();
  }
}