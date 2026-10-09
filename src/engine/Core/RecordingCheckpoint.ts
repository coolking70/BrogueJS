/** Worker wire data contains no engine objects or capabilities. */
import { mechanicalDigest, worldSnapshotHash } from './RecordingDigest';
import type { GameSnapshot } from './WholeRunSnapshot';
import type { EventDigest, MechanicalDigest, RecordingInputStateV2 } from './RecordingV4';
export interface CheckpointIdentity {
  generation: number;
  boundaryCommand: number;
  previousVerifiedBoundary: number;
  codecIdentity: string;
  manifestFingerprint: string;
  snapshot: boolean;
}
export interface CheckpointJob extends CheckpointIdentity {
  /** Exclusive UTF-8 JSON projection. Retained until verified, for transport recovery. */
  bytes: Uint8Array;
  inputState: RecordingInputStateV2;
  checkpoint: EventDigest | null;
}
export interface CheckpointResult extends CheckpointIdentity {
  full: MechanicalDigest;
  snapshotDigest: string | null;
  computeMs: number;
}
export const checkpointIdentity = (job: CheckpointIdentity): CheckpointIdentity => ({
  generation: job.generation, boundaryCommand: job.boundaryCommand,
  previousVerifiedBoundary: job.previousVerifiedBoundary, codecIdentity: job.codecIdentity,
  manifestFingerprint: job.manifestFingerprint, snapshot: job.snapshot,
});
export function computeCheckpoint(job: CheckpointJob): CheckpointResult {
  const start = performance.now();
  const world = JSON.parse(new TextDecoder().decode(job.bytes)) as GameSnapshot;
  const full = mechanicalDigest(world, job.inputState);
  world.savedAt = 0;
  return { ...checkpointIdentity(job), full,
    snapshotDigest: job.snapshot ? worldSnapshotHash(world) : null, computeMs: performance.now() - start };
}
