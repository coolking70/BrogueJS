import { getInstalledModuleDescriptors } from '../../ext/catalog';

/** Discover optional packages before building test inputs, just as the game does. */
export function installedOptionalModules(ids: readonly string[]): string[] {
    const installed = new Set(getInstalledModuleDescriptors().map(module => module.id));
    return ids.filter(id => installed.has(id));
}

export function installedModuleSubsets(ids: readonly string[]): string[][] {
    let subsets: string[][] = [[]];
    for (const id of installedOptionalModules(ids)) {
        subsets = [...subsets, ...subsets.map(subset => [...subset, id])];
    }
    return subsets;
}
