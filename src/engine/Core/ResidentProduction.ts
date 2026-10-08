import { prepareResidentOrder,commitResidentOrder,residentOrder } from './ResidentOrders';
import type { Game } from './Game';
import { generationReserved } from '../Generator/GenerationReservation';
import { inventoryStamp } from './RecordingDigest';
import { ItemCategory } from '../Items/Item';
import { Monster } from '../../entities/Monster';
import type { ResidentSource, ResidentRead } from '../../ext/residentSdk';
import { RESIDENT_ACTIONS } from '../../ext/residentSdk';
import { assertResidentJob, validResident } from '../../ext/residentSchema';
import { exact, uint, checkedAdd, World5Error } from '../../ext/worldBasics';
import { c5Canonical } from '../../ext/worldJson';
import { hasInteractionLine } from '../../ext/worldSpatial';
import { canDirectlySeeMonster } from '../UI/MonsterVisibility';
import { travelDistanceMap } from '../Movement/LevelTravel';
import { T_PATHING_BLOCKER } from '../Map/TerrainCatalog';
import { regionContains } from '../../ext/regions';
import { productionActorActionScheduler } from './ActorActionProduction';
import { initialResidentNeed, residentEfficiency } from './ResidentEconomy';
import { triggerActorNeeds } from './ActorNeeds';
import {
  residentActors,
  residentRecord,
  residentComponent,
  candidateSource,
  residentEligible,
  residentDisabled,
  residentCamp,
  inResidentCamp,
  residentBedIds,
  residentRations,
  campBox,
  failResident,
  transactResidentWorld,
  publishResident,
  unsafeResidentCell
} from './ResidentWorld';
import { settleResidentNeeds, freezeResidentCamps } from './ResidentNeeds';
import { cancelResidentWork } from './ResidentJobs';
import { beginDeparture } from './ActorDeparture';
import { stableGround, updateWorldReasons, recordWorldReceipt } from './WorldWorkWorld';
import { containerRead } from './WorldWorkWorld';
import { logger } from '../Systems/Logger';
import i18next from 'i18next';
import type { CampState } from '../../ext/structureSdk';
const sourceRetirements = new WeakMap<Game, Map<string, CampState>>();
/** Called only inside the encompassing needs transaction. Components and native
 * retirement still publish in order; with no observers, validate/publish each
 * owner's accumulated slot/revision changes once before leaving this stage. */
export function batchResidentSourceTerminations(g: Game, work: () => void): void {
  if (!g.extensionRuntime!.residentRetirementBatchSafe() || sourceRetirements.has(g)) {
    work(); return;
  }
  const states = new Map<string, CampState>();
  sourceRetirements.set(g, states);
  try {
    work();
    for (const [owner, state] of states) g.extensionRuntime!.worldCampReplace(owner, state);
  } finally { sourceRetirements.delete(g); }
}
export function isResidentCommand(g: Game, data: unknown): boolean {
  try {
    const x = typeof data === 'string' ? JSON.parse(data) : data;
    return (
      !!x &&
      g.extensionRuntime?.residentOwners().includes(x.module) === true &&
      (RESIDENT_ACTIONS as readonly string[]).includes(x.action)
    );
  } catch {
    return false;
  }
}
export interface ResidentCommandPlan {
  owner: string;
  action: string;
  payload: any;
  canonical: string;
  chargedTicks: number;
}
export function prepareResidentCommand(g:Game,data:unknown):ReturnType<typeof prepareResidentCommandInternal>{
  let production=false;try{const x=typeof data==='string'?JSON.parse(data):data;production=['order-work','resupply-work','cancel-order'].includes(x?.action);}catch{}
  if(!production)return prepareResidentCommandInternal(g,data);
  const restore=g.checkpointResidentWorld();
  try{return prepareResidentCommandInternal(g,data);}finally{restore();}
}
function prepareResidentCommandInternal(
  g: Game,
  data: unknown
):
  | { ok: true; value: ResidentCommandPlan }
  | { ok: false; code: World5Error['code']; field: string | null } {
  try {
    const x = typeof data === 'string' ? JSON.parse(data) : data;
    c5Canonical(x);
    exact(x, 'module,action,payload', 'envelope');
    if (!isResidentCommand(g, x)) failResident('C5_DISABLED');
    const p = x.payload,
      extra: Record<string, string> = {
        recruit: 'targetId,targetRevision',
        'order-work':'targetId,targetRevision,recipeId,batchCount,sourceId,sourceRevision,destinationId,destinationRevision,stationId,stationRevision,plotIds,plotRevisions,inventoryStamp',
        'resupply-work':'targetId,targetRevision,orderId,orderRevision,sourceRevision,destinationRevision,stationRevision,plotRevisions,inventoryStamp',
        'cancel-order':'targetId,targetRevision,orderId,orderRevision',
        'set-residence': 'targetId,targetRevision,mode',
        'return-home': 'targetId,targetRevision',
        'assign-job':
          'targetId,targetRevision,job,sourceRevision,destinationRevision,componentRevisions,inventoryStamp',
        'set-schedule': 'targetId,targetRevision,schedule',
        'set-granary': 'containerId,containerRevision,enabled',
        'dismiss-resident': 'targetId,targetRevision'
      };
    exact(p, 'v,stateRevision,campId,campRevision,' + extra[String(x.action)], 'residentPayload');
    if (p.v !== 1) failResident('C5_BAD_VERSION');
    for (const k of ['stateRevision', 'campRevision']) uint(p[k], k);
    uint(p.campId, 'campId', 1);
    const owner = x.module as string,
      state = g.extensionRuntime!.worldCampState(owner),
      c = residentCamp(g, owner, p.campId);
    if (g.isGameOver || g.player.hp <= 0) failResident('C5_TERMINAL');
    if (
      residentDisabled(g.player as unknown as Monster) ||
      productionActorActionScheduler(g)?.isBusy(g.player.id)
    )
      failResident('C5_BUSY');
    if (state.revision !== p.stateRevision || c.revision !== p.campRevision)
      failResident('C5_STALE');
    if (c.depth !== g.depth && x.action !== 'set-residence' && x.action !== 'return-home')
      failResident('C5_WRONG_LEVEL');
    if (x.action === 'set-granary') {
      uint(p.containerId, 'containerId', 1);
      uint(p.containerRevision, 'containerRevision');
      if (typeof p.enabled !== 'boolean') failResident('C5_BAD_PAYLOAD');
      const b = campBox(g, c, p.containerId),
        at = containerRead(g, b.id).at!;
      if (b.revision !== p.containerRevision) failResident('C5_STALE');
      if (
        !g.grid.getCell(at.x, at.y)?.isVisible ||
        Math.max(Math.abs(at.x - g.player.x), Math.abs(at.y - g.player.y)) > 1 ||
        !hasInteractionLine(g.grid, g.player.loc, at)
      )
        failResident('C5_DISTANCE');
      if (b.id === c.supplyId && !p.enabled) failResident('C5_RESERVED');
    } else {
      uint(p.targetId, 'targetId', 1);
      uint(p.targetRevision, 'targetRevision');
      const a = g.monsters.find((a) => a.id === p.targetId);
      if (!a || !canDirectlySeeMonster(g.player, g.grid, a)) failResident('C5_UNKNOWN_TARGET');
      if (
        Math.max(Math.abs(a!.x - g.player.x), Math.abs(a!.y - g.player.y)) > 1 ||
        !hasInteractionLine(g.grid, g.player.loc, a!.loc)
      )
        failResident('C5_DISTANCE');
      if (!residentEligible(g, a!)) failResident('C5_GATE');
      if (
        residentDisabled(a!) ||
        (productionActorActionScheduler(g)?.isBusy(a!.id) &&
          !(x.action !== 'recruit' && (g.world5!.residentJobs.some((j) => j.actorId === a!.id)||!!residentOrder(g,a!.id))))
      )
        failResident('C5_BUSY');
      const r = residentComponent(g, a!.id);
      if (x.action === 'recruit') {
        const source = candidateSource(g, a!.id);
        if (r || !source || source.owner !== owner || source.source.consumed)
          failResident('C5_GATE');
        if (source!.source.revision !== p.targetRevision) failResident('C5_STALE');
        if (!inResidentCamp(g, c, a!.loc)) failResident('C5_DISTANCE');
        if ([...g.visibleMonsters].some((m) => m.hp > 0 && !m.isAlly && !m.isCaged))
          failResident('C5_THREAT');
        const rows = g.world5!.residents.filter(
          (r) => r.owner === owner && r.campSlotId === c.slot
        );
        if (g.world5!.residents.length >= 64 || rows.length >= 16) failResident('C5_BUDGET');
        const used = rows.map((r) => residentComponent(g, r.actorId)?.bedId);
        if (!residentBedIds(g, c).some((id) => !used.includes(id))) failResident('C5_ROOM');
        if (residentRations(g, c).reduce((n, r) => n + r.quantity, 0) < rows.length + 1)
          failResident('C5_INPUT');
      } else {
        if (!r || r.campId !== c.regionId || r.campOrdinal !== c.ordinal)
          failResident('C5_BAD_REFERENCE');
        if (r!.revision !== p.targetRevision) failResident('C5_STALE');
        if (['order-work','resupply-work','cancel-order'].includes(String(x.action))){
          if(!inResidentCamp(g,c,a!.loc))failResident('C5_WRONG_LEVEL');
          if(x.action!=='cancel-order'&&p.inventoryStamp!==inventoryStamp(g.player.inventory.items))failResident('C5_STALE');
          prepareResidentOrder(g,c,String(x.action),p);
        }
        if (x.action === 'set-residence') {
          if (!['stay', 'escort'].includes(String(p.mode))) failResident('C5_BAD_PAYLOAD');
          if (p.mode === 'stay' && !inResidentCamp(g, c, a!.loc)) failResident('C5_WRONG_LEVEL');
        }
        if (x.action === 'return-home' && !inResidentCamp(g, c, a!.loc))
          failResident('C5_DISTANCE');
        if (x.action === 'set-schedule') {
          const n = { ...r!, schedule: p.schedule };
          if (!validResident(n)) failResident('C5_BAD_PAYLOAD');
        }
        if (x.action === 'assign-job') {
          assertResidentJob(p.job);
          if (p.inventoryStamp !== inventoryStamp(g.player.inventory.items))
            failResident('C5_STALE');
          if (p.job.kind === 'idle' || p.job.kind === 'guard') {
            if (
              p.sourceRevision !== null ||
              p.destinationRevision !== null ||
              !Array.isArray(p.componentRevisions) ||
              p.componentRevisions.length
            )
              failResident('C5_BAD_PAYLOAD');
          } else {
            uint(p.sourceRevision, 'sourceRevision');
            uint(p.destinationRevision, 'destinationRevision');
          }
          if (!inResidentCamp(g, c, a!.loc)) failResident('C5_WRONG_LEVEL');
          if (p.job.kind === 'guard') {
            if (
              !inResidentCamp(g, c, p.job.at) ||
              !g.grid.getCell(p.job.at.x, p.job.at.y)?.isVisible ||
              unsafeResidentCell(g, p.job.at)
            )
              failResident('C5_BLOCKED');
          } else if (p.job.kind !== 'idle') {
            for (const k of ['sourceId', 'destinationId']) {
              const b = campBox(g, c, p.job[k as 'sourceId' | 'destinationId']);
              if (b.revision !== p[k === 'sourceId' ? 'sourceRevision' : 'destinationRevision'])
                failResident('C5_STALE');
            }
            if (p.job.kind === 'plant') {
              if (
                !Array.isArray(p.componentRevisions) ||
                p.componentRevisions.length !== p.job.plotIds.length
              )
                failResident('C5_BAD_PAYLOAD');
              for (const [i, id] of p.job.plotIds.entries()) {
                const row = g.world5!.structures.find((s) => s.fixture?.id === id);
                if (
                  !row ||
                  row.fixture!.definitionId !== owner + '.plot' ||
                  !inResidentCamp(g, c, row.at) ||
                  row.fixture!.revision !== (p.componentRevisions as number[])[i]
                )
                  failResident('C5_BAD_REFERENCE');
              }
            } else {
              if (!Array.isArray(p.componentRevisions) || p.componentRevisions.length)
                failResident('C5_BAD_PAYLOAD');
              const item = g.worldContainerItems!.get(p.job.itemId);
              if (
                !item ||
                !campBox(g, c, p.job.sourceId).itemIds.includes(item!.id) ||
                item!.quantity < p.job.quantity
              )
                failResident('C5_INPUT');
              if (
                ![ItemCategory.MATERIAL, ItemCategory.FOOD, ItemCategory.GEM].includes(
                  item!.category
                ) &&
                p.job.quantity !== 1
              )
                failResident('C5_BAD_PAYLOAD');
              if (
                g.extensionRuntime!.worldCampLockedQuantity(item!.id) >
                item!.quantity - p.job.quantity
              )
                failResident('C5_RESERVED');
            }
          }
        }
      }
    }
    return {
      ok: true,
      value: {
        owner,
        action: String(x.action),
        payload: structuredClone(p),
        canonical: c5Canonical(x),
        chargedTicks: ['recruit', 'dismiss-resident'].includes(String(x.action)) ? 100 : 0
      }
    };
  } catch (e) {
    return {
      ok: false,
      code: e instanceof World5Error ? e.code : 'C5_BAD_PAYLOAD',
      field: e instanceof World5Error ? e.field : null
    };
  }
}
export function commitResidentCommand(g: Game, plan: ResidentCommandPlan) {
  const check = prepareResidentCommand(g, {
    module: plan.owner,
    action: plan.action,
    payload: plan.payload
  });
  if (!check.ok) return check;
  if (check.value.canonical !== plan.canonical)
    return { ok: false as const, code: 'C5_STALE' as const, field: null };
  try {
    return transactResidentWorld(g, () => {
      settleResidentNeeds(g, true);
      const runtime = g.extensionRuntime!,
        p = plan.payload;
      let state = runtime.worldCampState(plan.owner),
        c = state.camps.find((c) => c.regionId === p.campId)!;
      if (!c) failResident('C5_BAD_REFERENCE');
      if (plan.action === 'recruit') {
        const afterNeeds = prepareResidentCommand(g, {
          module: plan.owner,
          action: plan.action,
          payload: { ...p, stateRevision: state.revision, campRevision: c.revision }
        });
        if (!afterNeeds.ok) failResident(afterNeeds.code);
      }
      if (plan.action === 'set-granary') {
        c.granaryIds = p.enabled
          ? [...new Set([...c.granaryIds, p.containerId])].sort((a, b) => a - b)
          : c.granaryIds.filter((id) => id !== p.containerId);
      } else {
        const a = g.monsters.find((a) => a.id === p.targetId)!;
        let r = residentComponent(g, a.id);
        if (plan.action === 'recruit') {
          const source = candidateSource(g, a.id)!;
          const beds = residentBedIds(g, c),
            used = g
              .world5!.residents.filter((r) => r.campSlotId === c.slot)
              .map((r) => residentComponent(g, r.actorId)?.bedId);
          const bed = beds.find((id) => !used.includes(id));
          if (bed === undefined) failResident('C5_ROOM');
          r = {
            schema: 1,
            campId: c.regionId,
            campOrdinal: c.ordinal,
            revision: 0,
            mode: 'stay',
            bedId: bed!,
            schedule: [16, 8, 8],
            job: { kind: 'idle' },
            stopReason: null
          };
          source.source.consumed = true;
          source.source.revision++;
          runtime.replaceResidentComponent(plan.owner, a.id, 'source', source.source);
          g.world5!.residents.push({
            actorId: a.id,
            owner: plan.owner,
            campSlotId: c.slot as 0,
            levelRef: { kind: 'dungeon', depth: c.depth },
            revision: 0
          });
          g.world5!.residents.sort((a, b) => a.actorId - b.actorId);
          g.world5!.offline.find((l) => l.campSlotId === c.slot)!.residentStates.push(
            initialResidentNeed(a.id)
          );
          a.doesNotTrackLeader = true;
          a.entersLevelIn = a.approaching = 0;
          logger.log(i18next.t('ext.settlement.resident.recruited', { name: a.name }), '#a5c98d');
        } else if (plan.action === 'dismiss-resident') {
          removeResident(g, a.id, 'dismiss', true);
          state = runtime.worldCampState(plan.owner);
          c = state.camps.find((c) => c.regionId === p.campId)!;
          r = undefined;
        } else if(['order-work','resupply-work','cancel-order'].includes(plan.action)){
          commitResidentOrder(g,c,plan.action,p);
          r!.job={kind:'idle'};r!.stopReason=null;
        } else {
          cancelResidentWork(g, a.id, 'reassigned');
          if (plan.action === 'set-residence' || plan.action === 'return-home') {
            r!.mode = plan.action === 'return-home' ? 'stay' : p.mode;
            a.doesNotTrackLeader = r!.mode === 'stay';
            a.leader = null;
            a.boundToLeader = false;
            a.entersLevelIn = a.approaching = 0;
          } else if (plan.action === 'assign-job') r!.job = structuredClone(p.job);
          else if (plan.action === 'set-schedule')
            r!.schedule = [...p.schedule] as [number, number, number];
        }
        if (r) {
          publishResident(g, plan.owner, a.id, r);
          triggerActorNeeds(g, [a], 'resident-changed');
        }
      }
      c.revision = checkedAdd(c.revision, 1);
      state.revision = checkedAdd(state.revision, 1);
      runtime.worldCampReplace(plan.owner, state);
      updateWorldReasons(g);
      if (plan.chargedTicks)
        recordWorldReceipt(
          g,
          plan.owner,
          'work',
          `resident.${plan.action}.${p.targetId}.${c.ordinal}`,
          'completed',
          null
        );
      freezeResidentCamps(g, c.depth);
      g.world5!.revision = checkedAdd(g.world5!.revision, 1);
      if (plan.chargedTicks) {
        g.player.ticksUntilTurn = plan.chargedTicks;
        g.requestEdibleRender();
      }
      return { ok: true as const, value: { chargedTicks: plan.chargedTicks } };
    });
  } catch (e) {
    return {
      ok: false as const,
      code: e instanceof World5Error ? e.code : ('C5_TRANSACTION' as const),
      field: e instanceof World5Error ? e.field : null
    };
  }
}
export function recordRescuedResident(g: Game, a: Monster, wasCaged: boolean): void {
  if (!wasCaged || !residentEligible(g, a)) return;
  for (const owner of g.extensionRuntime?.residentOwners() ?? []) {
    const policy = g.extensionRuntime!.residentPolicy(owner)!;
    if (!policy.rescuedTemplates.includes(a.typeId) || candidateSource(g, a.id)) continue;
    const count = residentActors(g).filter((a) => {
      const s = g.extensionRuntime!.residentComponent<ResidentSource>(owner, a.id, 'source');
      return s?.kind === 'rescue' && !s.consumed;
    }).length;
    if (count >= 64) {
      recordWorldReceipt(
        g,
        owner,
        'placement',
        owner + '.rescue.' + a.id,
        'skipped',
        'source-budget'
      );
      logger.log(i18next.t('ext.settlement.resident.limit'), '#aaaaaa');
      continue;
    }
    g.extensionRuntime!.replaceResidentComponent(owner, a.id, 'source', {
      schema: 1,
      key: owner + '.rescue.' + a.id,
      kind: 'rescue',
      consumed: false,
      revision: 0
    });
    recordWorldReceipt(g, owner, 'placement', owner + '.rescue.' + a.id, 'completed', null);
  }
}
export function spawnResidentCandidates(
  g: Game,
  token: import('../../ext/types').GenerationToken
): void {
  for (const owner of g.extensionRuntime?.residentOwners() ?? []) {
    const runtime = g.extensionRuntime!,
      p = runtime.residentPolicy(owner)!;
    if (!p.spawnDepths.includes(g.depth)) continue;
    const state = runtime.worldCampState(owner),
      slot = state.spawnSlots.find((s) => s.depth === g.depth);
    if (slot && slot.status !== 'deferred') continue;
    const map = travelDistanceMap(g.grid, g.monsters, g.player.loc, T_PATHING_BLOCKER),
      positions: { x: number; y: number }[] = [];
    for (let y = 1; y < g.grid.height - 1; y++)
      for (let x = 1; x < g.grid.width - 1; x++) {
        const cell = g.grid.getCell(x, y)!;
        if (
          map[x]?.[y]! < 30000 &&
          cell.isPassable &&
          !cell.machineNumber &&
          !generationReserved(g.grid, x, y) &&
          !g.grid.isImpregnable(x, y) &&
          stableGround(g, { x, y }) &&
          !unsafeResidentCell(g, { x, y }) &&
          !g.getMonsterAt(x, y) &&
          !g.dormantMonsters.some((a) => g.footprintOf(a).some((p) => p.x === x && p.y === y)) &&
          !g.footprintOf(g.player).some((p) => p.x === x && p.y === y) &&
          !runtime.worldWorkEntities().some((e) => e.depth === g.depth && e.x === x && e.y === y) &&
          !runtime
            .worldStructureRegions()
            .some((r) => r.depth === g.depth && regionContains(r, { x, y }))
        )
          positions.push({ x, y });
      }
    positions.sort((a, b) => map[a.x]![a.y]! - map[b.x]![b.y]! || a.y - b.y || a.x - b.x);
    const next = slot ?? {
      depth: g.depth,
      attempts: 0,
      status: 'deferred' as const,
      actorId: null
    };
    next.attempts++;
    const actor = positions[0]
      ? g.createResidentCandidate(
          token,
          owner,
          p.templates[p.spawnDepths.indexOf(g.depth) % p.templates.length]!.id,
          positions[0]
        )
      : null;
    next.status = actor ? 'placed' : next.attempts === 1 ? 'deferred' : 'skipped';
    next.actorId = actor?.id ?? null;
    if (actor)
      runtime.replaceResidentComponent(owner, actor.id, 'source', {
        schema: 1,
        key: owner + '.spawn.' + g.depth,
        kind: 'spawn',
        consumed: false,
        revision: 0
      });
    if (!slot) state.spawnSlots.push(next);
    state.revision++;
    runtime.worldCampReplace(owner, state);
  }
}
export function removeResident(
  g: Game,
  id: number,
  reason: string,
  depart = false,
  occurredTick?: number,
  batchRetirement = false
): void {
  const existing = residentRecord(g, id);
  if (existing && !g.extensionRuntime?.residentOwners().includes(existing.owner)) return;
  if (
    !g.world5 ||
    !g.extensionRuntime ||
    (!residentRecord(g, id) &&
      !g.world5.residentJobs.some((j) => j.actorId === id) &&
      !candidateSource(g, id))
  )
    return;
  transactResidentWorld(g, () => {
    cancelResidentWork(g, id, reason,occurredTick);
    const rec = residentRecord(g, id),
      a = g.departureActor(id);
    if (rec) {
      for (const l of g.world5!.offline) {
        if(l.productionQuotas)l.productionQuotas=l.productionQuotas.filter(q=>q.actorId!==id);
        l.residentStates = l.residentStates.filter((s) => s.actorId !== id);
        l.frozen.residents = l.frozen.residents.filter((s) => s.actorId !== id);
      }
      g.world5!.orders = g.world5!.orders.filter((o) => o.actorId !== id);
      g.world5!.residents = g.world5!.residents.filter((r) => r.actorId !== id);
      g.extensionRuntime!.replaceResidentComponent(rec.owner, id, 'resident', null);
      if (a && depart)
        beginDeparture(
          g,
          id,
          {
            owner: rec.owner,
            reason,
            visibleGraceTicks:
              g.monsters.includes(a) && canDirectlySeeMonster(g.player, g.grid, a) ? 300 : 0,
            occurredTick
          },
          !g.monsters.includes(a),
          batchRetirement
        );
      updateWorldReasons(g);
      if (a && a.hp > 0 && residentActors(g).includes(a))
        triggerActorNeeds(g, [a], 'resident-changed');
    }
    if (a && a.hp <= 0) terminateResidentSource(g, id);
  });
}
/** Loss of eligibility cannot reset an existing living source into a new candidate. */
export function sealResidentCandidate(g: Game, id: number): void {
  const s = candidateSource(g, id);
  if (!s || s.source.consumed) return;
  transactResidentWorld(g, () => {
    s.source.consumed = true;
    s.source.revision = checkedAdd(s.source.revision, 1);
    g.extensionRuntime!.replaceResidentComponent(s.owner, id, 'source', s.source);
  });
}
/** Permanent native retirement seals spawn slots before components are detached. */
export function terminateResidentSource(g: Game, id: number): void {
  const source = candidateSource(g, id);
  if (!source) return;
  const batch = sourceRetirements.get(g),
    state = batch?.get(source.owner) ?? g.extensionRuntime!.worldCampState(source.owner);
  for (const slot of state.spawnSlots)
    if (slot.actorId === id) {
      slot.actorId = null;
      slot.status = 'terminal';
    }
  g.extensionRuntime!.replaceResidentComponent(source.owner, id, 'source', null);
  state.revision = checkedAdd(state.revision, 1);
  if (batch) batch.set(source.owner, state);
  else g.extensionRuntime!.worldCampReplace(source.owner, state);
}
export function residentRead(g: Game, owner: string): ResidentRead {
  const visible = (a: Monster) => canDirectlySeeMonster(g.player, g.grid, a);
  return {
    tick: g.world5?.simulationTicks ?? 0,
    candidates: g.monsters
      .filter(
        (a) =>
          visible(a) &&
          residentEligible(g, a) &&
          candidateSource(g, a.id)?.owner === owner &&
          !candidateSource(g, a.id)!.source.consumed
      )
      .map((a) => ({
        id: a.id,
        name: a.name,
        at: { ...a.loc },
        revision: candidateSource(g, a.id)!.source.revision
      })),
    residents: residentActors(g)
      .filter(
        (a) => visible(a) && g.monsters.includes(a) && residentRecord(g, a.id)?.owner === owner
      )
      .map((a) => {
        const r = residentComponent(g, a.id)!,
          n = g.world5!.offline.flatMap((l) => l.residentStates).find((s) => s.actorId === a.id)!;
        return {
          id: a.id,
          name: a.name,
          at: { ...a.loc },
          work: (() => {
            const j = g.world5!.residentJobs.find((j) => j.actorId === a.id);
            return j
              ? { ticketId: j.id, phase: j.phase, creditTicks: j.creditTicks, status: j.status }
              : null;
          })(),
          ...r,
          foodShortage: n.foodShortage,
          housingShortage: n.housingShortage,
          efficiency: residentEfficiency(n)
        };
      })
  };
}
