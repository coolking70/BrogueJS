import { createConfiguredWorldHarness } from '../../../testing/configuredWorldHarness';
import { vi, afterEach, expect } from 'vitest';
import { worldHarnessGame } from '../../../testing/worldHarness';
import type { WorldHarness } from '../../../worldSdk';
import { installRecordingScene } from '../../../../test/support/recordingV4';
import { TerrainType } from '../../../../engine/Map/Grid';
import { Game } from '../../../../engine/Core/Game';
import { inventoryStamp } from '../../../../engine/Core/RecordingDigest';
import { ItemCategory } from '../../../../engine/Items/Item';
import { itemDefinition } from '../../../../engine/Core/WorldWorkWorld';
import { assembleWorldItem } from '../../../../engine/Items/WorldItems';
const live: WorldHarness[] = [];
afterEach(() => {
  live.splice(0).forEach((h) => h.dispose());
  vi.restoreAllMocks();
});
export function scene(g: Game, initial = true) {
  for (let y = 1; y < 28; y++)
    for (let x = 1; x < 78; x++) {
      g.grid.setTerrain(x, y, TerrainType.FLOOR);
      const c = g.grid.getCell(x, y)!;
      c.machineNumber = 0;
      c.hasMemory = c.isExplored = true;
      c.isVisible = Math.max(Math.abs(x - 20), Math.abs(y - 12)) <= 8;
    }
  for (let y = 1; y < 28; y++) g.grid.setTerrain(35, y, TerrainType.WALL);
  if (!initial) g.grid.setTerrain(35, 1, TerrainType.FLOOR);
  g.grid.impregnableCells.clear();
  g.grid.setTerrain(2, 2, TerrainType.STAIRS_UP);
  g.grid.setTerrain(30, 25, TerrainType.STAIRS_DOWN);
  (g as any).levelSeeds[g.depth - 1].upStairsLoc = { x: 2, y: 2 };
  (g as any).levelSeeds[g.depth - 1].downStairsLoc = { x: 30, y: 25 };
  if (initial) g.player.loc = { x: 20, y: 12 };
  g.monsters.forEach((m, i) => {
    m.loc = { x: 60 + (i % 10), y: 20 };
    m.ticksUntilTurn = 100000;
  });
  g.dormantMonsters.forEach((m) => (m.loc = { x: 60, y: 22 }));
  g.items.forEach((i) => (i.loc = { x: 65, y: 24 }));
  for (const e of g.extensionRuntime!.worldWorkEntities().filter((e) => e.depth === g.depth)) {
    Object.assign(e, { x: 4 + (e.id % 6), y: 4 });
    const n = g.world5!.nodes.find((n) => n.interactableId === e.id);
    if (n) n.at = { x: e.x, y: e.y };
  }
  // Only the recording origin receives staged budgets. A real first visit may
  // reshape the test map, but never changes the native landing or backpack.
  if (!initial) return;
  const food = g.player.inventory.items.find((i) => i.category === ItemCategory.FOOD)!;
  food.quantity = 4;
  for (const name of ['wood', 'stone', 'fiber']) {
    const i = g.player.inventory.items.find(
      (i) => i.worldItem?.definitionId === 'settlement.' + name
    );
    if (i) i.quantity = 99;
  }
}
export function setup(modules = ['settlement'], depth = 1, foodQuantity = 4, raids = false) {
  installRecordingScene((g) => {
    if (g.extensionRuntime?.manifest.modules.some((m) => m.id === 'settlement')) {
      if (depth !== 1) {
        g.depth = depth;
        (g as any).generateDepth();
      }
      scene(g);
      g.player.inventory.items.find((i) => i.category === ItemCategory.FOOD)!.quantity =
        foodQuantity;
    }
  });
  const h = createConfiguredWorldHarness({ seed: 51020001, modules }, modules.includes('settlement') ? {settlement:{raids}} : {});
  live.push(h);
  return { h, g: worldHarnessGame(h) };
}
export function base(g: Game) {
  return {
    v: 1,
    stateRevision: g.extensionRuntime!.worldCampState('settlement').revision,
    inventoryStamp: inventoryStamp(g.player.inventory.items)
  };
}
export function payment(g: Game, cost: { itemDefinitionId: string; count: number }[]) {
  return { ...base(g), sourceContainerId: null, sourceRevision: null, materials: cost };
}
export function establish(g: Game) {
  const food = g.player.inventory.items.find((i) => i.category === ItemCategory.FOOD)!;
  return {
    ...payment(g, [
      { itemDefinitionId: 'settlement.wood', count: 4 },
      { itemDefinitionId: 'settlement.stone', count: 2 }
    ]),
    x: 21,
    y: 12,
    bounds: { x: 17, y: 8, width: 9, height: 9 },
    food: [{ itemId: food.id, quantity: 2 }]
  };
}
export const current = (g: Game) => g.extensionRuntime!.worldCampState('settlement').camps[0]!;
export function build(g: Game, name = 'bed', at = { x: 20, y: 13 }) {
  const c = current(g),
    r = g.extensionRuntime!.worldStructureRegions().find((r) => r.id === c.regionId)!,
    d = g
      .extensionRuntime!.worldDefinitionPacks()
      .find((p) => p.items[0]?.owner === 'settlement')!
      .structures!.find((d) => d.id === 'settlement.' + name)!;
  return {
    ...payment(g, d.constructionCost as any),
    regionId: r.id,
    regionRevision: r.revision,
    definitionId: d.id,
    ...at
  };
}
export function add(g: Game, id: string, count: number) {
  g.player.inventory.addItem(assembleWorldItem(itemDefinition(g, id), count));
}

export function travelScenes() {
  const prototype = Game.prototype as unknown as { generateDepth(...args: any[]): void };
  const original = prototype.generateDepth;
  vi.spyOn(prototype, 'generateDepth').mockImplementation(function (this: Game, ...args: any[]) {
    const first = !(this as any).levelSeeds[this.depth - 1]?.visited;
    original.apply(this, args);
    if (first && this.world5) {
      const landing = { ...this.player.loc },
        inventory = inventoryStamp(this.player.inventory.items);
      scene(this, false);
      expect(this.player.loc).toEqual(landing);
      expect(inventoryStamp(this.player.inventory.items)).toBe(inventory);
    }
  });
}
export function walk(h: WorldHarness, g: Game, to: { x: number; y: number }) {
  const depth = g.depth;
  let n = 0;
  while (g.depth === depth && (g.player.x !== to.x || g.player.y !== to.y)) {
    if (++n > 200)
      throw new Error(
        'walk limit ' +
          JSON.stringify({
            at: g.player.loc,
            to,
            over: g.isGameOver,
            locked: g.isInputLocked(),
            pending: g.hasPendingConfirmation,
            events: g.recordedInputEvents.length
          })
      );
    // Plan only the staged, known walking geometry. Every actual step still
    // goes through the native public move command, including stair interception.
    const start = { ...g.player.loc },
      queue = [start];
    const key = (p: { x: number; y: number }) => p.y * g.grid.width + p.x;
    const previous = new Map<number, { x: number; y: number } | null>([[key(start), null]]);
    const occupied = new Set(
      [...g.monsters, ...g.dormantMonsters].flatMap((m) => g.footprintOf(m).map(key))
    );
    for (let head = 0; head < queue.length && !previous.has(key(to)); head++) {
      const at = queue[head]!;
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1]
      ]) {
        const p = { x: at.x + dx!, y: at.y + dy! },
          cell = g.grid.getCell(p.x, p.y);
        if (!cell || !cell.isPassable || previous.has(key(p)) || occupied.has(key(p))) continue;
        if (
          key(p) !== key(to) &&
          cell.layers.some((t) => t === TerrainType.STAIRS_UP || t === TerrainType.STAIRS_DOWN)
        )
          continue;
        previous.set(key(p), at);
        queue.push(p);
      }
    }
    if (!previous.has(key(to))) throw new Error('staged walking route blocked');
    let next = to;
    while (previous.get(key(next)) && key(previous.get(key(next))!) !== key(start))
      next = previous.get(key(next))!;
    h.command('move', { x: next.x - start.x, y: next.y - start.y });
  }
}
export function stairs(h: WorldHarness, g: Game, down: boolean) {
  const type = down ? TerrainType.STAIRS_DOWN : TerrainType.STAIRS_UP;
  let at: { x: number; y: number } | undefined;
  for (let y = 0; y < g.grid.height; y++)
    for (let x = 0; x < g.grid.width; x++)
      if (g.grid.getCell(x, y)!.layers.includes(type)) at = { x, y };
  if (!at) throw new Error('no stairs');
  const depth = g.depth;
  walk(h, g, at);
  if (g.depth === depth) h.command(down ? 'stairs_down' : 'stairs_up');
}
