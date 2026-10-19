import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../../../i18n';
import { Game } from '../../../../engine/Core/Game';
import { timeSystem } from '../../../../engine/Systems/Time';
import { logger } from '../../../../engine/Systems/Logger';
import { rng } from '../../../../engine/Random';
import { getNextEntityId } from '../../../../entities/Creature';
import { TerrainType } from '../../../../engine/Map/Grid';
import { PartyAiV1 } from '../PartyAiV1';
import { defaultPartyAi, type PartyAiInput, type PartyAiView } from '../../../partyAi';
import { partyAiView } from '../../../../engine/Core/PartyAi';
import type { WindowBatch } from '../../../partyWindow';
const games: Game[] = [];
function clear() {
  while (logger.pendingAcknowledgment) logger.acknowledgeNext();
}
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
function send(g: Game, change: PartyAiInput['change']) {
  clear();
  g.executeCommand('party:ai', {
    kind: 'party:ai',
    schema: 1,
    issuerSlot: 'local:0',
    expectedRevision: g.party!.state.revision,
    change
  });
}
function control(g: Game, id: number, kind: 'human' | 'ai') {
  const m = g.party!.state.members.find((m) => m.actorId === id)!;
  send(g, {
    kind: 'controller',
    actorId: id,
    expectedEpoch: m.controlEpoch,
    controller: kind === 'ai' ? { kind, policyId: 'party-ai-v1' } : { kind, slot: 'local:0' }
  });
}
function batch(g: Game, ticks: 100 | 300 | 1000 = 100): WindowBatch {
  return {
    kind: 'party:window',
    schema: 2,
    expectedRevision: g.party!.state.revision,
    issuerSlot: 'local:0',
    seq: g.party!.state.window.seq + 1,
    startTick: timeSystem.currentTick,
    length: { kind: 'ticks', ticks },
    fineActorId: null,
    automatic: false,
    trigger: 'manual',
    plans: []
  };
}
function safe(g: Game) {
  g.monsters = [];
  g.dormantMonsters = [];
  for (const a of g.controlledActors)
    for (let y = a.y - 2; y <= a.y + 2; y++)
      for (let x = a.x - 2; x <= a.x + 2; x++)
        if (g.grid.isValidPos(x, y)) g.grid.setTerrain(x, y, TerrainType.FLOOR);
}
afterEach(() => {
  games.splice(0).forEach((g) => g.disposeRecording());
  clear();
  vi.restoreAllMocks();
});
describe('P1c finite AI and authoritative control', () => {
  it.each([1, 2, 4])('runs all %i AI with finite windows and permits takeover', (n) => {
    const g = start(n);
    safe(g);
    const ids = g.controlledActors.map((a) => a.id);
    for (const id of ids) control(g, id, 'ai');
    const tick = timeSystem.currentTick;
    g.submitPartyWindow(batch(g));
    expect(timeSystem.currentTick - tick).toBe(100);
    for (const m of g.party!.state.members) expect(m.ai.ordinal).toBe(1);
    control(g, ids[0]!, 'human');
    expect(g.party!.state.members[0]!.controller.kind).toBe('human');
  });
  it('same controller request is a no-op including recording/revision/RNG', () => {
    const g = start();
    control(g, g.player.id, 'ai');
    const s = JSON.stringify(g.toSaveSnapshot()),
      r = rng.getState();
    control(g, g.player.id, 'ai');
    expect(JSON.stringify(g.toSaveSnapshot()).replace(/"savedAt":\d+/g, '"savedAt":0')).toBe(
      s.replace(/"savedAt":\d+/g, '"savedAt":0')
    );
    expect(rng.getState()).toEqual(r);
  });
  it('last busy request wins and clears accepted tail; next idle applies once', () => {
    const g = start();
    safe(g);
    const id = g.player.id;
    g.executeCommand('party:actor-step', {
      kind: 'party:actor-step',
      schema: 1,
      expectedRevision: g.party!.state.revision,
      issuerSlot: 'local:0',
      actorId: id,
      intent: { kind: 'wait' }
    });
    expect(g.player.ticksUntilTurn).toBe(100);
    control(g, id, 'ai');
    expect(g.party!.state.members[0]!.controller.kind).toBe('human');
    expect(g.party!.state.members[0]!.pendingController?.kind).toBe('ai');
    control(g, id, 'human');
    g.submitPartyWindow(batch(g));
    expect(g.party!.state.members[0]!.controller.kind).toBe('human');
    expect(g.party!.state.members[0]!.ai.ordinal).toBe(0);
  });
  it('temporary plan preserves tail cursor and clears at window end', () => {
    const g = start();
    safe(g);
    const m = g.party!.state.window.members[0]!;
    m.plan = { kind: 'queue', actions: [{ kind: 'search' }] };
    m.cursor = 0;
    const b = batch(g);
    b.plans = [
      {
        actorId: g.player.id,
        controllerSlot: 'local:0',
        update: 'replace',
        plan: { kind: 'ai-this-window' }
      }
    ];
    g.submitPartyWindow(b);
    expect(m.cursor).toBe(0);
    expect(m.plan).toEqual({ kind: 'queue', actions: [{ kind: 'search' }] });
    expect(g.party!.state.members[0]!.temporaryAiSeq).toBeNull();
    expect(g.party!.state.members[0]!.ai.ordinal).toBe(1);
  });
  it('rejects foreign/stale/partial orders without graph or allocator effects', () => {
    const g = start();
    control(g, g.player.id, 'ai');
    const before = JSON.stringify(g.party),
      r = rng.getState(),
      id = getNextEntityId(),
      events = g.exportRecording().events.length;
    expect(() =>
      send(g, {
        kind: 'order',
        actorIds: [g.player.id, 999999],
        order: { kind: 'explore', level: g.depth }
      })
    ).toThrow('BAD_ACTOR');
    expect(JSON.stringify(g.party)).toBe(before);
    expect(rng.getState()).toEqual(r);
    expect(getNextEntityId()).toBe(id);
    expect(g.exportRecording().events).toHaveLength(events);
  });
  it('uses real recording save/load replay seek and resume for AI control', () => {
    const g = start();
    control(g, g.player.id, 'ai');
    send(g, {
      kind: 'settings',
      actorId: g.player.id,
      expectedEpoch: g.party!.state.members[0]!.controlEpoch,
      settings: { ...defaultPartyAi().settings, tactic: 'still' }
    });
    g.submitPartyWindow(batch(g));
    clear();
    const save = JSON.parse(JSON.stringify(g.toSaveSnapshot())),
      recording = g.exportRecording(),
      root = JSON.parse(JSON.stringify(g.party!.state));
    const h = new Game({ seed: 2 });
    games.push(h);
    expect(h.loadSnapshot(save)).toBe(true);
    expect(h.party!.state).toEqual(root);
    control(h, h.player.id, 'human');
    const resumed = h.exportRecording();
    expect(resumed.events.length).toBe(recording.events.length + 1);
    expect(h.loadReplay(resumed)).toBe(true);
    while (h.replayCursor < resumed.events.length && !h.replayError) {
      clear();
      h.replayStep(true);
    }
    expect(h.replayError).toBeNull();
    h.replaySeek(recording.events.length);
    expect(h.replayError).toBeNull();
    expect(h.party!.state).toEqual(root);
  });
  it('known view never changes native streams or control ordinals', () => {
    const g = start();
    const before = rng.getState(),
      ordinal = g.party!.state.members[0]!.ai.ordinal;
    const a = partyAiView(g, g.player, g.party!.state.members[0]!.ai);
    PartyAiV1.decide(a);
    expect(rng.getState()).toEqual(before);
    expect(g.party!.state.members[0]!.ai.ordinal).toBe(ordinal);
  });
});
const view = (): PartyAiView => ({
  seed: '42',
  fingerprint: 'rule',
  actorId: 1,
  ordinal: 0,
  level: 1,
  at: { x: 2, y: 2 },
  hp: 20,
  maxHp: 20,
  leader: { x: 5, y: 2 },
  cells: Array.from({ length: 49 }, (_, i) => ({
    x: i % 7,
    y: Math.floor(i / 7),
    passable: true,
    danger: false,
    stairs: false
  })),
  occupied: [],
  enemies: [],
  recovery: [],
  rangedItem: null,
  pickups: [],
  settings: defaultPartyAi().settings,
  order: null
});
describe('P1c lawful pure policy', () => {
  it.each(['follow', 'attack', 'distance', 'defend', 'still'] as const)(
    'implements %s and bounded normal wait',
    (tactic) => {
      const v = view();
      v.settings.tactic = tactic;
      const a = PartyAiV1.decide(v);
      expect(a.nodes).toBeLessThanOrEqual(4096);
      expect(a.intent.kind).toBe(tactic === 'follow' ? 'move' : 'wait');
    }
  );
  it('does not cross unknown/dangerous cells or occupied destinations', () => {
    const v = view();
    v.cells = v.cells.filter((c) => c.x <= 2);
    expect(PartyAiV1.decide(v).intent.kind).toBe('wait');
    v.cells = view().cells.map((c) => ({ ...c, danger: c.x === 3 }));
    expect(PartyAiV1.decide(v).intent.kind).toBe('wait');
  });
  it('still may defend and recover, cannot obey displacement order', () => {
    const v = view();
    v.settings.tactic = 'still';
    v.order = { kind: 'retreat', level: 1, x: 6, y: 6 };
    expect(PartyAiV1.decide(v).intent.kind).toBe('wait');
    v.enemies = [{ id: 5, x: 3, y: 2, attackable: true, ranged: false }];
    expect(PartyAiV1.decide(v).intent).toEqual({ kind: 'attack', targetId: 5 });
    v.settings.consumables = true;
    v.recovery = [9];
    expect(PartyAiV1.decide(v).intent.kind).toBe('item');
  });
  it('ranged fallback consumes only actor-owned ammunition offered by view', () => {
    const v = view();
    v.settings.tactic = 'distance';
    v.enemies = [{ id: 5, x: 5, y: 2, attackable: true, ranged: true }];
    expect(PartyAiV1.decide(v).diagnostic).toBe('no-ranged');
    v.rangedItem = 8;
    expect(PartyAiV1.decide(v).intent).toEqual({
      kind: 'item',
      operation: 'throw',
      itemId: 8,
      target: { x: 5, y: 2 }
    });
  });
  it('caps expansions deterministically at 4096', () => {
    const v = view();
    v.leader = { x: 500, y: 500 };
    v.cells = Array.from({ length: 10000 }, (_, i) => ({
      x: i % 100,
      y: Math.floor(i / 100),
      passable: true,
      danger: false,
      stairs: false
    }));
    const a = PartyAiV1.decide(v);
    expect(a.diagnostic).toBe('budget');
    expect(a.nodes).toBe(4096);
    expect(PartyAiV1.decide(structuredClone(v))).toEqual(a);
  });
});
