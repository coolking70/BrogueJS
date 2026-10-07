#!/usr/bin/env node
/** Validate candidate sources and the freshly built product, never an old dist.
 * Intended to run after build inside each physical-removal candidate copy.
 * A missing browser is a failed/blocked gate, not an implicit skip. */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createServer, preview } from 'vite';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const option = name => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
const output = option('--output');
const engineOnly = args.includes('--engine-only');
const planOnly = args.includes('--plan');
const removed = (option('--removed-modules') ?? '').split(',').filter(Boolean);
const report = { schema: 1, cwd: process.cwd(), requestedScope: planOnly ? 'plan' : engineOnly ? 'engine-only' : 'engine-and-built-browser', removed, installed: [], engine: { status: 'not-run' }, browser: { status: 'not-run' } };
let sourceServer, productServer, browser;

// Self-contained so exactly the same real-Game checks can run against built JS.
function exerciseGame(game, plans, unavailableIds) {
    const clone = value => JSON.parse(JSON.stringify(value));
    const stable = value => value && typeof value === 'object'
        ? Array.isArray(value) ? value.map(stable) : Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
    const equal = (actual, expected, message) => {
        if (JSON.stringify(stable(actual)) !== JSON.stringify(stable(expected))) throw new Error(message);
    };
    const assert = (condition, message) => { if (!condition) throw new Error(message); };
    const checkpoint = () => {
        const state = game.toSnapshot();
        return clone({ tick: state.run.currentTick, turn: state.run.absoluteTurnNumber, depth: state.depth,
            player: state.player.loc, rng: state.rngState, extensions: state.extensions });
    };
    const exactCheckpoint = (actual, expected, message) => {
        assert(expected, `${message}: missing live checkpoint`);
        for (const field of ['tick', 'turn', 'depth', 'player', 'rng', 'extensions'])
            equal(actual[field], expected[field], `${message}: ${field}`);
    };
    const fromEvent = event => {
        assert(event.levelRef.kind === 'dungeon', 'Unexpected recording level reference');
        return { tick: event.tick, turn: event.turn, depth: event.levelRef.depth,
            player: event.player, rng: event.rng };
    };
    const command = (checkpoints, action, data) => {
        const index = game.recordedInputEvents.length;
        assert(checkpoints.length === index + 1, 'Incomplete live checkpoint history');
        game.executeCommand(action, data);
        while (game.pendingCommandConfirmation)
            game.resolveCommandDecision(game.pendingCommandConfirmation.token, true);
        const count = game.recordedInputEvents.length;
        assert(count === index || count === index + 1, 'Command recorded an unexpected event count');
        if (count === index + 1) checkpoints.push(checkpoint());
        else exactCheckpoint(checkpoint(), checkpoints[index], 'Unrecorded command changed state');
    };
    const play = checkpoints => {
        const before = game.absoluteTurnNumber;
        command(checkpoints, 'wait');
        assert(game.absoluteTurnNumber > before, 'Selected set cannot play a normal command');
    };
    const replay = (recording, checkpoints) => {
        assert(recording.version === 4, 'Expected recording v4');
        assert(checkpoints.length === recording.events.length + 1, 'Incomplete replay checkpoint history');
        assert(game.loadReplay(clone(recording)), 'Recording rejected');
        game.animationEnabled = false;
        exactCheckpoint(checkpoint(), checkpoints[0], 'Replay initial checkpoint mismatch');
        for (const event of recording.events) {
            game.replayStep(true);
            assert(game.replayError === null, `Replay failed: ${game.replayError}`);
            assert(game.replayCursor === event.index + 1, 'Replay did not consume event');
            const actual = checkpoint(), { extensions, ...eventState } = actual;
            equal(eventState, fromEvent(event), 'Replay v4 event checkpoint/RNG mismatch');
            // v4 stores extension digests, not the complete extension state. Compare
            // the replayed world with the independent state captured during live play.
            exactCheckpoint(actual, checkpoints[event.index + 1], `Replay command ${event.index + 1} mismatch`);
        }
    };
    const walkNatural = (plan, checkpoints) => {
        for (let commands=0; commands<600 && game.depth<plan.naturalDepth && !game.isGameOver; commands++) {
            const grid=game.grid,key=p=>p.y*grid.width+p.x,target=game.levelSeeds[game.depth-1].downStairsLoc,start={...game.player.loc};
            const queue=[start],previous=new Map([[key(start),null]]);
            const valid=p=>{const c=grid.getCell(p.x,p.y);return c&&(c.isPassable||plan.routeTerrain.doors.includes(c.terrain))&&!c.layers.some(t=>plan.routeTerrain.hazards.includes(t));};
            for(let i=0;i<queue.length;i++){
                const p=queue[i];if(p.x===target.x&&p.y===target.y)break;
                for(const [dx,dy]of[[0,-1],[0,1],[-1,0],[1,0]]){const n={x:p.x+dx,y:p.y+dy};if(valid(n)&&!previous.has(key(n))){previous.set(key(n),p);queue.push(n);}}
            }
            assert(previous.has(key(target)),'No natural stair route');let at=target,next=target;
            while(previous.get(key(at))){next=at;at=previous.get(key(at));}
            if(grid.getCell(next.x,next.y).terrain===plan.routeTerrain.secret)command(checkpoints,'search');
            else if(next.x===game.player.x&&next.y===game.player.y)command(checkpoints,'stairs_down');
            else command(checkpoints,'move',{x:next.x-game.player.x,y:next.y-game.player.y});
        }
        assert(game.depth===plan.naturalDepth&&!game.isGameOver,'Natural play did not reach contribution depth');
        assert(game.monsters.some(m=>plan.forms.includes(m.typeId)),'No natural contributed creature');
    };
    const results = [];
    for (const plan of plans) {
        // With real combat telegraphs active, the blind stair route is a serialization
        // probe, not an AI that reads warnings; use the public wizard mode there (no HP edits).
        const naturalMode = plan.ids.includes('combat') ? 'wizard' : 'normal';
        const options = { seed: plan.naturalDepth ? 7306 : 7301, mode: plan.naturalDepth ? naturalMode : 'test', ruleSet: 'extended', extensions: plan.ids };
        // Observe command 0 before any creation command, then each creation state.
        // Also exercise the original atomic startup batch against that live history.
        game.startNewGame(options);
        game.animationEnabled = false;
        const checkpoints = [checkpoint()];
        for (const initial of plan.initialCommands) command(checkpoints, 'ext:command', initial);
        assert(checkpoints.length === plan.initialCommands.length + 1, 'Initial command was not recorded');
        game.startNewGame({ ...options, initialCommands: plan.initialCommands });
        game.animationEnabled = false;
        equal(game.extensionRuntime.manifest, plan.manifest, 'Startup manifest mismatch');
        equal(game.recordedInputEvents.map(event => event.data), plan.initialCommands, 'Incomplete or reordered initial batch');
        exactCheckpoint(checkpoint(), checkpoints[checkpoints.length - 1], 'Startup batch checkpoint mismatch');
        if(plan.naturalDepth)walkNatural(plan, checkpoints);
        play(checkpoints); play(checkpoints);
        // Saving/exporting adds a temporary full checkpoint to the last event.
        // Appending in v4 restores its original fullCheckpoint/chainDigest, so the
        // unsaved live events are the exact continuation-prefix oracle.
        const continuingPrefix = clone(game.recordedInputEvents), recordedCheckpoints = checkpoints.slice();
        const saved = clone(game.toSaveSnapshot()), expected = checkpoint(), recording = clone(game.exportRecording());
        assert(saved.run.recordingOrigin?.version === 2, 'Save lost recording v2 provenance');
        equal(Object.keys(saved.extensions.modules).sort(), [...plan.ids].sort(), 'Save module ownership mismatch');
        assert(game.loadSnapshot(saved), 'Save rejected');
        game.animationEnabled = false;
        exactCheckpoint(checkpoint(), expected, 'Load exact checkpoint/RNG mismatch');
        assert(game.hasCompleteRecording, 'Loaded save cannot continue recording');
        play(checkpoints);
        const continuation = clone(game.exportRecording()), continued = checkpoint();
        equal(continuation.events.slice(0, recording.events.length), continuingPrefix, 'Continuation rewrote history');
        assert(continuation.events.length === recording.events.length + 1, 'Continuation did not append');
        replay(recording, recordedCheckpoints);
        exactCheckpoint(checkpoint(), expected, 'Replay final mismatch');
        for (const index of [0, 1, recording.events.length]) {
            game.replaySeek(index);
            assert(game.replayError === null && game.replayCursor === index, 'Seek failed');
            exactCheckpoint(checkpoint(), recordedCheckpoints[index], `Seek ${index} exact checkpoint/RNG mismatch`);
        }
        replay(continuation, checkpoints);
        exactCheckpoint(checkpoint(), continued, 'Continuation replay mismatch');
        // Rejection must retain the old player, runtime and substantive/cosmetic RNG.
        const player = game.player, runtime = game.extensionRuntime, before = checkpoint();
        for (const id of unavailableIds) {
            const badSave = clone(saved), badRecording = clone(recording);
            const addMissing = manifest => { manifest.modules.push({ id, version: '1.0.0' }); manifest.modules.sort((a, b) => a.id.localeCompare(b.id)); };
            addMissing(badSave.extensions.manifest); addMissing(badRecording.extensions);
            assert(game.loadSnapshot(badSave) === false, `Missing ${id} save accepted`);
            assert(game.loadReplay(badRecording) === false, `Missing ${id} recording accepted`);
            assert(game.player === player && game.extensionRuntime === runtime, 'Failed input retired old run');
            exactCheckpoint(checkpoint(), before, 'Failed input changed checkpoint/RNG');
        }
        results.push({ modules: plan.ids, ...(plan.naturalDepth ? {naturalDepth:game.depth,naturalContributedBirth:true}:{}), events: recording.events.length, continuationEvents: continuation.events.length,
            exactCheckpoints: true, saveLoad: true, replaySeek: true, continuation: true, missingModuleRejected: unavailableIds });
    }
    return results;
}

try {
    sourceServer = await createServer({ configFile: false, root: process.cwd(), server: { middlewareMode: true, watch: null, hmr: false }, appType: 'custom' });
    const catalog = await sourceServer.ssrLoadModule('/src/ext/catalog.ts');
    const descriptors = catalog.getInstalledModuleDescriptors();
    report.installed = descriptors.map(descriptor => descriptor.id);
    const unavailable = [...new Set([...removed, 'composition-unavailable'])].filter(id => !report.installed.includes(id));
    const subsets = report.installed.reduce((sets, id) => [...sets, ...sets.map(set => [...set, id])], [[]]);
    const registry = catalog.createExtensionRegistry();
    const { TerrainType } = await sourceServer.ssrLoadModule('/src/engine/Map/Grid.ts');
    const plans = subsets.map(ids => {
        const manifest = registry.manifest(ids);
        const initialCommands = registry.create(manifest).flatMap(module => module.initialCommand
            ? [JSON.stringify({ module: module.id, ...module.initialCommand })] : []);
        const modules=registry.create(manifest),contributions=modules.flatMap(m=>m.generationContributions??[]);
        return { ids, manifest, initialCommands, naturalDepth:contributions.length?Math.min(...contributions.map(t=>t.minDepth)):null,
            forms:modules.flatMap(m=>m.nativeForms??[]).map(f=>f.id),routeTerrain:{doors:[TerrainType.DOOR,TerrainType.SECRET_DOOR],secret:TerrainType.SECRET_DOOR,hazards:[TerrainType.LAVA,TerrainType.WATER_DEEP,TerrainType.CHASM]} };
    });
    if (planOnly) report.plan = { status: 'planned-not-verified', combinations: plans, unavailable };
    else try {
        const { createHeadlessGame } = await sourceServer.ssrLoadModule('/src/test/harness.ts');
        report.engine = { status: 'passed', combinations: exerciseGame(createHeadlessGame(7301, 'test'), plans, unavailable) };
    }
    catch (error) { report.engine = { status: 'failed', error: String(error?.stack ?? error) }; }
    await sourceServer.close(); sourceServer = undefined;

    if (planOnly) report.browser = { status: 'not-run', reason: 'Explicit --plan: no Game or browser verification executed' };
    else if (engineOnly) report.browser = { status: 'not-run', reason: 'Explicit --engine-only: built-product browser validation is a separate required gate' };
    else try {
        if (!existsSync(resolve('dist/index.html'))) throw new Error('Fresh dist/index.html is required; run build first');
        const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
            ?? (process.platform === 'linux' && existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
        browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
        productServer = await preview({ configFile: false, root: process.cwd(), preview: { host: '127.0.0.1', port: 0, strictPort: false } });
        const address = productServer.httpServer.address();
        if (!address || typeof address === 'string') throw new Error('Built-product preview has no TCP address');
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(String(error)));
        await page.goto(`http://127.0.0.1:${address.port}`, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => !!window.activeGame, { timeout: 30000 });
        // activeGame is the existing product debug handle, not an added test-only app hook.
        const combinations = await page.evaluate(({ source, plans, unavailable }) => {
            const run = (0, eval)(`(${source})`);
            return run(window.activeGame, plans, unavailable);
        }, { source: exerciseGame.toString(), plans, unavailable });
        if (errors.length) throw new Error(`Built product page errors: ${errors.join('; ')}`);
        report.browser = { status: 'passed', engine: 'built dist JavaScript', combinations };
    } catch (error) { report.browser = { status: 'failed', error: String(error?.stack ?? error) }; }
} catch (error) {
    if (report.engine.status === 'not-run') report.engine = { status: 'failed', error: String(error?.stack ?? error) };
} finally {
    if (browser) await browser.close();
    if (productServer) await new Promise(resolveClose => productServer.httpServer.close(resolveClose));
    if (sourceServer) await sourceServer.close();
    report.passed = report.engine.status === 'passed' && report.browser.status === 'passed';
    report.requestedScopePassed = report.engine.status === 'passed' && (engineOnly || report.browser.status === 'passed');
    if (output) { mkdirSync(dirname(resolve(output)), { recursive: true }); writeFileSync(resolve(output), `${JSON.stringify(report, null, 2)}\n`); }
    console.log(JSON.stringify(report, null, 2));
    if (planOnly ? report.plan?.status !== 'planned-not-verified' : !report.requestedScopePassed) process.exitCode = 1;
}
