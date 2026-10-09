import { c5Canonical } from './WorldCanonical';
import { digestRoot, recordingStart, recordingChain } from './RecordingDigest';
import {
  DIGEST_DOMAINS,
  EVENT_DOMAINS,
  SNAPSHOT_BYTES,
  SNAPSHOT_COUNT,
  type RecordingV4,
  type RecordingOriginV2,
  type RecordingHeaderV4,
  type RecordingInputStateV2,
  type ReplaySnapshotV4
} from './RecordingV4';
import { exact, uint, levelKey, requireDungeon } from '../../ext/world5';
import { ExtensionCompatibilityError } from '../../ext/compatibility';
import { isSeed } from '../Seed';
import { Random } from '../Random';
import type { GameSnapshot } from './WholeRunSnapshot';
const hex = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
function digest(value: any, header: RecordingHeaderV4, event = false): void {
  exact(value, 'root,domains', 'digest');
  const order = event ? EVENT_DOMAINS : DIGEST_DOMAINS;
  const domains = value.domains as Record<string, string>;
  exact(domains, order.join(','), 'digest.domains');
  if (
    !hex(value.root) ||
    order.some((d) => !hex(domains[d])) ||
    digestRoot(domains, header.extensions, order) !== value.root
  )
    throw new Error('Invalid recording digest');
}
export function recordingHeader(recording: RecordingV4): RecordingHeaderV4 {
  const { events: _events, snapshots: _snapshots, ...header } = recording;
  return header;
}
export function validateRecordingV4(
  value: unknown,
  validateManifest: (manifest: unknown) => void
): value is RecordingV4 {
  try {
    exact(
      value,
      'version,recordedAt,seed,mode,initialLevel,extensions,codec,digestAlgorithm,digestChunk,checkpointPeriod,initialDigest,events,snapshots',
      'recording'
    );
    const r = value as unknown as RecordingV4,
      header = recordingHeader(r);
    c5Canonical(header, true);
    exact(r.codec, 'wholeRun,foundation,origin', 'codec');
    if (
      r.version !== 4 ||
      r.codec.wholeRun !== 6 ||
      r.codec.foundation !== 13 ||
      r.codec.origin !== 2 ||
      r.digestAlgorithm !== 'sha256-c5-merkle-v1' ||
      r.digestChunk !== 256 ||
      r.checkpointPeriod !== 2048 ||
      !isSeed(r.seed) ||
      !['normal', 'easy', 'wizard', 'test'].includes(r.mode) ||
      requireDungeon(r.initialLevel) !== 1 ||
      !Number.isFinite(r.recordedAt) ||
      !Array.isArray(r.events) ||
      !Array.isArray(r.snapshots)
    )
      return false;
    if (r.extensions !== null) validateManifest(r.extensions);
    digest(r.initialDigest, header);
    let chain = recordingStart(header);
    for (let index = 0; index < r.events.length; index++) {
      const e = r.events[index]!;
      exact(
        e,
        'index,action,data,decisions,tick,turn,simulationTicks,levelRef,player,hp,inventoryStamp,rng,terminal,checkpoint,fullCheckpoint,chainDigest',
        'event'
      );
      c5Canonical(e, true);
      requireDungeon(e.levelRef);
      exact(e.player, 'x,y', 'player');
      uint(e.tick, 'tick');
      uint(e.turn, 'turn');
      uint(e.player.x, 'player.x');
      uint(e.player.y, 'player.y');
      if (e.simulationTicks !== null) uint(e.simulationTicks, 'simulationTicks');
      if (
        e.index !== index ||
        typeof e.action !== 'string' ||
        !e.action.length ||
        e.action.length > 128 ||
        !Array.isArray(e.decisions) ||
        e.decisions.some((d) => typeof d !== 'boolean') ||
        !Number.isFinite(e.hp) ||
        !/^[0-9a-f]{16}$/.test(e.inventoryStamp) ||
        !Random.isState(e.rng)
      )
        return false;
      if (e.data !== null && typeof e.data !== 'string' && typeof e.data !== 'number') {
        exact(e.data, 'x,y', 'data');
        if (!Number.isFinite(e.data.x) || !Number.isFinite(e.data.y)) return false;
      }
      if (e.terminal !== null) {
        exact(e.terminal, 'won,superVictory,score', 'terminal');
        if (
          typeof e.terminal.won !== 'boolean' ||
          typeof e.terminal.superVictory !== 'boolean' ||
          !Number.isSafeInteger(e.terminal.score)
        )
          return false;
      }
      if (r.extensions === null) {
        if (e.checkpoint !== null || e.simulationTicks !== null) return false;
      } else {
        if (e.checkpoint === null) return false;
        digest(e.checkpoint, header, true);
      }
      if (e.fullCheckpoint !== null) {
        digest(e.fullCheckpoint, header);
        if (
          e.checkpoint &&
          EVENT_DOMAINS.some((d) => e.checkpoint!.domains[d] !== e.fullCheckpoint!.domains[d])
        )
          return false;
      }
      if (((index + 1) % 256 === 0 || index === r.events.length - 1) && e.fullCheckpoint === null)
        return false;
      if (!hex(e.chainDigest) || recordingChain(chain, e) !== e.chainDigest) return false;
      chain = e.chainDigest;
    }
    return true;
  } catch (error) {
    if (error instanceof ExtensionCompatibilityError) throw error;
    return false;
  }
}
export function validateInputState(
  value: unknown,
  world: GameSnapshot
): value is RecordingInputStateV2 {
  try {
    exact(
      value,
      'inventoryOpen,inventoryAction,referenceScreen,arcana,throwItemId,pendingUseConfirmId',
      'inputState'
    );
    const i = value as unknown as RecordingInputStateV2;
    const item = (id: number | null) =>
      id === null ||
      (Number.isSafeInteger(id) && world.player.inventory.some((item) => item.id === id));
    if (
      typeof i.inventoryOpen !== 'boolean' ||
      ![null, 'equip', 'unequip', 'drop', 'call', 'relabel'].includes(i.inventoryAction) ||
      ![null, 'discoveries', 'help'].includes(i.referenceScreen) ||
      !item(i.throwItemId) ||
      !item(i.pendingUseConfirmId)
    )
      return false;
    if (i.arcana !== null) {
      exact(i.arcana, 'itemId,cursor', 'arcana');
      exact(i.arcana.cursor, 'x,y', 'cursor');
      if (
        i.arcana.itemId === null ||
        !item(i.arcana.itemId) ||
        !Number.isInteger(i.arcana.cursor.x) ||
        !Number.isInteger(i.arcana.cursor.y) ||
        i.arcana.cursor.x < 0 ||
        i.arcana.cursor.x >= world.width ||
        i.arcana.cursor.y < 0 ||
        i.arcana.cursor.y >= world.height
      )
        return false;
    }
    return !(world.run.pendingIdentify || world.pendingEnchantment) || i.inventoryOpen;
  } catch {
    return false;
  }
}
export function originRecording(origin: RecordingOriginV2): RecordingV4 {
  return { ...origin.header, events: origin.events, snapshots: [] };
}
export function validOriginShape(
  origin: unknown,
  world: GameSnapshot,
  validateManifest: (m: unknown) => void
): origin is RecordingOriginV2 {
  try {
    exact(origin, 'version,header,events,prefixDigest,inputState', 'origin');
    const o = origin as unknown as RecordingOriginV2;
    if (
      o.version !== 2 ||
      o.header.seed !== world.seed ||
      o.header.mode !== world.mode ||
      !validateInputState(o.inputState, world) ||
      !validateRecordingV4(originRecording(o), validateManifest)
    )
      return false;
    const last = o.events[o.events.length - 1];
    return (
      o.prefixDigest === (last?.chainDigest ?? recordingStart(o.header)) &&
      levelKey(o.header.initialLevel) === 'dungeon.1'
    );
  } catch {
    return false;
  }
}
const sizes = new WeakMap<object, number>();
export function snapshotBytes(snapshot: ReplaySnapshotV4, fresh = false): number {
  let size = sizes.get(snapshot);
  if (size === undefined || fresh) {
    size = new TextEncoder().encode(JSON.stringify(snapshot)).length;
    sizes.set(snapshot, size);
  }
  return size;
}
export function boundedSnapshots(values: readonly ReplaySnapshotV4[]): ReplaySnapshotV4[] {
  const snapshots = values
    .filter((s) => {
      try {
        return (
          !!s &&
          Number.isSafeInteger(s.afterCommand) &&
          s.afterCommand > 0 &&
          snapshotBytes(s) <= SNAPSHOT_BYTES
        );
      } catch {
        return false;
      }
    })
    .slice()
    .sort((a, b) => a.afterCommand - b.afterCommand);
  let bytes = snapshots.reduce((n, s) => n + snapshotBytes(s), 0);
  while (snapshots.length > SNAPSHOT_COUNT || bytes > SNAPSHOT_BYTES) {
    bytes -= snapshotBytes(snapshots.shift()!);
  }
  return snapshots;
}

export function validAccelerationSnapshot(
  value: unknown,
  recording: RecordingV4
): value is ReplaySnapshotV4 {
  try {
    exact(
      value,
      'afterCommand,tick,simulationTicks,levelRef,prefixDigest,checkpoint,snapshotCodec,snapshotDigest,world,inputState',
      'snapshot'
    );
    const s = value as unknown as ReplaySnapshotV4,
      e = recording.events[s.afterCommand - 1];
    if (
      !Number.isSafeInteger(s.afterCommand) ||
      s.afterCommand <= 0 ||
      s.afterCommand % 2048 !== 0 ||
      !e ||
      !e.fullCheckpoint ||
      s.snapshotCodec !== 'brogue-web-whole-run-v6' ||
      s.tick !== e.tick ||
      s.simulationTicks !== e.simulationTicks ||
      levelKey(s.levelRef) !== levelKey(e.levelRef) ||
      s.prefixDigest !== e.chainDigest ||
      !hex(s.snapshotDigest) ||
      s.checkpoint.root !== e.fullCheckpoint.root ||
      !validateInputState(s.inputState, s.world) ||
      'recordingOrigin' in s.world.run ||
      'recordedInputEvents' in s.world.run ||
      'recordedInputIndex' in s.world.run
    )
      return false;
    digest(s.checkpoint, recordingHeader(recording));
    return snapshotBytes(s, true) <= SNAPSHOT_BYTES;
  } catch {
    return false;
  }
}
