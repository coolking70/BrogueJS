import { describe, expect, it } from 'vitest';
import type { WorldHarness } from '../../../worldSdk';
import { effectScope, nextTick, ref } from 'vue';
import { nativeStat } from '../../../../engine/Stats/NativeStatSources';
import { useForagingUi } from '../ui/useForagingUi';
import {
  makeHarness,
  scene,
  addFood,
  addAlly,
  eat,
  feed,
  roast,
  hearth,
  saveContinue,
  moveNodeBeside,
  harvest,
  waitTurns,
  state,
  rng,
  mechanics,
  game,
  observeFacts,
  knowledgeState
} from './mechanicsHelpers';

/** Scene edits are not fabricated recording events. Natural replay/seek origins are covered by T-TRACE. */
describe('foraging T-PERSIST staged effect save/load continuations', () => {
  it.each(['eat', 'roast', 'explosion', 'feed', 'strength', 'slumber', 'partial-node'] as const)(
    '%s persists its real activated effect through the complete public continuation',
    (kind) => {
      let immediateSlumber = 0;
      const observed = observeFacts((f) => {
        if (f.definitionId === 'foraging.drowse')
          immediateSlumber = game(h)
            .monsters.find((m) => m.id === f.eaterId)!
            .getStatusDuration('slumber');
      });
      const h = makeHarness(
          51020001,
          kind === 'roast' || kind === 'explosion' ? ['fgheat', 'foraging'] : ['foraging'],
          [observed.override]
        ),
        g = scene(h);
      let actorId: number | null = null,
        itemId: number | null = null,
        nodeId: number | null = null,
        enemyId: number | null = null;
      const strength = nativeStat(g.player, 'native.strength');
      if (kind === 'eat') {
        eat(h, addFood(h, 'venom', 2));
        expect(g.player.getStatusDuration('poisoned')).toBe(7);
        expect(observed.consumed[0]!.resolvedIntent).toEqual({
          kind: 'status',
          status: 'poisoned',
          turns: 8
        });
      }
      if (kind === 'roast' || kind === 'explosion') {
        hearth(h);
        const food = addFood(
          h,
          kind === 'explosion' ? 'blast' : 'mend',
          kind === 'explosion' ? 3 : 2
        );
        itemId = food.id;
        expect(roast(h, food).error).toBeNull();
        expect(state(h).totals[kind === 'explosion' ? 'exploded' : 'roasted']).toBe(1);
        if (kind === 'roast') expect(food.worldItem!.definitionId).toBe('foraging.mend-roasted');
        else {
          expect(g.player.inventory.items.some((i) => i.id === itemId)).toBe(false);
          expect(knowledgeState(g, 'foraging.blast')).toBe('known');
          itemId = addFood(h, 'blast').id;
        }
      }
      if (kind === 'feed' || kind === 'slumber') {
        const ally = addAlly(h);
        actorId = ally.id;
        // A ready actor must remain unable to act during the real fed slumber.
        if (kind === 'slumber') {
          ally.ticksUntilTurn = 0;
          const enemy = addAlly(h);
          enemyId = enemy.id;
          enemy.loc = { x: 12, y: 10 };
          enemy.isAlly = false;
          enemy.extensionHooks?.relationshipChanged?.(enemy);
        }
        expect(
          feed(h, ally, addFood(h, kind === 'feed' ? 'might' : 'drowse'), [true]).error
        ).toBeNull();
        if (kind === 'slumber') {
          expect(immediateSlumber).toBe(25);
          expect(ally.getStatusDuration('slumber')).toBe(24);
        } else {
          expect(nativeStat(ally, 'native.physical-damage-dealt', { baseValue: 100 })).toBe(125);
          expect(g.extensionRuntime!.snapshot().foundation.timedStats!.rows[0]).toMatchObject({
            actorId,
            value: 2500,
            untilTick: 40000
          });
        }
      }
      if (kind === 'strength') {
        eat(h, addFood(h, 'might'));
        expect(nativeStat(g.player, 'native.strength')).toBe(strength + 2);
        expect(g.extensionRuntime!.snapshot().foundation.timedStats!.rows[0]).toMatchObject({
          value: 2,
          untilTick: 40000
        });
      }
      if (kind === 'partial-node') {
        const n = moveNodeBeside(h);
        nodeId = n.interactableId;
        expect(harvest(h, n).error).toBeNull();
        waitTurns(h, 5);
        expect(harvest(h, n).error).toBeNull();
        expect(n.remaining).toBe(1);
        expect(n.regenRemainder).toBe(600);
      }
      const expectedState = state(h),
        save = h.save(),
        digest = h.digest();
      const continuation = (h: WorldHarness) => {
        const current = game(h); // All entities are reacquired after every load.
        if (kind === 'eat') {
          waitTurns(h, 7);
          expect(current.player.hasStatus('poisoned')).toBe(false);
          expect(knowledgeState(current, 'foraging.venom')).toBe('known');
        }
        if (kind === 'roast') {
          const food = current.player.inventory.items.find((i) => i.id === itemId)!;
          expect(roast(h, food).error).toBeNull();
          expect(food.worldItem!.definitionId).toBe('foraging.char');
          expect(roast(h, food).error).toBeNull();
          expect(current.player.inventory.items.some((i) => i.id === itemId)).toBe(false);
          expect(state(h).totals).toMatchObject({ roasted: 1, charred: 1, burned: 1 });
        }
        if (kind === 'explosion') {
          expect(
            roast(h, current.player.inventory.items.find((i) => i.id === itemId)!).error
          ).toBeNull();
          expect(state(h).totals).toMatchObject({ exploded: 2, revealed: 1 });
        }
        if (kind === 'feed' || kind === 'strength') {
          waitTurns(h, 398);
          const actor =
            kind === 'feed' ? current.monsters.find((m) => m.id === actorId)! : current.player;
          expect(
            kind === 'feed'
              ? nativeStat(actor, 'native.physical-damage-dealt', { baseValue: 100 })
              : nativeStat(actor, 'native.strength')
          ).toBe(kind === 'feed' ? 125 : strength + 2);
          waitTurns(h, 1);
          expect(current.extensionRuntime!.snapshot().foundation.timedStats?.rows ?? []).toEqual(
            []
          );
          expect(
            kind === 'feed'
              ? nativeStat(actor, 'native.physical-damage-dealt', { baseValue: 100 })
              : nativeStat(actor, 'native.strength')
          ).toBe(kind === 'feed' ? 100 : strength);
        }
        if (kind === 'slumber') {
          const ally = current.monsters.find((m) => m.id === actorId)!,
            at = { ...ally.loc },
            hp = current.player.hp;
          const enemy = current.monsters.find((m) => m.id === enemyId)!,
            enemyHp = enemy.hp;
          waitTurns(h, 23);
          expect(ally.getStatusDuration('slumber')).toBe(1);
          expect(ally.loc).toEqual(at);
          expect(enemy.hp).toBe(enemyHp);
          expect(current.player.hp).toBe(hp);
          waitTurns(h, 1);
          expect(ally.hasStatus('slumber')).toBe(false);
          expect(knowledgeState(current, 'foraging.drowse')).toBe('known');
          waitTurns(h, 20);
          expect(enemy.hp).toBeLessThan(enemyHp);
        }
        if (kind === 'partial-node') {
          waitTurns(h, 313);
          const n = current.world5!.nodes.find((n) => n.interactableId === nodeId)!;
          expect(harvest(h, n).error).toBeNull();
          expect(n.remaining).toBe(1);
          expect(n.regenRemainder).toBe(0);
        }
      };
      if (kind === 'strength') {
        // Restore into a fresh live run: the baseline's advanced-live materialized-stat
        // validation uses the old run's clock (runtime.ts), reported separately.
        const roots = (current: WorldHarness) => {
          const s = game(current).toSnapshot();
          return structuredClone({
            player: s.player,
            monsters: s.monsters,
            dormantMonsters: s.dormantMonsters,
            items: s.items,
            grid: s.grid,
            extensions: s.extensions,
            world5: s.run.world5,
            tick: s.run.currentTick,
            turn: s.run.absoluteTurnNumber,
            rng: s.rngState
          });
        };
        const initial = roots(h);
        continuation(h);
        const expected = roots(h),
          endDigest = h.digest();
        const loaded = makeHarness(51020001, ['foraging'], [observed.override]);
        loaded.load(save);
        expect(loaded.digest()).toBe(digest);
        expect(state(loaded)).toEqual(expectedState);
        expect(roots(loaded)).toEqual(initial);
        continuation(loaded);
        expect(loaded.digest()).toBe(endDigest);
        expect(roots(loaded)).toEqual(expected);
      } else saveContinue(h, () => continuation(h));
    }
  );
  it('fed active slumber saves 24 real remaining turns and actual explosion damage wakes the loaded/control actor early', () => {
    const h = makeHarness(51020001, ['foraging', 'fgheat']);
    scene(h);
    hearth(h);
    const ally = addAlly(h);
    ally.maxHp = ally.hp = 1000;
    ally.ticksUntilTurn = 0;
    const id = ally.id;
    const blast = addFood(h, 'blast');
    const blastId = blast.id;
    expect(feed(h, ally, addFood(h, 'drowse'), [true]).error).toBeNull();
    expect(ally.getStatusDuration('slumber')).toBe(24);
    saveContinue(h, () => {
      const current = game(h),
        actor = current.monsters.find((m) => m.id === id)!,
        hp = actor.hp;
      expect(actor.getStatusDuration('slumber')).toBe(24);
      expect(
        roast(h, current.player.inventory.items.find((i) => i.id === blastId)!).error
      ).toBeNull();
      expect(actor.hp).toBeLessThan(hp);
      expect(actor.hp).toBeGreaterThan(0);
      expect(actor.hasStatus('slumber')).toBe(false);
      expect(knowledgeState(current, 'foraging.drowse')).toBe('known');
      expect(knowledgeState(current, 'foraging.blast')).toBe('known');
    });
  });
  it.each(['overflow', 'history-order', 'extra-key'] as const)(
    'bad module state %s is rejected without retiring the current run',
    (mode) => {
      const h = makeHarness(),
        g = scene(h);
      eat(h, addFood(h, 'mend', 2));
      eat(h, addFood(h, 'blast', 2));
      const save = JSON.parse(h.save());
      if (mode === 'overflow')
        save.extensions.modules.foraging.totals.eaten = Number.MAX_SAFE_INTEGER + 1;
      if (mode === 'history-order') save.extensions.modules.foraging.history.reverse();
      if (mode === 'extra-key') save.extensions.modules.foraging.hiddenKind = 'blast';
      const live = g.extensionRuntime,
        before = h.digest(),
        random = rng.getState();
      expect(g.loadSnapshot(save)).toBe(false);
      expect(g.extensionRuntime).toBe(live);
      expect(h.digest()).toBe(before);
      expect(rng.getState()).toEqual(random);
    }
  );
  it('repeated real UI open/close/tab changes leave digest, both streams and every mechanical root unchanged', async () => {
    const h = makeHarness(),
      g = scene(h);
    addFood(h, 'mend');
    moveNodeBeside(h);
    const scope = effectScope(),
      before = h.digest(),
      random = rng.getState(),
      roots = mechanics(h);
    const ui = scope.run(() =>
      useForagingUi(
        {
          game: () => g,
          tick: ref(0),
          immersive: ref(false),
          canOpenPanel: () => true,
          canPresentInteraction: () => true,
          isPresentationBusy: () => false,
          beforeOpenPanel: () => {},
          afterClosePanel: () => {}
        },
        async () => ({ render: () => null })
      )
    )!;
    try {
      for (let i = 0; i < 5; i++) {
        ui.commands.value[0]!.invoke();
        await nextTick();
        await nextTick();
        expect(ui.panelOpen.value).toBe(true);
        for (const tab of ['harvest', 'roast', 'feed']) {
          (ui.panel.value!.props.onTab as (tab: string) => void)(tab);
          ui.refresh();
        }
        ui.close();
        expect(ui.panelOpen.value).toBe(false);
      }
      expect(h.digest()).toBe(before);
      expect(rng.getState()).toEqual(random);
      expect(mechanics(h)).toEqual(roots);
    } finally {
      scope.stop();
    }
  });
});
