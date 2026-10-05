import { createActorActionBundle, createActorActionScheduler } from '../../../engine/Core/ActorActionScheduler';
import { advanceActorActionsOneTick } from '../../../engine/Simulation/ActorActionTick';
import type { PopulationHost, PopulationRuntime, PopulationView } from '../../../engine/Simulation/PopulationRuntime';
import type { CreatureBase } from '../../../entities/CreatureBase';
import { raycast } from '../../../engine/Movement/SpatialQuery';
import { HORDE_ACTORS, HORDE_DATA } from './definitions';
import { FlowField } from './flowField';
import { fullActor, snapshotActor } from './fullActor';
import { findReinforcement } from './spawnDirector';
import { steer } from './steering';
import { validateHordeState, type HordeState } from './state';

export function createHordes(host: PopulationHost, restored?: unknown): PopulationRuntime {
    if (!host.body) throw new Error('Hordes requires indexed body reads');
    const state: HordeState = restored === undefined ? {
        schema: 1, nextActionId: 1, nextSpawnTick: HORDE_DATA.director.interval, spawned: HORDE_ACTORS.length,
        units: HORDE_ACTORS.map(d => ({ id: d.id, generation: 0, readyTick: 0, attackReadyTick: 0, hp: host.health(d.id)!.hp })),
        full: HORDE_ACTORS.filter(d => d.kind !== 'swarm').map(d => ({ id: d.id, poiseDamage: 0, action: null,
            creature: snapshotActor(fullActor(d, host.body!(d.id)!)) })), actions: { schema: 1, bundles: [] },
    } : (() => { validateHordeState(restored, host.tick()); return structuredClone(restored); })();
    const full = new Map(state.full.map(f => [f.id, f])), creatures = new Map<number, CreatureBase>();
    for (const d of HORDE_ACTORS) {
        const unit = state.units[d.id - 2]!, body = host.body(d.id), hp = host.health(d.id);
        if (!body || !hp || hp.hp !== unit.hp || hp.maxHp !== d.maxHp || body.radius !== d.radius || hp.team !== 1) throw new Error('Invalid horde world binding');
        if (full.has(d.id)) creatures.set(d.id, fullActor(d, body, full.get(d.id)!.creature));
    }
    const fields = new Map([...new Set(HORDE_ACTORS.map(d => d.radius))].map(radius => [radius, new FlowField(host.world.grid, radius)]));
    let fault: Error | null = null;
    const actions = createActorActionScheduler(state.actions, {
        decisionOwnerId: id => id,
        // Retained dead slots still own their zeroed timer mirror.
        readActor: id => creatures.has(id) ? { alive: true, ticksUntilTurn: creatures.get(id)!.ticksUntilTurn } : null,
        writeOwnerTicks: (id, ticks) => { creatures.get(id)!.ticksUntilTurn = ticks; },
        isSourceValid: source => !!host.health(source.sourceEntityId)?.hp && !creatures.get(source.sourceEntityId)?.hasStatus('paralyzed')
            && source.sourceFootprintVersion === 'hordes-v1',
        finishAction: bundle => { full.get(bundle.decisionOwnerId)!.action = null; },
        resolveSegment: boundary => {
            const intent = full.get(boundary.sourceEntityId)!.action!, source = host.body!(boundary.sourceEntityId)!, player = host.body!(host.ownerId)!;
            const delta = { x: player.pose.x - source.pose.x, y: player.pose.y - source.pose.y };
            const hit = !!player.hp && (player.pose.x - intent.center.x) ** 2 + (player.pose.y - intent.center.y) ** 2 <= (intent.radius + player.radius) ** 2
                && !raycast({ grid: host.world.grid }, source.pose, delta);
            if (hit) host.damage({ sourceId: source.id, targetId: player.id, amount: intent.damage, kind: 'kinetic', friendlyFire: 'none' });
            host.emit({ tick: host.tick(), kind: 'explosion', from: { x: source.pose.x, y: source.pose.y }, to: intent.center, radius: intent.radius, hit });
        }, onFault: error => { fault = error; },
    });
    function synchronize(): void {
        for (const unit of state.units) {
            const definition = HORDE_ACTORS[unit.id - 2]!, health = host.health(unit.id)!;
            const f = full.get(unit.id), creature = creatures.get(unit.id);
            if (creature) {
                if (health.hp < unit.hp && health.hp > 0) {
                    f!.poiseDamage += unit.hp - health.hp;
                    if (f!.poiseDamage >= HORDE_DATA.stagger.threshold) {
                        f!.poiseDamage = 0; creature.applyStatus('paralyzed', HORDE_DATA.stagger.duration, 'refresh');
                    }
                }
                creature.hp = health.hp;
                const pose = host.body!(unit.id)!.pose; creature.loc = { x: Math.floor(pose.x / 1024), y: Math.floor(pose.y / 1024) };
            }
            if (health.hp === 0 && !unit.readyTick) unit.readyTick = host.tick() + HORDE_DATA[definition.kind].respawnDelay;
            unit.hp = health.hp;
        }
        actions.cancelDeadActions();
    }
    function reinforce(): void {
        if (host.tick() < state.nextSpawnTick) return;
        state.nextSpawnTick = host.tick() + HORDE_DATA.director.interval;
        let budget = HORDE_DATA.director.batch;
        for (const unit of state.units) {
            if (!budget || unit.hp || host.tick() < unit.readyTick) continue;
            const d = HORDE_ACTORS[unit.id - 2]!, at = findReinforcement(host, d.id, unit.generation + 1, d.radius);
            if (!at || !host.revive(d.id, at)) continue;
            unit.generation++; unit.readyTick = 0; unit.hp = d.maxHp; unit.attackReadyTick = host.tick() + 30; state.spawned++; budget--;
            if (full.has(d.id)) {
                full.get(d.id)!.poiseDamage = 0; full.get(d.id)!.action = null;
                creatures.set(d.id, fullActor(d, host.body!(d.id)!));
            }
        }
    }
    function view(): PopulationView {
        const alive = (kind: string) => HORDE_ACTORS.filter(d => d.kind === kind && host.health(d.id)!.hp > 0).length;
        return { swarm: alive('swarm'), elites: alive('elite'), bosses: alive('boss'), pending: state.units.filter(u => u.hp === 0).length,
            spawned: state.spawned, telegraphs: actions.snapshot().bundles.flatMap(b => {
                const s = b.subactions[0]!, phase = s.phases[s.phaseIndex];
                return phase?.segmentIndex !== null && phase ? [{ id: b.decisionOwnerId, center: { ...full.get(b.decisionOwnerId)!.action!.center },
                    radius: full.get(b.decisionOwnerId)!.action!.radius, remaining: s.phaseRemainingTicks }] : [];
            }) };
    }
    return {
        advance() {
            if (fault) throw fault;
            synchronize(); reinforce();
            const player = host.body!(host.ownerId)!;
            for (const field of fields.values()) field.update(player.pose);
            for (const creature of creatures.values()) creature.tickStatuses();
            // Rotating the first mover avoids a permanent low-ID priority in a
            // dense doorway; this order is an explicit integer-tick rule.
            for (let i = 0; i < HORDE_ACTORS.length; i++) {
                const d = HORDE_ACTORS[(i + host.tick()) % HORDE_ACTORS.length]!, unit = state.units[d.id - 2]!;
                if (!unit.hp) continue;
                const body = host.body!(d.id)!, creature = creatures.get(d.id);
                if (creature?.hasStatus('paralyzed') || actions.isBusy(d.id)) continue;
                const distance2 = (body.pose.x - player.pose.x) ** 2 + (body.pose.y - player.pose.y) ** 2;
                if (d.kind !== 'swarm' && player.hp && distance2 <= HORDE_DATA[d.kind].range ** 2
                    && !raycast({ grid: host.world.grid }, body.pose, { x: player.pose.x - body.pose.x, y: player.pose.y - body.pose.y })) {
                    const rule = HORDE_DATA[d.kind];
                    full.get(d.id)!.action = { center: { x: player.pose.x, y: player.pose.y }, radius: rule.blastRadius, damage: rule.damage };
                    actions.commitBundle(createActorActionBundle({ actionId: state.nextActionId++, depth: 1, decisionOwnerId: d.id, timeChargeOwnerId: d.id,
                        subactions: [{ sourceEntityId: d.id, sourcePartId: d.kind, sourceFootprintVersion: 'hordes-v1', phases: [
                            { kind: 'windup', durationTicks: rule.windup, segmentIndex: 0 },
                            ...(d.kind === 'boss' ? [{ kind: 'inter-segment' as const, durationTicks: 18, segmentIndex: 1 }] : []),
                            { kind: 'recovery', durationTicks: rule.recovery, segmentIndex: null },
                        ] }] }));
                    continue;
                }
                const waypoint = fields.get(d.radius)!.waypoint(body.pose, player.pose, d.id % 4);
                if (waypoint) { const v = steer(host, body, waypoint); host.move(d.id, v.x, v.y, HORDE_DATA[d.kind].speed); }
                if (d.kind === 'swarm' && player.hp && host.tick() >= unit.attackReadyTick) {
                    const current = host.body!(d.id)!, delta = { x: player.pose.x - current.pose.x, y: player.pose.y - current.pose.y };
                    if (delta.x ** 2 + delta.y ** 2 <= (d.radius + player.radius + 120) ** 2 && !raycast({ grid: host.world.grid }, current.pose, delta)) {
                        host.damage({ sourceId: d.id, targetId: player.id, amount: HORDE_DATA.swarm.damage, kind: 'kinetic', friendlyFire: 'none' });
                        unit.attackReadyTick = host.tick() + HORDE_DATA.swarm.attackInterval;
                    }
                }
            }
            advanceActorActionsOneTick(actions, [...creatures.keys()]); synchronize();
        },
        afterCombat() { synchronize(); },
        snapshot() { if (fault) throw fault; return { ...structuredClone(state), actions: actions.snapshot(), full: state.full.map(f => ({ ...structuredClone(f), creature: snapshotActor(creatures.get(f.id)!) })) }; },
        view,
    };
}
