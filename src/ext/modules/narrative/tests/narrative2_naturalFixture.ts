import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { expect } from 'vitest';
import i18next from 'i18next';
import type { Game, GameRecording } from '../../../../engine/Core/Game';
import { createHeadlessGame } from '../../../../test/harness';
import { createExtensionRegistry } from '../../../catalog';
import { canonical } from '../../../json';
import { logger } from '../../../../engine/Systems/Logger';
import { TerrainType as T } from '../../../../engine/Map/Grid';
import { cellTerrainFlags } from '../../../../engine/Map/DungeonFeature';
import { T_IS_FIRE, T_OBSTRUCTS_DIAGONAL_MOVEMENT } from '../../../../engine/Map/TerrainCatalog';
import { footprintOf } from '../../../../engine/Movement/CreatureSpatial';
import { ItemCategory } from '../../../../engine/Items/Item';
import { buildNarrativeUiCommand, readNarrativeUiView } from '../ui/view';
import type { NarrativeState } from '../state';
import locale from '../locales/zh_CN.json';

export const EVIDENCE = process.env.NARRATIVE2_EVIDENCE ?? '/tmp/narrative2-evidence';
export const NPCS = [
  { id: 'cord.mender', min: 2, max: 3, a: 'splice', b: 'sever' },
  { id: 'cistern.listener', min: 3, max: 4, a: 'mark', b: 'erase' },
  { id: 'bone.clerk', min: 4, max: 6, a: 'blank', b: 'number' },
  { id: 'salt.warden', min: 6, max: 8, a: 'share', b: 'keep' },
  { id: 'letter.carrier', min: 8, max: 10, a: 'return', b: 'wait' }
] as const;
export const json = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export const digest = (value: unknown) =>
  createHash('sha256').update(canonical(value)).digest('hex');
export const narrative = (game: Game) =>
  game.extensionRuntime!.snapshot().modules.narrative as unknown as NarrativeState;
/** Full native/extension mechanical snapshot. Logger and recording origin are compared
 * separately as messages and real recording prefix/suffix, never dropped silently. */
export function world(game: Game) {
  const { savedAt: _time, run, ...snapshot } = game.toSnapshot();
  const { logger: _logger, recordingOrigin: _origin, ...mechanical } = run;
  return json({ ...snapshot, run: mechanical });
}
export const messages = (game: Game) => json(game.toSnapshot().run.logger);
export function settle(game: Game) {
  if (game.pendingCommandConfirmation)
    game.resolveCommandDecision(game.pendingCommandConfirmation.token, true);
  while (logger.pendingAcknowledgment) logger.acknowledgeNext();
}
export function startNarrative(
  ids: readonly string[] = ['narrative'],
  seed = 1,
  mode: 'wizard' | 'normal' = 'wizard',
  initial = true
) {
  const game = createHeadlessGame(seed, 'test');
  i18next.addResourceBundle(i18next.language, 'translation', locale, true, true);
  const registry = createExtensionRegistry(),
    manifest = registry.manifest(ids);
  const initialCommands = initial
    ? registry
        .create(manifest)
        .flatMap((m) =>
          m.initialCommand ? [JSON.stringify({ module: m.id, ...m.initialCommand })] : []
        )
    : [];
  game.startNewGame({ seed, mode, ruleSet: 'extended', extensions: ids, initialCommands });
  game.animationEnabled = false;
  settle(game);
  return game;
}
export type Command = Pick<GameRecording['events'][number], 'action' | 'data' | 'decisions'>;
export function execute(game: Game, event: Command) {
  settle(game);
  const before = game.recordedInputEvents.length;
  game.executeCommand(event.action, event.data);
  for (const decision of event.decisions ?? [])
    if (game.pendingCommandConfirmation)
      game.resolveCommandDecision(game.pendingCommandConfirmation.token, decision);
  settle(game);
  expect(game.recordedInputEvents.length).toBe(before + 1);
  expect(game.recordedInputEvents[game.recordedInputEvents.length - 1]!.decisions).toEqual(
    event.decisions ?? []
  );
}
export function command(game: Game, action: 'open' | 'choose' | 'close', id?: number | string) {
  settle(game);
  const input = buildNarrativeUiCommand(game, readNarrativeUiView(game)!, action, id);
  expect(input, `${action}:${id ?? ''} D${game.depth}`).not.toBeNull();
  const prior = game.toSnapshot(),
    turn = game.absoluteTurnNumber,
    tick = prior.run.currentTick,
    rng = json(prior.rngState);
  const modules = json(game.extensionRuntime!.snapshot().modules);
  delete modules.narrative;
  execute(game, { action: 'ext:command', data: input!, decisions: [] });
  expect(game.absoluteTurnNumber).toBe(turn);
  expect(game.toSnapshot().run.currentTick).toBe(tick);
  const afterSnapshot = game.toSnapshot();
  expect(afterSnapshot.rngState).toEqual(rng);
  expect(afterSnapshot.player).toEqual(prior.player);
  expect(afterSnapshot.extensions!.components).toEqual(prior.extensions!.components);
  const after = json(game.extensionRuntime!.snapshot().modules);
  delete after.narrative;
  expect(after).toEqual(modules);
}
export class RouteFailure extends Error {}
export let lastAttempt: unknown = null;
type Position = { x: number; y: number };
const key = (p: Position) => `${p.x},${p.y}`;
const directions = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1]
] as const;
/** Read-only, whole-map BFS is a reproducible harness strategy, not a player exploration policy.
 * Cardinal routes have priority; legal diagonals are a deterministic fallback. */
export function routeCommand(game: Game, target: Position, stairs?: 'stairs_up' | 'stairs_down') {
  const at = game.player.loc;
  const occupied = new Set(
    game.monsters.filter((m) => m.hp > 0 && m.spatial).flatMap((m) => footprintOf(m).map(key))
  );
  const terrain = (p: Position) => {
    const c = game.grid.getCell(p.x, p.y);
    return (
      !!c &&
      (c.isPassable || c.terrain === T.DOOR || c.terrain === T.SECRET_DOOR) &&
      !c.layers.some((t) => [T.LAVA, T.CHASM, T.WATER_DEEP].includes(t)) &&
      !(cellTerrainFlags(game.grid, p.x, p.y) & T_IS_FIRE)
    );
  };
  const diagonal = (p: Position, n: Position) =>
    p.x === n.x ||
    p.y === n.y ||
    (terrain({ x: n.x, y: p.y }) &&
      terrain({ x: p.x, y: n.y }) &&
      !(cellTerrainFlags(game.grid, n.x, p.y) & T_OBSTRUCTS_DIAGONAL_MOVEMENT) &&
      !(cellTerrainFlags(game.grid, p.x, n.y) & T_OBSTRUCTS_DIAGONAL_MOVEMENT));
  let goal: Position | undefined,
    prev = new Map<string, Position | null>();
  for (const [length, avoid] of [
    [4, true],
    [8, true],
    [4, false],
    [8, false]
  ] as const) {
    const q = [{ ...at }];
    prev = new Map([[key(at), null]]);
    goal = undefined;
    for (let i = 0; i < q.length; i++) {
      const p = q[i]!;
      if (key(p) === key(target)) {
        goal = p;
        break;
      }
      for (const [dx, dy] of directions.slice(0, length)) {
        const n = { x: p.x + dx, y: p.y + dy };
        if (
          terrain(n) &&
          (!avoid || !occupied.has(key(n))) &&
          diagonal(p, n) &&
          !prev.has(key(n))
        ) {
          prev.set(key(n), p);
          q.push(n);
        }
      }
    }
    if (goal) break;
  }
  if (!goal) throw new RouteFailure(`no-route D${game.depth} ${key(at)} -> ${key(target)}`);
  let next = goal,
    p = goal;
  while (prev.get(key(p))) {
    next = p;
    p = prev.get(key(p))!;
  }
  if (key(next) === key(at)) {
    if (!stairs) throw new RouteFailure(`target-ineligible D${game.depth} ${key(at)}`);
    game.executeCommand(stairs);
  } else if (game.grid.getCell(next.x, next.y)!.terrain === T.SECRET_DOOR)
    game.executeCommand('search');
  else game.executeCommand('move', { x: next.x - at.x, y: next.y - at.y });
  settle(game);
}
export type RouteBudget = {
  commands: number;
  stagnant: number;
  last: string;
  entrances: Record<number, Position>;
};
export const newBudget = (): RouteBudget => ({ commands: 0, stagnant: 0, last: '', entrances: {} });
function progress(game: Game) {
  const p = game.player.loc;
  // Only changes that can advance this route count. Distant gas/fire/roaming
  // monsters are not an effective action by a stationary player.
  return canonical({
    d: game.depth,
    p,
    terrain: Array.from({ length: 3 }, (_, dy) =>
      Array.from(
        { length: 3 },
        (_, dx) => game.grid.getCell(p.x + dx - 1, p.y + dy - 1)?.terrain ?? null
      )
    ),
    inventory: game.player.inventory.items.map((i) => [i.id, i.quantity])
  });
}
export function routeStep(
  game: Game,
  budget: RouteBudget,
  target: Position,
  stairs?: 'stairs_up' | 'stairs_down'
) {
  if (game.isGameOver) throw new RouteFailure(`death D${game.depth} HP${game.player.hp}`);
  if (budget.commands >= 3000) throw new RouteFailure(`route-budget D${game.depth}`);
  const beforeDepth = game.depth;
  const beforeProgress = progress(game),
    beforeTargets = game.monsters
      .filter((m) => Math.max(Math.abs(m.x - game.player.x), Math.abs(m.y - game.player.y)) <= 1)
      .map((m) => ({ id: m.id, hp: m.hp }));
  const food =
    game.player.nutrition < 400
      ? game.player.inventory.items.find((i) => i.category === ItemCategory.FOOD)
      : undefined;
  if (food) {
    game.executeItemCommand('eat', food);
    settle(game);
  } else routeCommand(game, target, stairs);
  budget.commands++;
  if (game.depth !== beforeDepth) budget.entrances[game.depth] = { ...game.player.loc };
  lastAttempt = {
    depth: game.depth,
    commands: budget.commands,
    events: game.recordedInputEvents.length,
    player: json(game.player.loc),
    hp: game.player.hp,
    placements: json(narrative(game).placementReceipts)
  };
  if (
    (process.env.BROGUE_CAPTURE_NARRATIVE2_TRACE === '1' ||
      process.env.BROGUE_CAPTURE_NARRATIVE2_COMBOS === '1') &&
    budget.commands % 100 === 0
  ) {
    mkdirSync(EVIDENCE, { recursive: true });
    appendFileSync(`${EVIDENCE}/route-progress.ndjson`, JSON.stringify(lastAttempt) + '\n');
  }
  const after = progress(game),
    damagedBlocker = beforeTargets.some(
      (m) => (game.monsters.find((n) => n.id === m.id)?.hp ?? 0) < m.hp
    );
  budget.stagnant = after === beforeProgress && !damagedBlocker ? budget.stagnant + 1 : 0;
  budget.last = after;
  if (budget.stagnant >= 64)
    throw new RouteFailure(`stagnant64 D${game.depth} ${key(game.player.loc)}`);
  if (game.lastAdvancementError)
    throw new Error(`engine advancement failure: ${game.lastAdvancementError}`);
  if (game.isGameOver) throw new RouteFailure(`death D${game.depth} HP${game.player.hp}`);
}
export function descend(game: Game, depth: number, budget: RouteBudget) {
  while (game.depth < depth)
    routeStep(game, budget, game.levelSeeds[game.depth - 1]!.downStairsLoc, 'stairs_down');
}
export function target(game: Game, id: string) {
  return game
    .extensionRuntime!.snapshot()
    .foundation.world.entities.find(
      (e) => e.owner === 'narrative' && e.contentId === id && e.depth === game.depth
    );
}
export function approach(game: Game, id: string, budget: RouteBudget) {
  const entity = target(game, id);
  if (!entity) throw new RouteFailure(`not-placed ${id} D${game.depth}`);
  while (!game.extensionRuntime!.nearbyInteractables('narrative').some((e) => e.id === entity.id))
    routeStep(game, budget, entity);
  assertNaturalPlacement(game, id, budget.entrances[game.depth]);
  return entity;
}
export function assertNaturalPlacement(game: Game, id: string, entrance: Position | undefined) {
  const entity = target(game, id)!;
  expect(entity).toBeDefined();
  expect(readNarrativeUiView(game)!.nearby.some((e) => e.targetEntityId === entity.id)).toBe(true);
  expect(entity).toMatchObject({
    owner: 'narrative',
    contentId: id,
    depth: game.depth,
    instanceKey: `${id}.first.slot.1`,
    interactionDistance: 1
  });
  const cell = game.grid.getCell(entity.x, entity.y)!;
  expect(cell.layers[0]).toBe(T.FLOOR);
  expect(cell.isPassable).toBe(true);
  expect(cell.isVisible).toBe(true);
  expect([...game.monsters, ...game.dormantMonsters].some((m) => m.id === entity.id)).toBe(false);
  expect('hp' in entity).toBe(false);
  expect(game.player.id).not.toBe(entity.id);
  const distance = (a: Position, b: Position) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  for (const stair of [
    game.levelSeeds[game.depth - 1]!.upStairsLoc,
    game.levelSeeds[game.depth - 1]!.downStairsLoc
  ])
    expect(distance(entity, stair)).toBeGreaterThanOrEqual(1);
  expect(entrance, 'actual public level-entry position').toBeDefined();
  expect(distance(entity, entrance!)).toBeLessThanOrEqual(8);
  expect(narrative(game).npcBindings[entity.id]).toEqual({
    npcId: id,
    placementId: `${id}.first`,
    instanceKey: entity.instanceKey
  });
  expect(narrative(game).placementReceipts).toContainEqual({
    npcId: id,
    placementId: `${id}.first`,
    instanceKey: entity.instanceKey,
    depth: game.depth,
    result: 'placed'
  });
  return entity;
}
export type Point = {
  label: string;
  index: number;
  worldHash: string;
  messageHash: string;
  turn: number;
  tick: number;
};
export type SavedPoint = {
  save: ReturnType<Game['toSaveSnapshot']>;
  world: ReturnType<typeof world>;
  messages: ReturnType<typeof messages>;
};
export function playDialogue(
  game: Game,
  id: string,
  ending: 'a' | 'b' = 'a',
  capture: (label: string) => void = () => {}
) {
  const entity = target(game, id)!;
  expect(entity).toBeDefined();
  const npc = NPCS.find((n) => n.id === id)!;
  capture(`${id}:arrival`);
  command(game, 'open', entity.id);
  capture(`${id}:open`);
  for (const choice of ['ask', 'detail', 'back-detail', 'consider'])
    command(game, 'choose', choice);
  capture(`${id}:decision`);
  command(game, 'choose', `choose-${ending}`);
  capture(`${id}:ending`);
  expect(narrative(game).flags[`${id}.verdict`]).toBe(npc[ending]);
  expect(narrative(game).journal.filter((e) => e.entryId.startsWith(`${id}.`))).toEqual([
    { entryId: `${id}.${npc[ending]}.note`, order: narrative(game).journal.length }
  ]);
  expect(narrative(game).rewardReceipts.filter((r) => r.id === `${id}.reward.receipt`)).toEqual([
    {
      id: `${id}.reward.receipt`,
      instanceKey: `narrative.${id}.reward.receipt.run`,
      result: 'skipped',
      reason: game.extensionRuntime!.manifest.modules.some((m) => m.id === 'growth')
        ? 'disabled'
        : 'absent'
    }
  ]);
  command(game, 'choose', `leave-${ending}`);
  capture(`${id}:close`);
  command(game, 'open', entity.id);
  command(game, 'choose', `recall-${ending}`);
  capture(`${id}:recall`);
  command(game, 'choose', `leave-recall-${ending}`);
  capture(`${id}:finished`);
}
export function captureNatural(
  seed: number,
  ids: readonly string[] = ['narrative'],
  mode: 'wizard' | 'normal' = 'wizard',
  targets: readonly string[] = NPCS.map((n) => n.id),
  ending: 'a' | 'b' = 'a'
) {
  const game = startNarrative(ids, seed, mode),
    budget = newBudget();
  lastAttempt = { seed, depth: game.depth, commands: 0, events: game.recordedInputEvents.length };
  const checkpoints: Point[] = [],
    points = new Map<number, SavedPoint>();
  const capture = (label: string) => {
    const save = json(game.toSaveSnapshot()),
      w = world(game),
      m = messages(game),
      index = game.recordedInputEvents.length;
    checkpoints.push({
      label,
      index,
      worldHash: digest(w),
      messageHash: digest(m),
      turn: game.absoluteTurnNumber,
      tick: save.run.currentTick
    });
    points.set(index, { save, world: w, messages: m });
    if (
      process.env.BROGUE_CAPTURE_NARRATIVE2_TRACE === '1' ||
      process.env.BROGUE_CAPTURE_NARRATIVE2_COMBOS === '1'
    ) {
      mkdirSync(EVIDENCE, { recursive: true });
      appendFileSync(
        `${EVIDENCE}/route-progress.ndjson`,
        JSON.stringify({
          seed,
          modules: ids,
          label,
          index,
          depth: game.depth,
          commands: budget.commands
        }) + '\n'
      );
    }
  };
  capture('initial');
  if (targets.length === 0) {
    // The empty-manifest row still plays before its first saved lifecycle cut.
    execute(game, { action: 'wait', data: null, decisions: [] });
    budget.commands++;
    capture('played');
  }
  const births: unknown[] = [];
  for (const id of targets) {
    const npc = NPCS.find((n) => n.id === id)!;
    while (game.depth < npc.min) descend(game, game.depth + 1, budget);
    while (!target(game, id) && game.depth < npc.max) descend(game, game.depth + 1, budget);
    const entity = approach(game, id, budget);
    births.push({
      npcId: id,
      entrance: json(budget.entrances[game.depth]),
      entity: json(entity),
      placement: json(narrative(game).placementReceipts.find((p) => p.npcId === id)),
      index: game.recordedInputEvents.length,
      turn: game.absoluteTurnNumber,
      tick: game.toSnapshot().run.currentTick
    });
    playDialogue(game, id, ending, capture);
  }
  const recording = json(game.exportRecording());
  return {
    game,
    points,
    recording,
    trace: {
      schema: 1,
      seed,
      mode,
      modules: [...ids],
      ending,
      targets: [...targets],
      births,
      checkpoints,
      commands: recording.events.map(({ action, data, decisions }) => ({
        action,
        data,
        decisions
      })),
      events: recording.events.length,
      routeCommands: budget.commands,
      recordingBytes: Buffer.byteLength(JSON.stringify(recording)),
      finalHash: digest(world(game)),
      finalRng: json(game.toSnapshot().rngState)
    }
  };
}
export type NaturalTrace = ReturnType<typeof captureNatural>['trace'];
export const readTrace = (name: string): NaturalTrace =>
  JSON.parse(
    readFileSync(new URL(`../data/narrative2-${name}.trace.json`, import.meta.url), 'utf8')
  );
export function writeEvidence(name: string, data: ReturnType<typeof captureNatural>) {
  mkdirSync(EVIDENCE, { recursive: true });
  writeFileSync(`${EVIDENCE}/${name}-recording.json`, JSON.stringify(data.recording));
  writeFileSync(`${EVIDENCE}/${name}-save.json`, JSON.stringify(data.game.toSaveSnapshot()));
  writeFileSync(
    `${EVIDENCE}/${name}-summary.json`,
    JSON.stringify({ ...data.trace, commands: undefined }, null, 2)
  );
  for (const point of data.trace.checkpoints.filter(
    (p) =>
      p.label.endsWith(':arrival') || p.label.endsWith(':open') || p.label.endsWith(':decision')
  ))
    writeFileSync(
      `${EVIDENCE}/${name}-${point.label.replace(':', '-')}-save.json`,
      JSON.stringify(data.points.get(point.index)!.save)
    );
}
export function reconstruct(input: NaturalTrace) {
  const game = startNarrative(input.modules, input.seed, input.mode),
    points = new Map<number, SavedPoint>(),
    entrances: Record<number, Position> = { [1]: { ...game.player.loc } };
  const observe = () => {
    const index = game.recordedInputEvents.length;
    if (input.checkpoints.some((p) => p.index === index))
      points.set(index, {
        save: json(game.toSaveSnapshot()),
        world: world(game),
        messages: messages(game)
      });
    for (const id of input.targets)
      if (input.checkpoints.some((p) => p.index === index && p.label === `${id}:arrival`))
        assertNaturalPlacement(game, id, entrances[game.depth]);
  };
  observe();
  for (const event of input.commands.slice(game.recordedInputEvents.length)) {
    const depth = game.depth;
    execute(game, event);
    if (game.depth !== depth) entrances[game.depth] = { ...game.player.loc };
    observe();
  }
  for (const p of input.checkpoints) {
    expect(digest(points.get(p.index)!.world), p.label).toBe(p.worldHash);
    expect(digest(points.get(p.index)!.messages), p.label).toBe(p.messageHash);
  }
  expect(digest(world(game))).toBe(input.finalHash);
  expect(game.toSnapshot().rngState).toEqual(input.finalRng);
  return { game, points, recording: json(game.exportRecording()), input };
}
