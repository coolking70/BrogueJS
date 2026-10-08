import { auditFullObjectGraph } from '../../../../test/support/fullGenerationCheckpointOracle';
import { logger } from '../../../../engine/Systems/Logger';
import { it, expect, vi } from 'vitest';
import { setup, current } from './helpers';
import { bedroom, residentScene } from './residentHelpers';
import { Monster, type MonsterData } from '../../../../entities/Monster';
import data from '../../../../data/monsters.json';
import { ItemLoader } from '../../../../engine/Items/ItemLoader';
import { candidateSource, residentComponent } from '../../../../engine/Core/ResidentWorld';
import { rng } from '../../../../engine/Random';
import { getNextEntityId } from '../../../../entities/Creature';

function rescuedGoblin() {
  const { h, g } = setup();
  bedroom(h, g);
  const a = new Monster(20, 13, (data as MonsterData[]).find((d) => d.id === 'goblin')!);
  a.isCaged = true;
  g.monsters.push(a);
  g.extensionRuntime!.attachCreature(a);
  h.command('wait');
  g.executeCommand('wait', undefined, () => g.freeCaptive(a));
  const c = current(g);
  g.player.loc = { x: 19, y: 13 };
  g.refreshStructureDerivedState();
  expect(
    h.ext('settlement', 'recruit', {
      v: 1,
      stateRevision: g.extensionRuntime!.worldCampState('settlement').revision,
      campId: c.regionId,
      campRevision: current(g).revision,
      targetId: a.id,
      targetRevision: 0
    }).error
  ).toBeNull();
  return { h, g, a };
}

it('a real public polymorph wand clears original allegiance and resident ownership without creating a fresh recruit source', () => {
  const { h, g, a } = rescuedGoblin();
  const wand = ItemLoader.spawnWand('wand_of_polymorphism', -1, -1)!;
  expect(g.player.inventory.addItem(wand)).toBeTruthy();
  g.executeItemCommand('use', wand);
  expect(g.pendingArcana?.item).toBe(wand);
  g.setArcanaTarget(a.x, a.y);
  h.command('confirm_target');
  expect(g.monsters.find((m) => m.id === a.id)).toBe(a);
  expect(a.isAlly).toBe(false);
  expect(residentComponent(g, a.id)).toBeUndefined();
  expect(g.world5!.residents).toHaveLength(0);
  expect(candidateSource(g, a.id)?.source.consumed).toBe(true);
  expect(g.world5!.offline[0]!.residentStates.some((r) => r.actorId === a.id)).toBe(false);
  const digest = h.digest();
  h.load(h.save());
  expect(h.digest()).toBe(digest);
});

it('game-over freezes actual resident needs and actors under subsequent public commands and remains a valid save', () => {
  const { h, g, a } = residentScene();
  g.executeCommand('wait', undefined, () => g.triggerGameOver(false));
  expect(g.isGameOver).toBe(true);
  const world = structuredClone(g.world5),
    at = { ...a.loc },
    random = rng.getState(),
    id = getNextEntityId();
  for (const action of ['wait', 'move', 'auto_step'])
    h.command(action, action === 'move' ? { x: 1, y: 0 } : undefined);
  expect(g.world5).toEqual(world);
  expect(a.loc).toEqual(at);
  expect(rng.getState()).toEqual(random);
  expect(getNextEntityId()).toBe(id);
  const digest = h.digest();
  h.load(h.save());
  expect(h.digest()).toBe(digest);
});

it.each(['resident-delete', 'late-item-used'] as const)(
  'F2: native polymorph %s publication fault restores the complete accepted outer spell entry',
  (stage) => {
    const { h, g, a } = rescuedGoblin(),
      wand = ItemLoader.spawnWand('wand_of_polymorphism', -1, -1)!;
    expect(g.player.inventory.addItem(wand)).toBeTruthy();
    g.executeItemCommand('use', wand);
    g.setArcanaTarget(a.x, a.y);
    const charges = wand.charges,
      random = rng.getState(),
      id = getNextEntityId();
    const replace = g.extensionRuntime!.replaceResidentComponent.bind(g.extensionRuntime!);
    const emit = g.extensionRuntime!.emit.bind(g.extensionRuntime!);
    const lateFault = vi.spyOn(g.extensionRuntime!, 'emit').mockImplementation((...args) => {
      emit(...args);
      if (stage === 'late-item-used' && args[0] === 'itemUsed')
        throw Error('qualification publication');
    });
    const fault = vi
      .spyOn(g.extensionRuntime!, 'replaceResidentComponent')
      .mockImplementation((...args) => {
        replace(...args);
        if (stage === 'resident-delete' && args[2] === 'resident' && args[3] === null)
          throw Error('qualification publication');
      });
    const checkpoint = g.checkpointResidentWorld.bind(g),
      entries: boolean[] = [];
    vi.spyOn(g, 'checkpointResidentWorld').mockImplementation(() => {
      entries.push(a.isAlly);
      const audit = auditFullObjectGraph({
          g,
          logger,
          identified: ItemLoader.identifiedItems,
          titles: ItemLoader.callTitles,
          polarity: ItemLoader.magicPolarityRevealed
        }),
        restore = checkpoint();
      return () => {
        restore();
        expect(audit.differences()).toEqual([]);
      };
    });
    expect(() => h.command('confirm_target')).toThrow('qualification publication');
    expect(entries[0]).toBe(true);
    expect(a.isAlly).toBe(true);
    expect(wand.charges).toBe(charges);
    expect(rng.getState()).toEqual(random);
    expect(getNextEntityId()).toBe(id);
    expect(residentComponent(g, a.id)).toBeDefined();
    fault.mockRestore();
    lateFault.mockRestore();
    // A failed command retires its continuous recording prefix. Resolve the
    // restored live aim by a real retry before asserting the stable save root.
    const tick = g.world5!.simulationTicks;
    h.command('confirm_target');
    expect(a.isAlly).toBe(false);
    expect(wand.charges).toBe(charges! - 1);
    expect(residentComponent(g, a.id)).toBeUndefined();
    expect(g.world5!.simulationTicks).toBeGreaterThan(tick);
    const digest = h.digest();
    h.load(h.save());
    expect(h.digest()).toBe(digest);
  }
);
