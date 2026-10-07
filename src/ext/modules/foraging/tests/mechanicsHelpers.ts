import { itemDefinition } from '../../../../engine/Core/WorldWorkWorld';
import { assembleWorldItem } from '../../../../engine/Items/WorldItems';
/** Deterministic scene construction only; all operations under test use public commands. */
import { afterEach, expect } from 'vitest';
import i18next from 'i18next';
import { createHash } from 'node:crypto';
import foundationLocale from '../../../../locales/zh_CN.json';
import locale from '../locales/zh_CN.json';
import { descriptor } from '../descriptor';
import type { ForagingState, ForagingView } from '../types';
import { createWorldHarness, worldHarnessGame } from '../../../testing/worldHarness';
import type { WorldHarness } from '../../../worldSdk';
import type { ModuleDescriptor } from '../../../descriptor';
import type { EdibleConsumedFact, FireContactFact } from '../../../edibleSdk';
import { assembleEdibleItem, knowledgeState } from '../../../../engine/Core/KindKnowledge';
import { readEdibleContext } from '../../../../engine/Core/EdibleCommands';
import { TerrainType, DungeonLayer } from '../../../../engine/Map/Grid';
import type { Game } from '../../../../engine/Core/Game';
import type { Item } from '../../../../engine/Items/Item';
import { Monster } from '../../../../entities/Monster';
import monsters from '../../../../data/monsters.json';
import { rng } from '../../../../engine/Random';
import { logger } from '../../../../engine/Systems/Logger';
export { worldHarnessGame as game, knowledgeState, rng, logger };
const active: WorldHarness[] = [];
afterEach(() => { for (const h of active.splice(0)) h.dispose(); });
export function makeHarness(seed = 51020001, modules: string[] = ['foraging'], overrides: readonly ModuleDescriptor[] = []) {
  if (!i18next.isInitialized) i18next.init({ lng: 'zh_CN', fallbackLng: false, resources: {}, initImmediate: false });
  i18next.addResources(i18next.language, 'translation', foundationLocale);
  i18next.addResources(i18next.language, 'translation', locale);
  const h = createWorldHarness({ seed, modules }, overrides); active.push(h); return h;
}
export function scene(h: WorldHarness): Game {
  const g = worldHarnessGame(h);
  g.monsters = []; g.dormantMonsters = [];
  (g as unknown as { monsterSpawnFuse: number }).monsterSpawnFuse = 1_000_000;
  g.player.loc = { x: 10, y: 10 };
  g.items = g.items.filter(i => Math.max(Math.abs(i.x - 10), Math.abs(i.y - 10)) > 6);
  for (let y = 4; y <= 16; y++) for (let x = 4; x <= 16; x++) {
    g.grid.setTerrain(x, y, TerrainType.FLOOR);
    const c = g.grid.getCell(x, y)!;
    c.layers[DungeonLayer.LIQUID] = c.layers[DungeonLayer.SURFACE] = c.layers[DungeonLayer.GAS] = TerrainType.NOTHING;
    c.isVisible = c.hasMemory = true; c.machineNumber = 0;
    g.grid.impregnableCells.delete(y * g.grid.width + x);
  }
  (g as unknown as { updateVision(): void }).updateVision();
  g.disturbed = false;
  return g;
}
export function addFood(h: WorldHarness, kind: string, quantity = 1): Item {
  const g = worldHarnessGame(h), id = kind.startsWith('foraging.') ? kind : `foraging.${kind}`;
  const item = assembleEdibleItem(g, id, quantity);
  if (!g.player.inventory.addItem(item)) throw Error('Test inventory is full');
  return g.player.inventory.items.find(i => i.worldItem?.definitionId === id)!;
}
export function addAlly(h: WorldHarness, monsterId = 'goblin'): Monster {
  const g = worldHarnessGame(h), template = monsters.find(m => m.id === monsterId)!;
  const ally = new Monster(g.player.x + 1, g.player.y, template as unknown as ConstructorParameters<typeof Monster>[2]);
  ally.ticksUntilTurn = 1_000_000;
  g.monsters.push(ally); g.extensionRuntime!.attachCreature(ally); g.becomeAllyWith(ally);
  return ally;
}
export function edible(h: WorldHarness) { const r = readEdibleContext(worldHarnessGame(h), 'foraging'); if (!r.ok) throw Error(r.code); return r.value; }
export function state(h: WorldHarness) { return worldHarnessGame(h).extensionRuntime!.snapshot().modules.foraging as unknown as ForagingState; }
export function view(h: WorldHarness) { return worldHarnessGame(h).extensionRuntime!.readModuleView('foraging')!.state as unknown as ForagingView; }
export function native(h: WorldHarness, action: string, data?: string, answers: readonly boolean[] = []) {
  const g = worldHarnessGame(h), previous = g.onConfirmRequest, previousCommand = g.onCommandConfirmRequest;
  expect(g.pendingCommandConfirmation).toBeNull();
  let cursor = 0; const before = g.recordedInputEvents.length;
  try { g.onCommandConfirmRequest = null; g.onConfirmRequest = () => answers[cursor++] ?? true; h.command(action, data); expect(g.pendingCommandConfirmation).toBeNull(); }
  finally { g.onConfirmRequest = previous; g.onCommandConfirmRequest = previousCommand; }
  return { cursor, before, events: g.recordedInputEvents.slice(before) };
}
export function eat(h: WorldHarness, item: Item, answers: readonly boolean[] = []) { return native(h, 'item:execute', `eat|${item.inventoryLetter}`, answers); }
export function feed(h: WorldHarness, ally: Monster, item: Item, answers: readonly boolean[] = []) {
  const c = edible(h), target = c.feedTargets.find(t => t.actorId === ally.id)!;
  return h.ext('foraging', 'feed', { v: 1, targetId: ally.id, targetRevision: target.targetRevision, itemId: item.id, inventoryStamp: c.inventoryStamp }, answers);
}
export function roast(h: WorldHarness, item: Item, sourceId = edible(h).heatSources[0]!.interactableId) {
  return h.ext('foraging', 'roast', { v: 1, heatSourceId: sourceId, itemId: item.id, inventoryStamp: edible(h).inventoryStamp });
}
export function mechanics(h: WorldHarness) { const g = worldHarnessGame(h), s = g.toSnapshot(); return structuredClone({ player: s.player, tick: s.run.currentTick, turn: s.run.absoluteTurnNumber, extensions: s.extensions, world5: s.run.world5, rng: s.rngState }); }
export function observeFacts(readConsumed?: (fact: EdibleConsumedFact) => void) {
  const consumed: EdibleConsumedFact[] = [], fire: FireContactFact[] = [];
  const override: ModuleDescriptor = { ...descriptor, create: () => {
    const m = descriptor.create(), original = m.edibleParticipant!;
    return { ...m, edibleParticipant: {
      onConsumed(f, tx) { consumed.push(structuredClone(f)); readConsumed?.(f); original.onConsumed?.(f, tx); },
      onFireContact(f, tx) { fire.push(structuredClone(f)); original.onFireContact?.(f, tx); }
    } };
  } };
  return { consumed, fire, override };
}
/** Independent crypto oracle: no imports from DerivedDraw, WorldCanonical or KindKnowledge RNG. */
export function roastChoice(seed: string | number, fingerprint: string, ordinal: number): 0 | 1 {
  const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v), 'utf8').digest('hex');
  const seedKey = hash(['c5-derive-seed-v1', String(seed), 'foraging', fingerprint.replace(/^sha256:/, '')]);
  const n = 2, limit = 0x100000000 - (0x100000000 % n);
  for (let attempt = 0; ; attempt++) {
    const v = parseInt(hash(['c5-derive-v1', seedKey, 'foraging.roast-policy', ordinal, attempt]).slice(0, 8), 16);
    if (v < limit) return (v % n) as 0 | 1;
  }
}
export function waitTurns(h: WorldHarness, turns: number) { for (let i = 0; i < turns; i++) h.command('wait'); }
export function messages() { return logger.messages.map(m => m.text).join('\n'); }
export function saveContinue(h: WorldHarness, continuation: () => void) {
  const save = h.save(), digest = h.digest(); continuation(); const result = h.digest();
  h.load(save); expect(h.digest()).toBe(digest); continuation(); expect(h.digest()).toBe(result);
}
export function moveNodeBeside(h: WorldHarness) {
  const g = worldHarnessGame(h), n = g.world5!.nodes.find(n => n.owner === 'foraging' && n.levelRef.kind === 'dungeon' && n.levelRef.depth === g.depth)!;
  if (!n) throw Error('Seed has no foraging node');
  n.at = { x: 11, y: 10 };
  Object.assign(g.extensionRuntime!.worldWorkEntities().find(e => e.id === n.interactableId)!, n.at);
  return n;
}
export function harvest(h: WorldHarness, node = moveNodeBeside(h)) {
  const context = h.readWorkContext('foraging', { kind: 'node', interactableId: node.interactableId });
  if (!context.ok) throw Error(context.code);
  return h.ext('foraging', 'harvest', { v: 1, nodeId: node.interactableId, nodeRevision: node.revision, inventoryStamp: context.value.inventoryStamp, destinationId: null, destinationRevision: null });
}
export function descend(h: WorldHarness) {
  const g = worldHarnessGame(h); g.monsters = []; g.dormantMonsters = [];
  for (let y = 0; y < g.grid.height; y++) for (let x = 0; x < g.grid.width; x++) if (g.grid.getCell(x, y)!.layers.includes(TerrainType.STAIRS_DOWN)) {
    g.player.loc = { x, y }; h.command('stairs_down'); return;
  }
  throw Error('No down stairs');
}

export function hearth(h: WorldHarness) {
  const g = worldHarnessGame(h);
  for (const [id, quantity] of [['crafting.stone', 6], ['crafting.wood', 2]] as const) g.player.inventory.addItem(assembleWorldItem(itemDefinition(g, id), quantity));
  const context = h.readWorkContext('crafting', { kind: 'inventory' }); if (!context.ok) throw Error(context.code);
  const before = g.world5!.simulationTicks;
  expect(h.ext('crafting', 'place-station', { v: 1, definitionId: 'crafting.hearth', x: 11, y: 10, inventoryStamp: context.value.inventoryStamp })).toEqual({ recorded: true, error: null });
  h.runAutoUntilIdle(10);
  expect(g.world5!.simulationTicks - before).toBe(300);
  const source = edible(h).heatSources.find(s => s.kind === 'hearth-station'); expect(source).toBeDefined(); return source!;
}
