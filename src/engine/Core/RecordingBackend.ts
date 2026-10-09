import { computeCheckpoint, type CheckpointJob, type CheckpointResult } from './RecordingCheckpoint';
export interface RecordingBackend {
  readonly kind: string;
  enqueue(job: CheckpointJob): Promise<CheckpointResult>;
  dispose(): void;
}
export class RecordingCancelled extends Error {}
export class RecordingCalculationError extends Error {}
export class InlineRecordingBackend implements RecordingBackend {
  readonly kind = 'inline';
  enqueue(job: CheckpointJob): Promise<CheckpointResult> {
    try { return Promise.resolve(computeCheckpoint(job)); }
    catch (error) { return Promise.reject(new RecordingCalculationError(String(error))); }
  }
  dispose(): void {}
}
interface Pending {
  job: CheckpointJob;
  resolve(result: CheckpointResult): void;
  reject(error: Error): void;
  timer: ReturnType<typeof setTimeout>;
}
/** At most two requests are admitted by the recorder. Transport failures downgrade
 * once, from the original bytes; calculation/identity errors never trigger recovery. */
export class WorkerRecordingBackend implements RecordingBackend {
  private worker: Worker | null = null;
  private pending = new Map<number, Pending>();
  // Request IDs are issued contiguously. An issued ID absent from pending has
  // already completed, even after arbitrarily many exports or out-of-order replies.
  private issuedThrough = 0;
  private retired = false;
  private downgraded = false;
  public fallbackReason: string | null = null;
  get kind(): string { return this.downgraded ? 'inline-fallback' : 'worker'; }
  constructor(private timeoutMs = 30_000, factory: () => Worker = () =>
    new Worker(new URL('./RecordingCheckpoint.worker.ts', import.meta.url), { type: 'module' })) {
    try {
      this.worker = factory();
      this.worker.onmessage = ({ data }) => {
        const identity = data?.result ?? data?.identity;
        const live = this.pending.values().next().value as Pending | undefined;
        if (this.retired) return;
        if (live && typeof identity?.generation === 'number' && identity.generation < live.job.generation) return;
        if (live && (!identity || identity.generation !== live.job.generation)) { this.failIntegrity('Invalid checkpoint identity'); return; }
        const requestId = data?.requestId;
        if (!Number.isSafeInteger(requestId) || requestId < 1 || requestId > this.issuedThrough) {
          if (live) this.failIntegrity('Unexpected checkpoint identity');
          return;
        }
        const p = this.pending.get(requestId);
        if (!p) return; // Completed request; never let a repeat satisfy another job.
        if (identity.boundaryCommand !== p.job.boundaryCommand) { this.failIntegrity('Unexpected checkpoint identity'); return; }
        clearTimeout(p.timer); this.pending.delete(requestId);
        if (data.calculationError !== undefined) p.reject(new RecordingCalculationError(data.calculationError));
        else p.resolve(data.result);
      };
      this.worker.onerror = () => this.fallback('worker error');
      this.worker.onmessageerror = () => this.fallback('message decode error');
    } catch (error) { this.fallback('worker construction: ' + String(error)); }
  }
  enqueue(job: CheckpointJob): Promise<CheckpointResult> {
    if (this.retired) return Promise.reject(new RecordingCancelled('Recording retired'));
    if (this.downgraded) return new InlineRecordingBackend().enqueue(job);
    if (this.issuedThrough === Number.MAX_SAFE_INTEGER) return Promise.reject(new RecordingCalculationError('Checkpoint request limit reached'));
    const requestId = ++this.issuedThrough;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.fallback('worker timeout'), this.timeoutMs);
      this.pending.set(requestId, { job, resolve, reject, timer });
      try {
        // Transfer only a job-owned copy. The retained bytes remain available for
        // recovery and 2048 publication; no live/saved buffers are detached.
        const bytes = job.bytes.slice();
        this.worker!.postMessage({ ...job, requestId, bytes }, [bytes.buffer]);
      } catch (error) { this.fallback('postMessage: ' + String(error)); }
    });
  }
  private fallback(reason: string): void {
    if (this.retired || this.downgraded) return;
    this.downgraded = true; this.fallbackReason = reason;
    this.worker?.terminate(); this.worker = null;
    const pending = [...this.pending.values()]; this.pending.clear();
    for (const p of pending) {
      clearTimeout(p.timer);
      try { p.resolve(computeCheckpoint(p.job)); }
      catch (error) { p.reject(new RecordingCalculationError(String(error))); }
    }
  }
  private failIntegrity(reason: string): void {
    for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new RecordingCalculationError(reason)); }
    this.pending.clear(); this.worker?.terminate(); this.worker = null;
  }
  dispose(): void {
    this.retired = true; this.worker?.terminate(); this.worker = null;
    for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new RecordingCancelled('Recording retired')); }
    this.pending.clear();
  }
}
export const defaultRecordingBackend = (): RecordingBackend | null =>
  typeof window !== 'undefined' && typeof Worker !== 'undefined' ? new WorkerRecordingBackend() : null;
