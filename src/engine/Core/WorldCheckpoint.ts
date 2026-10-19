/** The generation boundary owns the write-set, not the whole reachable Game.
 * Shallow roots preserve pointers/container membership without following them;
 * deep roots preserve mutable descendants, stopping at explicit reference roots.
 * Append-only presentation queues need their original reference and length only.
 * Selection runs inside capture so performance measurements include its cost. */
export interface GenerationCheckpointRoots {
    shallow: readonly object[];
    deep: readonly unknown[];
    references?: readonly unknown[];
    appendOnly?: readonly unknown[][];
    restoreSession?: readonly (() => void)[];
}

/** Extension-only in-place failure recovery. No save loading, constructors,
 * setters on owned creature lists, or RNG/ID allocation during restoration.
 * Weak session associations are restored separately by the generation boundary.
 * Classic generation never calls this function. */
export function checkpointGenerationWorld(select: () => GenerationCheckpointRoots, orderedProperties = false): () => void {
    const roots = select();
    const seen = new Set<unknown>(roots.references);
    const shallow = new Set(roots.shallow);
    const restore: Array<() => void> = [];
    for (const queue of roots.appendOnly ?? []) {
        seen.add(queue);
        const length = queue.length;
        restore.push(() => { queue.length = length; });
    }
    const capture = (value: unknown): void => {
        if (!value || typeof value !== 'object' || seen.has(value) || Object.isFrozen(value)) return;
        seen.add(value);
        if (value instanceof WeakMap || value instanceof WeakSet) return;
        const descend = !shallow.has(value);
        if (ArrayBuffer.isView(value)) {
            const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
            const saved = bytes.slice();
            restore.push(() => { bytes.set(saved); });
        } else if (value instanceof Map) {
            const entries = [...value];
            restore.push(() => { value.clear(); for (const [key, entry] of entries) value.set(key, entry); });
            if (descend) for (const [key, entry] of entries) { capture(key); capture(entry); }
        } else if (value instanceof Set) {
            const entries = [...value];
            restore.push(() => { value.clear(); for (const entry of entries) value.add(entry); });
            if (descend) entries.forEach(capture);
        } else {
            // Ordinary mutable data properties need only their value. Retaining
            // a descriptor object per grid-cell property makes GC dominate the
            // party savepoint. Keep full descriptors only for exceptional flags
            // or accessors; never invoke getters while capturing.
            if (orderedProperties) {
                const keys = Reflect.ownKeys(value), values: unknown[] = [];
                let special: Array<PropertyDescriptor | undefined> | undefined;
                for (let i = 0; i < keys.length; i++) {
                    const descriptor = Object.getOwnPropertyDescriptor(value, keys[i]!);
                    // Match getOwnPropertyDescriptors when a proxy removes a key
                    // between ownKeys and descriptor lookup.
                    if (!descriptor) { keys.splice(i--, 1); continue; }
                    values.push('value' in descriptor ? descriptor.value : undefined);
                    if (!('value' in descriptor && descriptor.writable && descriptor.enumerable && descriptor.configurable))
                        (special ??= [])[i] = descriptor;
                }
                restore.push(() => {
                    const saved = new Set(keys);
                    for (const key of Reflect.ownKeys(value)) if (!saved.has(key)) Reflect.deleteProperty(value, key);
                    for (let i = 0; i < keys.length; i++) Object.defineProperty(value, keys[i]!, special?.[i]
                        ?? { value: values[i], writable: true, enumerable: true, configurable: true });
                });
                if (descend) for (const child of values) capture(child);
                return;
            }
            const descriptors = Object.getOwnPropertyDescriptors(value);
            restore.push(() => {
                for (const key of Reflect.ownKeys(value)) {
                    if (!Object.prototype.hasOwnProperty.call(descriptors, key)) Reflect.deleteProperty(value, key);
                }
                Object.defineProperties(value, descriptors);
            });
            if (descend) for (const key of Reflect.ownKeys(descriptors)) {
                const descriptor = descriptors[key as keyof typeof descriptors]!;
                if ('value' in descriptor) capture(descriptor.value);
            }
        }
    };
    roots.shallow.forEach(capture);
    roots.deep.forEach(capture);
    return () => {
        for (const apply of restore) apply();
        for (const apply of roots.restoreSession ?? []) apply();
    };
}

/** Capture the union of independent write sets at one synchronous boundary.
 * Each selection retains its own shallow/reference stops. Shared objects save
 * descriptors once; visiting them in another selection can still descend. */
export function checkpointGenerationWorldGroups(selectors: readonly (() => GenerationCheckpointRoots)[]): () => void {
    const saved = new Map<object, readonly unknown[]>();
    const restore: Array<() => void> = [];
    const sessions: Array<() => void> = [];
    for (const select of selectors) {
        const roots = select();
        const seen = new Set<unknown>(roots.references);
        const shallow = new Set(roots.shallow);
        sessions.push(...roots.restoreSession ?? []);
        for (const queue of roots.appendOnly ?? []) {
            seen.add(queue);
            const length = queue.length;
            restore.push(() => { queue.length = length; });
        }
        const capture = (value: unknown): void => {
            if (!value || typeof value !== 'object' || seen.has(value) || Object.isFrozen(value)) return;
            seen.add(value);
            if (value instanceof WeakMap || value instanceof WeakSet) return;
            const descend = !shallow.has(value);
            const prior = saved.get(value);
            if (prior) { if (descend) for (const child of prior) capture(child); return; }
            const children: object[] = [];
            saved.set(value, children);
            if (ArrayBuffer.isView(value)) {
                const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
                const saved = bytes.slice();
                restore.push(() => { bytes.set(saved); });
            } else if (value instanceof Map) {
                const entries = [...value];
                restore.push(() => { value.clear(); for (const [key, entry] of entries) value.set(key, entry); });
                for (const [key, entry] of entries) {
                    if (key && typeof key === 'object') children.push(key);
                    if (entry && typeof entry === 'object') children.push(entry);
                }
            } else if (value instanceof Set) {
                const entries = [...value];
                restore.push(() => { value.clear(); for (const entry of entries) value.add(entry); });
                for (const entry of entries) if (entry && typeof entry === 'object') children.push(entry);
            } else {
                const keys = Reflect.ownKeys(value);
                const descriptors = Object.create(null) as PropertyDescriptorMap;
                for (const key of keys) {
                    const descriptor = Object.getOwnPropertyDescriptor(value, key);
                    // getOwnPropertyDescriptors likewise ignores a property
                    // removed by a proxy between ownKeys and descriptor lookup.
                    if (descriptor) descriptors[key] = descriptor;
                }
                restore.push(() => {
                    for (const key of Reflect.ownKeys(value)) {
                        if (!Object.prototype.hasOwnProperty.call(descriptors, key)) Reflect.deleteProperty(value, key);
                    }
                    Object.defineProperties(value, descriptors);
                });
                for (const key of Reflect.ownKeys(descriptors)) {
                    const descriptor = descriptors[key];
                    if (descriptor && 'value' in descriptor && descriptor.value && typeof descriptor.value === 'object')
                        children.push(descriptor.value);
                }
            }
            if (descend) for (const child of children) capture(child);
        };
        roots.shallow.forEach(capture);
        roots.deep.forEach(capture);
    }
    return () => {
        for (const apply of restore) apply();
        for (const apply of sessions) apply();
    };
}

export interface GenerationCheckpointCapture {
    capture(select: () => GenerationCheckpointRoots): () => void;
    seal(): void;
    readonly diagnostics: Readonly<{ objects: number; properties: number; typedBytes: number; reused: number }>;
}
/** Share descriptor/byte captures made at the SAME synchronous write boundary.
 * Each receipt retains its own reference stops, traversal and restore order.
 * Never carry a pool across a write or use it for a later nested savepoint. */
export function createGenerationCheckpointCapture(): GenerationCheckpointCapture {
    const saved = new Map<object, { children: object[]; apply: () => void }>();
    let sealed = false;
    const counts = { objects: 0, properties: 0, typedBytes: 0, reused: 0 };
    return {
        get diagnostics() { return { ...counts }; },
        seal() { sealed = true; saved.clear(); },
        capture(select) {
            if (sealed) throw new Error('Checkpoint capture boundary closed');
            const roots = select(), seen = new Set<unknown>(roots.references), shallow = new Set(roots.shallow);
            const restore: Array<() => void> = [];
            for (const queue of roots.appendOnly ?? []) {
                seen.add(queue); const length = queue.length;
                restore.push(() => { queue.length = length; });
            }
            const capture = (value: unknown): void => {
                if (!value || typeof value !== 'object' || seen.has(value) || Object.isFrozen(value)) return;
                seen.add(value);
                if (value instanceof WeakMap || value instanceof WeakSet) return;
                let entry = saved.get(value);
                if (entry) counts.reused++;
                else {
                    const children: object[] = [];
                    const child = (v: unknown) => { if (v && typeof v === 'object') children.push(v); };
                    let apply: () => void;
                    if (ArrayBuffer.isView(value)) {
                        const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength), copy = bytes.slice();
                        counts.typedBytes += copy.length;
                        apply = () => { bytes.set(copy); };
                    } else if (value instanceof Map) {
                        const entries = [...value];
                        apply = () => { value.clear(); for (const [key, v] of entries) value.set(key, v); };
                        for (const [key, v] of entries) { child(key); child(v); }
                    } else if (value instanceof Set) {
                        const entries = [...value];
                        apply = () => { value.clear(); for (const v of entries) value.add(v); };
                        entries.forEach(child);
                    } else {
                        const descriptors = Object.getOwnPropertyDescriptors(value);
                        const keys = Reflect.ownKeys(descriptors); counts.properties += keys.length;
                        apply = () => {
                            for (const key of Reflect.ownKeys(value)) if (!Object.prototype.hasOwnProperty.call(descriptors, key)) Reflect.deleteProperty(value, key);
                            Object.defineProperties(value, descriptors);
                        };
                        for (const key of keys) {
                            const descriptor = descriptors[key as keyof typeof descriptors]!;
                            if ('value' in descriptor) child(descriptor.value);
                        }
                    }
                    entry = { children, apply }; saved.set(value, entry); counts.objects++;
                }
                restore.push(entry.apply);
                if (!shallow.has(value)) entry.children.forEach(capture);
            };
            roots.shallow.forEach(capture); roots.deep.forEach(capture);
            return () => { restore.forEach(apply => apply()); for (const apply of roots.restoreSession ?? []) apply(); };
        }
    };
}
