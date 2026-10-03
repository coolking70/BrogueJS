/** Physically delete module packages in isolated copies of the CURRENT tree.
 * Usage: npm run check:module-removal -- --plan
 *        npm run check:module-removal -- --retain=none --output=/tmp/evidence
 * Default execution covers every installed-directory subset; no worktree deletion.
 */
import { createHash } from 'node:crypto';
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { discoverModules, repositoryRoot, resolveTestSuites } from './test-discovery.mjs';

const slash = path => path.split(sep).join('/');
const generated = new Set(['.git', 'node_modules', 'dist', 'coverage', '.vite', '.vite-temp', '.cache', '.tmp', 'playwright-report', 'test-results']);
function isCopiedPath(path) {
    const parts = slash(path).split('/');
    return !parts.some(part => generated.has(part) || /^tmp-phase/.test(part) || part === 'raw-evidence')
        && !/\.tsbuildinfo$/.test(path);
}
export function isCandidateInput(path) {
    return isCopiedPath(path) && slash(path).split('/')[0] !== '.ce-reference';
}
export function hashCandidate(root) {
    const files = [];
    const visit = dir => {
        for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
            const path = join(dir, entry.name), key = slash(relative(root, path));
            if (!isCandidateInput(key)) continue;
            if (entry.isDirectory()) visit(path);
            else if (entry.isFile()) files.push({ path: key, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') });
            else if (entry.isSymbolicLink()) throw new Error(`Candidate source symlink must be explicit, not copied outside ownership: ${key}`);
        }
    };
    visit(root);
    const hash = createHash('sha256');
    for (const file of files) hash.update(`${file.path}\0${file.sha256}\n`);
    return { sha256: hash.digest('hex'), files };
}
export function removalMatrix(modules) {
    let subsets = [[]];
    for (const module of modules) subsets = subsets.flatMap(subset => [subset, [...subset, module.id]]);
    return subsets.reverse().map(retained => ({
        id: retained.length ? `keep-${retained.join('+')}` : 'keep-none',
        retained, removed: modules.filter(module => !retained.includes(module.id)).map(module => module.id),
    }));
}
/** Shared package content, separate writable caches. Never link node_modules wholesale. */
function linkDependencies(source, destination) {
    const directory = join(source, 'node_modules');
    if (!existsSync(directory)) throw new Error('Current candidate has no node_modules; install dependencies before removal verification');
    const target = join(destination, 'node_modules'); mkdirSync(target);
    for (const entry of readdirSync(directory)) {
        if (entry === '.tmp' || entry === '.vite' || entry === '.vite-temp' || entry === '.cache') continue;
        symlinkSync(realpathSync(join(directory, entry)), join(target, entry), lstatSync(join(directory, entry)).isDirectory() ? 'dir' : 'file');
    }
}
function cleanCaches(root) {
    for (const path of ['dist', 'node_modules/.tmp', 'node_modules/.vite', 'node_modules/.vite-temp', '.vite', '.cache']) {
        rmSync(join(root, path), { recursive: true, force: true });
    }
    const visit = directory => {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
            if (entry.name === 'node_modules' || entry.name === '.git') continue;
            const path = join(directory, entry.name);
            if (entry.isDirectory()) visit(path);
            else if (entry.name.endsWith('.tsbuildinfo')) rmSync(path);
        }
    };
    visit(root);
}
function parseArguments(argv) {
    const options = { plan: false, prepareOnly: false, engineOnly: false, maxWorkers: 2, root: repositoryRoot, output: null, retain: null };
    for (const argument of argv) {
        if (argument === '--plan' || argument === '--dry-run') options.plan = true;
        else if (argument === '--prepare-only') options.prepareOnly = true;
        else if (argument === '--engine-only') options.engineOnly = true;
        else if (/^--maxWorkers=[1-9][0-9]*$/.test(argument)) options.maxWorkers = Number(argument.slice(13));
        else if (argument.startsWith('--root=')) options.root = resolve(argument.slice(7));
        else if (argument.startsWith('--output=')) options.output = resolve(argument.slice(9));
        else if (argument.startsWith('--retain=')) options.retain = argument.slice(9) === 'none' ? [] : argument.slice(9).split(',').sort();
        else throw new Error(`Unknown argument: ${argument}`);
    }
    return options;
}
function execute(command, args, cwd, log) {
    const startedAt = new Date().toISOString();
    // Streaming logs keep complete gate output and avoid spawnSync buffer limits.
    const env = { ...process.env }; delete env.BROGUE_TEST_DISCOVERY; delete env.BROGUE_TEST_SUITE;
    const result = spawnSync(command, args, { cwd, env,
        stdio: ['ignore', log, log] });
    return { command: [command, ...args], startedAt, endedAt: new Date().toISOString(), exitCode: result.status,
        signal: result.signal, ...(result.error ? { error: result.error.message } : {}) };
}
export async function checkModuleRemoval(argv = process.argv.slice(2)) {
    const options = parseArguments(argv), root = realpathSync(options.root);
    const discovery = resolveTestSuites(root), modules = discoverModules(root);
    let matrix = removalMatrix(modules);
    if (options.retain) {
        if (new Set(options.retain).size !== options.retain.length || options.retain.some(id => !modules.some(module => module.id === id))) throw new Error(`Invalid retained module set: ${options.retain.join(',')}`);
        matrix = matrix.filter(row => [...row.retained].sort().join(',') === options.retain.join(','));
    }
    const fixtureDirectory = join(root, 'src/test/fixtures');
    const plan = { source: root, foundationFixtureDirectories: existsSync(fixtureDirectory) ? readdirSync(fixtureDirectory, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => `src/test/fixtures/${entry.name}`).sort() : [], preservedCeReference: existsSync(join(root, '.ce-reference')), installedModules: modules.map(module => module.id), matrix,
        ownedRoots: modules.map(module => module.root), tests: Object.fromEntries(Object.entries(discovery.suites).map(([name, files]) => [name, files.length])),
        gates: ['node scripts/check-module-boundaries.mjs', 'npx vue-tsc -b', 'npm run build', `npm run test:ext -- --maxWorkers=${options.maxWorkers}`, `npm test -- --maxWorkers=${options.maxWorkers}`, 'node scripts/check-module-composition-smoke.mjs'],
        caveat: modules.length === 1 ? 'Only the currently installed module is assessed. Absent future modules are not claimed as verified.' : 'Matrix covers only currently installed module directories.' };
    if (options.plan) { console.log(JSON.stringify(plan, null, 2)); return plan; }
    const output = options.output ?? mkdtempSync(join(tmpdir(), 'brogue-module-removal-evidence-'));
    if (output === root || output.startsWith(root + sep)) throw new Error('Evidence/output must be outside the candidate tree');
    if (existsSync(join(output, 'module-removal-results.json'))) throw new Error('Evidence directory already contains a prior run; choose a new output directory to preserve its result');
    mkdirSync(output, { recursive: true });
    const input = hashCandidate(root);
    writeFileSync(join(output, 'candidate-inputs.json'), JSON.stringify(input, null, 2) + '\n');
    const evidence = { ...plan, browserRequired: !options.engineOnly, browserStatus: options.engineOnly ? 'not-run' : 'required-in-smoke', inputHash: input.sha256, startedAt: new Date().toISOString(), cases: [] };
    const record = () => writeFileSync(join(output, 'module-removal-results.json'), JSON.stringify(evidence, null, 2) + '\n');
    record();
    const { openSync, closeSync } = await import('node:fs');
    try {
    for (const row of matrix) {
        const temporary = mkdtempSync(join(tmpdir(), 'brogue-removed-modules-'));
        const copy = join(temporary, 'candidate');
        cpSync(root, copy, { recursive: true, filter: path => path === root || isCopiedPath(relative(root, path)) });
        const copied = hashCandidate(copy), unchanged = hashCandidate(root);
        if (copied.sha256 !== input.sha256 || unchanged.sha256 !== input.sha256) throw new Error('Candidate changed while creating removal copy; freeze the candidate before retrying');
        linkDependencies(root, copy);
        const caseEvidence = { ...row, temporaryCopy: copy, beforeDeletionHash: copied.sha256, deleted: [], gates: [], status: 'running' };
        evidence.cases.push(caseEvidence); record();
        for (const id of row.removed) {
            const owner = modules.find(module => module.id === id), path = join(copy, owner.root);
            if (!existsSync(path)) throw new Error(`Expected physical module directory before deletion: ${owner.root}`);
            const deletedFiles = copied.files.filter(file => file.path.startsWith(owner.root + '/')).map(file => file.path);
            rmSync(path, { recursive: true });
            if (existsSync(path)) throw new Error(`Physical deletion failed: ${owner.root}`);
            caseEvidence.deleted.push({ id, directory: owner.root, files: deletedFiles, verifiedAbsent: true });
        }
        cleanCaches(copy);
        const remaining = resolveTestSuites(copy);
        const expectedRemovedTests = discovery.files.filter(file => row.removed.includes(discovery.owners[file].moduleId));
        const actualRemovedTests = discovery.files.filter(file => !remaining.files.includes(file));
        if (JSON.stringify(expectedRemovedTests) !== JSON.stringify(actualRemovedTests)) throw new Error('Module removal changed tests outside their ownership');
        caseEvidence.afterDeletionHash = hashCandidate(copy).sha256;
        caseEvidence.removedTests = actualRemovedTests;
        caseEvidence.remainingTests = remaining.files;
        caseEvidence.remainingModules = remaining.modules.map(module => module.id);
        if (JSON.stringify([...row.retained].sort()) !== JSON.stringify(caseEvidence.remainingModules)) throw new Error('Physical package set differs from requested retention');
        record();
        if (options.prepareOnly) { caseEvidence.status = 'prepared-not-verified'; record(); continue; }
        const commands = [
            [process.execPath, ['scripts/check-module-boundaries.mjs']],
            [process.execPath, ['node_modules/vue-tsc/bin/vue-tsc.js', '-b']],
            ['npm', ['run', 'build']], ['npm', ['run', 'test:ext', '--', `--maxWorkers=${options.maxWorkers}`]], ['npm', ['test', '--', `--maxWorkers=${options.maxWorkers}`]],
            [process.execPath, ['scripts/check-module-composition-smoke.mjs', '--output', join(output, `${row.id}-smoke.json`), ...(options.engineOnly ? ['--engine-only'] : []), ...(row.removed.length ? ['--removed-modules', row.removed.join(',')] : [])]],
        ];
        for (let index = 0; index < commands.length; index++) {
            const [command, args] = commands[index], logPath = join(output, `${row.id}-${index + 1}.log`);
            console.log(`[${row.id}] ${command} ${args.join(' ')} (log: ${logPath})`);
            const log = openSync(logPath, 'w');
            let gate;
            try { gate = execute(command, args, copy, log); } finally { closeSync(log); }
            caseEvidence.gates.push({ ...gate, log: logPath }); record();
            if (gate.exitCode !== 0) { caseEvidence.status = 'failed'; break; }
        }
        if (caseEvidence.status === 'running') caseEvidence.status = 'passed';
        caseEvidence.finalInputHash = hashCandidate(copy).sha256;
        if (caseEvidence.finalInputHash !== caseEvidence.afterDeletionHash) {
            caseEvidence.status = 'failed'; caseEvidence.sourceMutation = 'Candidate inputs changed while running gates';
        }
        record();
    }
    } catch (error) { evidence.error = error.stack ?? error.message; }
    evidence.endedAt = new Date().toISOString();
    evidence.sourceFinalHash = hashCandidate(root).sha256;
    evidence.status = !evidence.error && evidence.sourceFinalHash === evidence.inputHash
        && evidence.cases.length === matrix.length && evidence.cases.every(row => row.status === (options.prepareOnly ? 'prepared-not-verified' : 'passed'))
        ? (options.prepareOnly ? 'prepared-not-verified' : options.engineOnly ? 'partial-browser-not-verified' : 'passed') : 'failed';
    record(); console.log(JSON.stringify({ status: evidence.status, evidence: join(output, 'module-removal-results.json') }, null, 2));
    if (evidence.status === 'failed') process.exitCode = 1;
    return evidence;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    checkModuleRemoval().catch(error => { console.error(error.stack ?? error.message); process.exitCode = 1; });
}
