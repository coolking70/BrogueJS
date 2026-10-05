/** Strict, inert JSON protocol checks. Accessors never run while validating. */
export function record(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)
        || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
    return Reflect.ownKeys(value).length === keys.length && keys.every(key => {
        const d = Object.getOwnPropertyDescriptor(value, key);
        return d?.enumerable === true && 'value' in d;
    });
}
export function integer(value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
}
export function dataArray(value: unknown, max: number): value is unknown[] {
    return Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype && value.length <= max
        && Reflect.ownKeys(value).length === value.length + 1
        && Array.from({ length: value.length }, (_, i) => Object.getOwnPropertyDescriptor(value, String(i)))
            .every(d => d?.enumerable === true && 'value' in d);
}
