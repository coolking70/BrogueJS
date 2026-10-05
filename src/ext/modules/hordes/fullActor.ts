import { canonical } from '../../json';
import { CreatureBase } from '../../../entities/CreatureBase';
import { integer, record } from '../../../engine/Simulation/Protocol';
import type { CombatBody } from '../../../engine/Simulation/RangedRuntime';
import type { PopulationActorDefinition } from '../../../engine/Simulation/PopulationRuntime';
import { HORDE_DATA } from './definitions';
export function fullActor(definition: PopulationActorDefinition, body: CombatBody, restored?: unknown): CreatureBase {
    const actor = new CreatureBase(Math.floor(body.pose.x / 1024), Math.floor(body.pose.y / 1024), definition.kind,
        definition.kind === 'boss' ? 'B' : 'E', definition.kind === 'boss' ? 0xc48df2 : 0xf5bd64, definition.id);
    actor.maxHp = definition.maxHp; actor.hp = body.hp;
    if (restored === undefined) return actor;
    const defaults = snapshotActor(actor);
    if (!record(restored, Object.keys(defaults))) throw new Error('Invalid full actor fields');
    const mutable = new Set(['loc', 'hp', 'ticksUntilTurn', 'statusDurations', 'maxStatus']);
    for (const key of Object.keys(defaults)) if (!mutable.has(key) && canonical(restored[key] as never) !== canonical(defaults[key] as never))
        throw new Error('Invalid full actor constant');
    if (!record(restored.loc, ['x', 'y']) || restored.loc.x !== actor.loc.x || restored.loc.y !== actor.loc.y || restored.hp !== body.hp
        || !integer(restored.ticksUntilTurn, 0, 1000)) throw new Error('Invalid full actor mirror');
    const statuses = restored.statusDurations, max = restored.maxStatus;
    if (!(record(statuses, []) || record(statuses, ['paralyzed']) && integer(statuses.paralyzed, 1, HORDE_DATA.stagger.duration))
        || !record(max, [])) throw new Error('Invalid full actor status');
    // The shared applyStatus('paralyzed') sets only the remaining timer; unlike
    // shield/fear it does not maintain a maxStatus entry. Preserve that contract.
    actor.ticksUntilTurn = restored.ticksUntilTurn;
    actor.statusDurations = { ...(statuses as { paralyzed?: number }) }; actor.maxStatus = { ...(max as { paralyzed?: number }) };
    return actor;
}
/** Complete own-state projection, including fields unused by this archetype.
 * The authoritative HP/loc mirrors and every persisted status are checked. */
export function snapshotActor(actor: CreatureBase): Record<string, unknown> {
    return structuredClone(Object.fromEntries(Object.entries(actor).map(([key, value]) => [key, value instanceof Set ? [...value].sort() : value])));
}
