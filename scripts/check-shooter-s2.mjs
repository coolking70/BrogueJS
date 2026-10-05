#!/usr/bin/env node
/** S2 combat benchmark and actual built-product keyboard/mouse, standard-pad
 * polling and two simultaneous CDP touch pointers. Physical feel is not certified. */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import { createServer, preview } from 'vite';
import { chromium } from 'playwright';
const args = process.argv.slice(2), directory = resolve(args.includes('--output') ? args[args.indexOf('--output') + 1] : '../shooter-s2-evidence');
mkdirSync(directory, { recursive: true });
const report = { schema: 2, node: process.version, scenario: 'S2: four weapons, six respawning enemies, moving/aimed combat for 600 simulated seconds', engine: {}, browser: {} };
let source, server, browser;
try {
    source = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
    const { ShooterSession, replayShooter, canonicalState } = await source.ssrLoadModule('/src/products/shooter/ShooterSession.ts');
    const { SimulationHost } = await source.ssrLoadModule('/src/engine/Simulation/SimulationHost.ts');
    const { RealtimeSimulationDriver } = await source.ssrLoadModule('/src/engine/Simulation/RealtimeSimulationDriver.ts');
    if (!args.includes('--browser-only')) {
        const session = new ShooterSession(7301, { modules: ['firearms'] }), durations = [];
        assert.ok(session.snapshot().ranged, 'S2 benchmark requires an installed ranged runtime');
        for (let tick = 1; tick <= 18000; tick++) {
            const state = session.snapshot(), player = state.actors[0], slot = Math.floor((tick - 1) / 300) % 4;
            const enemies = state.actors.slice(1).filter(a => state.damage.actors[a.id - 1].hp > 0).sort((a, b) =>
                (a.pose.x - player.pose.x) ** 2 + (a.pose.y - player.pose.y) ** 2 - ((b.pose.x - player.pose.x) ** 2 + (b.pose.y - player.pose.y) ** 2));
            const target = enemies[0], aimAngle = target ? (Math.round(Math.atan2(target.pose.y - player.pose.y, target.pose.x - player.pose.x) * 4096 / (Math.PI * 2)) + 4096) % 4096 : 0;
            const [moveX, moveY] = [[127, 0], [0, 127], [-127, 0], [0, -127]][Math.floor((tick - 1) % 480 / 120)], commands = [];
            if ((tick - 1) % 300 === 0) commands.push({ tick, kind: 'equip', slot });
            if (state.ranged.weapons[slot].ammo === 0 && !state.ranged.reloadRemaining) commands.push({ tick, kind: 'reload' });
            const start = performance.now();
            session.advanceTick({ tick, moveX, moveY, aimAngle, buttons: slot === 1 || tick % 12 !== 0 ? 1 : 0 }, commands);
            // Include detached production snapshot cost in the tick CPU budget.
            session.snapshot(); durations.push(performance.now() - start);
        }
        durations.sort((a, b) => a - b);
        const expected = canonicalState(session.snapshot()), replay = session.exportReplay(), cadences = [];
        assert.equal(canonicalState(replayShooter(JSON.parse(JSON.stringify(replay))).snapshot()), expected);
        for (const fps of [30, 60, 144]) {
            const other = ShooterSession.fromSnapshot(replay.initial); let cursor = 0;
            const host = new SimulationHost({ get tick() { return other.tick; }, snapshot: () => other.snapshot(), advanceTick: frame => {
                const commands = []; while (replay.commands[cursor]?.tick === frame.tick) commands.push(replay.commands[cursor++]); other.advanceTick(frame, commands);
            } });
            const driver = new RealtimeSimulationDriver({ id: 'shooter', ticksPerSecond: 30 }, () => host.step(replay.frames[host.tick]));
            driver.pump(0); let peakBacklog = 0;
            for (let f = 1; f <= fps * 600; f++) peakBacklog = Math.max(peakBacklog, driver.pump(Math.round(f * 1e6 / fps)).backlogTicks);
            assert.equal(canonicalState(other.snapshot()), expected); assert.equal(peakBacklog, 0); cadences.push({ fps, ticks: other.tick, peakBacklog, exactState: true });
        }
        const final = session.snapshot();
        report.engine = { status: 'passed', ticks: session.tick, stats: final.stats, shots: final.ranged.shots,
            weaponShots: final.moduleStates[final.modules[0].id].weapons.map((w, i) => ({ id: final.ranged.weapons[i].id, shots: w.shotSequence })),
            replayBytes: Buffer.byteLength(JSON.stringify(replay)), cadences,
            tickCpuMs: Object.fromEntries([50, 95, 99].map(p => [`p${p}`, durations[Math.floor(durations.length * p / 100)]])) };
        writeFileSync(join(directory, 'combat-replay.json'), JSON.stringify(replay));
    } else report.engine = { status: 'not-run', reason: 'Explicit --browser-only' };
    if (args.includes('--engine-only')) report.browser = { status: 'not-run', reason: 'Explicit --engine-only' };
    else {
        browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}),
            args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
        server = await preview({ configFile: false, root: process.cwd(), logLevel: 'error', preview: { host: '127.0.0.1', port: 0 } });
        const url = `http://127.0.0.1:${server.httpServer.address().port}/shooter.html`, checks = [];
        for (const viewport of [{ width: 1440, height: 1100 }, { width: 390, height: 844 }]) {
            const page = await browser.newPage({ viewport, hasTouch: viewport.width < 600 }), errors = [];
            page.on('pageerror', error => errors.push(String(error)));
            await page.goto(url, { waitUntil: 'networkidle' }); if(await page.getByTestId('training').count())await page.getByTestId('training').click(); await page.waitForSelector('canvas');
            await page.locator('summary').click();
            const hordeToggle = page.getByTestId('module-hordes'); if (await hordeToggle.count()) await hordeToggle.setChecked(false);
            await page.getByTestId('restart').click();
            const ticks = async n => { const at = Number(await page.getByTestId('tick').textContent()); await page.waitForFunction(t => Number(document.querySelector('[data-testid="tick"]').textContent) >= t, at + n, { timeout: 15000 }); };
            const position = async () => (await page.getByTestId('position').textContent()).match(/-?\d+/g).map(Number);
            const shots = async () => Number(await page.getByTestId('shots').textContent());
            await page.getByTestId('toggle').click(); await page.getByTestId('weapon-1').click(); await ticks(2);
            const before = await position();
            if (viewport.width > 600) {
                const rect = await page.getByTestId('movement-canvas').boundingBox();
                await page.mouse.move(rect.x + rect.width * .8, rect.y + rect.height * .5); await page.mouse.down();
                await page.keyboard.down('KeyS'); await ticks(35); await page.keyboard.up('KeyS'); await page.mouse.up();
                assert.ok((await position())[1] > before[1] + 1000); assert.ok(await shots() >= 8);
                // Actual navigator polling path with a synthetic standard controller.
                await page.evaluate(() => {
                    window.__s2Pad = { connected: true, mapping: 'standard', axes: [0, -1, 0, -1], buttons: Array.from({ length: 8 }, (_, i) => ({ pressed: i === 7, value: i === 7 ? 1 : 0 })) };
                    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [window.__s2Pad] });
                });
                const at = await shots(); await ticks(15); assert.ok(await shots() > at);
                await page.evaluate(() => { window.__s2Pad.connected = false; });
            } else {
                await page.locator('.twin-controls').scrollIntoViewIfNeeded();
                const left = await page.getByTestId('movement-stick').boundingBox(), right = await page.getByTestId('aim-stick').boundingBox();
                const cdp = await page.context().newCDPSession(page);
                const points = [{ id: 1, x: left.x + 64, y: left.y + 64 }, { id: 2, x: right.x + 64, y: right.y + 64 }];
                await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points });
                points[0].y += 42; points[1].x += 42;
                await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points }); await ticks(45);
                await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach();
                assert.ok((await position())[1] > before[1] + 1000); assert.ok(await shots() >= 10);
            }
            await ticks(2); const released = await shots(), releasePosition = await position(); await ticks(4);
            assert.equal(await shots(), released); assert.deepEqual(await position(), releasePosition);
            await page.getByTestId('reload').click(); await page.waitForFunction(() => document.querySelector('[data-testid="battle-status"]').textContent.includes('换弹中'));
            await ticks(4); await page.getByTestId('toggle').click(); await page.getByTestId('save').click();
            const checkpoint = JSON.parse(await page.evaluate(() => localStorage.getItem('broguejs-shooter-s6-checkpoint-v7')));
            assert.ok(checkpoint.ranged.reloadRemaining > 0); assert.ok(checkpoint.ranged.reloadRemaining < 60);
            const event = page.waitForEvent('download'); await page.getByTestId('export').click(); const download = await event;
            const destination = join(directory, `browser-replay-${viewport.width}.json`); await download.saveAs(destination);
            const recording = JSON.parse(readFileSync(destination, 'utf8')); assert.equal(canonicalState(replayShooter(recording).snapshot()), canonicalState(checkpoint));
            assert.ok(recording.frames.length > 30, 'Control history must survive until export');
            assert.ok(recording.frames.some(f => f.buttons === 1 && f.moveY === (viewport.width > 600 ? -127 : 127)
                && f.aimAngle === (viewport.width > 600 ? 3072 : 0)), 'Recorded controller/touch aim and movement were not accepted together');
            await page.getByTestId('step').click(); await page.getByTestId('load').click();
            assert.equal(Number(await page.getByTestId('tick').textContent()), checkpoint.tick);
            await page.getByTestId('verify').click(); assert.match(await page.getByTestId('message').textContent(), /重放验证通过/);
            await page.getByTestId('step').click(); await page.locator('input[type=file]').setInputFiles(destination);
            await page.waitForFunction(() => document.querySelector('[data-testid="message"]').textContent.includes('录像已验证'));
            assert.equal(Number(await page.getByTestId('tick').textContent()), checkpoint.tick);
            await page.getByTestId('toggle').click(); await page.keyboard.down('KeyW'); await ticks(3);
            await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await page.keyboard.up('KeyW');
            const atBlur = Number(await page.getByTestId('tick').textContent());
            await page.evaluate(() => new Promise(done => { let n = 0; const f = () => ++n === 8 ? done() : requestAnimationFrame(f); requestAnimationFrame(f); }));
            assert.equal(Number(await page.getByTestId('tick').textContent()), atBlur);
            const blurPosition = await position(); await page.getByTestId('toggle').click(); await ticks(4);
            assert.deepEqual(await position(), blurPosition); await page.getByTestId('toggle').click();
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); assert.deepEqual(errors, []);
            await page.screenshot({ path: join(directory, `shooter-${viewport.width}.png`), fullPage: true });
            checks.push({ viewport, controls: viewport.width > 600 ? 'keyboard + mouse + simulated standard gamepad' : 'two simultaneous CDP touch pointers',
                movingFire: true, release: true, midReloadRestore: true, exactReplay: true, importExport: true, blur: true, horizontalOverflow: false, errors });
            await page.close();
        }
        report.browser = { status: 'passed', checks, physicalDevices: 'not-tested' };
    }
} catch (error) { report.error = String(error?.stack ?? error); process.exitCode = 1; }
finally {
    await browser?.close(); if (server) await new Promise(done => server.httpServer.close(done)); await source?.close();
    writeFileSync(join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report, null, 2));
}
