import { afterEach, describe, expect, it, vi } from 'vitest';
import { writeFileSync } from 'node:fs';
import { createHeadlessGame } from './harness';
import { workGame } from './support/worldWorkFixture';
import {
  readWorkContext,
  placementDraw,
  placementCandidates,
  checkInteractableBudget
} from '../engine/Core/WorldWorkWorld';
import { grantStartupItems, enterWorldWorkLevel } from '../engine/Core/WorldWorkPlacement';
import { worldWorkLastError, transactWorldWork } from '../engine/Core/WorldWork';
import { rng } from '../engine/Random';
import { timeSystem } from '../engine/Systems/Time';
import { Grid, TerrainType } from '../engine/Map/Grid';
import { Item, ItemCategory } from '../engine/Items/Item';
import { getNextEntityId } from '../entities/Creature';
import type { Game } from '../engine/Core/Game';
afterEach(() => vi.restoreAllMocks());
const read = (g: Game) => {
  const r = readWorkContext(g, 'craftskel', { kind: 'inventory' });
  if (!r.ok) throw new Error(r.code);
  return r.value;
};
const craft = (g: Game, count: number) => {
  const r = read(g),
    s = r.stations.find((s) => s.workPositions.some((p) => p.x === r.at.x && p.y === r.at.y))!;
  g.executeCommand(
    'ext:command',
    JSON.stringify({
      module: 'craftskel',
      action: 'craft',
      payload: {
        v: 1,
        recipeId: 'craftskel.dagger-recipe',
        batchCount: count,
        stationId: s.interactableId,
        stationRevision: s.revision,
        sourceContainerId: null,
        sourceRevision: null,
        inventoryStamp: r.inventoryStamp
      }
    })
  );
  while (g.pendingCommandConfirmation)
    g.resolveCommandDecision(g.pendingCommandConfirmation.token, true);
};
describe('C5 placement, startup and work boundaries', () => {
  it('c5-place-v1 freezes independent SHA first-word rejection vectors', () => {
    expect(placementDraw('51020001', 'dungeon.1', 'craftskel.fiber-node', 0, 5)).toEqual({
      index: 3,
      attempt: 0,
      word: 42723738
    });
    expect(placementDraw('42', 'dungeon.7', 'craftskel.fiber-node', 2, 123)).toEqual({
      index: 52,
      attempt: 0,
      word: 149204218
    });
    expect(placementDraw('4', 'dungeon.1', 'craftskel.fiber-node', 0, 2147483649)).toEqual({
      index: 561148371,
      attempt: 3,
      word: 561148371
    });
  });
  it('stable reachability cannot cross a secret door or occupy items and bodies', () => {
    const g = workGame();
    g.grid = new Grid(12, 12);
    for (let y = 0; y < 12; y++)
      for (let x = 0; x < 12; x++) g.grid.setTerrain(x, y, TerrainType.WALL);
    g.player.loc = { x: 2, y: 2 };
    g.items = [];
    g.monsters = [];
    g.dormantMonsters = [];
    for (let y = 1; y < 5; y++)
      for (let x = 1; x < 5; x++) g.grid.setTerrain(x, y, TerrainType.FLOOR);
    g.grid.setTerrain(5, 2, TerrainType.SECRET_DOOR);
    for (let y = 1; y < 5; y++)
      for (let x = 6; x < 10; x++) g.grid.setTerrain(x, y, TerrainType.FLOOR);
    const item = new Item('guard', '*', 1, ItemCategory.GEM);
    item.loc = { x: 3, y: 2 };
    g.items.push(item);
    const before = rng.getState(),
      cells = placementCandidates(g);
    expect(cells.length).toBeGreaterThan(0);
    expect(cells.every((c) => c.x < 5)).toBe(true);
    expect(cells).not.toContainEqual(item.loc);
    expect(rng.getState()).toEqual(before);
  });
  it('startup grants are one-shot across entry, save/load and replay', () => {
    const g = workGame(),
      grant = structuredClone(g.world5!.startupGrants),
      count = g.player.inventory.items.length;
    enterWorldWorkLevel(g, false);
    expect(g.world5!.startupGrants).toEqual(grant);
    expect(g.player.inventory.items).toHaveLength(count);
    expect(g.loadSnapshot(g.toSnapshot())).toBe(true);
    expect(g.world5!.startupGrants).toEqual(grant);
  });
  it('startup overflow is stable floor placement and skip allocates no Item ID', () => {
    const g = workGame({
      pack: (p) =>
        (p.startupItems.items = [
          { itemDefinitionId: 'craftskel.fiber', count: 99 },
          { itemDefinitionId: 'craftskel.knife', count: 30 },
          { itemDefinitionId: 'craftskel.kit', count: 99 }
        ])
    });
    expect(g.world5!.startupGrants[0]!.result).toBe('partial');
    expect(g.world5!.startupGrants[0]!.toFloor.length).toBeGreaterThan(0);
    const blocked = workGame();
    blocked.world5!.startupGrants = [];
    blocked.player.inventory.items = [];
    for (let n = 0; n < 26; n++)
      blocked.player.inventory.items.push(new Item('native' + n, ')', 1, ItemCategory.WEAPON));
    for (let y = blocked.player.y - 4; y <= blocked.player.y + 4; y++)
      for (let x = blocked.player.x - 4; x <= blocked.player.x + 4; x++)
        if (blocked.grid.isValidPos(x, y)) blocked.grid.setTerrain(x, y, TerrainType.WALL);
    const id = getNextEntityId();
    transactWorldWork(blocked, () => grantStartupItems(blocked, 'craftskel'));
    expect(blocked.world5!.startupGrants[0]!.result).toBe('skipped');
    expect(getNextEntityId()).toBe(id);
  });
  it('interactable admission preserves the 832 C5 and 1024 global boundaries', () => {
    const g = workGame(),
      w = g.world5!;
    w.nodes = Array.from({ length: 832 }, () => w.nodes[0]!);
    w.stations = [];
    w.containers = [];
    expect(() => checkInteractableBudget(g, 0)).not.toThrow();
    expect(() => checkInteractableBudget(g, 1)).toThrow('C5_BUDGET');
    w.nodes = [];
    const entities = g.extensionRuntime!.worldWorkEntities() as any[];
    while (entities.length < 1024) entities.push({ ...entities[0], id: 90000 + entities.length });
    expect(() => checkInteractableBudget(g, 0)).not.toThrow();
    expect(() => checkInteractableBudget(g, 1)).toThrow('C5_BUDGET');
  });
  it.each([1, 2, 16])('%i batches execute one real command and one clock each', (count) => {
    const g = workGame({
      pack: (p) => {
        p.items[1].tool.maxDurability = 16;
      }
    });
    g.monsters = [];
    g.dormantMonsters = [];
    const start = timeSystem.currentTick,
      before = g.recordedInputEvents.length;
    craft(g, count);
    for (let n = 1; n < count; n++) g.executeCommand('auto_step');
    expect(worldWorkLastError(g)).toBe(null);
    expect(g.world5!.terminalTickets[0]!.status).toBe('completed');
    expect(g.world5!.terminalTickets[0]!.completedBatches).toBe(count);
    expect(timeSystem.currentTick - start).toBe(count * 100);
    expect(g.recordedInputEvents.slice(before).map((e) => e.action)).toEqual([
      'ext:command',
      ...Array(count - 1).fill('auto_step')
    ]);
    expect(g.actorActions!.nextActionId).toBe(count + 1);
  });
  it('10000 single batch has one recovery versus ten 1000 batches, both deduct 100 hunger', () => {
    const run = (count: number, ticks: number) => {
      const g = workGame({
        mode: 'normal',
        pack: (p) => {
          p.recipes[0].workTicks = ticks;
          p.recipes[0].toolTag = null;
        }
      });
      g.monsters = [];
      g.dormantMonsters = [];
      (g as any).monsterSpawnFuse = 1000000;
      g.player.maxHp = 300;
      g.player.hp = 1;
      g.player.regenCarry = 0.1;
      g.player.nutrition = 1800;
      const before = { tick: timeSystem.currentTick, turns: g.stats.turns };
      craft(g, count);
      for (let n = 1; n < count; n++) g.executeCommand('auto_step');
      return {
        hp: g.player.hp,
        carry: g.player.regenCarry,
        nutrition: g.player.nutrition,
        elapsed: timeSystem.currentTick - before.tick,
        turns: g.stats.turns - before.turns,
        status: g.world5!.terminalTickets[0]!.status
      };
    };
    const single = run(1, 10000),
      batches = run(10, 1000);
    writeFileSync(
      '/private/tmp/phase5a2-D15.json',
      JSON.stringify({ single, batches }, null, 2) + '\n'
    );
    expect(single).toMatchObject({
      hp: 2,
      nutrition: 1700,
      elapsed: 10000,
      turns: 1,
      status: 'completed'
    });
    expect(batches).toMatchObject({
      hp: 11,
      nutrition: 1700,
      elapsed: 10000,
      turns: 10,
      status: 'completed'
    });
  });
});

it.each(['skip', 'defer'] as const)(
  '%s placement is one-shot, defer retries once, without native RNG',
  async (policy) => {
    const world = await import('../engine/Core/WorldWorkWorld'),
      { enterWorldWorkLevel } = await import('../engine/Core/WorldWorkPlacement');
    const noSpace = vi.spyOn(world, 'placementCandidates').mockReturnValue([]);
    const g = workGame({
      fixed: false,
      pack: (p) => (p.resourceNodes[0].placement.dungeon.onNoSpace = policy)
    });
    const before = rng.getState();
    expect(g.world5!.nodes).toHaveLength(0);
    expect(g.world5!.pendingPlacements).toHaveLength(policy === 'defer' ? 1 : 0);
    noSpace.mockRestore();
    enterWorldWorkLevel(g, false);
    expect(g.world5!.pendingPlacements).toHaveLength(0);
    expect(g.world5!.nodes).toHaveLength(policy === 'defer' ? 1 : 0);
    const receipts = structuredClone(g.world5!.receipts);
    enterWorldWorkLevel(g, false);
    expect(g.world5!.receipts).toEqual(receipts);
    expect(rng.getState()).toEqual(before);
  }
);
it('native generation and both RNG streams are unchanged by SHA placement and an in-pack grant', () => {
  const native = createHeadlessGame(51020001, 'wizard').toSnapshot();
  const world = workGame({ fixed: false }).toSnapshot();
  expect(world.rngState).toEqual(native.rngState);
  expect(world.grid).toEqual(native.grid);
});
