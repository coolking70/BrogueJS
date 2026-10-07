/** Natural-capture helpers. Navigation reads the real world; mutations are public commands only. */
import { worldHarnessGame } from '../../../testing/worldHarness';
import type {
  WorldHarness,
  JsonValue,
  WorldErrorCode,
  WorkContext,
  Position
} from '../../../worldSdk';
import { cellTerrainFlags } from '../../../../engine/Map/DungeonFeature';
import { TerrainType as T } from '../../../../engine/Map/Grid';
import { T_IS_FIRE, T_OBSTRUCTS_DIAGONAL_MOVEMENT } from '../../../../engine/Map/TerrainCatalog';
import { clearWorldCell, workPositions } from '../../../../engine/Core/WorldWorkWorld';

export interface TraceCommand {
  action: string;
  data: JsonValue;
  answers?: boolean[];
  expect: { recorded: boolean; error?: WorldErrorCode | null };
}
export const last = <T>(rows: readonly T[]): T | undefined => rows[rows.length - 1];
export const copyJson = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export function craftingContext(h: WorldHarness): WorkContext {
  const read = h.readWorkContext('crafting', { kind: 'inventory' });
  if (!read.ok) throw new Error(read.code);
  return read.value;
}
export function craftingFinal(h: WorldHarness) {
  const game = worldHarnessGame(h);
  return copyJson({
    inventory: craftingContext(h).inventory,
    nodes: h.world5()!.nodes,
    state: game.extensionRuntime!.snapshot().modules.crafting,
    digest: h.digest()
  });
}
export function harvestPayload(h: WorldHarness, id: number) {
  const read = h.readWorkContext('crafting', { kind: 'node', interactableId: id });
  if (!read.ok) throw new Error(read.code);
  return {
    v: 1,
    nodeId: id,
    nodeRevision: read.value.node!.revision,
    inventoryStamp: read.value.inventoryStamp,
    destinationId: null,
    destinationRevision: null
  };
}
export function craftPayload(h: WorldHarness, recipeId: string, batchCount = 1) {
  const c = craftingContext(h);
  const hand = [
    'crafting.make-pick',
    'crafting.make-table-kit',
    'crafting.make-hearth-kit'
  ].includes(recipeId);
  const station = hand
    ? undefined
    : c.stations
        .filter(
          (s) =>
            s.tags.includes('station.table') &&
            s.workPositions.some((p) => p.x === c.at.x && p.y === c.at.y)
        )
        .sort((a, b) => a.interactableId - b.interactableId)[0];
  return {
    v: 1,
    recipeId,
    batchCount,
    stationId: station?.interactableId ?? null,
    stationRevision: station?.revision ?? null,
    sourceContainerId: null,
    sourceRevision: null,
    inventoryStamp: c.inventoryStamp
  };
}
export function executeTraceCommand(
  h: WorldHarness,
  command: Pick<TraceCommand, 'action' | 'data' | 'answers'>
): TraceCommand['expect'] {
  if (command.action === 'ext:command') {
    if (typeof command.data !== 'string')
      throw new Error('Expected a serialized extension envelope');
    const envelope = JSON.parse(command.data);
    return h.ext(envelope.module, envelope.action, envelope.payload, command.answers);
  }
  const game = worldHarnessGame(h),
    before = game.recordedInputEvents.length;
  h.command(command.action, command.data);
  let cursor = 0;
  while (game.pendingCommandConfirmation)
    game.resolveCommandDecision(
      game.pendingCommandConfirmation.token,
      command.answers?.[cursor++] ?? true
    );
  return { recorded: game.recordedInputEvents.length > before };
}
export class NaturalCraftingDriver {
  readonly commands: TraceCommand[] = [];
  constructor(readonly h: WorldHarness) {}
  get game() {
    return worldHarnessGame(this.h);
  }
  command(action: string, data: JsonValue = null, answers?: boolean[]) {
    if (this.game.isGameOver) throw new Error(`Player died on D${this.game.depth}`);
    const before = this.game.recordedInputEvents.length;
    const expect = executeTraceCommand(this.h, { action, data, answers });
    const decisions =
      this.game.recordedInputEvents.length > before
        ? last(this.game.recordedInputEvents)!.decisions
        : [];
    this.commands.push({
      action,
      data,
      ...(decisions.length ? { answers: [...decisions] } : {}),
      expect
    });
    if (this.commands.length > 3000) throw new Error('Natural route exceeded 3000 commands');
    return expect;
  }
  ext(action: string, payload: JsonValue) {
    return this.command('ext:command', JSON.stringify({ module: 'crafting', action, payload }));
  }
  route(targets: readonly Position[], avoidEnemies = true): Position[] | null {
    const game = this.game,
      grid = game.grid,
      start = { ...game.player.loc };
    const key = (p: Position) => p.y * grid.width + p.x;
    const goals = new Set(targets.map(key));
    const valid = (p: Position) => {
      const c = grid.getCell(p.x, p.y);
      return (
        !!c &&
        (c.isPassable || c.terrain === T.DOOR) &&
        !c.layers.some((t) => [T.LAVA, T.WATER_DEEP, T.CHASM].includes(t)) &&
        c.trapType !== 'fire' &&
        !(cellTerrainFlags(grid, p.x, p.y) & T_IS_FIRE)
      );
    };
    const queue = [start],
      previous = new Map<number, Position | null>([[key(start), null]]);
    let target: Position | undefined;
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i]!;
      if (goals.has(key(p))) {
        target = p;
        break;
      }
      for (const [dx, dy] of [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1]
      ]) {
        const n = { x: p.x + dx!, y: p.y + dy! };
        if (previous.has(key(n)) || !valid(n)) continue;
        if (
          dx &&
          dy &&
          (!valid({ x: n.x, y: p.y }) ||
            !valid({ x: p.x, y: n.y }) ||
            cellTerrainFlags(grid, n.x, p.y) & T_OBSTRUCTS_DIAGONAL_MOVEMENT ||
            cellTerrainFlags(grid, p.x, n.y) & T_OBSTRUCTS_DIAGONAL_MOVEMENT)
        )
          continue;
        if (
          avoidEnemies &&
          game.monsters.some(
            (m) => m.hp > 0 && !m.isAlly && Math.max(Math.abs(m.x - n.x), Math.abs(m.y - n.y)) <= 2
          )
        )
          continue;
        previous.set(key(n), p);
        queue.push(n);
      }
    }
    if (!target) return null;
    const result = [target];
    for (let p = previous.get(key(target)); p; p = previous.get(key(p))) result.push(p);
    return result.reverse();
  }
  walk(targets: readonly Position[], max = 600) {
    const depth = this.game.depth;
    for (let count = 0; count < max; count++) {
      if (this.game.depth !== depth) return;
      const path = this.route(targets) ?? this.route(targets, false);
      if (!path) throw new Error(`No safe route on D${this.game.depth}`);
      if (path.length === 1) return;
      const next = path[1]!;
      const before = `${this.game.depth}:${this.game.player.x}:${this.game.player.y}:${this.game.player.hp}`;
      this.command('move', { x: next.x - this.game.player.x, y: next.y - this.game.player.y });
      const after = `${this.game.depth}:${this.game.player.x}:${this.game.player.y}:${this.game.player.hp}`;
      if (before === after && !last(this.commands)!.expect.recorded)
        throw new Error('Unrecorded blocked move');
    }
    throw new Error('Natural walk did not reach target');
  }
  approachNode(id: string) {
    const nodes = this.h
      .world5()!
      .nodes.filter(
        (n) =>
          n.definitionId === id &&
          n.levelRef.kind === 'dungeon' &&
          n.levelRef.depth === this.game.depth
      );
    const candidates = nodes
      .map((n) => ({
        n,
        path:
          this.route(workPositions(this.game, n.at)) ??
          this.route(workPositions(this.game, n.at), false)
      }))
      .filter((r) => r.path)
      .sort((a, b) => a.path!.length - b.path!.length);
    if (!candidates.length) throw new Error(`No reachable ${id}`);
    const node = candidates[0]!.n;
    this.walk(workPositions(this.game, node.at));
    return node.interactableId;
  }
  clearThreat() {
    // Bump-attacks are ordinary public movement, and pursuing a visible foe is a read-only choice.
    for (let n = 0; n < 100; n++) {
      const enemies = [...this.game.visibleMonsters]
        .filter((m) => m.hp > 0 && !m.isAlly && !m.isCaged)
        .sort(
          (a, b) =>
            Math.max(Math.abs(a.x - this.game.player.x), Math.abs(a.y - this.game.player.y)) -
            Math.max(Math.abs(b.x - this.game.player.x), Math.abs(b.y - this.game.player.y))
        );
      if (!enemies.length) return;
      const enemy = enemies[0]!,
        path = this.route([enemy.loc], false);
      if (!path || path.length < 2) throw new Error('Visible foe unreachable');
      const next = path[1]!;
      this.command('move', { x: next.x - this.game.player.x, y: next.y - this.game.player.y });
    }
    throw new Error('Threat clearance exceeded limit');
  }
  harvest(id: string, count: number) {
    for (let i = 0; i < count; i++) {
      this.clearThreat();
      const nodeId = this.approachNode(id);
      const out = this.ext('harvest', harvestPayload(this.h, nodeId));
      if (out.error) {
        if (out.error === 'C5_THREAT') {
          this.clearThreat();
          i--;
          continue;
        }
        throw new Error(`Harvest ${id}: ${out.error}`);
      }
      if (last(this.h.world5()!.terminalTickets)?.status !== 'completed') {
        this.clearThreat();
        i--;
        continue;
      }
    }
  }
  craft(id: string, batches = 1) {
    for (let attempt = 0; attempt < 10; attempt++) {
      this.clearThreat();
      const out = this.ext('craft', craftPayload(this.h, id, batches));
      if (out.error) throw new Error(`Craft ${id}: ${out.error}`);
      while (this.game.isAutoTraveling()) this.command('auto_step');
      const terminal = last(this.h.world5()!.terminalTickets)!;
      if (terminal.status === 'completed') return;
      if (!['threat', 'damage'].includes(terminal.stopReason ?? ''))
        throw new Error(`Craft ${id} interrupted: ${terminal.stopReason}`);
    }
    throw new Error(`Craft ${id} interrupted ten times`);
  }
  place(id: string): WorkContext['stations'][number] {
    this.clearThreat();
    const c = craftingContext(this.h);
    const candidates: Position[] = [];
    for (let y = c.at.y - 1; y <= c.at.y + 1; y++)
      for (let x = c.at.x - 1; x <= c.at.x + 1; x++)
        if (
          clearWorldCell(this.game, { x, y }) &&
          workPositions(this.game, { x, y }).some((p) => p.x === c.at.x && p.y === c.at.y)
        )
          candidates.push({ x, y });
    if (!candidates.length) {
      const options: { at: Position; path: Position[] }[] = [];
      for (let y = 1; y < this.game.grid.height - 1; y++)
        for (let x = 1; x < this.game.grid.width - 1; x++) {
          if (!clearWorldCell(this.game, { x, y })) continue;
          const path = this.route(workPositions(this.game, { x, y }));
          if (path) options.push({ at: { x, y }, path });
        }
      options.sort((a, b) => a.path.length - b.path.length);
      if (!options.length) throw new Error('No reachable station placement');
      this.walk([last(options[0]!.path)!]);
      return this.place(id);
    }
    const at = candidates[0]!,
      out = this.ext('place-station', {
        v: 1,
        definitionId: id,
        ...at,
        inventoryStamp: c.inventoryStamp
      });
    if (out.error) throw new Error(`Place ${id}: ${out.error}`);
    if (last(this.h.world5()!.terminalTickets)?.status !== 'completed') {
      const reason = last(this.h.world5()!.terminalTickets)?.stopReason;
      if (reason === 'threat' || reason === 'damage') return this.place(id);
      throw new Error(`Place ${id} interrupted: ${reason}`);
    }
    return craftingContext(this.h).stations.find(
      (s) => s.definitionId === id && s.at.x === at.x && s.at.y === at.y
    )!;
  }
}
