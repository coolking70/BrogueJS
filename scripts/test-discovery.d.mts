export type TestSuiteName = 'test' | 'gen' | 'drift';
export interface DiscoveredModule { id: string; root: string; manifest: string }
export interface TestDiscovery {
    root: string;
    suites: Record<TestSuiteName | 'ext', string[]>;
    files: string[];
    modules: DiscoveredModule[];
    owners: Record<string, { kind: 'module' | 'foundation'; moduleId: string | null; manifest: string; suite: TestSuiteName }>;
}
export const suiteNames: readonly TestSuiteName[];
export const repositoryRoot: string;
export function discoverTestFiles(root?: string): string[];
export function discoverModules(root?: string): DiscoveredModule[];
export function resolveTestSuites(root?: string): TestDiscovery;
export function getTestDiscovery(root?: string): TestDiscovery;
