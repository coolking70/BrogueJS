/** Real recording replay; raw evidence stays outside the repository.
 * node scripts/profile-late-depth.mjs replay.json /private/tmp/mainperf/before
 * PROFILE_FROM / PROFILE_TO: inclusive, one-based command range for inspector.
 * PROFILE_RANGES=11369:11369,13228:13228 for separate command profiles.
 * CAPTURE_AT writes a diagnostic snapshot; PROFILE_INTERVAL_US defaults to 1000.
 * LATE_P95_MS enforces every D22–D28 P95 on a complete, unprofiled replay.
 * LIMIT bounds an investigative prefix; SEQUENTIAL_LIGHTS=1 uses the original
 * per-source painting as a counterfactual, without touching replay validation.
 */
import { createServer } from 'vite';
import { Session } from 'node:inspector';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const [input, output] = process.argv.slice(2);
assert.ok(input && output, 'Supply recording and output prefix');
mkdirSync(dirname(output), { recursive: true });
const recording = JSON.parse(readFileSync(input, 'utf8'));
const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const stats = values => { const a = values.toSorted((a,b) => a-b); return { n:a.length, median:a[Math.floor(a.length/2)], p95:a[Math.ceil(a.length*.95)-1], max:a.at(-1), total:a.reduce((a,b)=>a+b,0) }; };
const session = new Session();
const post = (method, args = {}) => new Promise((resolve,reject) => session.post(method,args,(e,r)=>e?reject(e):resolve(r)));
try {
    await server.ssrLoadModule('/src/i18n.ts');
    const { Game } = await server.ssrLoadModule('/src/engine/Core/Game.ts');
    const { logger } = await server.ssrLoadModule('/src/engine/Systems/Logger.ts');
    if (process.env.SEQUENTIAL_LIGHTS) {
        const { LightMap } = await server.ssrLoadModule('/src/engine/Lighting/LightMap.ts');
        LightMap.prototype.paintLights = function(sources) { for (const source of sources) this.paintLight(source); };
    }
    const game = new Game();
    game.animationEnabled = !process.env.NO_ANIMATION;
    if (!process.env.NO_RENDER) game.onRenderRequested = () => {}; // Mounted vision preparation.
    assert.equal(game.loadReplay(recording), true);
    const ranges = process.env.PROFILE_RANGES?.split(',').map(range=>range.split(':').map(Number))
        ?? (process.env.PROFILE_FROM ? [[Number(process.env.PROFILE_FROM),Number(process.env.PROFILE_TO)]] : []);
    const limit = Math.min(Number(process.env.LIMIT) || recording.events.length,recording.events.length);
    if (ranges.length) { session.connect(); await post('Profiler.enable'); await post('Profiler.setSamplingInterval', {interval:Number(process.env.PROFILE_INTERVAL_US) || 1000}); }
    const rows = [], checkpoints = [];
    const start = performance.now();
    for (let i=0; i<limit; i++) {
        if (ranges.some(([from])=>i+1===from)) await post('Profiler.start');
        const depth = game.depth, turn = game.absoluteTurnNumber;
        const begin = performance.now();
        game.replayStep(true);
        while (game.isAdvancing) game.tickAdvancement(1000);
        const ms = performance.now()-begin;
        if (game.replayError) {
            writeFileSync(`${output}.oos.json`, JSON.stringify({error:game.replayError, event:recording.events[i], snapshot:game.toSnapshot()}, null, 2));
        }
        assert.equal(game.replayError, null);
        assert.equal(game.replayCursor, i+1);
        rows.push({command:i+1, depth, endDepth:game.depth, action:recording.events[i].action, ms, turns:game.absoluteTurnNumber-turn, monsters:game.monsters.length, messages:logger.messages.length});
        const range = ranges.find(([,to])=>i+1===to);
        if (range) { const {profile} = await post('Profiler.stop'); writeFileSync(`${output}${ranges.length>1?'.'+range.join('-'):''}.cpuprofile`, JSON.stringify(profile)); }
        if (i + 1 === Number(process.env.CAPTURE_AT)) {
            writeFileSync(`${output}.capture.json`, JSON.stringify(game.toSnapshot()));
        }
        if (depth !== game.depth || i === limit-1) {
            const snapshot = game.toSnapshot(); snapshot.savedAt = 0;
            checkpoints.push({command:i+1, depth:game.depth, hash:hash(snapshot), rng:snapshot.rngState});
            writeFileSync(`${output}.state.json`, JSON.stringify(snapshot));
        }
        if ((i+1)%500 === 0) console.log(JSON.stringify(rows.at(-1)));
    }
    const groups = field => Object.fromEntries([...new Set(rows.map(r=>r[field]))].map(key=>[key,stats(rows.filter(r=>r[field]===key).map(r=>r.ms))]));
    const summary = {node:process.version, seed:recording.seed, events:rows.length, recordingEvents:recording.events.length, sequentialLights:!!process.env.SEQUENTIAL_LIGHTS, elapsed:performance.now()-start, depth:groups('depth'), action:groups('action'), slowest:rows.toSorted((a,b)=>b.ms-a.ms).slice(0,30), checkpoints};
    writeFileSync(`${output}.rows.json`,JSON.stringify(rows));
    writeFileSync(`${output}.summary.json`,JSON.stringify(summary,null,2));
    console.log(JSON.stringify(summary,null,2));
    // Opt-in machine performance gate; never filter multi-turn actions or
    // transition commands out of the depth distributions to meet the budget.
    if (process.env.LATE_P95_MS) {
        assert.equal(ranges.length, 0, 'Do not enforce wall time under the CPU profiler');
        assert.equal(rows.length, recording.events.length, 'Performance gate requires the complete recording');
        assert.ok(!process.env.NO_ANIMATION && !process.env.NO_RENDER, 'Performance gate requires the mounted animation/vision path');
        for (let depth = 22; depth <= 28; depth++) {
            const measured = summary.depth[depth];
            assert.ok(measured, `Missing D${depth} samples`);
            assert.ok(measured.p95 <= Number(process.env.LATE_P95_MS),
                `D${depth} P95 ${measured.p95.toFixed(2)}ms exceeds ${process.env.LATE_P95_MS}ms`);
        }
    }
} finally { session.disconnect(); await server.close(); }
