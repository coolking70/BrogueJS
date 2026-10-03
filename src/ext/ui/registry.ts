import { getInstalledModuleDescriptors } from '../catalog';
import type { ModuleUiContribution } from './types';

export function collectModuleUiContributions(entries: Readonly<Record<string, ModuleUiContribution>>, installedIds: readonly string[]): readonly ModuleUiContribution[] {
    const installed = new Set(installedIds), seen = new Set<string>();
    for (const [path, entry] of Object.entries(entries)) {
        const owner = /^\.\.\/modules\/([^/]+)\/ui\/descriptor\.ts$/.exec(path)?.[1];
        if (owner !== entry.moduleId || !installed.has(entry.moduleId) || seen.has(entry.moduleId)
            || (!entry.useSession && !entry.creationStep && !entry.loadCreationStep)
            || (entry.creationStep && entry.loadCreationStep)) throw new Error('Invalid module UI contribution');
        seen.add(entry.moduleId);
    }
    return Object.freeze(Object.values(entries).sort((a, b) => a.moduleId.localeCompare(b.moduleId)));
}
const declarations = import.meta.glob<{ default: ModuleUiContribution }>('../modules/*/ui/descriptor.ts', { eager: true });
export function getInstalledModuleUiContributions(): readonly ModuleUiContribution[] {
    return collectModuleUiContributions(Object.fromEntries(Object.entries(declarations).map(([path, entry]) => [path, entry.default])), getInstalledModuleDescriptors().map(entry => entry.id));
}
