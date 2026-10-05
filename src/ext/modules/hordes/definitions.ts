import data from './data/definitions.json';
import { extensionDataFingerprint } from '../../fingerprint';
import type { PopulationActorDefinition } from '../../../engine/Simulation/PopulationRuntime';
const integer = (n: number, lo: number, hi: number) => Number.isSafeInteger(n) && n >= lo && n <= hi;
for (const [kind, cap] of [['swarm', 400], ['elite', 32], ['boss', 4]] as const) {
    const d = data[kind];
    if (!integer(d.count, 1, cap) || !integer(d.radius, 1, 1024) || !integer(d.hp, 1, 1_000_000)
        || !integer(d.speed, 1, 256) || !integer(d.damage, 1, 10000) || !integer(d.respawnDelay, 1, 3600)) throw new Error('Invalid horde archetype');
    if (kind !== 'swarm') {
        const action = data[kind];
        if (!integer(action.windup, 1, 600) || !integer(action.recovery, 1, 600)
            || !integer(action.range, 1, 16384) || !integer(action.blastRadius, 1, 8192)) throw new Error('Invalid horde attack');
    }
}
if (!integer(data.swarm.attackInterval, 1, 600) || !integer(data.director.interval, 1, 600) || !integer(data.director.batch, 1, 64)
    || !integer(data.director.minimumDistance, 1024, 32768) || !integer(data.stagger.threshold, 1, 10000) || !integer(data.stagger.duration, 1, 600)) throw new Error('Invalid horde director');
export const HORDE_DATA = Object.freeze({ ...data, swarm: Object.freeze(data.swarm), elite: Object.freeze(data.elite), boss: Object.freeze(data.boss),
    director: Object.freeze(data.director), stagger: Object.freeze(data.stagger) });
export const HORDE_RULES = { schema: data.schema, version: data.version, fingerprint: extensionDataFingerprint(data) };
export const HORDE_ACTORS: readonly PopulationActorDefinition[] = (['swarm', 'elite', 'boss'] as const).flatMap(kind =>
    Array.from({ length: data[kind].count }, () => ({ id: 0, kind, radius: data[kind].radius, maxHp: data[kind].hp })))
    .map((a, i) => Object.freeze({ ...a, id: i + 2 }));
export const HORDE_FULL_ACTORS = HORDE_ACTORS.filter(a => a.kind !== 'swarm');
