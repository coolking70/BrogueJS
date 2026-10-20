import { afterEach, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import '../../../../i18n';
import { Game, type GameRecording } from '../../../../engine/Core/Game';
import { createHeadlessGame } from '../../../../test/harness';
import { createExtensionRegistry } from '../../../catalog';
import { logger } from '../../../../engine/Systems/Logger';
import { rng } from '../../../../engine/Random';
import { mechanicalDigest } from '../../../../engine/Core/RecordingDigest';
import { TerrainType } from '../../../../engine/Map/Grid';
import { scene as stageCampGeometry, current } from '../../settlement/tests/helpers';
import { bedroom } from '../../settlement/tests/residentHelpers';
import { worldWorkLastError } from '../../../../engine/Core/WorldWork';
import { residentRecord } from '../../../../engine/Core/ResidentWorld';
import type { WorldHarness } from '../../../worldSdk';
import { buildNarrativeUiCommand, readNarrativeUiView } from '../../narrative/ui/view';
import {
  assertNaturalPlacement, json, narrative, newBudget, settle, target
} from '../../narrative/tests/narrative2_naturalFixture';

const games: Game[] = [];
const fingerprint = (g: Game) => mechanicalDigest(g.toSnapshot(), (g as any).recordingInputState());
const track = (g: Game) => { games.push(g); return g; };
afterEach(() => { for (const g of games.splice(0)) g.disposeRecording(); logger.reset(); logger.onDisturb = null; });
function roster(g: Game, id: number) {
  settle(g);
  g.executeCommand('party:roster', { kind: 'party:roster', schema: 1,
    expectedRevision: g.party!.state.revision, issuerSlot: 'local:0', actorId: g.player.id,
    targetId: id, operation: 'join', campId: null, level: { kind: 'dungeon', depth: g.depth } });
}
function dialogue(g: Game, action: 'open' | 'choose' | 'close', id?: string | number) {
  settle(g);
  const input = buildNarrativeUiCommand(g, readNarrativeUiView(g)!, action, id);
  expect(input, `${action}:${id ?? ''} ${JSON.stringify(readNarrativeUiView(g)?.active)}`).not.toBeNull();
  const events = g.recordedInputEvents.length;
  g.executeCommand('ext:command', input!);
  settle(g);
  expect(g.recordedInputEvents.length, `accepted narrative ${action}:${id ?? ''}`).toBe(events + 1);
  if (action === 'close') expect(narrative(g).active).toBeNull();
}
function wait(g: Game) {
  settle(g);
  expect(g.readyPartyActorId).not.toBeNull();
  g.submitPartyIntent({ kind: 'wait' }, g.readyPartyActorId!);
}
function walkStep(g: Game, goal: { x: number; y: number }) {
  settle(g); while (g.player.ticksUntilTurn > 0) wait(g);
  const key = (p: { x: number; y: number }) => `${p.x},${p.y}`;
  const queue = [{ ...g.player.loc }], previous = new Map<string, { x: number; y: number } | null>([[key(g.player.loc), null]]);
  let found: { x: number; y: number } | undefined;
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i]!;
    if (key(p) === key(goal)) { found = p; break; }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = { x: p.x + dx!, y: p.y + dy! }, cell = g.grid.getCell(n.x, n.y);
      if (!cell || !(cell.isPassable || cell.terrain === TerrainType.DOOR || cell.terrain === TerrainType.SECRET_DOOR)
        || cell.layers.some(t => [TerrainType.LAVA, TerrainType.CHASM, TerrainType.WATER_DEEP].includes(t))
        || previous.has(key(n)) || g.activeControlledActors.some(a => a !== g.player && a.x === n.x && a.y === n.y)) continue;
      previous.set(key(n), p); queue.push(n);
    }
  }
  expect(found, `route D${g.depth} ${key(g.player.loc)} -> ${key(goal)}`).toBeDefined();
  let next = found!;
  for (let p = previous.get(key(next)); p && key(p) !== key(g.player.loc); p = previous.get(key(next))) next = p;
  g.submitPartyIntent(g.grid.getCell(next.x, next.y)!.terrain === TerrainType.SECRET_DOOR
    ? { kind: 'search' } : { kind: 'move', dx: next.x - g.player.x, dy: next.y - g.player.y }, g.player.id);
  settle(g);
}
/** Actual installed content, placement depths and public movement. Other initial
 * members are explicitly left on D1, so the four-slot case also covers frozen capacity. */
function arrival(count = 1, additionalModules: string[] = []) {
  const g = track(createHeadlessGame(1, 'test')), registry = createExtensionRegistry();
  const ids = ['party', 'narrative', ...additionalModules], configurations = { party: { schema: 1, members: count } };
  const manifest = registry.manifest(ids, configurations);
  const initialCommands = registry.create(manifest).flatMap(m => m.initialCommand
    ? [JSON.stringify({ module: m.id, ...m.initialCommand })] : []);
  // Seed 2 is the existing narrative2-five-wizard natural placement seed.
  g.startNewGame({ seed: 2, mode: 'wizard', ruleSet: 'extended', extensions: ids,
    extensionConfigurations: configurations, initialCommands });
  g.animationEnabled = false; settle(g);
  const budget = newBudget();
  while (g.depth < 2 || !target(g, 'cord.mender')) {
    expect(budget.commands++).toBeLessThan(1800);
    expect(g.depth, JSON.stringify({ placements: narrative(g).placementReceipts,
      pending: narrative(g).pendingPlacements, entities: g.extensionRuntime!.worldWorkEntities(), at: g.player.loc })).toBeLessThan(3);
    while (g.player.ticksUntilTurn > 0) wait(g);
    const stairs = g.levelSeeds[g.depth - 1]!.downStairsLoc;
    if (g.player.x === stairs.x && g.player.y === stairs.y) {
      settle(g);
      g.executeCommand('party:control', { kind: 'party:control', schema: 1,
        expectedRevision: g.party!.state.revision, issuerSlot: 'local:0', actorId: g.player.id,
        change: { kind: 'travel-party', destination: { kind: 'dungeon', depth: g.depth + 1 },
          leavingBehind: g.activeControlledActors.filter(a => a !== g.player).map(a => a.id) } });
      budget.entrances[g.depth] = { ...g.player.loc };
    } else walkStep(g, stairs);
  }
  const npc = target(g, 'cord.mender')!;
  while (!g.extensionRuntime!.nearbyInteractables('narrative').some(e => e.id === npc.id)) {
    expect(budget.commands++).toBeLessThan(1800); walkStep(g, npc);
  }
  assertNaturalPlacement(g, 'cord.mender', budget.entrances[g.depth]);
  if(!additionalModules.length)expect(Object.keys(g.extensionRuntime!.snapshot().modules).sort()).toEqual(['narrative', 'party']);
  else expect(Object.keys(g.extensionRuntime!.snapshot().modules).sort()).toEqual([...ids].sort());
  expect(narrative(g).placementReceipts).toContainEqual(expect.objectContaining({
    npcId: 'cord.mender', instanceKey: npc.instanceKey, result: 'placed'
  }));
  return { g, id: npc.id };
}
function splice(g: Game, id: number) {
  dialogue(g, 'open', id);
  for (const choice of ['ask', 'consider', 'choose-a']) dialogue(g, 'choose', choice);
  expect(narrative(g).flags['cord.mender.verdict']).toBe('splice');
  const prefix = g.recordedInputEvents.length, before = fingerprint(g);
  expect(() => roster(g, id)).toThrow('DECISION_REQUIRED');
  expect(g.recordedInputEvents).toHaveLength(prefix); expect(fingerprint(g)).toEqual(before);
  dialogue(g, 'choose', 'leave-a');
  expect(narrative(g).active).toBeNull();
}
function loaded(save: ReturnType<Game['toSaveSnapshot']>) {
  const g = track(new Game({ seed: 7 }));
  expect(g.loadSnapshot(json(save), message => console.error(message))).toBe(true);
  g.animationEnabled = false; settle(g); return g;
}
function replay(g: Game, recording: GameRecording) {
  if (process.env.PARTY_P1D_NARRATIVE_CAPTURE) writeFileSync(join(process.env.PARTY_P1D_NARRATIVE_CAPTURE, 'narrative-recording.json'), JSON.stringify(recording) + '\n');
  expect(g.loadReplay(json(recording))).toBe(true);
  g.animationEnabled = false;
  while (g.replayCursor < recording.events.length && !g.replayError) {
    const cursor = g.replayCursor;
    settle(g); g.replayStep(true);
    expect(g.replayError || g.replayCursor > cursor, `replay made progress at ${cursor}`).toBeTruthy();
  }
  expect(g.replayError).toBeNull();
  expect(g.replayCursor).toBe(recording.events.length);
}

it('P+narrative natural splice recruits once, survives save/load, seed replay, bidirectional seek and continuation', () => {
  const { g, id } = arrival();
  const untouched = fingerprint(g), events = g.recordedInputEvents.length, random = rng.getState();
  expect(() => roster(g, id)).toThrow('INVALID_TARGET');
  expect(fingerprint(g)).toEqual(untouched); expect(g.recordedInputEvents).toHaveLength(events); expect(rng.getState()).toEqual(random);
  dialogue(g, 'open', id); dialogue(g, 'close');
  expect(() => roster(g, id)).toThrow('INVALID_TARGET');
  splice(g, id);
  const receipts = json(narrative(g).rewardReceipts), placements = json(narrative(g).placementReceipts);
  expect(receipts.filter(r => r.id === 'cord.mender.reward.receipt')).toHaveLength(1);
  const beforeSave = json(g.toSaveSnapshot()), beforeIndex = g.recordedInputEvents.length, beforeDigest = fingerprint(g);
  if (process.env.PARTY_P1D_NARRATIVE_CAPTURE) {
    mkdirSync(process.env.PARTY_P1D_NARRATIVE_CAPTURE, { recursive: true });
    writeFileSync(join(process.env.PARTY_P1D_NARRATIVE_CAPTURE, 'narrative-before-join.json'),
      JSON.stringify({ schema: 1, kind: 'diagnostic-origin', targetId: id, campId: null, snapshot: g.toSnapshot() }) + '\n');
  }
  roster(g, id);
  expect(g.party!.actors.get(id)?.hp).toBe(20);
  expect(g.party!.state.sources.find(s => s.actorId === id)).toMatchObject({ kind: 'narrative', template: 'cord.mender' });
  expect(g.extensionRuntime!.worldWorkEntities().some(e => e.id === id)).toBe(false);
  expect(narrative(g).npcBindings[id]).toBeUndefined();
  expect(narrative(g).rewardReceipts).toEqual(receipts); expect(narrative(g).placementReceipts).toEqual(placements);
  const joined = fingerprint(g), joinedIndex = g.recordedInputEvents.length, joinedSave = json(g.toSaveSnapshot());
  expect(() => roster(g, id)).toThrow('BAD_ACTOR');
  expect(fingerprint(g)).toEqual(joined); expect(g.recordedInputEvents).toHaveLength(joinedIndex);
  const continued = loaded(beforeSave);
  expect(fingerprint(continued)).toEqual(beforeDigest);
  roster(continued, id); expect(fingerprint(continued)).toEqual(joined);
  expect(fingerprint(loaded(joinedSave))).toEqual(joined);
  const recording = json(continued.exportRecording()), playback = track(new Game({ seed: 9 }));
  replay(playback, recording); expect(fingerprint(playback)).toEqual(joined);
  for (const [index, digest] of [[beforeIndex, beforeDigest], [joinedIndex, joined], [0, null], [joinedIndex, joined]] as const) {
    playback.replaySeek(index); expect(playback.replayError).toBeNull(); expect(playback.replayCursor).toBe(index);
    if (digest) expect(fingerprint(playback)).toEqual(digest);
  }
  const tail = loaded(joinedSave); wait(tail); wait(tail);
  expect(narrative(tail).rewardReceipts).toEqual(receipts);
  const final = fingerprint(tail), extended = json(tail.exportRecording());
  if(process.env.PARTY_P1D_NARRATIVE_CAPTURE)writeFileSync(join(process.env.PARTY_P1D_NARRATIVE_CAPTURE,'narrative-joined-save.json'),JSON.stringify(tail.toSaveSnapshot()));
  expect(extended.events.filter(e => e.action === 'party:roster')).toHaveLength(1);
  replay(playback, extended); expect(fingerprint(playback)).toEqual(final);
}, 240000);

it('a full initial roster retains the real narrative qualification and rewards after refused recruitment', () => {
  const { g, id } = arrival(4);
  expect(g.party!.state.members.filter(m => m.life === 'frozen')).toHaveLength(3);
  splice(g, id);
  const before = fingerprint(g), events = g.recordedInputEvents.length, receipts = json(narrative(g).rewardReceipts);
  expect(() => roster(g, id)).toThrow('NO_SPACE');
  expect(fingerprint(g)).toEqual(before); expect(g.recordedInputEvents).toHaveLength(events);
  expect(narrative(g).rewardReceipts).toEqual(receipts);
  expect(g.extensionRuntime!.worldWorkEntities().some(e => e.id === id)).toBe(true);
}, 240000);

it('rejects forged narrative source and proof from a real joined diagnostic snapshot before replacing the live game', () => {
  const { g, id } = arrival(); splice(g, id); roster(g, id);
  const good = json(g.toSnapshot()), before = fingerprint(g), actor = g.player, runtime = g.extensionRuntime;
  const mutations: ((s: typeof good) => void)[] = [
    s => { const source = s.party!.state.sources.find(r => r.actorId === id)!; source.key = 'forged';
      s.party!.state.transfers.filter(r => r.actorId === id).forEach(r => { r.sourceKey = 'forged'; }); },
    s => { s.party!.state.sources.find(r => r.actorId === id)!.kind = 'resident'; },
    s => { (s.extensions!.modules.narrative as unknown as ReturnType<typeof narrative>).flags['cord.mender.verdict'] = 'sever'; },
    s => { (s.extensions!.modules.narrative as unknown as ReturnType<typeof narrative>).placementReceipts =
      (s.extensions!.modules.narrative as unknown as ReturnType<typeof narrative>).placementReceipts.filter(p => p.npcId !== 'cord.mender'); }
  ];
  for (const mutate of mutations) {
    const bad = json(good); mutate(bad);
    expect(g.loadSnapshot(bad)).toBe(false);
    expect(g.player).toBe(actor); expect(g.extensionRuntime).toBe(runtime); expect(fingerprint(g)).toEqual(before);
  }
}, 240000);


it('real narrative qualification survives a paid diagnostic camp station/rejoin without restoring the NPC or its rewards',()=>{
  // Segment A: seed2 actual placement/public walking/original splice chain. No source injection.
  const {g,id}=arrival(1,['settlement']);splice(g,id);roster(g,id);
  const actor=g.party!.actors.get(id)!,receipts=json(narrative(g).rewardReceipts),placements=json(narrative(g).placementReceipts),triggers=json(narrative(g).triggerReceipts);
  const idle=()=>{for(let n=0;n<80&&g.activeControlledActors.some(a=>a.ticksUntilTurn>0);n++)wait(g);expect(g.activeControlledActors.every(a=>a.ticksUntilTurn===0)).toBe(true);};
  idle();
  // Segment B is explicitly diagnostic geometry/budget, not a seed-derived camp.
  // Preserve the real qualified actor, HP, ID and narrative receipts. Every structure
  // and ration reservation below is still paid by ordinary settlement commands.
  stageCampGeometry(g);actor.loc={x:25,y:13};g.refreshStructureDerivedState();
  const h={ext(module:string,action:string,payload:unknown){
    idle();settle(g);g.focusPartyMember(g.player.id);g.onConfirmRequest=()=>true;const before=g.recordedInputEvents.length;
    g.executeCommand('ext:command',JSON.stringify({module,action,payload}));
    while(g.pendingCommandConfirmation)g.resolveCommandDecision(g.pendingCommandConfirmation.token,true);
    while(g.party!.state.window.decision)g.choosePartyDecision('yes');
    return {recorded:g.recordedInputEvents.length>before,error:worldWorkLastError(g)};
  }} as WorldHarness;
  bedroom(h,g);idle();g.player.loc={x:19,y:13};actor.loc={x:20,y:13};g.refreshStructureDerivedState();
  const camp=current(g),health=actor.hp,items=actor.inventory.items;
  settle(g);g.executeCommand('party:roster',{kind:'party:roster',schema:1,expectedRevision:g.party!.state.revision,issuerSlot:'local:0',actorId:g.player.id,targetId:id,operation:'station',campId:camp.regionId,level:{kind:'dungeon',depth:g.depth}});
  expect(g.party!.stationed.get(id)).toBe(actor);expect(residentRecord(g,id)).toBeTruthy();expect(actor.hp).toBe(health);expect(actor.inventory.items).toBe(items);
  expect(g.extensionRuntime!.worldWorkEntities().some(e=>e.id===id)).toBe(false);expect(narrative(g).npcBindings[id]).toBeUndefined();
  expect(buildNarrativeUiCommand(g,readNarrativeUiView(g)!,'open',id)).toBeNull();
  roster(g,id);expect(g.party!.actors.get(id)).toBe(actor);expect(g.party!.stationed.has(id)).toBe(false);expect(residentRecord(g,id)).toBeUndefined();
  expect(()=>roster(g,id)).toThrow('BAD_ACTOR');
  expect(g.extensionRuntime!.worldWorkEntities().some(e=>e.id===id)).toBe(false);expect(narrative(g).npcBindings[id]).toBeUndefined();
  expect(buildNarrativeUiCommand(g,readNarrativeUiView(g)!,'open',id)).toBeNull();
  expect(narrative(g).rewardReceipts).toEqual(receipts);expect(narrative(g).placementReceipts).toEqual(placements);expect(narrative(g).triggerReceipts).toEqual(triggers);
  const diagnostic=json(g.toSnapshot()),readback=track(new Game({seed:4}));expect(readback.loadSnapshot(diagnostic,message=>console.error(message))).toBe(true);
  expect(readback.party!.actors.has(id)).toBe(true);expect(narrative(readback).npcBindings[id]).toBeUndefined();expect(narrative(readback).rewardReceipts).toEqual(receipts);
},240000);
