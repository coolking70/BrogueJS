import type { Game } from './Game';
import type {
  EdibleContext,
  EdiblePlanHandle,
  EdiblePrepareSDK,
  FeedRequest,
  RoastRequest,
  HeatSourceRead
} from '../../ext/worldEdible';
import type { WorldResult, WorldErrorCode } from '../../ext/worldSdk';
import { c5Canonical } from './WorldCanonical';
import { deepFreeze } from '../Movement/SpatialSchema';
import { World5Error } from '../../ext/world5';
import { inventoryStamp } from './RecordingDigest';
import {
  edibleDefinition,
  knowledgeState,
  confirmationSatiety,
  knowledgeView
} from './KindKnowledge';
import { edibleState, peekEdibleState } from './EdibleState';
import { needDeclarations, projectNeed } from './ActorNeeds';
import { isDeparting } from './ActorDeparture';
import { isIncapacitated } from '../Status/Incapacitation';
import { canDirectlySeeMonster } from '../UI/MonsterVisibility';
import { hasInteractionLine } from '../../ext/worldSpatial';
import { consumeEdible } from './EdibleEffects';
import { queueFireContact, drainFireContacts, clearFireContacts } from './FireContact';
import { isWorldErrorCode, transactWorldWork } from './WorldWork';
import { timeSystem } from '../Systems/Time';
function fail(code: WorldErrorCode): never {
  throw new World5Error(code);
}
const result = <T>(f: () => T): WorldResult<T> => {
  try {
    return deepFreeze({ ok: true as const, value: f() }) as WorldResult<T>;
  } catch (e) {
    return {
      ok: false,
      code: e instanceof World5Error ? e.code : 'C5_PROVIDER',
      field: e instanceof World5Error ? e.field : null
    };
  }
};
const stamp = (game: Game) => inventoryStamp(game.player.inventory.items);
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
export function heatSources(game: Game, accessible = true): HeatSourceRead[] {
  const runtime = game.extensionRuntime;
  if (!runtime) return [];
  const rows: HeatSourceRead[] = [];
  const binding = runtime.actorActionBinding();
  for (const e of runtime.worldWorkEntities()) {
    if (e.depth !== game.depth) continue;
    let kind: HeatSourceRead['kind'] | null = null,
      interactionDistance = e.interactionDistance;
    if (binding?.state.bonfires?.bindings[String(e.id)]) kind = 'bonfire';
    else {
      const station = game.world5?.stations.find((s) => s.interactableId === e.id),
        d = station
          ? runtime
              .worldDefinitionPacks()
              .flatMap((p) => p.stations)
              .find((d) => d.id === station.definitionId)
          : null;
      if (d?.stationTags.includes('station.hearth')) {
        kind = 'hearth-station';
        interactionDistance = d.interactionDistance;
      }
    }
    if (
      kind &&
      (!accessible ||
        (game.grid.getCell(e.x, e.y)?.isVisible &&
          distance(game.player.loc, e) <= interactionDistance &&
          hasInteractionLine(game.grid, game.player.loc, e)))
    )
      rows.push({ interactableId: e.id, kind, at: { x: e.x, y: e.y }, interactionDistance });
  }
  return rows.sort((a, b) => a.interactableId - b.interactableId);
}
export function readEdibleContext(game: Game, owner: string): WorldResult<EdibleContext> {
  return result(() => {
    const runtime = game.extensionRuntime;
    if (!runtime?.edibleModule(owner)?.worldDefinitions || !game.world5) fail('C5_DISABLED');
    const rows = peekEdibleState(runtime!).actorNeeds?.rows ?? [],
      definitions = needDeclarations(game);
    return {
      actorId: game.player.id,
      at: { ...game.player.loc },
      inventoryStamp: stamp(game),
      inventory: game.player.inventory.items.flatMap((item) => {
        const d = edibleDefinition(game, item),
          nativeFood =
            item.category === 4 && ['ration_of_food', 'mango'].includes(item.consumableId ?? '')
              ? (item.consumableId as 'ration_of_food' | 'mango')
              : null;
        if (!d && !nativeFood) return [];
        const knowledge = d ? knowledgeState(game, d.id) : null;
        return [
          {
            itemId: item.id,
            definitionId: d?.id ?? null,
            nativeFood,
            quantity: item.quantity,
            displayName: item.displayName,
            knowledge,
            satiety: d
              ? knowledge === 'known'
                ? d.satiety
                : null
              : nativeFood === 'mango'
                ? 1550
                : 1800,
            tags: d?.tags ?? []
          }
        ];
      }),
      feedTargets: rows.flatMap((row) => {
        const d = definitions.find((d) => d.id === row.needId && d.owner === owner),
          actor = game.monsters.find((a) => a.id === row.actorId);
        if (!d || !actor || !canDirectlySeeMonster(game.player, game.grid, actor)) return [];
        return [
          {
            actorId: actor.id,
            needId: d.id,
            targetRevision: row.revision,
            band: row.band,
            value: projectNeed(row, d, game.world5!.simulationTicks).value,
            departing: isDeparting(game, actor.id)
          }
        ];
      }),
      heatSources: heatSources(game)
    };
  });
}
export const edibleProjection = (game: Game, owner: string) =>
  Object.freeze({
    readEdibleContext: () => readEdibleContext(game, owner),
    knowledge: (id: string) => knowledgeView(game, owner, id)
  });
interface Plan {
  game: Game;
  runtime: object;
  owner: string;
  operation: 'feed' | 'roast';
  request: FeedRequest | RoastRequest;
  canonical: string;
  confirm: boolean;
  used: boolean;
  epoch: number;
  issuer: object;
}
const handles = new WeakMap<object, Plan>();
function prepare(
  game: Game,
  owner: string,
  operation: 'feed' | 'roast',
  request: FeedRequest | RoastRequest,
  issuer: object = {}
): EdiblePlanHandle {
  try {
    c5Canonical(request);
  } catch {
    fail('C5_BAD_PAYLOAD');
  }
  const keys =
    operation === 'feed'
      ? 'inventoryStamp,itemId,targetId,targetRevision'
      : 'heatSourceId,inventoryStamp,itemId';
  if (
    !request ||
    Object.keys(request).sort().join(',') !== keys ||
    !Number.isSafeInteger(request.itemId) ||
    request.itemId < 1 ||
    typeof request.inventoryStamp !== 'string'
  )
    fail('C5_BAD_PAYLOAD');
  if (
    operation === 'feed' &&
    (!Number.isSafeInteger((request as FeedRequest).targetId) ||
      (request as FeedRequest).targetId < 1 ||
      !Number.isSafeInteger((request as FeedRequest).targetRevision) ||
      (request as FeedRequest).targetRevision < 0)
  )
    fail('C5_BAD_PAYLOAD');
  if (
    operation === 'roast' &&
    (!Number.isSafeInteger((request as RoastRequest).heatSourceId) ||
      (request as RoastRequest).heatSourceId < 1)
  )
    fail('C5_BAD_PAYLOAD');
  if (game.isGameOver || game.player.hp <= 0) fail('C5_DEAD');
  if (game.interactionActive) fail('C5_GATE');
  if (isIncapacitated(game.player) || game.isInputLocked()) fail('C5_BUSY');
  const item = game.player.inventory.items.find((i) => i.id === request.itemId),
    d = item ? edibleDefinition(game, item) : null;
  let confirm = false;
  if (operation === 'feed') {
    const r = request as FeedRequest,
      row = peekEdibleState(game.extensionRuntime!).actorNeeds?.rows.find(
        (rw) =>
          rw.actorId === r.targetId &&
          needDeclarations(game).some(
            (d) => d.id === rw.needId && d.owner === owner && d.role === 'satiety'
          )
      );
    const target = game.monsters.find((a) => a.id === r.targetId);
    if (
      !target &&
      [...(game as any).levels.values()].some((l: any) =>
        [...l.monsters, ...(l.dormantMonsters ?? [])].some((a: any) => a.id === r.targetId)
      )
    )
      fail('C5_WRONG_LEVEL');
    if (!target || !row || !canDirectlySeeMonster(game.player, game.grid, target))
      fail('C5_UNKNOWN_TARGET');
    if (
      distance(game.player.loc, target!.loc) !== 1 ||
      !hasInteractionLine(game.grid, game.player.loc, target!.loc)
    )
      fail('C5_DISTANCE');
    if (isIncapacitated(target!) || isDeparting(game, target!.id)) fail('C5_GATE');
    if (
      !item ||
      (!d &&
        !(item.category === 4 && ['ration_of_food', 'mango'].includes(item.consumableId ?? '')))
    )
      fail('C5_INPUT');
    if (r.targetRevision !== row!.revision || r.inventoryStamp !== stamp(game)) fail('C5_STALE');
    const nd = needDeclarations(game).find((d) => d.id === row!.needId)!;
    confirm =
      nd.max - projectNeed(row!, nd, game.world5!.simulationTicks).value <
      (d ? confirmationSatiety(game, d) : item!.consumableId === 'mango' ? 1550 : 1800);
  } else {
    const r = request as RoastRequest,
      e = game.extensionRuntime!.worldWorkEntities().find((e) => e.id === r.heatSourceId);
    if (!e || !game.grid.getCell(e.x, e.y)?.isVisible) fail('C5_UNKNOWN_TARGET');
    if (!heatSources(game).some((h) => h.interactableId === r.heatSourceId)) fail('C5_DISTANCE');
    if (!item || !d) fail('C5_INPUT');
    if (r.inventoryStamp !== stamp(game)) fail('C5_STALE');
  }
  const canonical = c5Canonical({
    owner,
    operation,
    request,
    tick: game.world5!.simulationTicks,
    player: { at: game.player.loc, hp: game.player.hp, movementSpeed: game.player.movementSpeed },
    confirm,
    definition: d?.id ?? null
  });
  const handle = Object.freeze({ operation, owner, actorId: game.player.id }) as EdiblePlanHandle;
  handles.set(handle, {
    game,
    runtime: game.extensionRuntime!,
    owner,
    operation,
    request: structuredClone(request),
    canonical,
    confirm,
    used: false,
    epoch: game.worldWorkCommandScopeEpoch,
    issuer
  });
  return handle;
}
export function isEdibleCommand(game: Game, data: unknown): boolean {
  try {
    const e = typeof data === 'string' ? JSON.parse(data) : (data as any);
    return !!game.extensionRuntime?.edibleCommand(e.module, e.action);
  } catch {
    return false;
  }
}
export function prepareEdibleCommand(
  game: Game,
  data: unknown
): {
  outcome: WorldResult<EdiblePlanHandle>;
  canonical: string | null;
  confirm: boolean;
  operation: 'feed' | 'roast' | null;
  feedTargetId: number | null;
} {
  let open = true,
    operation: 'feed' | 'roast' | null = null;
  const issuer = {};
  const outcome = result(() => {
    let e: any;
    try {
      e = typeof data === 'string' ? JSON.parse(data) : data;
      c5Canonical(e);
    } catch {
      fail('C5_BAD_PAYLOAD');
    }
    if (
      !e ||
      Object.keys(e).sort().join(',') !== 'action,module,payload' ||
      !['feed', 'roast'].includes(e.action)
    )
      fail('C5_BAD_PAYLOAD');
    operation = e.action;
    const command = game.extensionRuntime?.edibleCommand(e.module, e.action);
    if (!command) fail('C5_DISABLED');
    const attempt = (op: 'feed' | 'roast', r: any): WorldResult<EdiblePlanHandle> =>
      open
        ? result(() => prepare(game, e.module, op, r, issuer))
        : { ok: false, code: 'C5_SCOPE', field: null };
    const sdk: EdiblePrepareSDK = Object.freeze({
      owner: e.module,
      actorId: game.player.id,
      readEdibleContext: () =>
        open
          ? readEdibleContext(game, e.module)
          : { ok: false as const, code: 'C5_SCOPE' as const, field: null },
      planFeed: (r: FeedRequest) => attempt('feed', r),
      planRoast: (r: RoastRequest) => attempt('roast', r)
    });
    let r: WorldResult<EdiblePlanHandle>;
    try {
      r = game.extensionRuntime!.ediblePure(() =>
        command!.prepare(deepFreeze(structuredClone(e.payload)), sdk)
      );
    } catch {
      fail('C5_PROVIDER');
    }
    if ((r as any)?.then) {
      void Promise.resolve(r).catch(() => undefined);
      fail('C5_PROVIDER');
    }
    if (!r || typeof r.ok !== 'boolean') fail('C5_PROVIDER');
    if (!r.ok) {
      if (!isWorldErrorCode(r.code) || !(r.field === null || typeof r.field === 'string'))
        fail('C5_PROVIDER');
      throw new World5Error(r.code, r.field);
    }
    const p = handles.get(r.value);
    if (
      !p ||
      p.game !== game ||
      p.owner !== e.module ||
      p.operation !== operation ||
      p.issuer !== issuer
    )
      fail('C5_SCOPE');
    return r.value;
  });
  open = false;
  const p = outcome.ok ? handles.get(outcome.value) : null;
  return {
    outcome,
    canonical: p?.canonical ?? null,
    confirm: p?.confirm ?? false,
    operation,
    feedTargetId: p?.operation === 'feed' ? (p.request as FeedRequest).targetId : null
  };
}
export function transactEdible<T>(game: Game, work: () => T): T {
  const restore = game.checkpointEdibleWorld();
  try {
    return transactWorldWork(game, work);
  } catch (e) {
    restore();
    clearFireContacts(game);
    throw e;
  }
}
export function commitEdibleCommand(game: Game, handle: EdiblePlanHandle): WorldResult<boolean> {
  return result(() => {
    const p = handles.get(handle);
    if (
      !p ||
      p.game !== game ||
      p.runtime !== game.extensionRuntime ||
      p.epoch !== game.worldWorkCommandScopeEpoch
    )
      fail('C5_SCOPE');
    if (p.used) fail('C5_PLAN_USED');
    p.used = true;
    const fresh = prepare(game, p.owner, p.operation, p.request);
    if (handles.get(fresh)!.canonical !== p.canonical) fail('C5_STALE');
    return transactEdible(game, () => {
      const item = game.player.inventory.items.find((i) => i.id === p.request.itemId)!;
      if (p.operation === 'feed') {
        const r = p.request as FeedRequest,
          target = game.monsters.find((a) => a.id === r.targetId)!,
          row = edibleState(game.extensionRuntime!).actorNeeds!.rows.find(
            (r) =>
              r.actorId === target.id &&
              needDeclarations(game).some((d) => d.id === r.needId && d.owner === p.owner)
          )!;
        return consumeEdible(game, item, target, p.owner, row.needId);
      }
      const source = heatSources(game).find(
        (h) => h.interactableId === (p.request as RoastRequest).heatSourceId
      )!;
      queueFireContact(game, item, 'roast-command', source.at);
      drainFireContacts(game, true);
      timeSystem.currentTick += game.player.movementSpeed;
      return true;
    });
  });
}
