/** Local mixing, never the world's mutable RNG stream. Each pellet's outcome
 * depends only on its shot identity, regardless of actor iteration order. */
export function shotRandom(seed: number, actorId: number, instanceId: number, sequence: number, pellet: number): number {
    let hash = seed >>> 0;
    for (const value of [actorId, instanceId, sequence, pellet]) {
        hash = Math.imul(hash ^ value, 0x85ebca6b) >>> 0;
        hash ^= hash >>> 13; hash = Math.imul(hash, 0xc2b2ae35) >>> 0; hash ^= hash >>> 16;
    }
    return hash >>> 0;
}
export function shotAngle(seed: number, actorId: number, instance: number, sequence: number, pellet: number, aim: number, spread: number, recoil: number): number {
    return (aim - Math.floor(recoil / 2) + shotRandom(seed, actorId, instance, sequence, pellet) % (2 * spread + 1) - spread + 8192) % 4096;
}
