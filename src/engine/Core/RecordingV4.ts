import type { ExtensionManifest } from '../../ext/types';
import type { LevelRef } from '../../ext/world5';
import type { RandomState } from '../Random';
import type { GameMode, RecordedInputData } from './Game';
import type { GameSnapshot } from './WholeRunSnapshot';
export type Digest = string;
export const DIGEST_DOMAINS = [
  'native',
  'extensions',
  'world5',
  'actorActions',
  'knowledge',
  'random'
] as const;
export const EVENT_DOMAINS = ['extensions', 'world5', 'actorActions'] as const;
export type DigestDomain = (typeof DIGEST_DOMAINS)[number];
/** Session-only OOS evidence; never serialized into a recording or save. */
export interface ReplayDiagnostic {
  readonly command: number;
  readonly domain: DigestDomain;
  readonly tick: number;
  readonly player: Readonly<{ x: number; y: number }>;
  readonly precision: 'exact' | 'interval';
  /** Command 0 is the verified initial world. */
  readonly previousVerifiedBoundary: number;
  /** Inclusive command bounds; exact diagnostics use a singleton interval. */
  readonly interval: Readonly<{ fromCommand: number; toCommand: number }>;
}
export interface MechanicalDigest {
  root: Digest;
  domains: Record<DigestDomain, Digest>;
}
export interface EventDigest {
  root: Digest;
  domains: Record<(typeof EVENT_DOMAINS)[number], Digest>;
}
export interface RecordingInputStateV2 {
  inventoryOpen: boolean;
  inventoryAction: 'equip' | 'unequip' | 'drop' | 'call' | 'relabel' | null;
  referenceScreen: 'discoveries' | 'help' | null;
  arcana: { itemId: number; cursor: { x: number; y: number } } | null;
  throwItemId: number | null;
  pendingUseConfirmId: number | null;
}
export interface RecordingEventV4 {
  index: number;
  action: string;
  data: RecordedInputData;
  decisions: boolean[];
  tick: number;
  turn: number;
  simulationTicks: number | null;
  levelRef: LevelRef;
  player: { x: number; y: number };
  hp: number;
  inventoryStamp: string;
  rng: RandomState;
  terminal: null | { won: boolean; superVictory: boolean; score: number };
  checkpoint: EventDigest | null;
  fullCheckpoint: MechanicalDigest | null;
  chainDigest: Digest;
}
export interface RecordingV4 {
  version: 4;
  recordedAt: number;
  seed: string;
  mode: GameMode;
  initialLevel: LevelRef;
  extensions: ExtensionManifest | null;
  codec: { wholeRun: 6; foundation: 13; origin: 2 };
  digestAlgorithm: 'sha256-c5-merkle-v1';
  digestChunk: 256;
  checkpointPeriod: 2048;
  initialDigest: MechanicalDigest;
  events: RecordingEventV4[];
  snapshots: ReplaySnapshotV4[];
}
export type RecordingHeaderV4 = Omit<RecordingV4, 'events' | 'snapshots'>;
export interface ReplaySnapshotV4 {
  afterCommand: number;
  tick: number;
  simulationTicks: number | null;
  levelRef: LevelRef;
  prefixDigest: Digest;
  checkpoint: MechanicalDigest;
  snapshotCodec: 'brogue-web-whole-run-v6';
  snapshotDigest: Digest;
  world: GameSnapshot;
  inputState: RecordingInputStateV2;
}
export interface RecordingOriginV2 {
  version: 2;
  header: RecordingHeaderV4;
  events: RecordingEventV4[];
  prefixDigest: Digest;
  inputState: RecordingInputStateV2;
}
export const SNAPSHOT_BYTES = 64 * 1024 * 1024;
export const SNAPSHOT_COUNT = 128;
