import '../../../../i18n';
import { afterEach, expect, it } from 'vitest';
import { Game } from '../../../../engine/Core/Game';
import { inventoryStamp, mechanicalDigest, recordingChain, recordingStart } from '../../../../engine/Core/RecordingDigest';
import { recordingHeader, validateRecordingV4 } from '../../../../engine/Core/RecordingFormat';
import { computeCheckpoint, type CheckpointJob, type CheckpointResult } from '../../../../engine/Core/RecordingCheckpoint';
import type { RecordingBackend } from '../../../../engine/Core/RecordingBackend';
import { worldWorkLastError } from '../../../../engine/Core/WorldWork';
import { loadSettlementPack } from '../definitions';

const live: Game[] = [];
afterEach(() => { for (const g of live.splice(0)) { g.disposeRecording(); g.extensionRuntime?.unload(); } });
function fresh() {
  const g = new Game({ seed: 1 }); live.push(g);
  g.startNewGame({ seed: '28', ruleSet: 'extended', extensions: ['settlement'], extensionConfigurations: { settlement: { raids: false } } });
  g.animationEnabled = false;
  return g;
}
function drain(g: Game) {
  for (let n = 0; g.isAdvancing && n < 1000; n++) g.stepAdvancement();
  expect(g.isAdvancing).toBe(false);
}
function send(g: Game, action: string, extra: Record<string, unknown>) {
  g.executeCommand('ext:command', JSON.stringify({ module: 'settlement', action, payload: {
    v: 1, stateRevision: g.extensionRuntime!.worldCampState('settlement').revision,
    inventoryStamp: inventoryStamp(g.player.inventory.items), sourceContainerId: null, sourceRevision: null, ...extra
  } }));
}
function establish(g: Game) {
  send(g, 'establish', { x: 39, y: 26, bounds: { x: 35, y: 19, width: 9, height: 9 },
    materials: loadSettlementPack().camp.createCost,
    food: [{ itemId: g.player.inventory.items.find(i => i.consumableId === 'ration_of_food')!.id, quantity: 2 }] });
}
function extendAndBuild(g: Game) {
  const camp = g.extensionRuntime!.worldCampState('settlement').camps[0]!;
  const region = () => g.extensionRuntime!.worldStructureRegions().find(r => r.id === camp.regionId)!;
  send(g, 'expand', { regionId: camp.regionId, regionRevision: region().revision,
    bounds: { x: 35, y: 19, width: 10, height: 9 }, materials: loadSettlementPack().camp.expandCost });
  drain(g); expect(worldWorkLastError(g)).toBeNull();
  const floor = loadSettlementPack().world.structures!.find(d => d.id === 'settlement.wood-floor')!;
  send(g, 'build', { regionId: camp.regionId, regionRevision: region().revision,
    x: 38, y: 25, definitionId: floor.id, materials: floor.constructionCost });
  drain(g); expect(worldWorkLastError(g)).toBeNull();
}
const digest = (g: Game) => mechanicalDigest(g.toSnapshot(), (g as any).recordingInputState());
async function roundTrip(g: Game) {
  const recording = await g.exportRecordingAsync(), expected = digest(g);
  expect(validateRecordingV4(recording, () => {})).toBe(true);
  let chain = recordingStart(recordingHeader(recording));
  for (const event of recording.events) {
    expect(event.chainDigest, `command ${event.index}`).toBe(recordingChain(chain, event));
    chain = event.chainDigest;
  }
  expect(await g.loadReplayAsync(recording)).toBe(true);
  for (const index of [recording.events.length, 0, recording.events.length]) {
    await g.replaySeekAsync(index); expect(g.replayError).toBeNull(); expect(g.replayCursor).toBe(index);
  }
  expect(digest(g)).toEqual(expected);
  return recording;
}
it('natural configured camp starts at turn zero; its first three-turn command, expansion and build export/load/seek exactly', async () => {
  const g = fresh(); const initial = g.exportRecording();
  expect(g.absoluteTurnNumber).toBe(0); expect(initial.events).toEqual([]);
  establish(g); expect(worldWorkLastError(g)).toBeNull();
  expect(g.recordedInputEvents[0]).toMatchObject({ index: 0, turn: 3, action: 'ext:command' });
  extendAndBuild(g);
  const recording = await roundTrip(g);
  expect(recording.initialDigest).toEqual(initial.initialDigest);
  expect(recording.events).toHaveLength(3);
});
class DelayedFirstCheckpoint implements RecordingBackend {
  kind = 'delayed-first';
  first: { job: CheckpointJob; resolve(result: CheckpointResult): void } | null = null;
  enqueue(job: CheckpointJob): Promise<CheckpointResult> {
    if (this.first) return Promise.resolve(computeCheckpoint(job));
    return new Promise(resolve => { this.first = { job, resolve }; });
  }
  complete() { this.first!.resolve(computeCheckpoint(this.first!.job)); }
  dispose() {}
}
it('a delayed checkpoint never publishes an animated camp command before its final state', async () => {
  const g = fresh(), backend = new DelayedFirstCheckpoint();
  g.configureRecordingBackend(() => backend);
  for (let i = 0; i < 256; i++) g.executeCommand('escape');
  expect(backend.first?.job.boundaryCommand).toBe(256);
  g.animationEnabled = true;
  establish(g);
  expect(g.isAdvancing).toBe(true);
  const pending = g.recordedInputEvents[256]!;
  expect(pending.chainDigest).toBe('');
  backend.complete();
  for (let i = 0; i < 5; i++) await Promise.resolve();
  expect(pending.chainDigest).toBe('');
  const provisionalHash = recordingChain(g.recordedInputEvents[255]!.chainDigest, pending);
  drain(g); expect(worldWorkLastError(g)).toBeNull();
  expect(pending.turn).toBe(3);
  extendAndBuild(g);
  const recording = await roundTrip(g);
  // Synthetic r2 corruption: only the in-flight row was hashed too early;
  // later rows were chained against that stale hash. Never silently accept it.
  const broken = structuredClone(recording);
  broken.events[256]!.chainDigest = provisionalHash;
  for (let i = 257; i < broken.events.length; i++)
    broken.events[i]!.chainDigest = recordingChain(broken.events[i - 1]!.chainDigest, broken.events[i]!);
  const before = digest(g), player = g.player;
  expect(g.loadReplay(broken)).toBe(false);
  expect(g.player).toBe(player); expect(digest(g)).toEqual(before);
});
