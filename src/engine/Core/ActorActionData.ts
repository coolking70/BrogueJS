/** Data-only public protocol boundaries: inspect descriptors before reading any
 * value so a malformed request cannot execute an accessor during pure prepare. */
export function actorActionRecord(value: unknown, names: readonly string[]): asserts value is Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)
        || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new Error('Invalid actor action DTO');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Reflect.ownKeys(value).length !== names.length || names.some(name => !descriptors[name]
        || !descriptors[name]!.enumerable || !('value' in descriptors[name]!))) throw new Error('Invalid actor action DTO fields');
}
export function actorActionArray(value: unknown, minimum: number, maximum: number): asserts value is unknown[] {
    if (!Array.isArray(value) || value.length < minimum || value.length > maximum
        || Reflect.ownKeys(value).length !== value.length + 1) throw new Error('Invalid actor action array');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (let i = 0; i < value.length; i++) if (!descriptors[String(i)] || !('value' in descriptors[String(i)]!))
        throw new Error('Invalid actor action array entry');
}
