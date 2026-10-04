import type { ExtensionModule, ExtensionRulesIdentity } from './types';
import { ExtensionRegistry } from './registry';
import { isJson, validId } from './json';

/** Pure installed-package metadata. Discovery never creates a module or a run.
 * UI has a separate discovered declaration so engine imports never initialize Vue. */
export interface ModuleDescriptor {
    readonly id: string;
    readonly version: string;
    readonly foundation: 2;
    readonly rules?: ExtensionRulesIdentity;
    readonly create: () => ExtensionModule;
    readonly labelKey: string;
    readonly descriptionKey?: string;
    /** Configurable sample default, not a dependency or permanent product policy. */
    readonly defaultEnabled?: boolean;
    readonly locales?: Readonly<Record<string, Readonly<Record<string, string>>>>;
}
function freeze<T>(value: T): T {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.values(value).forEach(freeze); Object.freeze(value);
    }
    return value;
}
export function validateModuleDescriptors(values: readonly ModuleDescriptor[]): readonly ModuleDescriptor[] {
    if (!Array.isArray(values)) throw new Error('Invalid module descriptors');
    const registry = new ExtensionRegistry();
    const result = values.map(value => {
        if (!value || typeof value !== 'object' || Array.isArray(value)
            || Object.keys(value).some(key => !['id', 'version', 'foundation', 'rules', 'create', 'labelKey', 'descriptionKey', 'defaultEnabled', 'locales'].includes(key))
            || !validId(value.id) || value.foundation !== 2 || typeof value.create !== 'function'
            || (value.defaultEnabled !== undefined && typeof value.defaultEnabled !== 'boolean')) throw new Error('Invalid module descriptor');
        const prefix = `ext.${value.id}.`;
        if (typeof value.labelKey !== 'string' || !value.labelKey.startsWith(prefix)
            || (value.descriptionKey !== undefined && (typeof value.descriptionKey !== 'string' || !value.descriptionKey.startsWith(prefix)))) throw new Error('Invalid module text ownership');
        if (value.locales !== undefined && (!isJson(value.locales) || !value.locales || Array.isArray(value.locales)
            || Object.entries(value.locales).some(([language, resource]) => !/^[a-z]{2}(?:_[A-Z]{2})?$/.test(language)
                || !resource || Array.isArray(resource) || typeof resource !== 'object'
                || Object.entries(resource).some(([key, text]) => !key.startsWith(prefix) || typeof text !== 'string')))) throw new Error('Invalid module locales');
        registry.register(value.id, value.version, value.create, value.rules);
        return freeze({ ...value, ...(value.rules ? { rules: structuredClone(value.rules) } : {}),
            ...(value.locales ? { locales: structuredClone(value.locales) } : {}) });
    });
    return Object.freeze(result.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
/** Caller and filesystem order cannot become simulation order. */
export function registryFromDescriptors(values: readonly ModuleDescriptor[]): ExtensionRegistry {
    const registry = new ExtensionRegistry();
    for (const descriptor of validateModuleDescriptors(values)) registry.register(descriptor.id, descriptor.version, () => {
        const module = descriptor.create();
        if (module.dependencies?.length) throw new Error(`Stage modules may only depend on the foundation: ${descriptor.id}`);
        return module;
    }, descriptor.rules);
    return registry;
}
