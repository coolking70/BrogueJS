import type { Json } from './types';

/** A native resolver may hold scheduler children while the optional provider
 * writes its own namespace. Keep those identities, including on rollback;
 * this changes no provider capabilities or part-break wire format. */
export function actorActionIdentityCheckpoint(value: Json): { restore(): void } {
    const values = new Map<object, Json>();
    function capture(node: Json): void {
        if (!node || typeof node !== 'object' || values.has(node)) return;
        values.set(node, Array.isArray(node) ? [...node] : { ...node });
        for (const child of Object.values(node)) capture(child);
    }
    capture(value);
    return { restore() {
        for (const [node, saved] of values) {
            if (Array.isArray(node) && Array.isArray(saved)) node.splice(0, node.length, ...saved);
            else {
                const record = node as Record<string, Json>;
                for (const key of Object.keys(record)) delete record[key];
                Object.assign(record, saved);
            }
        }
    } };
}
function identity(value: Json): string | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    // A receipt can carry both actorId and actionId: successive actions by
    // one actor remain distinct mechanical records.
    for (const key of ['actionId', 'actorId', 'sourceSubactionId']) {
        if (typeof value[key] === 'number') return `${key}:${value[key]}`;
    }
    return null;
}
/** Input has already passed the namespace's strict pure state codec. */
export function adoptActorActionJson(target: Json, next: Json): Json {
    if (Array.isArray(target) && Array.isArray(next)) {
        const keyed = new Map(target.flatMap(value => { const key = identity(value); return key ? [[key, value] as const] : []; }));
        const children = next.map((value, index) => {
            const key = identity(value), current = key ? keyed.get(key) : target[index];
            return current === undefined ? structuredClone(value) : adoptActorActionJson(current, value);
        });
        target.splice(0, target.length, ...children); return target;
    }
    if (target && next && typeof target === 'object' && typeof next === 'object' && !Array.isArray(target) && !Array.isArray(next)) {
        for (const key of Object.keys(target)) if (!(key in next)) delete target[key];
        for (const [key, value] of Object.entries(next)) target[key] = key in target ? adoptActorActionJson(target[key]!, value) : structuredClone(value);
        return target;
    }
    return structuredClone(next);
}
