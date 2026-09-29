import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const destination = join(root, '.ce-reference');
const legacyCommit = '49be8dd3fc1b9a0fb477df4c9153c0e1cf796fe9';
const repositories = {
    legacy: 'https://github.com/coolking70/BrogueCE-chs.git',
    upstream: 'https://github.com/tmewett/BrogueCE.git',
};

function git(cwd, ...args) {
    const result = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`git ${args[0]} failed: ${result.stderr.trim()}`);
    return result.stdout.trim();
}

function main() {
    let source = 'legacy', ref, force = false;
    const args = process.argv.slice(2);
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--force') force = true;
        else if (arg === '--source' || arg === '--ref') {
            const value = args[++i];
            if (!value || value.startsWith('-')) throw new Error(`${arg} needs a value`);
            if (arg === '--source') source = value;
            else ref = value;
        } else if (arg === '--help') {
            console.log('Usage: npm run ce:fetch -- [--source legacy|upstream] [--ref <tag|sha>] [--force]');
            return;
        } else throw new Error(`Unknown argument: ${arg}`);
    }
    if (!Object.hasOwn(repositories, source)) throw new Error(`Unknown source: ${source}`);
    if (source === 'legacy' && ref) throw new Error('legacy is pinned; --ref is only supported for upstream');
    const repo = repositories[source];
    const requestedRef = source === 'legacy' ? legacyCommit : ref ?? 'HEAD';
    if (source === 'upstream') console.warn('WARNING: Tests are calibrated against legacy; upstream may fail CE comparison tests.');

    if (existsSync(destination) && !force) {
        try {
            const info = JSON.parse(readFileSync(join(destination, 'SOURCE.json'), 'utf8'));
            const checkout = join(destination, '.checkout');
            const commit = git(checkout, 'rev-parse', 'HEAD');
            if (info.source !== source || info.repo !== repo || info.commit !== commit
                || git(checkout, 'remote', 'get-url', 'origin') !== repo
                || (source === 'legacy' ? commit !== legacyCommit : info.ref !== requestedRef)) {
                throw new Error('source or commit does not match the requested reference');
            }
            // The normalized source directory is the sparse worktree, so local edits
            // and missing files are detected as well as metadata/commit mismatches.
            if (git(checkout, 'status', '--porcelain', '--untracked-files=no')) {
                throw new Error('reference files have changed');
            }
            for (const file of ['src/brogue/Rogue.h', 'src/brogue/Globals.c', 'src/variants/GlobalsBrogue.c', 'LICENSE.txt']) {
                if (!existsSync(join(destination, 'BrogueCE-master', file))) throw new Error(`missing ${file}`);
            }
            console.log(`CE reference already verified: ${source} ${commit}`);
            return;
        } catch (error) {
            throw new Error(`Cannot reuse CE reference: ${error.message}. Run again with --force.`);
        }
    }

    const staging = mkdtempSync(join(root, '.ce-reference-fetch-'));
    try {
        git(staging, 'init', '--quiet', '.checkout');
        const checkout = join(staging, '.checkout');
        git(checkout, 'remote', 'add', 'origin', repo);
        git(checkout, 'sparse-checkout', 'init', '--no-cone');
        const prefix = source === 'legacy' ? 'BrogueCE-master/' : '';
        git(checkout, 'sparse-checkout', 'set', '--no-cone', `/${prefix}src/`, `/${prefix}LICENSE.txt`);
        console.log(`Fetching ${source} ${requestedRef} ...`);
        git(checkout, 'fetch', '--depth=1', '--filter=blob:none', 'origin', requestedRef);
        git(checkout, 'checkout', '--quiet', '--detach', 'FETCH_HEAD');
        const commit = git(checkout, 'rev-parse', 'HEAD');
        if (source === 'legacy' && commit !== legacyCommit) throw new Error('Unexpected legacy commit');

        // Keep a single git-controlled copy of src and the license, normalized
        // to the same path for both repository layouts.
        const sourceRoot = source === 'legacy' ? join(checkout, 'BrogueCE-master') : checkout;
        for (const file of ['src/brogue/Rogue.h', 'src/brogue/Globals.c', 'src/variants/GlobalsBrogue.c', 'LICENSE.txt']) {
            if (!existsSync(join(sourceRoot, file))) throw new Error(`Fetched reference is missing ${file}`);
        }
        if (source === 'legacy') {
            renameSync(sourceRoot, join(staging, 'BrogueCE-master'));
            git(checkout, 'config', 'core.worktree', '../..');
        } else {
            renameSync(checkout, join(staging, 'BrogueCE-master'));
            renameSync(join(staging, 'BrogueCE-master/.git'), join(staging, '.checkout'));
            git(join(staging, '.checkout'), 'config', 'core.worktree', '../BrogueCE-master');
        }
        writeFileSync(join(staging, 'SOURCE.json'), JSON.stringify({ source, repo, commit, ref: requestedRef, fetchedAt: new Date().toISOString() }, null, 2) + '\n');
        // A failed fetch leaves the existing reference intact, even with --force.
        rmSync(destination, { recursive: true, force: true });
        renameSync(staging, destination);
        console.log(`CE reference ready: ${source} ${commit}`);
    } finally {
        rmSync(staging, { recursive: true, force: true });
    }
}

try { main(); } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
