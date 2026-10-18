import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../../../i18n';
import { Game } from '../../../../engine/Core/Game';
import { logger } from '../../../../engine/Systems/Logger';
import { timeSystem } from '../../../../engine/Systems/Time';
import { rng } from '../../../../engine/Random';
import { getNextEntityId } from '../../../../entities/Creature';
import { TerrainType } from '../../../../engine/Map/Grid';
import { mechanicalDigest } from '../../../../engine/Core/RecordingDigest';
import { ItemCategory } from '../../../../engine/Items/Item';
import { PartyPlanningSession, previewPartyWindow } from '../../../../engine/Core/PartyPlanning';
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
function batch(g: Game, ticks: 100 | 300 | 1000 = 100): WindowBatch {
  return {
    kind: 'party:window',
    schema: 1,
    seq: g.party!.state.window.seq + 1,
    expectedRevision: g.party!.state.revision,
    issuerSlot: 'local:0',
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
  for (const a of g.controlledActors) {
    for (let y = a.y - 2; y <= a.y + 2; y++)
      for (let x = a.x - 2; x <= a.x + 2; x++)
        if (g.grid.isValidPos(x, y)) g.grid.setTerrain(x, y, TerrainType.FLOOR);
  }
  clear();
}
beforeEach(() => vi.spyOn(Date, 'now').mockReturnValue(1792252800000));
afterEach(() => {
  games.splice(0).forEach((g) => g.disposeRecording());
  clear();
  vi.restoreAllMocks();
});
describe('P1b window clock and accepted prefix', () => {
  it.each([1, 2, 4])('runs %i members for exactly 100 ticks', (n) => {
    const g = start(n);
    safe(g);
    const tick = timeSystem.currentTick,
      turn = g.absoluteTurnNumber;
    g.submitPartyWindow(batch(g));
    expect(timeSystem.currentTick - tick).toBe(100);
    expect(g.absoluteTurnNumber - turn).toBe(1);
    expect(g.party!.state.window.receipt!.trace).toHaveLength(n);
    expect(g.party!.state.window.phase).toBe('planning');
  });
  it.each([25, 50, 100, 200, 400])('preserves speed %i residual and per-member counts', (speed) => {
    const g = start();
    safe(g);
    Object.defineProperty(g.player, 'infoMovementSpeed', { get: () => speed });
    g.player.refreshSpeeds();
    const tick = timeSystem.currentTick;
    g.submitPartyWindow(batch(g, 300));
    expect(timeSystem.currentTick - tick).toBe(300);
    const trace = g.party!.state.window.receipt!.trace;
    expect(trace.filter((t) => t.actorId === g.player.id)).toHaveLength(Math.ceil(300 / speed));
    expect(trace.filter((t) => t.actorId !== g.player.id)).toHaveLength(3);
    expect(g.player.ticksUntilTurn).toBe(Math.ceil(300 / speed) * speed - 300);
  });
  it('fine explicitly waits for a slow selected actor, then resumes an existing long action', () => {
    const g = start();
    safe(g);
    Object.defineProperty(g.player, 'infoMovementSpeed', { get: () => 400 });
    g.player.refreshSpeeds();
    g.submitPartyWindow(batch(g));
    expect(g.player.ticksUntilTurn).toBe(300);
    clear();
    const b = batch(g);
    b.length = { kind: 'fine' };
    b.fineActorId = g.player.id;
    g.submitPartyWindow(b);
    expect(g.party!.state.window.elapsed).toBe(300);
    expect(
      g.party!.state.window.receipt!.trace.filter((t) => t.actorId === g.player.id)
    ).toHaveLength(0);
    expect(g.party!.state.window.receipt!.reason).toBe('fine-action');
  });
  it.each([
    'revision',
    'sequence',
    'tick',
    'actor',
    'slot',
    'duplicate',
    'long',
    'keep',
    'numeric-string'
  ] as const)('rejects %s with graph, streams, IDs and prefix unchanged', (bad) => {
    const g = start(),
      b = batch(g),
      id = g.player.id;
    b.plans = [
      {
        actorId: id,
        controllerSlot: 'local:0',
        update: 'replace',
        plan: { kind: 'queue', actions: [{ kind: 'wait' }] }
      }
    ];
    if (bad === 'revision') b.expectedRevision++;
    if (bad === 'sequence') b.seq++;
    if (bad === 'tick') b.startTick++;
    if (bad === 'actor') b.plans[0]!.actorId = 999999;
    if (bad === 'slot') b.issuerSlot = 'local:1';
    if (bad === 'duplicate') b.plans.push(b.plans[0]!);
    if (bad === 'long')
      b.plans[0]!.plan = {
        kind: 'queue',
        actions: Array.from({ length: 33 }, () => ({ kind: 'wait' }))
      };
    if (bad === 'numeric-string') (b.length as any).ticks = '100';
    if (bad === 'keep') b.plans[0]!.update = 'keep';
    const snapshot = JSON.stringify(g.toSnapshot()),
      random = rng.getState(),
      allocator = getNextEntityId(),
      prefix = JSON.stringify(g.exportRecording());
    expect(() => g.submitPartyWindow(b)).toThrow();
    expect(JSON.stringify(g.toSnapshot())).toBe(snapshot);
    expect(rng.getState()).toEqual(random);
    expect(getNextEntityId()).toBe(allocator);
    expect(JSON.stringify(g.exportRecording())).toBe(prefix);
  });
  it('persists a queue tail and retains its invalid next step', () => {
    const g = start();
    safe(g);
    const b = batch(g);
    b.plans = [
      {
        actorId: g.player.id,
        controllerSlot: 'local:0',
        update: 'replace',
        plan: { kind: 'queue', actions: [{ kind: 'wait' }, { kind: 'move', dx: 1, dy: 0 }] }
      }
    ];
    g.submitPartyWindow(b);
    expect(g.party!.state.window.members[0]!.cursor).toBe(1);
    g.grid.setTerrain(g.player.x + 1, g.player.y, TerrainType.WALL);
    clear();
    g.submitPartyWindow(batch(g));
    expect(g.party!.state.window.members[0]!.cursor).toBe(1);
    expect(g.party!.state.window.receipt!.interrupts.some((f) => f.kind === 'plan-invalid')).toBe(
      true
    );
  });
  it('natural windows save, reload, replay, seek and continue with semantic full preserved', () => {
    const g = start();
    g.submitPartyWindow(batch(g));
    clear();
    g.submitPartyWindow(batch(g));
    const save = JSON.parse(JSON.stringify(g.toSaveSnapshot())),
      rec = g.exportRecording(),
      digest = mechanicalDigest(g.toSnapshot(), (g as any).recordingInputState());
    expect(save.version).toBe(9);
    expect(rec.version).toBe(6);
    expect(
      rec.events
        .filter((e) => e.action === 'party:window')
        .every((e) => e.fullCheckpoint && e.partyReceipt)
    ).toBe(true);
    const h = start();
    expect(h.loadSnapshot(save)).toBe(true);
    expect(mechanicalDigest(h.toSnapshot(), (h as any).recordingInputState())).toEqual(digest);
    expect(h.loadReplay(rec)).toBe(true);
    while (h.replayCursor < rec.events.length && !h.replayError) h.replayStep(true);
    expect(h.replayError).toBeNull();
    expect(mechanicalDigest(h.toSnapshot(), (h as any).recordingInputState())).toEqual(digest);
    h.replaySeek(rec.events.length);
    expect(h.replayError).toBeNull();
  });
});

it.each(['yes', 'no'])(
  'serializes a non-primary confirmation and resumes same seq/next segment: %s',
  (choice) => {
    const g = start(),
      actor = g.controlledActors[1]!,
      food = actor.inventory.items.find((i) => i.category === ItemCategory.FOOD)!;
    const b = batch(g, 300);
    b.plans = [
      {
        actorId: actor.id,
        controllerSlot: 'local:0',
        update: 'replace',
        plan: {
          kind: 'queue',
          actions: [
            { kind: 'item', operation: 'use', itemId: food.id, target: null },
            { kind: 'search' }
          ]
        }
      }
    ];
    g.onCommandConfirmRequest = () => {};
    g.submitPartyWindow(b);
    expect(g.hasPendingConfirmation).toBe(false);
    expect(g.party!.state.window.phase).toBe('awaiting-decision');
    expect(g.party!.state.window.decision!.actorId).toBe(actor.id);
    expect(actor.inventory.items).toContain(food);
    const saved = JSON.parse(JSON.stringify(g.toSaveSnapshot())),
      seq = g.party!.state.window.seq,
      budget = g.party!.state.window.budget;
    clear();
    g.choosePartyDecision(choice);
    const expected = mechanicalDigest(g.toSnapshot(), (g as any).recordingInputState()),
      record = g.exportRecording();
    expect(g.party!.state.window.seq).toBe(seq);
    expect(g.party!.state.window.segment).toBe(1);
    expect(g.party!.state.window.budget).toBe(budget);
    expect(actor.inventory.items.some((i) => i.id === food.id)).toBe(choice === 'no');
    const h = start();
    expect(h.loadSnapshot(saved)).toBe(true);
    h.focusPartyMember(h.player.id);
    clear();
    h.choosePartyDecision(choice);
    expect(mechanicalDigest(h.toSnapshot(), (h as any).recordingInputState())).toEqual(expected);
    expect(h.exportRecording().events).toEqual(record.events);
    expect(h.loadReplay(record)).toBe(true);
    while (h.replayCursor < record.events.length && !h.replayError) h.replayStep(true);
    expect(h.replayError).toBeNull();
    h.replaySeek(record.events.length);
    expect(h.replayError).toBeNull();
  }
);
it('session edits, ready and deadline race leave the mechanical graph untouched; only one submission', () => {
  const g = start(),
    s = new PartyPlanningSession(g.party!.state),
    before = JSON.stringify(g.toSnapshot()),
    random = rng.getState(),
    ids = getNextEntityId();
  s.edit(g.player.id, { kind: 'queue', actions: [{ kind: 'wait' }] });
  s.markReady();
  let now = 10;
  const token = s.armDeadline(() => now, 5);
  s.edit(g.player.id, null);
  now = 20;
  const sent = vi.fn();
  expect(
    s.expire(
      () => now,
      token,
      () => batch(g),
      sent
    )
  ).toBe(false);
  s.markReady();
  const live = s.armDeadline(() => now, 0);
  expect(
    s.expire(
      () => now,
      live,
      () => batch(g),
      sent
    )
  ).toBe(true);
  expect(
    s.expire(
      () => now,
      live,
      () => batch(g),
      sent
    )
  ).toBe(false);
  expect(sent).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(g.toSnapshot())).toBe(before);
  expect(rng.getState()).toEqual(random);
  expect(getNextEntityId()).toBe(ids);
});
it('known-world previews are independent of hidden terrain and leave full state/streams/IDs/prefix intact', async () => {
  const g = start(),
    s = new PartyPlanningSession(g.party!.state),
    b = batch(g),
    view = g.knownPartyWorld(),
    before = JSON.stringify(g.toSnapshot()),
    random = rng.getState(),
    ids = getNextEntityId(),
    prefix = g.exportRecording();
  const first = await s.rehearse(view, b);
  expect(first).toEqual(previewPartyWindow(structuredClone(view), b));
  expect(JSON.stringify(g.toSnapshot())).toBe(before);
  expect(rng.getState()).toEqual(random);
  expect(getNextEntityId()).toBe(ids);
  expect(g.exportRecording()).toEqual(prefix);
  const pending = s.rehearse(view, b);
  s.edit(g.player.id, null);
  expect(await pending).toBeNull();
  let cell;
  for (let y = 0; y < g.grid.height && !cell; y++)
    for (let x = 0; x < g.grid.width; x++) {
      const c = g.grid.getCell(x, y)!;
      if (!c.hasMemory && !c.isVisible && !c.isMagicMapped) {
        cell = c;
        break;
      }
    }
  expect(cell).toBeTruthy();
  cell!.layers[0] = TerrainType.FLOOR;
  expect(g.knownPartyWorld()).toEqual(view);
  expect(previewPartyWindow(g.knownPartyWorld(), b)).toEqual(first);
});
it.each(['manual', 'all-ready', 'deadline'] as const)(
  'trigger %s has identical mechanical results',
  (trigger) => {
    const g = start(),
      save = JSON.parse(JSON.stringify(g.toSaveSnapshot()));
    g.submitPartyWindow(batch(g));
    const expected = mechanicalDigest(g.toSnapshot(), (g as any).recordingInputState());
    const h = start();
    expect(h.loadSnapshot(save)).toBe(true);
    const b = batch(h);
    b.trigger = trigger;
    clear();
    h.submitPartyWindow(b);
    expect(mechanicalDigest(h.toSnapshot(), (h as any).recordingInputState())).toEqual(expected);
  }
);
it('three safe complete windows restore auto 1000; advancing never schedules a second window', () => {
  const g = start();
  safe(g);
  for (let i = 0; i < 3; i++) {
    clear();
    const b = batch(g);
    b.automatic = true;
    g.submitPartyWindow(b);
    expect(g.party!.state.window.budget).toBe(100);
  }
  clear();
  const b = batch(g);
  b.automatic = true;
  g.submitPartyWindow(b);
  expect(g.party!.state.window.budget).toBe(1000);
  expect(g.party!.state.window.seq).toBe(4);
});
it('same-tick multi-member damage and negative states are all published before stop', () => {
  const g = start();
  safe(g);
  const original = (g as any).objectiveTimeBlock.bind(g);
  vi.spyOn(g as any, 'objectiveTimeBlock').mockImplementation(() => {
    original();
    for (const a of g.activeControlledActors) {
      a.hp -= 1;
      a.setStatusDuration('poisoned', 3);
    }
  });
  g.submitPartyWindow(batch(g, 300));
  const facts = g.party!.state.window.receipt!.interrupts;
  expect(g.party!.state.window.elapsed).toBe(100);
  for (const a of g.controlledActors) {
    expect(facts.some((f) => f.kind === 'damage' && f.actorId === a.id)).toBe(true);
    expect(facts.some((f) => f.kind === 'negative-status' && f.actorId === a.id)).toBe(true);
  }
});
it('forced paralysis does not consume an unexecuted queue and soft continue cannot defeat hard failure', () => {
  const g = start();
  safe(g);
  const a = g.controlledActors[1]!;
  a.setStatusDuration('paralyzed', 3);
  const b = batch(g);
  b.plans = [
    {
      actorId: a.id,
      controllerSlot: 'local:0',
      update: 'replace',
      plan: { kind: 'queue', actions: [{ kind: 'search' }] }
    }
  ];
  g.submitPartyWindow(b);
  expect(g.party!.state.window.members[1]!.cursor).toBe(0);
  expect(g.party!.native[a.id]!.searchingCharge).toBe(0);
});
it('same-cell competition retains the failed member step after the first actor commits', () => {
  const g = start();
  safe(g);
  const [a, b] = g.controlledActors;
  for (let y = 9; y < 12; y++)
    for (let x = 9; x < 14; x++) g.grid.setTerrain(x, y, TerrainType.FLOOR);
  a!.loc = { x: 10, y: 10 };
  b!.loc = { x: 12, y: 10 };
  const input = batch(g);
  input.plans = [
    {
      actorId: a!.id,
      controllerSlot: 'local:0',
      update: 'replace',
      plan: { kind: 'queue', actions: [{ kind: 'move', dx: 1, dy: 0 }] }
    },
    {
      actorId: b!.id,
      controllerSlot: 'local:0',
      update: 'replace',
      plan: { kind: 'queue', actions: [{ kind: 'move', dx: -1, dy: 0 }] }
    }
  ];
  g.submitPartyWindow(input);
  expect(a!.x).toBe(11);
  expect(b!.x).toBe(12);
  expect(g.party!.state.window.members.map((m) => m.cursor)).toEqual([1, 0]);
  expect(g.party!.state.window.receipt!.reason).toBe('interrupt');
});
it('old party codecs and mutated pending decisions are rejected with complete live roots preserved', () => {
  const g = start(),
    a = g.controlledActors[1]!,
    food = a.inventory.items.find((i) => i.category === ItemCategory.FOOD)!,
    b = batch(g);
  b.plans = [
    {
      actorId: a.id,
      controllerSlot: 'local:0',
      update: 'replace',
      plan: {
        kind: 'queue',
        actions: [{ kind: 'item', operation: 'use', itemId: food.id, target: null }]
      }
    }
  ];
  g.submitPartyWindow(b);
  const save = g.toSaveSnapshot(),
    before = JSON.stringify(g.toSnapshot()),
    player = g.player,
    other = g.controlledActors[1],
    random = rng.getState(),
    ids = getNextEntityId();
  for (const mutate of [
    (s: any) => {
      s.version = 8;
      s.schema = 'brogue-web-whole-run-v8';
    },
    (s: any) => (s.party.state.window.decision.actorId = s.player.id),
    (s: any) => (s.party.state.window.members[1].cursor = 99),
    (s: any) => s.party.state.window.decision.worldRevision++
  ]) {
    const bad = JSON.parse(JSON.stringify(save));
    mutate(bad);
    expect(g.loadSnapshot(bad)).toBe(false);
    expect(g.player).toBe(player);
    expect(g.controlledActors[1]).toBe(other);
    expect(JSON.stringify(g.toSnapshot())).toBe(before);
    expect(rng.getState()).toEqual(random);
    expect(getNextEntityId()).toBe(ids);
  }
});
it('requires an explicit safe switch before single-step can discard an accepted tail', () => {
  const g = start();
  safe(g);
  const b = batch(g);
  b.plans = [
    {
      actorId: g.player.id,
      controllerSlot: 'local:0',
      update: 'replace',
      plan: { kind: 'queue', actions: [{ kind: 'wait' }, { kind: 'wait' }] }
    }
  ];
  g.submitPartyWindow(b);
  clear();
  expect(() => g.submitPartyIntent({ kind: 'wait' }, g.readyPartyActorId!)).toThrow('ACTOR_BUSY');
  g.executeCommand('party:policy', {
    kind: 'party:policy',
    schema: 1,
    expectedRevision: g.party!.state.revision,
    issuerSlot: 'local:0',
    actorId: g.player.id,
    change: { kind: 'single-step' }
  });
  expect(g.party!.state.window.members.every((m) => m.plan === null)).toBe(true);
  clear();
  g.submitPartyIntent({ kind: 'wait' }, g.readyPartyActorId!);
});

it('rejects forged trace receipts during replay and malformed saved receipt times', () => {
  const g = start();
  g.submitPartyWindow(batch(g));
  const recording = JSON.parse(JSON.stringify(g.exportRecording())),
    save = JSON.parse(JSON.stringify(g.toSaveSnapshot()));
  const bad = structuredClone(recording);
  bad.events.find((e: any) => e.action === 'party:window').partyReceipt.trace[0].chargedTicks++;
  const h = start();
  if (h.loadReplay(bad)) {
    while (h.replayCursor < bad.events.length && !h.replayError) h.replayStep(true);
    expect(h.replayError).not.toBeNull();
  }
  const before = JSON.stringify(g.toSnapshot()),
    random = rng.getState(),
    allocator = getNextEntityId();
  delete save.run.recordingOrigin;
  save.party.state.window.receipt.startTick = '0';
  expect(g.loadSnapshot(save)).toBe(false);
  expect(JSON.stringify(g.toSnapshot())).toBe(before);
  expect(rng.getState()).toEqual(random);
  expect(getNextEntityId()).toBe(allocator);
});

it('latches initial low HP, rearms after recovery, and does not reset the latch on a new window', () => {
  const g = start(); safe(g);
  const a = g.controlledActors[1]!;
  a.hp = Math.floor(a.maxHp / 4);
  g.submitPartyWindow(batch(g));
  expect(g.party!.state.window.elapsed).toBe(0);
  expect(g.party!.state.window.receipt!.interrupts.some(f => f.kind === 'low-hp' && f.actorId === a.id)).toBe(true);
  clear(); g.submitPartyWindow(batch(g));
  expect(g.party!.state.window.receipt!.interrupts.some(f => f.kind === 'low-hp')).toBe(false);
  a.hp = a.maxHp; clear(); g.submitPartyWindow(batch(g));
  expect(g.party!.state.window.members.find(m => m.actorId === a.id)!.lowHpLatched).toBe(false);
  a.hp = Math.floor(a.maxHp / 4); clear(); g.submitPartyWindow(batch(g));
  expect(g.party!.state.window.receipt!.interrupts.some(f => f.kind === 'low-hp' && f.actorId === a.id)).toBe(true);
});
it('new and changed visible telegraph coverage interrupts once across window boundaries', () => {
  const g = start(); safe(g);
  // Diagnostic display-provider fixture; scheduling/acceptance uses the public command.
  let keys: string[] = [];
  vi.spyOn(g as any, 'partyTelegraphs').mockImplementation(() => keys);
  g.submitPartyWindow(batch(g));
  keys = ['attack:1:windup:10,10']; clear(); g.submitPartyWindow(batch(g));
  expect(g.party!.state.window.elapsed).toBe(0);
  expect(g.party!.state.window.receipt!.interrupts.filter(f => f.kind === 'telegraph')).toHaveLength(2);
  clear(); g.submitPartyWindow(batch(g));
  expect(g.party!.state.window.receipt!.interrupts.some(f => f.kind === 'telegraph')).toBe(false);
  keys = ['attack:1:windup:10,10;11,10']; clear(); g.submitPartyWindow(batch(g));
  expect(g.party!.state.window.receipt!.interrupts.filter(f => f.kind === 'telegraph')).toHaveLength(2);
});
it('an explicit empty-plan interrupt stops before taking a fallback wait', () => {
  const g = start(); safe(g); const a = g.controlledActors[0]!;
  const m = g.party!.state.window.members[0]!;
  g.executeCommand('party:policy', {kind:'party:policy',schema:1,expectedRevision:g.party!.state.revision,issuerSlot:'local:0',actorId:a.id,change:{kind:'reactions',emptyPlan:'interrupt',values:m.reactions}});
  g.submitPartyWindow(batch(g));
  expect(g.party!.state.window.elapsed).toBe(0);
  expect(g.party!.state.window.receipt!.trace).toHaveLength(0);
  expect(g.party!.state.window.receipt!.interrupts).toContainEqual(expect.objectContaining({kind:'plan-invalid',actorId:a.id}));
});
it('the deterministic decision cap retains the completed prefix without spending the remaining budget', () => {
  const g = start(4); safe(g);
  for (const a of g.controlledActors) { Object.defineProperty(a, 'infoMovementSpeed', {get: () => 1}); a.refreshSpeeds(); }
  g.submitPartyWindow(batch(g,1000));
  expect(g.party!.state.window.receipt!.trace).toHaveLength(1024);
  expect(g.party!.state.window.elapsed).toBeLessThan(1000);
  expect(g.party!.state.window.receipt!.interrupts).toContainEqual(expect.objectContaining({kind:'budget-exceeded'}));
});
