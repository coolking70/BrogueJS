import { validateActorActionSchedulerState, type ActorActionSchedulerState } from '../../../engine/Core/ActorActionScheduler';
import { dataArray, integer, record } from '../../../engine/Simulation/Protocol';
import type { WorldPoint } from '../../../engine/Movement/WorldUnits';
import { WEAPONS } from './definitions';

export interface WeaponInstance { instanceId: number; ammo: number; shotSequence: number; recoil: number }
export interface Projectile { id: number; sourceId: number; slot: number; pose: WorldPoint; angle: number; remainingTicks: number }
export interface FirearmsState {
    schema: 1; ownerId: number; selected: number; pendingReload: number | null; held: boolean; timer: number; nextActionId: number; nextProjectileId: number;
    action: { kind: 'reload' | 'cooldown'; slot: number } | null;
    weapons: WeaponInstance[]; projectiles: Projectile[]; actions: ActorActionSchedulerState;
}
export function initialState(ownerId: number): FirearmsState {
    return { schema: 1, ownerId, selected: 0, pendingReload: null, held: false, timer: 0, nextActionId: 1, nextProjectileId: 1, action: null,
        weapons: WEAPONS.map((w, i) => ({ instanceId: i + 1, ammo: w.magazineSize, shotSequence: 0, recoil: 0 })),
        projectiles: [], actions: { schema: 1, bundles: [] } };
}
export function validateState(value: unknown, ownerId: number, tick: number): asserts value is FirearmsState {
    if (!record(value, ['schema', 'ownerId', 'selected', 'pendingReload', 'held', 'timer', 'nextActionId', 'nextProjectileId', 'action', 'weapons', 'projectiles', 'actions'])
        || value.schema !== 1 || value.ownerId !== ownerId || !integer(value.selected, 0, 3) || typeof value.held !== 'boolean'
        || !integer(value.timer, 0, Math.max(...WEAPONS.map(w => Math.max(w.reloadTicks, w.fireIntervalTicks)))) || !integer(value.nextActionId, 1, tick * 8 + 2) || !integer(value.nextProjectileId, 1, tick + 2)
        || !dataArray(value.weapons, 4) || value.weapons.length !== 4 || !dataArray(value.projectiles, 32)) throw new Error('Invalid firearms state');
    value.weapons.forEach((w, i) => {
        if (!record(w, ['instanceId', 'ammo', 'shotSequence', 'recoil']) || w.instanceId !== i + 1
            || !integer(w.ammo, 0, WEAPONS[i]!.magazineSize) || !integer(w.shotSequence, 0, tick)
            || !integer(w.recoil, 0, WEAPONS[i]!.recoilMax)) throw new Error('Invalid weapon instance');
    });
    const instances = value.weapons as unknown as WeaponInstance[];
    const shots = instances.reduce((sum, w) => sum + w.shotSequence, 0);
    if (shots > tick || value.nextActionId <= shots || value.nextProjectileId !== instances[3]!.shotSequence + 1)
        throw new Error('Inconsistent shot identities');
    let previous = 0;
    for (const p of value.projectiles) {
        if (!record(p, ['id', 'sourceId', 'slot', 'pose', 'angle', 'remainingTicks']) || !integer(p.id, previous + 1, value.nextProjectileId - 1)
            || p.sourceId !== ownerId || p.slot !== 3 || !record(p.pose, ['x', 'y'])
            || !integer(p.pose.x, -65536, 1 << 22) || !integer(p.pose.y, -65536, 1 << 22)
            || !integer(p.angle, 0, 4095) || !integer(p.remainingTicks, 1, WEAPONS[3]!.fuseTicks)) throw new Error('Invalid projectile');
        previous = p.id;
    }
    validateActorActionSchedulerState(value.actions);
    const bundles = value.actions.bundles;
    if (value.pendingReload !== null && (value.pendingReload !== value.selected
        || instances[value.selected]!.ammo === WEAPONS[value.selected]!.magazineSize
        || (value.action !== null && (!record(value.action, ['kind', 'slot']) || value.action.kind !== 'cooldown')))) throw new Error('Invalid pending reload');
    if (value.action === null) {
        if (bundles.length || value.timer !== 0) throw new Error('Idle firearms clock mismatch');
        return;
    }
    if (!record(value.action, ['kind', 'slot']) || !['reload', 'cooldown'].includes(value.action.kind as string)
        || !integer(value.action.slot, 0, 3) || bundles.length !== 1) throw new Error('Invalid firearm action');
    const b = bundles[0]!, c = b.subactions[0], w = WEAPONS[value.action.slot]!;
    const duration = value.action.kind === 'reload' ? w.reloadTicks : w.fireIntervalTicks;
    if (b.actionId >= value.nextActionId || b.decisionOwnerId !== ownerId || b.depth !== 1 || b.subactions.length !== 1
        || b.elapsedActionTicks > tick || c?.sourceEntityId !== ownerId || c.sourceFootprintVersion !== 'firearms-v1'
        || c.sourcePartId !== (value.action.kind === 'reload' ? `reload:${value.action.slot}` : 'cooldown')
        || c.phaseIndex !== 0 || c.phaseRemainingTicks !== value.timer || c.phases.length !== 1
        || c.phases[0]?.kind !== 'recovery' || c.phases[0].durationTicks !== duration
        || (value.action.kind === 'reload' && value.selected !== value.action.slot)) throw new Error('Firearm action binding mismatch');
}
