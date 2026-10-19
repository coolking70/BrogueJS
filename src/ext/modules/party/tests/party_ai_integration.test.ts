import {writeFileSync} from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import '../../../../i18n';
import { Game } from '../../../../engine/Core/Game';
import { logger } from '../../../../engine/Systems/Logger';
import { timeSystem } from '../../../../engine/Systems/Time';
import { rng } from '../../../../engine/Random';
import { ItemLoader } from '../../../../engine/Items/ItemLoader';
import { Monster } from '../../../../entities/Monster';
import monsters from '../../../../data/monsters.json';
import type { MonsterData } from '../../../../entities/Monster';
import { entrancementDiagonalBlocked } from '../../../../engine/Movement/Entrancement';
import { TerrainType } from '../../../../engine/Map/Grid';
import { mechanicalDigest } from '../../../../engine/Core/RecordingDigest';
import { partyAiView, eligiblePartyCompanion } from '../../../../engine/Core/PartyAi';
import { PartyAiV1 } from '../PartyAiV1';
import type { PartyAiInput } from '../../../partyAi';
const games: Game[] = [];
const clear = () => {
  while (logger.pendingAcknowledgment) logger.acknowledgeNext();
};
function start(n = 2) {
  const g = new Game({ seed: 1 });
  games.push(g);
  g.startNewGame({
    seed: 42,
    ruleSet: 'extended',
    extensions: ['party'],
    extensionConfigurations: { party: { schema: 1, members: n } },
    initialCommands: [
      JSON.stringify({ module: 'party', action: 'create', payload: { schema: 1, members: n } })
    ]
  });
  g.animationEnabled = false;
  clear();
  return g;
}
function ai(g: Game, change: PartyAiInput['change']) {
  clear();
  g.executeCommand('party:ai', {
    kind: 'party:ai',
    schema: 1,
    issuerSlot: 'local:0',
    expectedRevision: g.party!.state.revision,
    change
  });
}
function control(g: Game, id: number, kind: 'ai' | 'human') {
  ai(g, {
    kind: 'controller',
    actorId: id,
    expectedEpoch: g.party!.state.members.find((m) => m.actorId === id)!.controlEpoch,
    controller: kind === 'ai' ? { kind, policyId: 'party-ai-v1' } : { kind, slot: 'local:0' }
  });
}
function window(g: Game) {
  clear();
  g.submitPartyWindow({
    kind: 'party:window',
    schema: 2,
    seq: g.party!.state.window.seq + 1,
    expectedRevision: g.party!.state.revision,
    issuerSlot: 'local:0',
    startTick: timeSystem.currentTick,
    length: { kind: 'ticks', ticks: 100 },
    fineActorId: null,
    automatic: false,
    trigger: 'manual',
    plans: []
  });
}
const digest = (g: Game) => mechanicalDigest(g.toSnapshot(), (g as any).recordingInputState());
afterEach(() => {
  games.splice(0).forEach((g) => g.disposeRecording());
  clear();
  vi.restoreAllMocks();
});
it('single-step explicit AI advance stops at first human and rejects all-AI with no writes', () => {
  const g = start();
  control(g, g.player.id, 'ai');
  clear();
  g.advancePartyToHuman();
  expect(g.readyPartyActorId).toBe(g.controlledActors[1]!.id);
  expect(g.party!.state.members[0]!.ai.ordinal).toBe(1);
  expect(timeSystem.currentTick).toBe(0);
  control(g, g.controlledActors[1]!.id, 'ai');
  const before = digest(g);
  expect(() => g.advancePartyToHuman()).toThrow('NOT_CONTROLLER');
  expect(digest(g)).toEqual(before);
});
it('AI preview runs the known policy with isolated ordinals and no world/RNG pollution', async () => {
  const g = start();
  control(g, g.player.id, 'ai');
  const planner = g.partyPlanner()!,
    view = g.knownPartyWorld(),
    b = planner.batch(timeSystem.currentTick, { kind: 'ticks', ticks: 300 }, null);
  const before = digest(g),
    random = rng.getState();
  const p = await planner.rehearse(view, b, (v) => g.decideKnownPartyAi(v));
  expect(p?.uncertain).toBe(true);
  expect(digest(g)).toEqual(before);
  expect(rng.getState()).toEqual(random);
  const hidden = g.monsters.find((m) => !g.grid.getCell(m.x, m.y)?.isVisible);
  if (hidden) hidden.hp--;
  expect(g.knownPartyWorld()).toEqual(view);
  expect(await planner.rehearse(g.knownPartyWorld(), b, (v) => g.decideKnownPartyAi(v))).toEqual(p);
});
it('pending switch while answering a real food confirmation persists and local management retains authority', () => {
  const g = start(),
    id = g.player.id,
    food = g.player.inventory.items.find((i) => i.consumableId === 'ration_of_food')!;
  clear();
  const planner = g.partyPlanner()!;
  planner.edit(id, {
    kind: 'queue',
    actions: [{ kind: 'item', operation: 'use', itemId: food.id, target: null }]
  });
  g.submitPartyWindow(planner.batch(timeSystem.currentTick, { kind: 'ticks', ticks: 100 }, null));
  expect(g.party!.state.window.decision).not.toBeNull();
  control(g, id, 'ai');
  expect(g.party!.state.members[0]!.pendingController?.kind).toBe('ai');
  const saved = JSON.parse(JSON.stringify(g.toSaveSnapshot()));
  const h = new Game({ seed: 1 });
  games.push(h);
  expect(h.loadSnapshot(saved)).toBe(true);
  clear();
  h.choosePartyDecision('no');
  expect(h.party!.state.window.decision).toBeNull();
  expect(h.party!.state.members[0]!.ai.ordinal).toBe(0);
  window(h);
  expect(h.party!.state.members[0]!.controller.kind).toBe('ai');
});
it('known recovery uses only own identified whitelist and disabled settings never drink', () => {
  const g = start(),
    m = g.party!.state.members[0]!,
    a = g.player,
    p = ItemLoader.spawnPotion('potion_of_life', -1, -1)!;
  a.inventory.addItem(p);
  a.hp = 1;
  let v = partyAiView(g, a, m.ai);
  expect(v.recovery).not.toContain(p.id);
  ItemLoader.identifiedItems.add('potion_of_life');
  v = partyAiView(g, a, m.ai);
  expect(v.recovery).toContain(p.id);
  expect(PartyAiV1.decide(v).diagnostic).not.toBe('recover');
  v.settings.consumables = true;
  expect(PartyAiV1.decide(v).intent).toMatchObject({ kind: 'item', itemId: p.id });
  expect(
    partyAiView(g, g.controlledActors[1]!, g.party!.state.members[1]!.ai).recovery
  ).not.toContain(p.id);
});
it('native ally receives an order without joining roster or borrowing a player turn', () => {
  const g = start();
  const a = g.player;
  g.monsters = [];
  g.dormantMonsters = [];
  for (let y = a.y - 3; y <= a.y + 3; y++)
    for (let x = a.x - 3; x <= a.x + 3; x++)
      if (g.grid.isValidPos(x, y)) g.grid.setTerrain(x, y, TerrainType.FLOOR);
  const ally = new Monster(a.x + 2, a.y, (monsters as MonsterData[]).find((m) => m.id === 'rat')!);
  ally.isAlly = true;
  g.monsters.push(ally);
  expect(eligiblePartyCompanion(g, ally.id)).toBe(ally);
  (g as any).updateVision();
  ai(g, {
    kind: 'order',
    actorIds: [ally.id],
    order: { kind: 'guard', level: g.depth, x: a.x + 2, y: a.y + 1 }
  });
  window(g);
  expect(g.party!.state.companionOrders[0]!.ai.ordinal).toBeGreaterThan(0);
  expect(g.party!.state.members).toHaveLength(2);
  expect(timeSystem.currentTick).toBe(100);
  const save = JSON.parse(JSON.stringify(g.toSaveSnapshot()));
  const h = new Game({ seed: 1 });
  games.push(h);
  expect(h.loadSnapshot(save)).toBe(true);
  expect(h.party!.state.companionOrders).toEqual(g.party!.state.companionOrders);
  ally.isCaged = true;
  expect(() =>
    ai(g, { kind: 'order', actorIds: [ally.id], order: { kind: 'explore', level: g.depth } })
  ).toThrow('BAD_ACTOR');
});
it('two AI explore an unmodified natural simple level and stop at choices', async () => {
  const g = start();
  const initial = g.controlledActors.map((a) => ({ ...a.loc }));
  for (const m of g.party!.state.members) {
    control(g, m.actorId, 'ai');
    clear();
    g.executeCommand('party:policy', {
      kind: 'party:policy',
      schema: 2,
      issuerSlot: 'local:0',
      expectedRevision: g.party!.state.revision,
      actorId: m.actorId,
      change: {
        kind: 'reactions',
        emptyPlan: 'wait',
        values: {
          'new-hostile': 'continue',
          damage: 'continue',
          'negative-status': 'stop',
          'low-hp': 'stop',
          telegraph: 'continue'
        }
      }
    });
  }
  ai(g, {
    kind: 'order',
    actorIds: g.controlledActors.map((a) => a.id),
    order: { kind: 'explore', level: g.depth }
  });
  let stair = false,
    decisions = 0;
  for (let n = 0; n < 450 && !g.isGameOver; n++) {
    const d = g.party!.state.window.decision;
    if (d) {
      decisions++;
      clear();
      g.choosePartyDecision(d.allowedChoiceIds.includes('no') ? 'no' : d.allowedChoiceIds[0]!);
    } else window(g);
    if (g.party!.state.window.receipt?.interrupts.some((f) => f.kind === 'stairs')) {
      stair = true;
      break;
    }
  }
  expect(g.controlledActors.some((a, i) => a.x !== initial[i]!.x || a.y !== initial[i]!.y)).toBe(
    true
  );
  expect(g.party!.state.members.every((m) => m.ai.ordinal > 0)).toBe(true);
  expect({
    stair,
    dead: g.isGameOver,
    decisions,
    diagnostics: g.party!.state.members.map((m) => m.ai.diagnostic)
  }).toMatchObject({ stair: true, dead: false });
  const exit=g.levelSeeds[g.depth-1]!.downStairsLoc!;
  const captain=g.controlledActors.find(a=>a.x===exit.x&&a.y===exit.y)!;expect(captain).toBeTruthy();
  control(g,captain.id,'human');
  ai(g,{kind:'order',actorIds:g.controlledActors.filter(a=>a.id!==captain.id).map(a=>a.id),order:{kind:'gather',level:g.depth,...exit}});
  for(let n=0;n<100&&(g.controlledActors.some(a=>Math.max(Math.abs(a.x-exit.x),Math.abs(a.y-exit.y))>1||entrancementDiagonalBlocked(g.grid,a.loc,exit))||g.controlledActors.some(a=>a.ticksUntilTurn>0));n++)window(g);
  expect(g.controlledActors.every(a=>Math.max(Math.abs(a.x-exit.x),Math.abs(a.y-exit.y))<=1&&!entrancementDiagonalBlocked(g.grid,a.loc,exit))).toBe(true);
  expect(captain.loc).toEqual(exit);clear();g.executeCommand('party:control',{kind:'party:control',schema:1,expectedRevision:g.party!.state.revision,issuerSlot:'local:0',actorId:captain.id,change:{kind:'travel-party',destination:{kind:'dungeon',depth:2},leavingBehind:[]}});
  expect(g.depth).toBe(2);control(g,captain.id,'ai');
  const save=await g.toSaveSnapshotAsync(),record=await g.exportRecordingAsync(),expected=digest(g);
  if(process.env.PARTY_P1C_EVIDENCE){writeFileSync(process.env.PARTY_P1C_EVIDENCE+'/natural.save.json',JSON.stringify(save));writeFileSync(process.env.PARTY_P1C_EVIDENCE+'/natural.recording.json',JSON.stringify(record));}
  const h=new Game({seed:1});games.push(h);expect(h.loadSnapshot(save)).toBe(true);expect(digest(h)).toEqual(expected);expect(h.loadReplay(record)).toBe(true);await h.replaySeekAsync(record.events.length);expect(h.replayError).toBeNull();expect(digest(h)).toEqual(expected);
}, 180000);
