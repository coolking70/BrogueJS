import { expect, it, vi } from 'vitest';
import { Worker as NodeWorker } from 'node:worker_threads';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import '../../../../i18n';
import { Game } from '../../../../engine/Core/Game';
import { ItemLoader } from '../../../../engine/Items/ItemLoader';
import { logger } from '../../../../engine/Systems/Logger';
import { timeSystem } from '../../../../engine/Systems/Time';
import { WorkerRecordingBackend } from '../../../../engine/Core/RecordingBackend';
import { computeCheckpoint, type CheckpointJob, type CheckpointResult } from '../../../../engine/Core/RecordingCheckpoint';
import { recordingHeader } from '../../../../engine/Core/RecordingFormat';
import { mechanicalDigest, recordingChain, recordingStart } from '../../../../engine/Core/RecordingDigest';
import type { GameSnapshot } from '../../../../engine/Core/WholeRunSnapshot';
import { createConfiguredWorldHarness } from '../../../testing/configuredWorldHarness';
import { residentScene } from '../../settlement/tests/residentHelpers';
import { current } from '../../settlement/tests/helpers';
import { rng } from '../../../../engine/Random';
import { getNextEntityId } from '../../../../entities/Creature';

// This is a paid-camp diagnostic snapshot, not a naturally generated seed route.
// Public commands provide the actual Worker transport boundaries below; the
// separate natural-source tests own seed replay and seek coverage.
it('publishes join/station/rejoin at 256/2048/2049 through the production Worker from the real paid-command fixture prefix', async () => {
  const scene = residentScene(['party', 'settlement'], false, (options, configurations) =>
    createConfiguredWorldHarness(options, { ...configurations, party: { schema: 1, members: 1 } }));
  scene.g.player.loc = { x: 19, y: 13 };
  scene.a.loc = { x: 20, y: 13 };
  scene.g.refreshStructureDerivedState();
  const targetId = scene.a.id, campId = current(scene.g).regionId;
  const g = scene.g;
  // Continue the real paid-command prefix captured by the controlled-scene
  // harness. Diagnostic snapshots deliberately cannot originate recordings.
  const header = recordingHeader(g.exportRecording());
  vi.restoreAllMocks();
  const directory = mkdtempSync(join(tmpdir(), 'party-roster-worker-'));
  const entry = join(directory, 'worker.mjs');
  let loaded: Game | undefined;
  const jobs = new Map<number, CheckpointJob>(), results = new Map<number, CheckpointResult>();
  const snapshots = new Map<number, GameSnapshot>();
  const backends: WorkerRecordingBackend[] = [];
  let integrityError: unknown;
  try {
    await build({
      entryPoints: [resolve('src/engine/Core/RecordingCheckpoint.worker.ts')],
      outfile: entry, bundle: true, platform: 'node', format: 'esm',
      banner: { js: "import {parentPort} from 'node:worker_threads';globalThis.postMessage=value=>parentPort.postMessage(value);" },
      footer: { js: 'parentPort.on("message",data=>globalThis.onmessage({data}));' }
    });
    expect(g.hasCompleteRecording).toBe(true);
    expect(g.recordedInputEvents.length).toBeLessThan(255);
    g.animationEnabled = false;
    g.configureRecordingBackend(() => {
      const backend = new WorkerRecordingBackend(60000, () => {
        const worker = new NodeWorker(entry);
        const adapter: any = {
          onmessage: null, onerror: null, onmessageerror: null,
          postMessage(job: CheckpointJob & { requestId: number }, transfer: Transferable[]) {
            jobs.set(job.requestId, structuredClone(job));
            worker.postMessage(job, transfer as any);
          },
          terminate() { void worker.terminate(); }
        };
        worker.on('message', data => {
          try {
            const job = jobs.get(data.requestId)!;
            const expected = computeCheckpoint(job);
            expect({ ...data.result, computeMs: 0 }).toEqual({ ...expected, computeMs: 0 });
            expect(data.result.full.domains.party).toBeTruthy();
            results.set(job.boundaryCommand, data.result);
          } catch (error) { integrityError = error; }
          adapter.onmessage?.({ data });
        });
        worker.on('error', error => adapter.onerror?.(error));
        return adapter;
      });
      backends.push(backend);
      return backend;
    });
    const acknowledge = () => { while (logger.pendingAcknowledgment) logger.acknowledgeNext(); };
    const policy = async () => {
      if (g.recordingInputBlocked) await g.flushRecording();
      acknowledge();
      const prefix = g.recordedInputEvents.length, tick = timeSystem.currentTick;
      g.executeCommand('party:policy', {
        kind: 'party:policy', schema: 2, expectedRevision: g.party!.state.revision,
        issuerSlot: 'local:0', actorId: g.player.id, change: { kind: 'single-step' }
      });
      expect(g.recordedInputEvents).toHaveLength(prefix + 1);
      expect(timeSystem.currentTick).toBe(tick);
    };
    const roster = (operation: 'join' | 'station') => {
      acknowledge();
      const tick = timeSystem.currentTick;
      g.executeCommand('party:roster', {
        kind: 'party:roster', schema: 1, expectedRevision: g.party!.state.revision,
        issuerSlot: 'local:0', actorId: g.player.id, targetId, operation,
        campId: operation === 'station' ? campId : null,
        level: { kind: 'dungeon', depth: g.depth }
      });
      expect(timeSystem.currentTick).toBe(tick);
    };
    const boundary = async (count: number) => {
      expect(g.recordedInputEvents).toHaveLength(count);
      await g.flushRecording();
      const snapshot = await g.toSaveSnapshotAsync();
      expect(integrityError).toBeUndefined();
      expect(g.recordingFailure).toBeNull();
      expect(backends.every(backend => backend.kind === 'worker' && backend.fallbackReason === null)).toBe(true);
      expect(snapshot.run.recordingOrigin).toBeTruthy();
      delete snapshot.run.recordingOrigin;
      snapshots.set(count, snapshot);
      expect(results.get(count)?.full).toEqual(g.recordedInputEvents[count - 1]!.fullCheckpoint);
      let chain = recordingStart(header);
      for (const event of g.recordedInputEvents) {
        chain = recordingChain(chain, event);
        expect(event.chainDigest).toBe(chain);
      }
    };

    while (g.recordedInputEvents.length < 255) await policy();
    await boundary(255);
    const originalHp = g.monsters.find(actor => actor.id === targetId)!.hp;
    roster('join');
    const member = g.party!.actors.get(targetId)!;
    const source = structuredClone(g.party!.state.sources.find(row => row.actorId === targetId)!);
    expect(source.kind).toBe('resident');
    expect(member.hp).toBe(originalHp);
    expect(g.monsters.some(actor => actor.id === targetId)).toBe(false);
    expect(g.world5!.residents.some(row => row.actorId === targetId)).toBe(false);
    expect(g.party!.native[targetId]).toBeTruthy();
    expect(g.party!.stationedNative[targetId]).toBeUndefined();
    await boundary(256);

    for (let step = 0; step < 40 && g.activeControlledActors.some(actor => actor.ticksUntilTurn > 0); step++) {
      acknowledge();
      if (g.recordingInputBlocked) await g.flushRecording();
      g.submitPartyIntent({ kind: 'wait' }, g.readyPartyActorId!);
      if (g.recordedInputEvents.length === 257) await boundary(257);
    }
    expect(g.activeControlledActors.every(actor => actor.ticksUntilTurn === 0)).toBe(true);
    if (!snapshots.has(257)) {
      while (g.recordedInputEvents.length < 257) await policy();
      await boundary(257);
    }
    while (g.recordedInputEvents.length < 2047) await policy();
    await boundary(2047);
    const native = structuredClone(g.party!.native[targetId]), health = member.hp;
    roster('station');
    expect(g.party!.actors.has(targetId)).toBe(false);
    expect(g.party!.stationed.get(targetId)).toBe(member);
    expect(g.party!.native[targetId]).toBeUndefined();
    expect(g.party!.stationedNative[targetId]).toEqual(native);
    expect(g.world5!.residents.some(row => row.actorId === targetId)).toBe(true);
    expect(member.hp).toBe(health);
    expect(g.party!.state.sources.find(row => row.actorId === targetId)).toEqual(source);
    await boundary(2048);
    roster('join');
    expect(g.party!.actors.get(targetId)).toBe(member);
    expect(g.party!.stationed.has(targetId)).toBe(false);
    expect(g.party!.native[targetId]).toEqual(native);
    expect(g.party!.stationedNative[targetId]).toBeUndefined();
    expect(g.world5!.residents.some(row => row.actorId === targetId)).toBe(false);
    expect(member.hp).toBe(health);
    expect(g.party!.state.sources.find(row => row.actorId === targetId)).toEqual(source);
    await boundary(2049);
    expect([...jobs.values()].find(job => job.boundaryCommand === 2048)?.snapshot).toBe(true);
    expect(results.get(2048)!.snapshotDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(g.recordedInputEvents.filter(event => event.action === 'party:roster').map(event => event.index + 1)).toEqual([256, 2048, 2049]);
    const recording=g.exportRecording();expect(recording.events).toHaveLength(2049);
    if(process.env.PARTY_P1D_RESIDENT_CAPTURE){mkdirSync(process.env.PARTY_P1D_RESIDENT_CAPTURE,{recursive:true});for(const [name,value] of [['resident-roundtrip-save',g.toSaveSnapshot()],['resident-stationed-save',snapshots.get(2048)!],['resident-recording',recording]] as const)writeFileSync(join(process.env.PARTY_P1D_RESIDENT_CAPTURE,name+'.json'),JSON.stringify(value));}

    if(process.env.PARTY_P1D_RESIDENT_CAPTURE){
      const directory=process.env.PARTY_P1D_RESIDENT_CAPTURE;
      acknowledge();const lead=g.party!.state.members.find(m=>m.actorId===g.player.id)!;
      g.executeCommand('party:ai',{kind:'party:ai',schema:1,expectedRevision:g.party!.state.revision,issuerSlot:'local:0',change:{kind:'controller',actorId:lead.actorId,expectedEpoch:lead.controlEpoch,controller:{kind:'ai',policyId:'party-ai-v1'}}});
      await g.flushRecording();writeFileSync(join(directory,'ai-save.json'),JSON.stringify(await g.toSaveSnapshotAsync()));writeFileSync(join(directory,'ai-recording.json'),JSON.stringify(g.exportRecording()));
      const wand=ItemLoader.spawnWand('wand_of_teleportation',0,0)!;expect(member.inventory.addItem(wand)).toBe(true);acknowledge();
      g.submitPartyWindow({kind:'party:window',schema:2,seq:g.party!.state.window.seq+1,expectedRevision:g.party!.state.revision,issuerSlot:'local:0',startTick:timeSystem.currentTick,length:{kind:'ticks',ticks:100},fineActorId:null,automatic:false,trigger:'manual',plans:[{actorId:member.id,controllerSlot:'local:0',update:'replace',plan:{kind:'queue',actions:[{kind:'item',operation:'use',itemId:wand.id,target:null}]}}]});
      expect(g.party!.state.window.decision?.kind).toBe('modal');await g.flushRecording();
      writeFileSync(join(directory,'pending-save.json'),JSON.stringify(await g.toSaveSnapshotAsync()));writeFileSync(join(directory,'pending-recording.json'),JSON.stringify(g.exportRecording()));
    }

    // Capture every source snapshot before constructing another Game: the entity
    // allocator and RNG are process globals. These loads validate diagnostic
    // ownership only and intentionally make no seed replay claim.
    loaded = new Game({ seed: 2 });
    for (const [count, snapshot] of snapshots) {
      expect(loaded.loadSnapshot(structuredClone(snapshot)), `load diagnostic boundary ${count}`).toBe(true);
      expect(loaded.hasCompleteRecording).toBe(false);
      expect(loaded.party!.state).toEqual(snapshot.party!.state);
      expect(loaded.party!.actors.has(targetId)).toBe(count !== 255 && count !== 2048);
      expect(loaded.party!.stationed.has(targetId)).toBe(count === 2048);
      expect(loaded.world5!.residents.some(row => row.actorId === targetId)).toBe(count === 255 || count === 2048);
      expect(loaded.party!.native).toEqual(snapshot.party!.native);
      expect(loaded.party!.stationedNative).toEqual(snapshot.party!.stationedNative);
    }
  } finally {
    g.disposeRecording(); loaded?.disposeRecording();
    rmSync(directory, { recursive: true, force: true });
  }
}, 600000);

it('late and out-of-order production Worker responses keep pre-join and pre-station jobs frozen without replacing the current roster', async () => {
  const scene = residentScene(['party', 'settlement'], false, (options, configurations) =>
    createConfiguredWorldHarness(options, { ...configurations, party: { schema: 1, members: 1 } }));
  const g = scene.g, targetId = scene.a.id, campId = current(g).regionId;
  g.player.loc = { x: 19, y: 13 }; scene.a.loc = { x: 20, y: 13 };
  g.refreshStructureDerivedState();
  const header = recordingHeader(g.exportRecording());
  vi.restoreAllMocks();
  const directory = mkdtempSync(join(tmpdir(), 'party-roster-delayed-worker-'));
  const entry = join(directory, 'worker.mjs');
  type WireJob = CheckpointJob & { requestId: number };
  type WireResult = { requestId: number; result: CheckpointResult };
  const jobs = new Map<number, WireJob>(), messages = new Map<number, WireResult>();
  const arrivals = new Map<number, { resolve(value: WireResult): void; reject(error: Error): void }>();
  let adapter: any, backend!: WorkerRecordingBackend, loaded: Game | undefined;
  const messageAt = (boundary: number) => messages.has(boundary)
    ? Promise.resolve(messages.get(boundary)!)
    : new Promise<WireResult>((resolve, reject) => arrivals.set(boundary, { resolve, reject }));
  const microtasks = async () => { for (let n = 0; n < 5; n++) await Promise.resolve(); };
  const acknowledge = () => { while (logger.pendingAcknowledgment) logger.acknowledgeNext(); };
  const digest = () => mechanicalDigest((g as any).projectWholeRun(), (g as any).recordingInputState());
  const policy = () => {
    acknowledge(); expect(g.recordingInputBlocked).toBe(false);
    const prefix = g.recordedInputEvents.length;
    g.executeCommand('party:policy', { kind: 'party:policy', schema: 2,
      expectedRevision: g.party!.state.revision, issuerSlot: 'local:0',
      actorId: g.player.id, change: { kind: 'single-step' } });
    expect(g.recordedInputEvents).toHaveLength(prefix + 1);
  };
  const roster = (operation: 'join' | 'station') => {
    acknowledge();
    g.executeCommand('party:roster', { kind: 'party:roster', schema: 1,
      expectedRevision: g.party!.state.revision, issuerSlot: 'local:0',
      actorId: g.player.id, targetId, operation,
      campId: operation === 'station' ? campId : null,
      level: { kind: 'dungeon', depth: g.depth } });
  };
  const assertChains = () => {
    let chain = recordingStart(header);
    for (const event of g.recordedInputEvents) {
      chain = recordingChain(chain, event); expect(event.chainDigest).toBe(chain);
    }
  };
  try {
    await build({
      entryPoints: [resolve('src/engine/Core/RecordingCheckpoint.worker.ts')],
      outfile: entry, bundle: true, platform: 'node', format: 'esm',
      banner: { js: "import {parentPort} from 'node:worker_threads';globalThis.postMessage=value=>parentPort.postMessage(value);" },
      footer: { js: 'parentPort.on("message",data=>globalThis.onmessage({data}));' }
    });
    expect(g.hasCompleteRecording).toBe(true); expect(g.recordedInputEvents.length).toBeLessThan(256);
    g.animationEnabled = false;
    g.configureRecordingBackend(() => {
      backend = new WorkerRecordingBackend(60000, () => {
        const worker = new NodeWorker(entry);
        adapter = {
          onmessage: null, onerror: null, onmessageerror: null,
          postMessage(job: WireJob, transfer: Transferable[]) {
            jobs.set(job.boundaryCommand, structuredClone(job));
            worker.postMessage(job, transfer as any);
          },
          terminate() { void worker.terminate(); }
        };
        // Only transport delivery is delayed. The unmodified production worker
        // computes each result from its actual frozen, transferred job bytes.
        worker.on('message', (data: WireResult) => {
          messages.set(data.result.boundaryCommand, data);
          arrivals.get(data.result.boundaryCommand)?.resolve(data);
          arrivals.delete(data.result.boundaryCommand);
        });
        worker.on('error', error => {
          for (const pending of arrivals.values()) pending.reject(error);
          arrivals.clear(); adapter.onerror?.(error);
        });
        return adapter;
      });
      return backend;
    });
    while (g.recordedInputEvents.length < 256) policy();
    expect(jobs.has(256)).toBe(true);
    expect(g.recordedInputEvents[255]!.fullCheckpoint).toBeNull();
    expect(g.recordingInputBlocked).toBe(false); // One pending job permits the next command.
    roster('join');
    expect(g.recordedInputEvents).toHaveLength(257); expect(jobs.has(257)).toBe(true);
    const root = g.party!, member = root.actors.get(targetId)!, inventory = member.inventory.items;
    const native = root.native[targetId], residents = g.world5!.residents;
    expect(root.stationed.has(targetId)).toBe(false);
    expect(g.monsters.some(actor => actor.id === targetId)).toBe(false);
    const joined = digest(), joinedState = structuredClone(root.state), random = rng.getState();
    const allocator = getNextEntityId(), tick = timeSystem.currentTick;
    const old = await messageAt(256), joinedMessage = await messageAt(257);
    for (const boundary of [256, 257]) {
      const message = messages.get(boundary)!, expected = computeCheckpoint(jobs.get(boundary)!);
      expect({ ...message.result, computeMs: 0 }).toEqual({ ...expected, computeMs: 0 });
    }
    const frozenBefore = JSON.parse(new TextDecoder().decode(jobs.get(256)!.bytes)) as GameSnapshot;
    const frozenJoined = JSON.parse(new TextDecoder().decode(jobs.get(257)!.bytes)) as GameSnapshot;
    expect(frozenBefore.party!.state.members.some(m => m.actorId === targetId)).toBe(false);
    expect(frozenBefore.run.world5!.residents.some(row => row.actorId === targetId)).toBe(true);
    expect(frozenJoined.party!.state.members.some(m => m.actorId === targetId)).toBe(true);
    expect(frozenJoined.run.world5!.residents.some(row => row.actorId === targetId)).toBe(false);
    expect(old.result.full.domains.party).not.toBe(joinedMessage.result.full.domains.party);
    adapter.onmessage({ data: joinedMessage }); await microtasks();
    // A ready newer result cannot publish past the withheld older prefix.
    expect(g.recordedInputEvents[255]!.fullCheckpoint).toBeNull();
    expect(g.recordedInputEvents[256]!.fullCheckpoint).toBeNull();
    expect(g.recordedInputEvents[256]!.chainDigest).toBe('');
    expect(digest()).toEqual(joined); expect(root.actors.get(targetId)).toBe(member);
    adapter.onmessage({ data: old }); await g.flushRecording();
    expect(g.recordedInputEvents[255]!.fullCheckpoint).toEqual(old.result.full);
    expect(g.recordedInputEvents[256]!.fullCheckpoint).toEqual(joinedMessage.result.full);
    expect(digest()).toEqual(joined); expect(root.state).toEqual(joinedState);
    expect(g.party).toBe(root); expect(root.actors.get(targetId)).toBe(member);
    expect(member.inventory.items).toBe(inventory); expect(root.native[targetId]).toBe(native);
    expect(g.world5!.residents).toBe(residents);
    expect(rng.getState()).toEqual(random); expect(getNextEntityId()).toBe(allocator);
    expect(timeSystem.currentTick).toBe(tick); assertChains();

    // Repeat across member -> stationed, while replaying already completed
    // pre-join responses against two genuinely outstanding newer requests.
    for (let n = 0; n < 40 && g.activeControlledActors.some(actor => actor.ticksUntilTurn > 0); n++) {
      acknowledge(); g.submitPartyIntent({ kind: 'wait' }, g.readyPartyActorId!);
    }
    expect(g.activeControlledActors.every(actor => actor.ticksUntilTurn === 0)).toBe(true);
    while (g.recordedInputEvents.length < 512) policy();
    roster('station'); expect(g.recordedInputEvents).toHaveLength(513);
    const stationed = digest(), stationedState = structuredClone(root.state);
    const stationedNative = root.stationedNative[targetId], stationedRandom = rng.getState();
    const stationedTick = timeSystem.currentTick, stationedAllocator = getNextEntityId();
    expect(root.stationed.get(targetId)).toBe(member); expect(root.actors.has(targetId)).toBe(false);
    adapter.onmessage({ data: old }); adapter.onmessage({ data: joinedMessage }); await microtasks();
    expect(g.recordedInputEvents[511]!.fullCheckpoint).toBeNull();
    expect(g.recordedInputEvents[512]!.fullCheckpoint).toBeNull();
    expect(g.recordingInputBlocked).toBe(true); expect(g.recordingFailure).toBeNull();
    expect(digest()).toEqual(stationed);
    const beforeStationMessage = await messageAt(512), stationedMessage = await messageAt(513);
    for (const boundary of [512, 513]) {
      const message = messages.get(boundary)!, expected = computeCheckpoint(jobs.get(boundary)!);
      expect({ ...message.result, computeMs: 0 }).toEqual({ ...expected, computeMs: 0 });
    }
    const frozenMember = JSON.parse(new TextDecoder().decode(jobs.get(512)!.bytes)) as GameSnapshot;
    const frozenStationed = JSON.parse(new TextDecoder().decode(jobs.get(513)!.bytes)) as GameSnapshot;
    expect(frozenMember.party!.actors.some(actor => actor.id === targetId)).toBe(true);
    expect(frozenMember.party!.stationed.some(actor => actor.id === targetId)).toBe(false);
    expect(frozenStationed.party!.actors.some(actor => actor.id === targetId)).toBe(false);
    expect(frozenStationed.party!.stationed.some(actor => actor.id === targetId)).toBe(true);
    adapter.onmessage({ data: stationedMessage }); await microtasks();
    expect(g.recordedInputEvents[511]!.fullCheckpoint).toBeNull();
    expect(g.recordedInputEvents[512]!.fullCheckpoint).toBeNull();
    adapter.onmessage({ data: beforeStationMessage }); await g.flushRecording();
    expect(g.recordedInputEvents[511]!.fullCheckpoint).toEqual(beforeStationMessage.result.full);
    expect(g.recordedInputEvents[512]!.fullCheckpoint).toEqual(stationedMessage.result.full);
    expect(g.party).toBe(root); expect(root.state).toEqual(stationedState);
    expect(root.stationed.get(targetId)).toBe(member); expect(root.actors.has(targetId)).toBe(false);
    expect(root.stationedNative[targetId]).toBe(stationedNative); expect(root.native[targetId]).toBeUndefined();
    expect(member.inventory.items).toBe(inventory); expect(digest()).toEqual(stationed);
    expect(rng.getState()).toEqual(stationedRandom); expect(getNextEntityId()).toBe(stationedAllocator);
    expect(timeSystem.currentTick).toBe(stationedTick);
    expect(backend.kind).toBe('worker'); expect(backend.fallbackReason).toBeNull();
    expect(g.recordingMetrics.peakJobs).toBe(2); expect(g.recordingFailure).toBeNull();
    assertChains();
    const save = await g.toSaveSnapshotAsync(); delete save.run.recordingOrigin;
    loaded = new Game({ seed: 2 });
    expect(loaded.loadSnapshot(save)).toBe(true);
    expect(loaded.party!.actors.has(targetId)).toBe(false);
    expect(loaded.party!.stationed.get(targetId)?.hp).toBe(member.hp);
    expect(loaded.party!.state).toEqual(stationedState);
  } finally {
    g.disposeRecording(); loaded?.disposeRecording();
    rmSync(directory, { recursive: true, force: true });
  }
}, 600000);
