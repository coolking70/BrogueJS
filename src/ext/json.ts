import type { Json } from './types';

// Only detached JSON owned by this boundary can carry a certificate. A frozen
// foreign object may still contain accessors, mutable children or a cycle.
const immutable = new WeakSet<object>();
const canonicalValues = new WeakMap<object, string>();
export function immutableJson<T extends Json>(value: T): T {
    if (value && typeof value === 'object' && immutable.has(value)) return value;
    const copy = cloneJson(value);
    if (!isJson(copy)) throw new Error('Extension data must be finite, acyclic JSON');
    const seal = (node: Json): void => {
        if (!node || typeof node !== 'object' || immutable.has(node)) return;
        Object.values(node).forEach(seal);
        Object.freeze(node); immutable.add(node);
    };
    seal(copy);
    return copy;
}
/** Mutable callers still receive a detached copy; read-only callers can share. */
export function readonlyJson<T extends Json>(value: T): T { return immutableJson(value); }
export function isImmutableJson(value: unknown): boolean {
    return !!value && typeof value === 'object' && immutable.has(value);
}

export function isJson(value: unknown, seen = new Set<object>()): value is Json {
    if (value && typeof value === 'object' && !seen.has(value) && immutable.has(value)) return true;
    if (value === null || typeof value === 'boolean' || typeof value === 'string') return true;
    if (typeof value === 'number') return Number.isFinite(value);
    if (typeof value !== 'object' || seen.has(value)) return false;
    if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return false;
    if (Array.isArray(value)) {
        const keys = Object.keys(value);
        if (keys.length !== value.length || keys.some((key, index) => key !== String(index))) return false;
    }
    seen.add(value);
    let valid = true;
    // Retain Object.entries' eager value reads (including legacy accessors),
    // while avoiding a closure and a temporary banned-key array per property.
    for (const [key, child] of Object.entries(value)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype' || !isJson(child, seen)) {
            valid = false; break;
        }
    }
    seen.delete(value);
    return valid;
}
export function cloneJson<T extends Json>(value: T): T {
    if (!isJson(value)) throw new Error('Extension data must be finite, acyclic JSON');
    return structuredClone(value);
}
export function canonical(value: unknown): string {
    if (isImmutableJson(value)) {
        const object = value as object, prior = canonicalValues.get(object);
        if (prior !== undefined) return prior;
        const result = canonicalUncached(value);
        canonicalValues.set(object, result); return result;
    }
    return canonicalUncached(value);
}
function canonicalUncached(value: unknown): string {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
        .map(([key, child]) => JSON.stringify(key) + ':' + canonical(child)).join(',') + '}';
    return JSON.stringify(value);
}
export function validId(id: unknown): id is string { return typeof id === 'string' && /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(id); }

/** A synchronous JSON savepoint owns mutable containers only. Certified leaves
 * cannot be written in place and may be shared by nested savepoints. Keep aliases
 * within the mutable graph, key order and -0 just like structuredClone. */
export function checkpointJson<T extends Json>(value: T): T {
    if (!isJson(value)) throw new Error('Extension data must be finite, acyclic JSON');
    const copies = new Map<object, Json>();
    const copy = (node: Json): Json => {
        if (!node || typeof node !== 'object' || immutable.has(node)) return node;
        const prior = copies.get(node); if (prior) return prior;
        const result: Json = Array.isArray(node) ? [] : {};
        copies.set(node, result);
        for (const [key, child] of Object.entries(node)) (result as Record<string, Json>)[key] = copy(child);
        return result;
    };
    return copy(value) as T;
}
