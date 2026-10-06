import { FOUNDATION_PROTOCOL } from './descriptor';
import type { ExtensionModule, ExtensionManifest, ExtensionRulesIdentity } from './types';
import { validId, canonical, isJson } from './json';
import { ExtensionCompatibilityError } from './compatibility';

export class ExtensionRegistry {
    private readonly factories = new Map<string, { version: string; create: () => ExtensionModule; rules?: ExtensionRulesIdentity }>();
    register(id: string, version: string, create: () => ExtensionModule, rules?: ExtensionRulesIdentity): void {
        if (!validId(id) || !/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid extension identity/version');
        if (this.factories.has(id)) throw new Error(`Duplicate extension: ${id}`);
        if (rules && (!Number.isSafeInteger(rules.schema) || rules.schema < 1 || rules.version !== version
            || !/^sha256:[a-f0-9]{64}$/.test(rules.fingerprint)
            || Object.keys(rules).some(key => !['schema', 'version', 'fingerprint'].includes(key)))) throw new Error('Invalid extension rules identity');
        this.factories.set(id, { version, create, ...(rules ? { rules: Object.freeze(structuredClone(rules)) } : {}) });
    }
    /** Registration never runs factories. Enable only at a new-run/load boundary. */
    manifest(ids: readonly string[]): ExtensionManifest {
        if (new Set(ids).size !== ids.length) throw new Error('Duplicate enabled extension');
        return { schema: 1, foundation: FOUNDATION_PROTOCOL, modules: [...ids].sort().map(id => {
            const registration = this.factories.get(id);
            if (!registration) throw new Error(`Unavailable extension: ${id}`);
            return { id, version: registration.version, ...(registration.rules ? { rules: structuredClone(registration.rules) } : {}) };
        }) };
    }
    validateManifest(value: unknown): asserts value is ExtensionManifest {
        const header = value as ExtensionManifest;
        if (!isJson(value) || !header || header.schema !== 1 || !Array.isArray(header.modules)
            || header.modules.some(entry => !entry || !validId(entry.id) || typeof entry.version !== 'string'
                || Object.keys(entry).some(key => key !== 'id' && key !== 'version' && key !== 'rules'))
            || Object.keys(header).some(key => key !== 'schema' && key !== 'modules' && key !== 'foundation')) throw new Error('Invalid extension manifest');
        // Keep malformed headers on the existing generic path. For otherwise
        // valid identities, report the first mismatch in stable module-ID order.
        if (header.foundation === FOUNDATION_PROTOCOL && new Set(header.modules.map(entry => entry.id)).size === header.modules.length
            && header.modules.every(entry => /^\d+\.\d+\.\d+$/.test(entry.version)
                && (entry.rules === undefined || (entry.rules && Number.isSafeInteger(entry.rules.schema)
                    && entry.rules.schema >= 1 && /^\d+\.\d+\.\d+$/.test(entry.rules.version)
                    && /^sha256:[a-f0-9]{64}$/.test(entry.rules.fingerprint)
                    && Object.keys(entry.rules).sort().join(',') === 'fingerprint,schema,version')))) {
            for (const entry of [...header.modules].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) {
                const installed = this.factories.get(entry.id);
                if (!installed) throw new ExtensionCompatibilityError('missing', entry.id,
                    `Unavailable extension: ${entry.id}`, entry.version, null);
                if (entry.version !== installed.version) throw new ExtensionCompatibilityError('version', entry.id,
                    `Extension set/version mismatch: ${entry.id}`, entry.version, installed.version);
                if (canonical(entry.rules) !== canonical(installed.rules)) throw new ExtensionCompatibilityError('version', entry.id,
                    `Extension set/version mismatch: ${entry.id}`, entry.version, installed.version,
                    { expected: entry.rules, actual: installed.rules });
            }
        }
        const expected = this.manifest(header.modules.map(entry => entry.id));
        if (canonical(header) !== canonical(expected)) throw new Error('Extension set/version mismatch');
    }
    create(manifest: ExtensionManifest): ExtensionModule[] {
        this.validateManifest(manifest);
        const modules = new Map(manifest.modules.map(({ id, version, rules }) => {
            const module = this.factories.get(id)!.create();
            if (module.id !== id || module.version !== version || canonical(module.rules) !== canonical(rules)) throw new Error('Extension factory identity mismatch');
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
