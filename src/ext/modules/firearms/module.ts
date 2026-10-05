import { createActorActionBundle, createActorActionScheduler, type ActorActionScheduler } from '../../../engine/Core/ActorActionScheduler';
import { advanceActorActionsOneTick } from '../../../engine/Simulation/ActorActionTick';
import type { FireControl, RangedHost, RangedRuntime, RangedView, WeaponCommand } from '../../../engine/Simulation/RangedRuntime';
import { WEAPONS } from './definitions';
import { circleIsFree } from '../../../engine/Movement/KinematicCollision';
import { WEAPON_LABEL_KEYS } from './ui/labels';
import { initialState, validateState, type FirearmsState } from './state';
import { shotAngle } from './firing';
import { advanceProjectiles, hitscan } from './ballistics';

export function createFirearms(host: RangedHost, restored?: unknown): RangedRuntime {
    const state: FirearmsState = restored === undefined ? initialState(host.ownerId) : (() => {
        validateState(restored, host.ownerId, host.tick()); return structuredClone(restored);
    })();
    if (state.projectiles.some(p => !circleIsFree(host.world, p.pose, 64, p.sourceId))) throw new Error('Invalid projectile binding');
    let fault: Error | null = null;
    const actions: ActorActionScheduler = createActorActionScheduler(state.actions, {
        decisionOwnerId: id => id,
        // The wielding slot persists through training death, but pending work is
        // retired by source validation. This keeps the native timer mirror zero.
        readActor: id => id === state.ownerId ? { alive: true, ticksUntilTurn: state.timer } : null,
        writeOwnerTicks: (_id, ticks) => { state.timer = ticks; },
        isSourceValid: source => !!host.health(state.ownerId)?.hp && source.sourceFootprintVersion === 'firearms-v1'
            && (source.sourcePartId === 'cooldown' || source.sourcePartId === `reload:${state.selected}`),
        resolveSegment: () => { throw new Error('Firearms has no delayed damage segment'); },
        finishAction: (_bundle, reason) => {
            if (reason === 'completed' && state.action?.kind === 'reload') state.weapons[state.action.slot]!.ammo = WEAPONS[state.action.slot]!.magazineSize;
            state.action = null;
        },
        onFault: error => { fault = error; },
    });
    function start(kind: 'reload' | 'cooldown'): void {
        const slot = state.selected, w = WEAPONS[slot]!;
        state.action = { kind, slot };
        actions.commitBundle(createActorActionBundle({ actionId: state.nextActionId++, depth: 1,
            decisionOwnerId: state.ownerId, timeChargeOwnerId: state.ownerId,
            subactions: [{ sourceEntityId: state.ownerId, sourcePartId: kind === 'reload' ? `reload:${slot}` : 'cooldown',
                sourceFootprintVersion: 'firearms-v1', phases: [{ kind: 'recovery', durationTicks: kind === 'reload' ? w.reloadTicks : w.fireIntervalTicks, segmentIndex: null }] }] }));
    }
    function view(): RangedView {
        return { weapons: state.weapons.map((v, slot) => ({ id: WEAPONS[slot]!.id, labelKey: WEAPON_LABEL_KEYS[slot]!,
            slot, ammo: v.ammo, capacity: WEAPONS[slot]!.magazineSize, selected: slot === state.selected })),
            reloadRemaining: state.action?.kind === 'reload' ? state.timer : 0, cooldownRemaining: state.action?.kind === 'cooldown' ? state.timer : 0,
            recoil: state.weapons[state.selected]!.recoil, shots: state.weapons.reduce((sum, w) => sum + w.shotSequence, 0),
            projectiles: state.projectiles.map(p => ({ id: p.id, pose: { ...p.pose }, radius: 64 })) };
    }
    return {
        advance(control: FireControl, commands: readonly WeaponCommand[]): void {
            if (fault) throw fault;
            if (control.actorId !== state.ownerId || control.tick !== host.tick()) throw new Error('Wrong firearm control owner/tick');
            state.weapons.forEach((w, slot) => { w.recoil = Math.max(0, w.recoil - WEAPONS[slot]!.recoilRecovery); });
            for (const command of commands) {
                if (command.kind === 'equip') { state.selected = command.slot; state.pendingReload = null; actions.cancelDeadActions(); }
                else if (state.action?.kind !== 'reload' && host.health(state.ownerId)?.hp
                    && state.weapons[state.selected]!.ammo < WEAPONS[state.selected]!.magazineSize) state.pendingReload = state.selected;
            }
            actions.cancelDeadActions();
            if (!host.health(state.ownerId)?.hp) state.pendingReload = null;
            if (state.pendingReload !== null && !actions.isBusy(state.ownerId)) { state.pendingReload = null; start('reload'); }
            // Existing projectiles advance before this tick's releases; a new
            // grenade therefore has its full fuse in a checkpoint at launch.
            state.projectiles = advanceProjectiles(host, state.projectiles);
            if (!host.health(state.ownerId)?.hp) state.pendingReload = null;
            const definition = WEAPONS[state.selected]!, weapon = state.weapons[state.selected]!;
            const source = host.body ? host.body(state.ownerId) : host.bodies().find(b => b.id === state.ownerId);
            if (source?.hp && control.fire && (definition.trigger === 'auto' || !state.held)
                && !actions.isBusy(state.ownerId) && weapon.ammo > 0) {
                weapon.ammo--; weapon.shotSequence++;
                const spread = definition.spread + (control.moving ? definition.movingSpread : 0) + weapon.recoil;
                for (let pellet = 0; pellet < definition.pellets; pellet++) {
                    const angle = shotAngle(host.seed, state.ownerId, weapon.instanceId, weapon.shotSequence, pellet, control.aimAngle, spread, weapon.recoil);
                    if (definition.ballistic === 'hitscan') hitscan(host, state.ownerId, source.pose, angle, definition);
                    else state.projectiles.push({ id: state.nextProjectileId++, sourceId: state.ownerId, slot: state.selected,
                        pose: { x: source.pose.x, y: source.pose.y }, angle, remainingTicks: definition.fuseTicks });
                }
                weapon.recoil = Math.min(definition.recoilMax, weapon.recoil + definition.recoilKick); start('cooldown');
            }
            state.held = control.fire;
            advanceActorActionsOneTick(actions, [state.ownerId]);
        },
        snapshot() { if (fault) throw fault; return { ...structuredClone(state), actions: actions.snapshot() }; },
        view,
    };
}
