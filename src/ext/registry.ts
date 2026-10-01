import type { ExtensionModule, ExtensionManifest } from './types';
import { validId, canonical } from './json';

export class ExtensionRegistry {
    private readonly factories = new Map<string, { version: string; create: () => ExtensionModule }>();
    register(id: string, version: string, create: () => ExtensionModule): void {
        if (!validId(id) || !/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid extension identity/version');
        if (this.factories.has(id)) throw new Error(`Duplicate extension: ${id}`);
        this.factories.set(id, { version, create });
    }
    /** Registration never runs factories. Enable only at a new-run/load boundary. */
    manifest(ids: readonly string[]): ExtensionManifest {
        if (new Set(ids).size !== ids.length) throw new Error('Duplicate enabled extension');
        return { schema: 1, modules: [...ids].sort().map(id => {
            const registration = this.factories.get(id);
            if (!registration) throw new Error(`Unavailable extension: ${id}`);
            return { id, version: registration.version };
        }) };
    }
    validateManifest(value: unknown): asserts value is ExtensionManifest {
        const header = value as ExtensionManifest;
        if (!header || header.schema !== 1 || !Array.isArray(header.modules)
            || header.modules.some(entry => !entry || !validId(entry.id) || typeof entry.version !== 'string'
                || Object.keys(entry).some(key => key !== 'id' && key !== 'version'))
            || Object.keys(header).some(key => key !== 'schema' && key !== 'modules')) throw new Error('Invalid extension manifest');
        const expected = this.manifest(header.modules.map(entry => entry.id));
        if (canonical(header) !== canonical(expected)) throw new Error('Extension set/version mismatch');
    }
    create(manifest: ExtensionManifest): ExtensionModule[] {
        this.validateManifest(manifest);
        const modules = new Map(manifest.modules.map(({ id, version }) => {
            const module = this.factories.get(id)!.create();
            if (module.id !== id || module.version !== version) throw new Error('Extension factory identity mismatch');
            return [id, module];
        }));
        const ordered: ExtensionModule[] = [], visiting = new Set<string>(), visited = new Set<string>();
        const visit = (id: string): void => {
            if (visited.has(id)) return;
            if (visiting.has(id)) throw new Error('Extension dependency cycle');
            const module = modules.get(id);
            if (!module) throw new Error(`Missing enabled dependency: ${id}`);
            visiting.add(id);
            for (const dependency of [...(module.dependencies ?? [])].sort()) visit(dependency);
            visiting.delete(id); visited.add(id); ordered.push(module);
        };
        for (const { id } of manifest.modules) visit(id);
        return ordered;
    }
}
