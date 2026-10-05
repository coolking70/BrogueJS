#!/usr/bin/env node
/** Reproducible S1 engine benchmark + real built-product browser acceptance.
 * Screenshots/raw evidence belong outside the repository. No product test hooks.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import { createServer, preview } from 'vite';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const output = args.includes('--output') ? args[args.indexOf('--output') + 1] : '../shooter-s1-evidence';
const directory = resolve(output);
mkdirSync(directory, { recursive: true });
const report = { schema: 1, node: process.version, scenario: 'S1 continuous movement, Grid contact, two scheduler actors; 600 simulated seconds', engine: {}, browser: {} };
let source, server, browser;
try {
    source = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error',
        optimizeDeps: { noDiscovery: true, include: [] } });
    const { ShooterSession, replayShooter, canonicalState } = await source.ssrLoadModule('/src/products/shooter/ShooterSession.ts');
    const { SimulationHost } = await source.ssrLoadModule('/src/engine/Simulation/SimulationHost.ts');
    const { RealtimeSimulationDriver } = await source.ssrLoadModule('/src/engine/Simulation/RealtimeSimulationDriver.ts');
    const { SHOOTER_PROFILE } = await source.ssrLoadModule('/src/products/shooter/profile.ts');
    const frame = tick => {
        const [moveX, moveY] = [[127, 0], [0, 127], [-127, 0], [0, -127]][Math.floor((tick - 1) % 480 / 120)];
        return { tick, moveX, moveY, aimAngle: 0, buttons: tick % 47 === 1 ? 1 : 0 };
    };
    const session = new ShooterSession(7301), host = new SimulationHost(session), durations = [];
    for (let tick = 1; tick <= 18000; tick++) {
        const start = performance.now(); host.step(frame(tick)); durations.push(performance.now() - start);
    }
    durations.sort((a, b) => a - b);
    const expected = canonicalState(session.snapshot()), replay = session.exportReplay();
    assert.equal(canonicalState(replayShooter(JSON.parse(JSON.stringify(replay))).snapshot()), expected);
    const cadences = [];
    for (const fps of [30, 60, 144]) {
        const other = new ShooterSession(7301), otherHost = new SimulationHost(other);
        const driver = new RealtimeSimulationDriver(SHOOTER_PROFILE.simulation, () => otherHost.step(frame(otherHost.tick + 1)));
        driver.pump(0);
        let peakBacklog = 0;
        for (let i = 1; i <= fps * 600; i++) peakBacklog = Math.max(peakBacklog, driver.pump(Math.round(i * 1e6 / fps)).backlogTicks);
        assert.equal(canonicalState(other.snapshot()), expected); assert.equal(peakBacklog, 0);
        cadences.push({ fps, ticks: other.tick, peakBacklog, exactState: true });
    }
    report.engine = { status: 'passed', ticks: session.tick, replayBytes: Buffer.byteLength(JSON.stringify(replay)), cadences,
        tickCpuMs: Object.fromEntries([50, 95, 99].map(p => [`p${p}`, durations[Math.floor(durations.length * p / 100)]])) };
    await source.close(); source = undefined;
    if (args.includes('--engine-only')) report.browser = { status: 'not-run', reason: 'Explicit --engine-only' };
    else {
        const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
        browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}),
            args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
        server = await preview({ configFile: false, root: process.cwd(), logLevel: 'error', preview: { host: '127.0.0.1', port: 0 } });
        const url = `http://127.0.0.1:${server.httpServer.address().port}/shooter.html`;
        const checks = [];
        for (const size of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
            const page = await browser.newPage({ viewport: size, hasTouch: size.width < 600 });
            const errors = []; page.on('pageerror', error => errors.push(String(error)));
            await page.goto(url, { waitUntil: 'networkidle' });
            await page.waitForSelector('canvas');
            await page.waitForFunction(() => Number(document.querySelector('[data-testid="tick"]').textContent) > 3);
            const readPosition = async () => (await page.getByTestId('position').textContent()).match(/-?\d+/g).map(Number);
            const waitTicks = async count => {
                const at = Number(await page.getByTestId('tick').textContent());
                await page.waitForFunction(target => Number(document.querySelector('[data-testid="tick"]').textContent) >= target, at + count, { timeout: 20000 });
            };
            const initialPosition = await readPosition();
            const initialCamera = Number(await page.getByTestId('movement-canvas').getAttribute('data-camera-x'));
            if (size.width > 600) {
                await page.keyboard.down('KeyD'); await waitTicks(120); await page.keyboard.up('KeyD');
            } else {
                const stick = page.getByTestId('movement-stick'); await stick.scrollIntoViewIfNeeded();
                const rect = await stick.boundingBox();
                const cdp = await page.context().newCDPSession(page);
                const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
                await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
                await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 42, y }] });
                await waitTicks(90);
                await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
                await cdp.detach();
            }
            await waitTicks(2);
            const movedPosition = await readPosition();
            assert.ok(movedPosition[0] > initialPosition[0] + 2000, 'Movement did not traverse the arena');
            assert.ok(Number(await page.getByTestId('movement-canvas').getAttribute('data-camera-x')) < initialCamera, 'Camera did not follow the continuous pose');
            await waitTicks(4); assert.deepEqual(await readPosition(), movedPosition, 'Released input kept moving');
            if (size.width > 600) {
                // Synthetic standard-pad fixture exercises the actual navigator polling path.
                // This is not physical controller certification.
                await page.evaluate(() => {
                    window.__s1PadAxes = [0, 1];
                    Object.defineProperty(navigator, 'getGamepads', { configurable: true,
                        value: () => [{ connected: true, mapping: 'standard', axes: window.__s1PadAxes }] });
                });
                await waitTicks(20);
                await page.evaluate(() => { window.__s1PadAxes = [0, 0]; }); await waitTicks(2);
                const gamepadPosition = await readPosition();
                assert.ok(gamepadPosition[1] > movedPosition[1]);
                await waitTicks(4); assert.deepEqual(await readPosition(), gamepadPosition);
            }
            await page.getByTestId('toggle').click();
            const savedPosition = await readPosition();
            const before = Number(await page.getByTestId('tick').textContent());
            // Wait for actual presentation frames, not an assumed wall-time delay.
            await page.evaluate(() => new Promise(resolve => {
                let n = 0; const frame = () => ++n === 10 ? resolve() : requestAnimationFrame(frame); requestAnimationFrame(frame);
            }));
            assert.equal(Number(await page.getByTestId('tick').textContent()), before);
            await page.getByTestId('pulse').click(); await page.getByTestId('step').click();
            assert.equal(Number(await page.getByTestId('tick').textContent()), before + 1);
            await page.getByRole('button', { name: '保存检查点', exact: true }).click();
            await page.getByTestId('step').click();
            await page.getByRole('button', { name: '恢复检查点', exact: true }).click();
            assert.equal(Number(await page.getByTestId('tick').textContent()), before + 1);
            assert.deepEqual(await readPosition(), savedPosition);
            await page.getByTestId('step').click(); await page.getByTestId('verify').click();
            assert.match(await page.getByTestId('message').textContent(), /重放验证通过/);
            const downloaded = page.waitForEvent('download');
            await page.getByRole('button', { name: '导出录像', exact: true }).click();
            const file = await downloaded, destination = join(directory, `replay-${size.width}.json`);
            await file.saveAs(destination);
            await page.getByTestId('step').click();
            await page.locator('input[type=file]').setInputFiles(destination);
            await page.waitForFunction(() => document.querySelector('[data-testid="message"]').textContent.includes('录像已验证'));
            assert.equal(Number(await page.getByTestId('tick').textContent()), before + 2);
            assert.deepEqual(await readPosition(), savedPosition);
            await page.getByTestId('toggle').click(); await page.keyboard.down('KeyW'); await waitTicks(3);
            await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await page.keyboard.up('KeyW');
            const blurPosition = await readPosition(), blurTick = Number(await page.getByTestId('tick').textContent());
            await page.evaluate(() => new Promise(done => { let n = 0; const f = () => ++n === 10 ? done() : requestAnimationFrame(f); requestAnimationFrame(f); }));
            assert.equal(Number(await page.getByTestId('tick').textContent()), blurTick);
            await page.getByTestId('toggle').click(); await waitTicks(4);
            assert.deepEqual(await readPosition(), blurPosition, 'Focus loss retained keyboard movement');
            await page.getByTestId('toggle').click();
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            assert.deepEqual(errors, []);
            await page.screenshot({ path: join(directory, `shooter-${size.width}.png`), fullPage: true });
            checks.push({ viewport: size, movement: size.width > 600 ? 'keyboard + simulated standard gamepad' : 'CDP touch pointer', cameraFollow: true, releaseAndBlur: true, exactPositionRestore: true, pause: true, singleStep: true, checkpoint: true, replay: true, exportImport: true, pageErrors: errors });
            await page.close();
        }
        report.browser = { status: 'passed', checks };
    }
} catch (error) { report.error = String(error?.stack ?? error); process.exitCode = 1; }
finally {
    await browser?.close();
    if (server) await new Promise(done => server.httpServer.close(done));
    await source?.close();
    writeFileSync(join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
}
