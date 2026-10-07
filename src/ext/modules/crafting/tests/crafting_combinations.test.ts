import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWorldHarness, worldHarnessGame } from '../../../testing/worldHarness';
import { getInstalledModuleDescriptors } from '../../../catalog';
import {
  NaturalCraftingDriver,
  last,
  craftingContext,
  craftingFinal,
  craftPayload
} from './traceHelpers';
import { Monster, MonsterState, type MonsterData } from '../../../../entities/Monster';
import monsters from '../../../../data/monsters.json';
import { TerrainType } from '../../../../engine/Map/Grid';
import { arena, craftPayload as workPayload, rejected } from './runtimeHelpers';
import { preparePhasedAttackCommand, commitPhasedAttackCommand } from '../../../../engine/Core/PhasedAttackProduction';
import { logger } from '../../../../engine/Systems/Logger';
import type { WorldHarness } from '../../../worldSdk';

const installed = getInstalledModuleDescriptors().map((d) => d.id);
const peers = ['growth', 'narrative', 'combat', 'giants'].filter((id) => installed.includes(id));
const combinations = [
  ['crafting'],
  ...peers.map((id) => ['crafting', id]),
  ...(peers.length > 1 ? [['crafting', ...peers]] : []),
  ...(installed.includes('settlement') ? [['settlement'], ['crafting', 'settlement']] : [])
];
const harnesses: WorldHarness[] = [];
function start(ids: string[], seed = 3) {
  const h = createWorldHarness({ seed, mode: 'normal', modules: ids });
  harnesses.push(h);
  return h;
}
afterEach(() => {
  harnesses.splice(0).forEach((h) => h.dispose());
  vi.restoreAllMocks();
  logger.reset();
});

describe('crafting independent installed-module combinations', () => {
  it.each(combinations.map((ids) => ({ ids, label: ids.join('+') })))(
    '$label: startup, harvest, craft, save/load, replay and seek',
    ({ ids }) => {
      const h = start(ids),
        game = worldHarnessGame(h);
      expect(game.extensionRuntime!.manifest.modules.map((m) => m.id)).toEqual([...ids].sort());
      if (!ids.includes('crafting')) {
        h.command('wait');
        const recording = h.exportRecording(),
          saved = h.save(),
          digest = h.digest();
        h.load(saved);
        expect(h.digest()).toBe(digest);
        expect(h.replay(recording)).toEqual({ ok: true, firstMismatch: null });
        return;
      }
      expect(h.world5()!.startupGrants.find((r) => r.owner === 'crafting')).toMatchObject({
        result: 'granted',
        toInventory: [
          { itemDefinitionId: 'crafting.wood', count: 6 },
          { itemDefinitionId: 'crafting.stone', count: 4 },
          { itemDefinitionId: 'crafting.fiber', count: 2 }
        ]
      });
      expect(
        craftingContext(h)
          .inventory.filter((i) => i.definitionId?.startsWith('crafting.'))
          .map((i) => [i.definitionId, i.quantity])
      ).toEqual([
        ['crafting.wood', 6],
        ['crafting.stone', 4],
        ['crafting.fiber', 2]
      ]);
      const driver = new NaturalCraftingDriver(h);
      driver.harvest('crafting.wood-node', 1);
      driver.craft('crafting.make-pick');
      expect(
        craftingContext(h).inventory.find((i) => i.definitionId === 'crafting.pick')
      ).toMatchObject({ quantity: 1, toolDurability: 40 });
      const saved = h.save(),
        recording = h.exportRecording(),
        final = craftingFinal(h);
      h.load(saved);
      expect(craftingFinal(h)).toEqual(final);
      expect(h.replay(recording)).toEqual({ ok: true, firstMismatch: null });
      expect(craftingFinal(h)).toEqual(final);
      h.seek(recording, JSON.parse(recording).events.length);
      expect(craftingFinal(h)).toEqual(final);
      expect(h.world5()!.startupGrants.filter((r) => r.owner === 'crafting')).toHaveLength(1);
    }
  );

  if (installed.includes('combat')) {
    it('a live player combat bundle records C5_BUSY with no work or clock mutation', () => {
      const h = start(['crafting', 'combat']), game = worldHarnessGame(h);
      arena(game); game.player.ticksUntilTurn = 0;
      const plan = preparePhasedAttackCommand(game, JSON.stringify({
        module: 'combat', action: 'attack', payload: { attackId: 'fixture.slash', facing: 'e' }
      }));
      expect(plan).not.toBeNull(); expect(commitPhasedAttackCommand(game, plan!)).toBe(true);
      expect(game.isInputLocked()).toBe(true);
      const attack = structuredClone(game.actorActions);
      rejected(h, 'craft', workPayload(h, 'make-pick'), 'C5_BUSY');
      expect(game.actorActions).toEqual(attack);
      const count = game.recordedInputEvents.length;
      h.command('wait'); expect(game.recordedInputEvents).toHaveLength(count);
    });
    it('combat damage during an accepted batch cancels output and refunds inputs exactly once', () => {
      const h = start(['crafting', 'combat']),
        game = worldHarnessGame(h);
      game.monsters = [];
      game.dormantMonsters = [];
      const at = { x: 30, y: 15 };
      for (let x = 27; x <= 34; x++)
        for (let y = 12; y <= 18; y++) game.grid.setTerrain(x, y, TerrainType.FLOOR);
      game.player.loc = at;
      game.player.hp = game.player.maxHp = 1000;
      const rat = new Monster(at.x + 1, at.y, {
        ...monsters.find((m) => m.id === 'rat')!,
        accuracy: 10000,
        damage: '10d1',
        moveSpeed: 10,
        attackSpeed: 10
      } as MonsterData);
      rat.state = MonsterState.HUNTING;
      rat.ticksUntilTurn = 1;
      rat.accuracy = 10000;
      rat.damageString = '10d1';
      rat.setStatusDuration('invisible', 1000);
      game.monsters.push(rat);
      game.extensionRuntime!.attachCreature(rat);
      // An unseen adjacent attacker is a valid initial state; its attack occurs within the paid batch.
      game.grid.getCell(rat.x, rat.y)!.isVisible = false;
      const before = craftingContext(h).inventory,
        hp = game.player.hp;
      const result = h.ext('crafting', 'craft', craftPayload(h, 'crafting.make-pick'));
      expect(result).toEqual({ recorded: true, error: null });
      expect(game.player.hp).toBeLessThan(hp);
      expect(last(h.world5()!.terminalTickets)).toMatchObject({
        status: 'cancelled',
        stopReason: 'damage',
        completedBatches: 0
      });
      expect(craftingContext(h).inventory).toEqual(before);
      expect(craftingContext(h).inventory.some((i) => i.definitionId === 'crafting.pick')).toBe(
        false
      );
      expect(
        game.worldWorkFacts!.filter((f) => f.owner === 'crafting' && f.operation === 'cancel')
      ).toHaveLength(1);
    });
  }

  if (installed.includes('giants'))
    it('resource generation never places nodes inside an actual giants side chamber', () => {
      const h = start(['crafting', 'giants'], 7306),
        game = worldHarnessGame(h);
      // Travel prerequisites are staged; depth generation is invoked through native stair commands.
      while (game.depth < 3) {
        game.monsters = [];
        game.dormantMonsters = [];
        game.player.loc = { ...game.levelSeeds[game.depth - 1]!.downStairsLoc };
        h.command('stairs_down');
      }
      const regions = game
        .extensionRuntime!.snapshot()
        .foundation.world.regions!.filter((r) => r.owner === 'giants');
      expect(regions.length).toBeGreaterThan(0);
      const nodes = h
        .world5()!
        .nodes.filter((n) => n.levelRef.kind === 'dungeon' && n.levelRef.depth === 3);
      expect(nodes.length).toBeGreaterThan(0);
      for (const node of nodes)
        for (const region of regions) {
          const b = region.bounds;
          expect(
            node.at.x >= b.x &&
              node.at.x < b.x + b.width &&
              node.at.y >= b.y &&
              node.at.y < b.y + b.height
          ).toBe(false);
        }
    });
});
