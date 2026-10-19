import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import '../../../../i18n';
import { Game } from '../../../../engine/Core/Game';
import { logger } from '../../../../engine/Systems/Logger';
import { timeSystem } from '../../../../engine/Systems/Time';
import { rng } from '../../../../engine/Random';
import { TerrainType } from '../../../../engine/Map/Grid';
import { ItemLoader } from '../../../../engine/Items/ItemLoader';
import { ItemCategory } from '../../../../engine/Items/Item';
import { mechanicalDigest } from '../../../../engine/Core/RecordingDigest';
import { validateInputState } from '../../../../engine/Core/RecordingFormat';
import { usePartyUi } from '../ui/usePartyUi';
import { ref } from 'vue';
import type { ActorIntent } from '../../../party';
import type { WindowBatch } from '../../../partyWindow';
const games: Game[] = [];
const clear = () => {
  while (logger.pendingAcknowledgment) logger.acknowledgeNext();
};
const fresh = () => {
  const g = new Game({ seed: 1 });
  games.push(g);
  return g;
};
// Fixture construction precedes the recording header and is repeated by seed replay.
function fixture(setup: (g: Game) => void) {
  const initialize = (Game.prototype as any).initializeParty;
  vi.spyOn(Game.prototype as any, 'initializeParty').mockImplementation(function (this: Game) {
    initialize.call(this);
    if (this.party) setup(this);
  });
}
function safe(g: Game) {
  g.monsters = [];
  g.dormantMonsters = [];
  for (const actor of g.controlledActors) g.grid.setTerrain(actor.x, actor.y, TerrainType.FLOOR);
}
function start() {
  const g = fresh();
  g.startNewGame({
    seed: 42,
    ruleSet: 'extended',
    extensions: ['party'],
    extensionConfigurations: { party: { schema: 1, members: 2 } },
    initialCommands: [
      JSON.stringify({ module: 'party', action: 'create', payload: { schema: 1, members: 2 } })
    ]
  });
  g.animationEnabled = false;
  clear();
  return g;
}
function batch(g: Game, actions?: ActorIntent[], ticks: 100 | 300 = 300): WindowBatch {
  return {
    kind: 'party:window',
    schema: 2,
    seq: g.party!.state.window.seq + 1,
    expectedRevision: g.party!.state.revision,
    issuerSlot: 'local:0',
    startTick: timeSystem.currentTick,
    length: { kind: 'ticks', ticks },
    fineActorId: null,
    automatic: false,
    trigger: 'manual',
    plans: actions
      ? [
          {
            actorId: g.controlledActors[1]!.id,
            controllerSlot: 'local:0',
            update: 'replace',
            plan: { kind: 'queue', actions }
          }
        ]
      : []
  };
}
const digest = (g: Game) => mechanicalDigest(g.toSnapshot(), (g as any).recordingInputState());
/** Real save + continuation and seed replay/seek must agree on every digest domain. */
function lifecycle(g: Game, next: (g: Game) => void) {
  const saved = JSON.parse(JSON.stringify(g.toSaveSnapshot())),
    before = digest(g),
    count = g.exportRecording().events.length;
  expect(saved.run.recordingOrigin).toBeTruthy();
  clear();
  next(g);
  const after = digest(g),
    recording = g.exportRecording();
  expect(g.toSaveSnapshot().run.recordingOrigin).toBeTruthy();
  const loaded = fresh();
  expect(loaded.loadSnapshot(saved)).toBe(true);
  loaded.animationEnabled = false;
  loaded.focusPartyMember(loaded.player.id);
  expect(loaded.hasCompleteRecording).toBe(true);
  expect(digest(loaded)).toEqual(before);
  clear();
  next(loaded);
  expect(digest(loaded)).toEqual(after);
  expect(loaded.exportRecording().events).toEqual(recording.events);
  const replay = fresh();
  expect(replay.loadReplay(recording)).toBe(true);
  while (replay.replayCursor < recording.events.length && !replay.replayError) {
    clear();
    replay.replayStep(true);
  }
  expect(replay.replayError).toBeNull();
  expect(digest(replay)).toEqual(after);
  replay.replaySeek(count);
  expect(replay.replayError).toBeNull();
  expect(digest(replay)).toEqual(before);
  replay.replaySeek(recording.events.length);
  expect(replay.replayError).toBeNull();
  expect(digest(replay)).toEqual(after);
}
beforeEach(() => vi.spyOn(Date, 'now').mockReturnValue(1792252800000));
afterEach(() => {
  games.splice(0).forEach((g) => g.disposeRecording());
  vi.restoreAllMocks();
  clear();
});
it.each(['arcana', 'throw', 'malevolent'] as const)(
  'R1-F1 secondary %s uses modal ownership across save/choose/replay/seek',
  (mode) => {
    fixture((g) => {
      const actor = g.controlledActors[1]!;
      const item =
        mode === 'arcana'
          ? ItemLoader.spawnWand('wand_of_teleportation', -1, -1)!
          : mode === 'malevolent'
            ? ItemLoader.spawnPotion('potion_of_poison', -1, -1)!
            : null;
      if (item) {
        if (mode === 'malevolent') item.magicDetected = true;
        actor.inventory.addItem(item);
      }
    });
    const g = start(),
      actor = g.controlledActors[1]!,
      item = actor.inventory.items.find((i) =>
        mode === 'arcana'
          ? i.category === ItemCategory.WAND
          : mode === 'malevolent'
            ? i.category === ItemCategory.POTION
            : i.name === 'dart' || i.quantity === 15
      )!;
    expect(item).toBeTruthy();
    const intent: ActorIntent =
      mode === 'throw'
        ? {
            kind: 'module',
            owner: 'foundation',
            commandId: 'native-item',
            payload: { operation: 'throw', itemId: item.id, title: '' }
          }
        : { kind: 'item', operation: 'use', itemId: item.id, target: null };
    g.submitPartyWindow(batch(g, [intent], 100));
    expect(g.party!.state.window.decision).toMatchObject({ actorId: actor.id, kind: 'modal' });
    const input = (g as any).recordingInputState(),
      save = g.toSaveSnapshot();
    expect(validateInputState(input, save)).toBe(true);
    const wrong = structuredClone(input),
      otherId = g.player.inventory.items[0]!.id;
    if (mode === 'arcana') wrong.arcana.itemId = otherId;
    else if (mode === 'throw') wrong.throwItemId = otherId;
    else wrong.pendingUseConfirmId = otherId;
    expect(validateInputState(wrong, save)).toBe(false);
    const choice =
      mode === 'malevolent'
        ? 'yes'
        : g.party!.state.window.decision!.allowedChoiceIds.find(
            (c) => c.startsWith('cell:') && c !== `cell:${actor.x}:${actor.y}`
          )!;
    const charges = item.charges,
      quantity = item.quantity;
    lifecycle(g, (h) => {
      h.choosePartyDecision(choice);
      expect(h.party!.state.window.decision).toBeNull();
      const remaining = h.controlledActors[1]!.inventory.items.find((i) => i.id === item.id);
      if (mode === 'arcana') expect(remaining!.charges).toBe(charges! - 1);
      else expect(remaining?.quantity ?? 0).toBe(quantity - 1);
    });
  }
);
it.each(['edit', 'append', 'clear', 'keep'] as const)(
  'R1-F2 rejected generation allows %s retry and invalidates old deadline',
  (edit) => {
    const g = start(),
      s = g.partyPlanner()!;
    g.handlePlayerAction('mouse_travel', { x: 0, y: 0 });
    const token = s.armDeadline(() => 0, 1);
    const submit = () =>
      s.submit(s.batch(timeSystem.currentTick, { kind: 'ticks', ticks: 100 }, null), (b) =>
        g.submitPartyWindow(b)
      );
    expect(submit).toThrow('INVALID_TARGET');
    expect(submit).toThrow('BAD_SEQUENCE');
    if (edit === 'keep') s.keep(g.player.id);
    else if (edit === 'clear') s.edit(g.player.id, null);
    else if (edit === 'append') s.append(g.player.id, { kind: 'wait' });
    else s.edit(g.player.id, { kind: 'queue', actions: [{ kind: 'wait' }] });
    expect(
      s.expire(
        () => 2,
        token,
        () => s.batch(0, { kind: 'ticks', ticks: 100 }, null),
        () => {
          throw Error('stale timer');
        }
      )
    ).toBe(false);
    expect(submit).not.toThrow();
    expect(g.party!.state.window.seq).toBe(1);
    lifecycle(g, (h) => {
      h.submitPartyWindow(batch(h, undefined, 100));
    });
  }
);
it('R1-F2 actual UI clear and advance recover from refusal, dropping an outstanding old submit', async () => {
  const g = start(),
    tick = ref(0);
  const ui = usePartyUi({
    game: () => g,
    tick,
    runAction: (work: () => void) => work(),
    afterClosePanel() {}
  } as any);
  const props = () => ui.hud.value!.props.windowProps as any;
  props();
  g.handlePlayerAction('mouse_travel', { x: 0, y: 0 });
  await props().advance({ kind: 'ticks', ticks: 100 }, false);
  expect(g.party!.state.window.seq).toBe(0);
  props().clear();
  props().append('wait');
  await props().advance({ kind: 'ticks', ticks: 100 }, false);
  expect(g.party!.state.window.seq).toBe(1);
  let release!: () => void;
  vi.spyOn(g, 'flushRecording').mockReturnValue(
    new Promise<void>((r) => {
      release = r;
    })
  );
  const pending = props().advance({ kind: 'ticks', ticks: 100 }, false);
  props().clear();
  release();
  await pending;
  expect(g.party!.state.window.seq).toBe(1);
});
it('R1-F3 native teleport interrupts at commit and preserves the search suffix across lifecycle', () => {
  fixture((g) => {
    safe(g);
    g.controlledActors[1]!.inventory.addItem(
      ItemLoader.spawnScroll('scroll_of_teleportation', -1, -1)!
    );
  });
  const g = start(),
    actor = g.controlledActors[1]!,
    item = actor.inventory.items.find((i) => i.category === ItemCategory.SCROLL)!;
  const primaryAt = { ...g.player.loc },
    oldAt = { ...actor.loc };
  g.submitPartyWindow(
    batch(g, [
      { kind: 'item', operation: 'use', itemId: item.id, target: null },
      { kind: 'search' },
      { kind: 'wait' }
    ])
  );
  expect(actor.loc).not.toEqual(oldAt);
  expect(g.player.loc).toEqual(primaryAt);
  expect(g.party!.state.window.receipt!.interrupts).toContainEqual(
    expect.objectContaining({ kind: 'displacement', actorId: actor.id })
  );
  expect(g.party!.state.window.members[1]!.cursor).toBe(1);
  expect(g.party!.state.window.receipt!.trace.some((t) => t.intent.kind === 'search')).toBe(false);
  lifecycle(g, (h) => {
    h.submitPartyWindow(batch(h));
    expect(
      h.party!.state.window.receipt!.trace.some(
        (t) => t.actorId === actor.id && t.intent.kind === 'search'
      )
    ).toBe(true);
  });
});
it('R1-F4 burning damage healed in the same boundary still interrupts and survives lifecycle', () => {
  fixture((g) => {
    safe(g);
    const a = g.controlledActors[1]!;
    a.hp = 20;
    a.regenCarry = 0.99;
    (a.statusDurations as any).burning = 1;
    rng.randRange(0, 100);
  });
  const g = start(),
    actor = g.controlledActors[1]!;
  const losses: number[] = [],
    original = (g as any).resolveBurningDamage;
  vi.spyOn(g as any, 'resolveBurningDamage').mockImplementation(function (a: any) {
    const hp = a.hp;
    original.call(g, a);
    if (a === actor) losses.push(hp - a.hp);
  });
  g.submitPartyWindow(batch(g));
  expect(losses).toContain(1);
  expect(actor.hp).toBe(20);
  expect(g.party!.state.window.elapsed).toBe(100);
  expect(g.party!.state.window.receipt!.interrupts).toContainEqual(
    expect.objectContaining({ kind: 'damage', actorId: actor.id, tick: 100 })
  );
  lifecycle(g, (h) => h.submitPartyWindow(batch(h)));
});
it.each(['unequip', 'equip', 'drop', 'native-unequip', 'empty-wand', 'cooldown'] as const)(
  'R1-F5 %s native refusal retains cursor on keep/save/replay/seek',
  (operation) => {
    fixture((g) => {
      safe(g);
      const actor = g.controlledActors[1]!;
      actor.equippedWeapon!.isCursed = true;
      if (operation === 'empty-wand') {
        const item = ItemLoader.spawnWand('wand_of_teleportation', -1, -1)!;
        item.charges = 0;
        item.identified = true;
        actor.inventory.addItem(item);
      }
      if (operation === 'cooldown') {
        const item = ItemLoader.spawnCharm('charm_of_teleportation', -1, -1)!;
        item.cooldownRemaining = 100;
        actor.inventory.addItem(item);
      }
    });
    const g = start(),
      actor = g.controlledActors[1]!;
    const item =
      operation === 'empty-wand'
        ? actor.inventory.items.find((i) => i.category === ItemCategory.WAND)!
        : operation === 'cooldown'
          ? actor.inventory.items.find((i) => i.category === ItemCategory.CHARM)!
          : actor.equippedWeapon!;
    const intent: ActorIntent =
      operation === 'native-unequip'
        ? {
            kind: 'module',
            owner: 'foundation',
            commandId: 'native-item',
            payload: { operation: 'unequip', itemId: item.id, title: '' }
          }
        : {
            kind: 'item',
            operation: operation === 'empty-wand' || operation === 'cooldown' ? 'use' : operation,
            itemId: item.id,
            target: null
          };
    const check = (h: Game) => {
      expect(h.party!.state.window.members[1]!.cursor).toBe(0);
      expect(h.party!.state.window.receipt!.trace.slice(-1)[0]).toMatchObject({
        actorId: actor.id,
        outcome: 'rejected',
        chargedTicks: 0
      });
      expect(h.party!.state.window.receipt!.interrupts).toContainEqual(
        expect.objectContaining({ kind: 'plan-invalid', actorId: actor.id })
      );
      expect(h.party!.state.window.receipt!.trace.some((t) => t.intent.kind === 'search')).toBe(
        false
      );
    };
    g.submitPartyWindow(batch(g, [intent, { kind: 'search' }]));
    check(g);
    lifecycle(g, (h) => {
      h.submitPartyWindow(batch(h));
      check(h);
    });
  }
);
it('R1-F5 legitimate zero-time inscription is accepted and consumes exactly one cursor', () => {
  fixture(safe);
  const g = start(),
    item = g.controlledActors[1]!.equippedWeapon!;
  g.submitPartyWindow(
    batch(g, [
      {
        kind: 'module',
        owner: 'foundation',
        commandId: 'native-item',
        payload: { operation: 'inscribe', itemId: item.id, title: 'r1' }
      },
      { kind: 'search' }
    ])
  );
  expect(g.party!.state.window.members[1]!.cursor).toBe(1);
  expect(g.party!.state.window.receipt!.trace.slice(-1)[0]).toMatchObject({
    outcome: 'accepted',
    chargedTicks: 0
  });
  lifecycle(g, (h) => {
    h.submitPartyWindow(batch(h));
    expect(h.party!.state.window.receipt!.trace[0]!.intent.kind).toBe('search');
  });
});
it.each(['stop', 'continue'] as const)(
  'R1-F4 multi-member native damage/heal and status/apply/remove facts survive one boundary (%s)',
  (reaction) => {
    fixture(safe);
    // An atomic environment fixture composes genuine native effects. No observer
    // or final receipt is mocked; replay executes the same production entry points.
    const original = (Game.prototype as any).objectiveTimeBlock;
    vi.spyOn(Game.prototype as any, 'objectiveTimeBlock').mockImplementation(function (this: Game) {
      original.call(this);
      for (const actor of this.activeControlledActors) {
        actor.takeDamage(1, true);
        actor.healPoints(1);
        actor.applyStatus('confused', 1);
        actor.setStatusDuration('confused', 0);
        actor.addPoison(1);
        actor.setStatusDuration('poisoned', 0);
        actor.weaken(1);
        actor.setStatusDuration('weakened', 0);
      }
    });
    const g = start();
    if (reaction === 'continue')
      for (const actor of g.controlledActors)
        g.executeCommand('party:policy', {
          kind: 'party:policy',
          schema: 2,
          expectedRevision: g.party!.state.revision,
          issuerSlot: 'local:0',
          actorId: actor.id,
          change: {
            kind: 'reactions',
            emptyPlan: 'wait',
            values: {
              'new-hostile': 'continue',
              damage: 'continue',
              'negative-status': 'continue',
              'low-hp': 'continue',
              telegraph: 'continue'
            }
          }
        });
    const hp = g.controlledActors.map((a) => a.hp);
    g.submitPartyWindow(batch(g));
    expect(g.controlledActors.map((a) => a.hp)).toEqual(hp);
    expect(g.party!.state.window.elapsed).toBe(reaction === 'stop' ? 100 : 300);
    for (const actor of g.controlledActors) {
      expect(actor.hasStatus('confused')).toBe(false);
      for (const kind of ['damage', 'negative-status'])
        expect(g.party!.state.window.receipt!.interrupts).toContainEqual(
          expect.objectContaining({ kind, actorId: actor.id, tick: 100 })
        );
    }
    lifecycle(g, (h) => h.submitPartyWindow(batch(h)));
  }
);
it('R1-F3 ordinary walking is not a forced displacement', () => {
  fixture((g) => {
    safe(g);
    const actor = g.controlledActors[1]!;
    g.grid.setTerrain(actor.x - 1, actor.y, TerrainType.FLOOR);
  });
  const g = start(),
    actor = g.controlledActors[1]!,
    at = { ...actor.loc };
  g.submitPartyWindow(batch(g, [{ kind: 'move', dx: -1, dy: 0 }, { kind: 'search' }], 100));
  expect(actor.x).toBe(at.x - 1);
  expect(g.party!.state.window.receipt!.interrupts.some((f) => f.kind === 'displacement')).toBe(
    false
  );
  lifecycle(g, (h) => h.submitPartyWindow(batch(h, undefined, 100)));
});
it('R1-F4 low HP crossing is retained even when native healing restores the boundary HP', () => {
  fixture((g) => {
    safe(g);
    for (const actor of g.controlledActors) {
      actor.hp = 8;
      actor.regenCarry = 0;
    }
  });
  const original = (Game.prototype as any).objectiveTimeBlock;
  vi.spyOn(Game.prototype as any, 'objectiveTimeBlock').mockImplementation(function (this: Game) {
    original.call(this);
    for (const actor of this.activeControlledActors) {
      actor.takeDamage(1, true);
      actor.healPoints(1);
    }
  });
  const g = start();
  g.submitPartyWindow(batch(g));
  expect(g.controlledActors.map((a) => a.hp)).toEqual([8, 8]);
  for (const actor of g.controlledActors)
    expect(g.party!.state.window.receipt!.interrupts).toContainEqual(
      expect.objectContaining({ kind: 'low-hp', actorId: actor.id, tick: 100 })
    );
  lifecycle(g, (h) => h.submitPartyWindow(batch(h)));
});
it.each(['call', 'inscribe', 'relabel'] as const)(
  'R1-F5 native zero-time %s refusal is distinguished from zero-time success',
  (operation) => {
    fixture(safe);
    const g = start(),
      actor = g.controlledActors[1]!,
      item =
        operation === 'inscribe'
          ? actor.inventory.items.find((i) => i.category === ItemCategory.FOOD)!
          : actor.equippedWeapon!;
    g.submitPartyWindow(
      batch(g, [
        {
          kind: 'module',
          owner: 'foundation',
          commandId: 'native-item',
          payload: { operation, itemId: item.id, title: 'invalid label' }
        },
        { kind: 'search' }
      ])
    );
    expect(g.party!.state.window.members[1]!.cursor).toBe(0);
    expect(g.party!.state.window.receipt!.trace.slice(-1)[0]).toMatchObject({
      outcome: 'rejected',
      chargedTicks: 0
    });
    expect(g.party!.state.window.receipt!.interrupts).toContainEqual(
      expect.objectContaining({ kind: 'plan-invalid' })
    );
    lifecycle(g, (h) => {
      h.submitPartyWindow(batch(h));
      expect(h.party!.state.window.members[1]!.cursor).toBe(0);
      expect(h.party!.state.window.receipt!.trace[0]!.outcome).toBe('rejected');
    });
  }
);
it('R1-F5 empty native pickup cannot consume its queue entry', () => {
  fixture((g) => {
    safe(g);
    const a = g.controlledActors[1]!;
    g.items = g.items.filter((i) => i.x !== a.x || i.y !== a.y);
  });
  const g = start();
  g.submitPartyWindow(
    batch(g, [
      {
        kind: 'module',
        owner: 'foundation',
        commandId: 'native-action',
        payload: { action: 'pickup' }
      },
      { kind: 'search' }
    ])
  );
  expect(g.party!.state.window.members[1]!.cursor).toBe(0);
  expect(g.party!.state.window.receipt!.trace.slice(-1)[0]).toMatchObject({
    outcome: 'rejected',
    chargedTicks: 0
  });
  lifecycle(g, (h) => {
    h.submitPartyWindow(batch(h));
    expect(h.party!.state.window.members[1]!.cursor).toBe(0);
  });
});
