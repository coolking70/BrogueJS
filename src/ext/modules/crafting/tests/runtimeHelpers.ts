/** Test scenes only. Every player operation under test uses the real command boundary. */
import { afterEach, expect, vi } from 'vitest';
import { createWorldHarness, worldHarnessGame } from '../../../testing/worldHarness';
import type { WorldHarness, WorldHarnessOptions, JsonValue, ResourceNodeRecord } from '../../../worldSdk';
import type { Game } from '../../../../engine/Core/Game';
import { TerrainType } from '../../../../engine/Map/Grid';
import { assembleWorldItem } from '../../../../engine/Items/WorldItems';
import { Item, ItemCategory } from '../../../../engine/Items/Item';
import { clearWorldCell, itemDefinition, workPositions } from '../../../../engine/Core/WorldWorkWorld';
import { rng } from '../../../../engine/Random';
import { getNextEntityId } from '../../../../entities/Creature';
import { timeSystem } from '../../../../engine/Systems/Time';
import { installRecordingScene } from '../../../../test/support/recordingV4';

export const SAFE_SEED = 51020001;
const live: WorldHarness[] = [];
afterEach(() => { for (const h of live.splice(0)) h.dispose(); vi.restoreAllMocks(); });
export function harness(options: Partial<WorldHarnessOptions> = {}) {
  const h = createWorldHarness({ seed: SAFE_SEED, modules: ['crafting'], mode: 'normal', ...options });
  live.push(h);
  return h;
}
export const game = worldHarnessGame;
export function read(h: WorldHarness, owner = 'crafting') {
  const r = h.readWorkContext(owner, { kind: 'inventory' });
  if (!r.ok) throw new Error(r.code);
  return r.value;
}
export function quiet(g: Game) {
  g.monsters = [];
  g.dormantMonsters = [];
  (g as unknown as { monsterSpawnFuse: number }).monsterSpawnFuse = 1_000_000;
  g.disturbed = false;
}
export function arena(g: Game) {
  quiet(g);
  for (let y = g.player.y - 3; y <= g.player.y + 3; y++)
    for (let x = g.player.x - 3; x <= g.player.x + 3; x++) {
      if (x < 1 || y < 1 || x >= g.grid.width - 1 || y >= g.grid.height - 1) continue;
      g.grid.setTerrain(x, y, TerrainType.FLOOR);
      const c = g.grid.getCell(x, y)!;
      c.hasMemory = true;
      c.isVisible = true;
      c.machineNumber = 0;
      g.grid.impregnableCells.delete(y * g.grid.width + x);
    }
  g.items = g.items.filter(i => Math.max(Math.abs(i.x - g.player.x), Math.abs(i.y - g.player.y)) > 3);
}
export function staged(setup: (g: Game) => void = arena, options: Partial<WorldHarnessOptions> = {}) {
  installRecordingScene(g => {
    if (g.world5 && g.extensionRuntime?.manifest.modules.some(m => m.id === 'crafting')) setup(g);
  });
  return harness(options);
}
export function add(g: Game, shortId: string, count: number) {
  const definition = itemDefinition(g, shortId.includes('.') ? shortId : `crafting.${shortId}`);
  while (count > 0) {
    const quantity = Math.min(count, definition.maxStack);
    const item = assembleWorldItem(definition, quantity);
    if (!g.player.inventory.addItem(item)) throw new Error(`Test inventory full: ${definition.id}`);
    count -= quantity;
  }
}
export function amount(h: WorldHarness, shortId: string) {
  const id = shortId.includes('.') ? shortId : `crafting.${shortId}`;
  return read(h).inventory.filter(i => i.definitionId === id).reduce((n, i) => n + i.quantity, 0);
}
export function amounts(h: WorldHarness) {
  return Object.fromEntries(read(h).inventory.filter(i => i.definitionId?.startsWith('crafting.'))
    .map(i => i.definitionId!).sort().map(id => [id, amount(h, id)]));
}
export function node(h: WorldHarness, shortId = 'wood-node') {
  const n = game(h).world5!.nodes.find(n => n.definitionId === `crafting.${shortId}` && n.levelRef.kind === 'dungeon' && n.levelRef.depth === game(h).depth);
  if (!n) throw new Error(`Missing ${shortId} at D${game(h).depth}`);
  return n;
}
export function adjacent(g: Game) {
  for (let y = g.player.y - 1; y <= g.player.y + 1; y++)
    for (let x = g.player.x - 1; x <= g.player.x + 1; x++)
      if (clearWorldCell(g, { x, y })) return { x, y };
  throw new Error('No adjacent placement cell in scene');
}
export function nearNode(h: WorldHarness, shortId = 'wood-node') {
  const g = game(h), n = node(h, shortId);
  quiet(g);
  const p = workPositions(g, n.at).find(p => !g.extensionRuntime!.worldWorkEntities().some(e => e.depth === g.depth && e.x === p.x && e.y === p.y));
  if (!p) throw new Error('Node has no work position');
  g.player.loc = { ...p };
  arena(g);
  g.grid.getCell(n.at.x, n.at.y)!.hasMemory = true;
  return n;
}
export function moveNodeBeside(g: Game, shortId = 'wood-node') {
  const n = g.world5!.nodes.find(n => n.definitionId === `crafting.${shortId}` && n.levelRef.kind === 'dungeon' && n.levelRef.depth === g.depth)!;
  const p = adjacent(g);
  n.at = { ...p };
  Object.assign(g.extensionRuntime!.worldWorkEntities().find(e => e.id === n.interactableId)!, p);
  return n;
}
export function harvestPayload(h: WorldHarness, n: ResourceNodeRecord = node(h)) {
  return { v: 1, nodeId: n.interactableId, nodeRevision: n.revision, inventoryStamp: read(h).inventoryStamp, destinationId: null, destinationRevision: null };
}
export function harvest(h: WorldHarness, shortId = 'wood-node', answers: readonly boolean[] = []) {
  return h.ext('crafting', 'harvest', harvestPayload(h, node(h, shortId)), answers);
}
export function craftPayload(h: WorldHarness, shortId = 'make-table-kit', batchCount = 1) {
  const r = read(h);
  const needsTable = ['make-dagger', 'make-leather-armor', 'make-bed-kit', 'make-chest-kit'].includes(shortId);
  const s = needsTable ? r.stations.find(s => s.definitionId === 'crafting.table' && s.workPositions.some(p => p.x === r.at.x && p.y === r.at.y)) : null;
  return { v: 1, recipeId: `crafting.${shortId}`, batchCount, stationId: s?.interactableId ?? null, stationRevision: s?.revision ?? null, sourceContainerId: null, sourceRevision: null, inventoryStamp: r.inventoryStamp };
}
export function craft(h: WorldHarness, shortId = 'make-table-kit', batchCount = 1, answers: readonly boolean[] = []) {
  return h.ext('crafting', 'craft', craftPayload(h, shortId, batchCount), answers);
}
export function place(h: WorldHarness, shortId = 'table') {
  return h.ext('crafting', 'place-station', { v: 1, definitionId: `crafting.${shortId}`, ...adjacent(game(h)), inventoryStamp: read(h).inventoryStamp });
}
export function cancel(h: WorldHarness) {
  const t = read(h).activeTicket!;
  return h.ext('crafting', 'cancel-work', { v: 1, ticketId: t.ticketId, ticketRevision: t.revision });
}
export function descend(h: WorldHarness) {
  const g = game(h);
  quiet(g);
  for (let y = 0; y < g.grid.height; y++) for (let x = 0; x < g.grid.width; x++)
    if (g.grid.getCell(x, y)!.layers.includes(TerrainType.STAIRS_DOWN)) {
      g.player.loc = { x, y };
      h.command('stairs_down');
      return;
    }
  throw new Error(`No stairs at D${g.depth}`);
}
export function ascend(h: WorldHarness) {
  const g = game(h);
  quiet(g);
  for (let y = 0; y < g.grid.height; y++) for (let x = 0; x < g.grid.width; x++)
    if (g.grid.getCell(x, y)!.layers.includes(TerrainType.STAIRS_UP)) {
      g.player.loc = { x, y };
      h.command('stairs_up');
      return;
    }
  throw new Error(`No up stairs at D${g.depth}`);
}
export function waitTicks(h: WorldHarness, ticks: number) {
  const before = game(h).world5!.simulationTicks;
  for (let i = 0; i < ticks / 100; i++) h.command('wait');
  expect(game(h).world5!.simulationTicks - before).toBe(ticks);
}
export function fillBag(g: Game) {
  while (g.player.inventory.packCount() < g.player.inventory.capacity)
    g.player.inventory.addItem(new Item(`fixture.${g.player.inventory.items.length}`, ')', 0xcccccc, ItemCategory.WEAPON));
}
export function mechanics(h: WorldHarness) {
  const g = game(h);
  return structuredClone({ hp: g.player.hp, gameOver: g.isGameOver, autoAction: (g as unknown as { autoAction: unknown }).autoAction, tick: timeSystem.currentTick, simulationTicks: g.world5!.simulationTicks, rng: rng.getState(), entityId: getNextEntityId(), world: g.world5, actions: g.actorActions, inventory: g.player.inventory.items, containerItems: [...(g.worldContainerItems ?? [])], facts: g.worldWorkFacts, state: g.extensionRuntime!.snapshot() });
}
export function rejected(h: WorldHarness, action: string, payload: unknown, code: string) {
  const before = mechanics(h), recorded = game(h).recordedInputEvents.length;
  expect(h.ext('crafting', action, payload as JsonValue)).toEqual({ recorded: true, error: code });
  expect(game(h).recordedInputEvents).toHaveLength(recorded + 1);
  expect(mechanics(h)).toEqual(before);
}
