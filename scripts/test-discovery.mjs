/** One ownership/discovery contract for npm, Vite, and the membership guard.
 * A module owns its entire directory, including its local test manifest. Removal
 * therefore removes registration and tests together, never by suppressing errors.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const suiteNames = Object.freeze(['test', 'gen', 'drift']);
export const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const generatedDirectories = new Set(['.git', 'node_modules', 'dist', 'coverage', '.vite', '.cache']);
const slash = path => path.split(sep).join('/');
const testPattern = /\.(test|spec)\.[cm]?[jt]sx?$/;

export function discoverTestFiles(root = repositoryRoot) {
    const visit = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        if (generatedDirectories.has(entry.name) || (resolve(dir) === resolve(root) && /^tmp-phase/.test(entry.name))) return [];
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return visit(path);
        return entry.isFile() && testPattern.test(entry.name) ? [slash(relative(root, path))] : [];
    });
    return visit(resolve(root)).sort();
}

export function discoverModules(root = repositoryRoot) {
    const directory = join(root, 'src/ext/modules');
    if (!existsSync(directory)) return [];
    return readdirSync(directory, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => {
        if (!/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(entry.name)) throw new Error(`Invalid module directory: ${entry.name}`);
        const moduleRoot = `src/ext/modules/${entry.name}`;
        if (!existsSync(join(root, moduleRoot, 'descriptor.ts'))) throw new Error(`Module ${entry.name} is missing descriptor.ts`);
        return { id: entry.name, root: moduleRoot, manifest: `${moduleRoot}/test-suites.json` };
    }).sort((a, b) => a.id.localeCompare(b.id, 'en'));
}

export function resolveTestSuites(root = repositoryRoot) {
    root = resolve(root);
    const files = discoverTestFiles(root), modules = discoverModules(root);
    const suites = Object.fromEntries(suiteNames.map(name => [name, []]));
    const owners = {}, errors = [];
    const manifests = [{ manifest: 'scripts/test-suites.json', root: '', id: null }, ...modules];
    for (const owner of manifests) {
        const absolute = join(root, owner.manifest);
        if (!existsSync(absolute)) { errors.push(`Missing test ownership manifest: ${owner.manifest}`); continue; }
        let manifest;
        try { manifest = JSON.parse(readFileSync(absolute, 'utf8')); }
        catch (error) { errors.push(`Invalid test ownership manifest ${owner.manifest}: ${error.message}`); continue; }
        if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)
            || Object.keys(manifest).sort().join(',') !== [...suiteNames].sort().join(',')) {
            errors.push(`${owner.manifest} must contain exactly test, gen, drift arrays`); continue;
        }
        for (const suite of suiteNames) {
            if (!Array.isArray(manifest[suite])) { errors.push(`${owner.manifest}: ${suite} must be an array`); continue; }
            for (const entry of manifest[suite]) {
                if (typeof entry !== 'string' || isAbsolute(entry) || entry.includes('\\')
                    || entry.split('/').some(part => !part || part === '.' || part === '..')) {
                    errors.push(`${owner.manifest}: invalid owned path ${JSON.stringify(entry)}`); continue;
                }
                const path = owner.root ? `${owner.root}/${entry}` : entry;
                if (owner.id && !entry.startsWith('tests/')) errors.push(`${owner.manifest}: module tests must live under tests/: ${entry}`);
                if (!owner.id && path.startsWith('src/ext/modules/')) errors.push(`Foundation manifest cannot own module test: ${path}`);
                if (!testPattern.test(path) || !files.includes(path)) errors.push(`Stale or invalid registered test: ${path} (${owner.manifest})`);
                if (Object.hasOwn(owners, path)) errors.push(`Duplicate test registration: ${path} (${owners[path].manifest}, ${owner.manifest})`);
                else owners[path] = { kind: owner.id ? 'module' : 'foundation', moduleId: owner.id, manifest: owner.manifest, suite };
                suites[suite].push(path);
            }
        }
    }
    for (const path of files) if (!Object.hasOwn(owners, path)) errors.push(`Unregistered discovered test: ${path}`);
    if (errors.length) throw new Error(`Test ownership failed:\n${errors.map(error => `- ${error}`).join('\n')}`);
    for (const suite of suiteNames) suites[suite].sort();
    // Phase 4 spatial/body fixtures belong to the foundation, including when
    // the content package is physically absent. Keep them in removal's ext gate.
    suites.ext = files.filter(path => owners[path].kind === 'module' || /^src\/test\/(?:ext_|phase4).*\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path));
    return { root, suites, files, modules, owners };
}

/** Vite repeats the runner's strict discovery unless a caller supplies a shared result. */
export function getTestDiscovery(root = repositoryRoot) {
    const serialized = process.env.BROGUE_TEST_DISCOVERY;
    if (!serialized) return resolveTestSuites(root);
    const result = JSON.parse(serialized);
    if (result.root !== resolve(root) || !result.suites || !Array.isArray(result.files)) throw new Error('Invalid shared test discovery result');
    return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        const result = resolveTestSuites(process.argv[2] ?? repositoryRoot);
        console.log(JSON.stringify({ modules: result.modules, counts: Object.fromEntries(Object.entries(result.suites).map(([name, files]) => [name, files.length])), files: result.files }, null, 2));
    } catch (error) { console.error(error.message); process.exitCode = 1; }
}
