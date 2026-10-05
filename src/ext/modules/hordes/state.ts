import { canonical } from '../../json';
import { validateActorActionSchedulerState, type ActorActionSchedulerState } from '../../../engine/Core/ActorActionScheduler';
import { dataArray, integer, record } from '../../../engine/Simulation/Protocol';
import type { WorldPoint } from '../../../engine/Movement/WorldUnits';
import { HORDE_ACTORS, HORDE_DATA, HORDE_FULL_ACTORS } from './definitions';
import type { SwarmUnitState } from './spawnDirector';
export interface FullActorState {
    id: number; creature: Record<string, unknown>; poiseDamage: number;
    action: { center: WorldPoint; radius: number; damage: number } | null;
}
export interface HordeState {
    schema: 1; nextActionId: number; nextSpawnTick: number; spawned: number;
    units: SwarmUnitState[]; full: FullActorState[]; actions: ActorActionSchedulerState;
}
export function validateHordeState(value: unknown, tick: number): asserts value is HordeState {
    if (!record(value, ['schema', 'nextActionId', 'nextSpawnTick', 'spawned', 'units', 'full', 'actions']) || value.schema !== 1
        || !integer(value.nextActionId, 1, tick * HORDE_FULL_ACTORS.length + 2) || !integer(value.nextSpawnTick, tick, tick + HORDE_DATA.director.interval)
        || !integer(value.spawned, HORDE_ACTORS.length, HORDE_ACTORS.length + tick * HORDE_DATA.director.batch)
        || !dataArray(value.units, HORDE_ACTORS.length) || value.units.length !== HORDE_ACTORS.length
        || !dataArray(value.full, HORDE_FULL_ACTORS.length) || value.full.length !== HORDE_FULL_ACTORS.length) throw new Error('Invalid horde state');
    for (const [i, unit] of value.units.entries()) {
        const def = HORDE_ACTORS[i]!;
        if (!record(unit, ['id', 'generation', 'readyTick', 'attackReadyTick', 'hp']) || unit.id !== def.id
            || !integer(unit.generation, 0, tick) || !integer(unit.readyTick, 0, tick + HORDE_DATA[def.kind].respawnDelay)
            || !integer(unit.attackReadyTick, 0, tick + Math.max(30, HORDE_DATA.swarm.attackInterval)) || !integer(unit.hp, 0, def.maxHp)
            || (unit.hp === 0) !== (unit.readyTick > 0)) throw new Error('Invalid swarm slot');
    }
    const units = value.units as unknown as SwarmUnitState[];
    if (value.spawned !== HORDE_ACTORS.length + units.reduce((n, u) => n + u.generation, 0)) throw new Error('Invalid spawn accounting');
    for (const [i, full] of value.full.entries()) {
        const d = HORDE_FULL_ACTORS[i]!, rule = d.kind === 'boss' ? HORDE_DATA.boss : HORDE_DATA.elite;
        if (!record(full, ['id', 'creature', 'poiseDamage', 'action']) || full.id !== d.id || !integer(full.poiseDamage, 0, HORDE_DATA.stagger.threshold - 1))
            throw new Error('Invalid full actor');
        if (full.action !== null && (!record(full.action, ['center', 'radius', 'damage']) || full.action.radius !== rule.blastRadius || full.action.damage !== rule.damage
            || !record(full.action.center, ['x', 'y']) || !integer(full.action.center.x, 0, 1 << 22) || !integer(full.action.center.y, 0, 1 << 22))) throw new Error('Invalid full actor action');
    }
    validateActorActionSchedulerState(value.actions);
    const full = value.full as unknown as FullActorState[];
    for (const b of value.actions.bundles) {
        const f = full.find(f => f.id === b.decisionOwnerId), d = HORDE_ACTORS.find(d => d.id === b.decisionOwnerId);
        if (!f?.action || !d || d.kind === 'swarm' || b.actionId >= value.nextActionId || b.depth !== 1 || b.subactions.length !== 1 || b.elapsedActionTicks > tick)
            throw new Error('Invalid horde action binding');
        const rule = HORDE_DATA[d.kind], s = b.subactions[0]!;
        const phases = [{ kind: 'windup', durationTicks: rule.windup, segmentIndex: 0 },
            ...(d.kind === 'boss' ? [{ kind: 'inter-segment', durationTicks: 18, segmentIndex: 1 }] : []),
            { kind: 'recovery', durationTicks: rule.recovery, segmentIndex: null }];
        if (s.sourceEntityId !== f.id || s.sourcePartId !== d.kind || s.sourceFootprintVersion !== 'hordes-v1'
            || canonical(s.phases) !== canonical(phases)) throw new Error('Invalid horde attack phases');
    }
    for (const f of full) if (!!f.action !== value.actions.bundles.some(b => b.decisionOwnerId === f.id)) throw new Error('Missing horde action');
}
