/**
 * UX-1E: bounded browser profile of real Game commands and Pixi's render callback.
 *
 * Run while the untouched baseline and development Vite servers are available:
 *   node scripts/ux-1-render-profile.mjs
 * Override BASE_URL, DEV_URL, PROFILE_OUTPUT or PROFILE_SEEDS as needed.
 * Each seed starts on a generated D1. D2-D5 are then generated in sequence by
 * setting depth and calling generateDepth; these are naturally generated floors
 * reached by a synthetic transition, not a natural uninterrupted playthrough.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:5394';
const devUrl = process.env.DEV_URL ?? 'http://127.0.0.1:5393';
const output = process.env.PROFILE_OUTPUT ?? '/tmp/broguejs-ux1-render-profile.json';
const seeds = (process.env.PROFILE_SEEDS ?? '27027,33008').split(',').map(s => s.trim()).filter(Boolean);
const depths = [1, 3, 4, 5];
const commandsPerDepth = 6;

function hash(value) { return createHash('sha256').update(value).digest('hex'); }
function percentile(values, fraction) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}
function summary(values) {
    return { n: values.length, p50: percentile(values, .5), p95: percentile(values, .95), max: Math.max(0, ...values) };
}

const browser = await chromium.launch({ headless: true });
const errors = [];

async function profile(url, seed) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(`${url} seed=${seed}: ${error}`));
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.locator('input[inputmode="numeric"]').fill(seed);
        await page.getByRole('button', { name: '新游戏', exact: true }).click();
        await page.waitForFunction(() => window.activeGame && window.render_game_to_text && document.querySelector('canvas'));
        const samples = await page.evaluate(async ({ depths, commandsPerDepth }) => {
            const g = window.activeGame;
            const { rng } = await import('/src/engine/Random.ts');
            const { timeSystem } = await import('/src/engine/Systems/Time.ts');
            const { logger } = await import('/src/engine/Systems/Logger.ts');
            // Keep each actual command synchronous so the measurement interval is
            // command-to-next-frame, rather than animation scheduling latency.
            g.animationEnabled = false;
            const visionOriginal = g.updateVision;
            const renderOriginal = g.onRenderRequested;
            const measures = { visions: [], renders: [] };
            g.updateVision = function (...args) {
                const start = performance.now();
                try { return visionOriginal.apply(this, args); }
                finally { measures.visions.push(performance.now() - start); }
            };
            g.onRenderRequested = () => {
                const start = performance.now();
                try { return renderOriginal(); }
                finally { measures.renders.push(performance.now() - start); }
            };
            const cell = (x, y) => g.grid.getCell(x, y);
            const chooseMove = () => {
                const { x, y } = g.player.loc;
                for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                    const target = cell(x + dx, y + dy);
                    if (target?.isPassable && !g.monsters.some(m => m.loc.x === x + dx && m.loc.y === y + dy)) return { x: dx, y: dy };
                }
                return null;
            };
            const fingerprint = () => {
                const map = [];
                for (let y = 0; y < 29; y++) for (let x = 0; x < 79; x++) {
                    const c = cell(x, y);
                    map.push(c?.layers?.join(',') ?? '');
                }
                return {
                    depth: g.depth,
                    player: { x: g.player.loc.x, y: g.player.loc.y, hp: g.player.hp, turn: g.absoluteTurnNumber },
                    monsters: g.monsters.map(m => [m.id, m.loc.x, m.loc.y, m.hp]).sort((a,b) => String(a[0]).localeCompare(String(b[0]))),
                    map,
                    rng: rng.getState(),
                    tick: timeSystem.currentTick,
                };
            };
            const result = [];
            for (let depth = 1; depth <= Math.max(...depths); depth++) {
                if (depth > 1) {
                    g.depth = depth;
                    g.generateDepth(false, false);
                    g.update();
                }
                if (!depths.includes(depth)) continue;
                // Survival fixture, identical on both versions; generated monsters
                // and terrain remain intact, and the player still takes real turns.
                g.player.hp = g.player.maxHp = 10000;
                const before = fingerprint();
                const commands = [];
                for (let i = 0; i < commandsPerDepth; i++) {
                    while (logger.pendingAcknowledgment) logger.acknowledgeNext();
                    measures.visions.length = 0;
                    measures.renders.length = 0;
                    const move = i === 1 || i === 2 ? chooseMove() : null;
                    const action = move ? 'move' : 'wait';
                    const turnBefore = g.absoluteTurnNumber;
                    const start = performance.now();
                    g.executeCommand(action, move ?? undefined);
                    g.update();
                    const commandMs = performance.now() - start;
                    const nextFrameMs = await new Promise(resolve => requestAnimationFrame(() => resolve(performance.now() - start)));
                    commands.push({ action, turnBefore, turnAfter: g.absoluteTurnNumber,
                        gameOver: g.isGameOver, advancing: g.isAdvancing, paused: g.isTimePaused(),
                        commandMs, nextFrameMs, visionCount: measures.visions.length,
                        visionMs: measures.visions.reduce((a, b) => a + b, 0),
                        renderCount: measures.renders.length,
                        renderMs: measures.renders.reduce((a, b) => a + b, 0) });
                }
                result.push({ depth, before, after: fingerprint(), commands });
            }
            g.updateVision = visionOriginal;
            g.onRenderRequested = renderOriginal;
            return result;
        }, { depths, commandsPerDepth });
        return samples.map(row => ({
            depth: row.depth,
            beforeHash: hash(JSON.stringify({ ...row.before, rng: undefined })),
            afterHash: hash(JSON.stringify({ ...row.after, rng: undefined })),
            before: { player: row.before.player, tick: row.before.tick, rng: row.before.rng },
            after: { player: row.after.player, tick: row.after.tick, rng: row.after.rng },
            commands: row.commands,
            summary: {
                commandMs: summary(row.commands.map(c => c.commandMs)),
                nextFrameMs: summary(row.commands.map(c => c.nextFrameMs)),
                visionMs: summary(row.commands.map(c => c.visionMs)),
                renderMs: summary(row.commands.map(c => c.renderMs)),
                visionCalls: row.commands.reduce((a,c) => a + c.visionCount, 0),
                renderCalls: row.commands.reduce((a,c) => a + c.renderCount, 0),
            },
        }));
    } finally { await context.close(); }
}

try {
    const results = { generatedAt: new Date().toISOString(), method: 'generated floors with synthetic depth entry, six real commands per sampled floor',
        urls: { baseline: baseUrl, development: devUrl }, seeds, samples: {}, errors };
    for (const seed of seeds) {
        results.samples[seed] = { baseline: await profile(baseUrl, seed), development: await profile(devUrl, seed) };
        console.log(`profiled seed ${seed}`);
    }
    const mismatches = [];
    for (const seed of seeds) for (const [index, depth] of depths.entries()) {
        const a = results.samples[seed].baseline[index];
        const b = results.samples[seed].development[index];
        if (a.beforeHash !== b.beforeHash || a.afterHash !== b.afterHash
            || JSON.stringify(a.before.rng) !== JSON.stringify(b.before.rng)
            || JSON.stringify(a.after.rng) !== JSON.stringify(b.after.rng)) mismatches.push({ seed, depth });
    }
    results.mismatches = mismatches;
    results.summary = Object.fromEntries(['baseline', 'development'].map(version => {
        const commands = seeds.flatMap(seed => results.samples[seed][version].flatMap(row => row.commands));
        return [version, {
            commandMs: summary(commands.map(row => row.commandMs)),
            nextFrameMs: summary(commands.map(row => row.nextFrameMs)),
            visionMs: summary(commands.map(row => row.visionMs)),
            renderMs: summary(commands.map(row => row.renderMs)),
            visionCalls: commands.reduce((total, row) => total + row.visionCount, 0),
            renderCalls: commands.reduce((total, row) => total + row.renderCount, 0),
        }];
    }));
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, JSON.stringify(results, null, 2));
    assert.deepEqual(errors, [], 'browser errors');
    assert.deepEqual(mismatches, [], 'world/RNG mismatch');
    console.log(JSON.stringify({ output, mismatches, summary: results.summary }));
} finally { await browser.close(); }
