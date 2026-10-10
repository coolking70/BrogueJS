import type { Json } from './types';

export function isJson(value: unknown, seen = new Set<object>()): value is Json {
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
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
        .map(([key, child]) => JSON.stringify(key) + ':' + canonical(child)).join(',') + '}';
    return JSON.stringify(value);
}
export function validId(id: unknown): id is string { return typeof id === 'string' && /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(id); }
