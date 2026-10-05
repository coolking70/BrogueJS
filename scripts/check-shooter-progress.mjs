#!/usr/bin/env node
// S4 playtest feedback: engine-produced checkpoints and the built, ordinary UI.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createServer, preview } from 'vite';
import { chromium } from 'playwright';
import { missionPilot } from './shooter-mission-route.mjs';
const args = process.argv.slice(2), output = resolve(args.includes('--output') ? args[args.indexOf('--output') + 1] : '../shooter-progress-evidence');
mkdirSync(output, { recursive: true });
const report = { schema: 1, browser: [] }, checkpoints = {};
let source, server, browser;
try {
    source = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
    const api = await source.ssrLoadModule('/src/products/shooter/ShooterSession.ts');
    const arena = await source.ssrLoadModule('/src/products/shooter/ShooterArena.ts');
    const catalog = await source.ssrLoadModule('/src/ext/realtimeCatalog.ts');
    const scenario = catalog.getRealtimeModules().find(d => d.kind === 'mission').scenario;
    const session = new api.ShooterSession(7301, { modules: ['firearms', 'missions'] });
    const pilot = missionPilot(session, arena.createScenarioArena(scenario));
    while (!session.finished) {
        const state = session.snapshot();
        if (!checkpoints.scan && state.mission.activity?.kind === 'region' && state.mission.activity.progress >= 90) checkpoints.scan = state;
        if (!checkpoints.arrival && state.mission.extraction === 'inbound') checkpoints.arrival = state;
        if (state.mission.activity?.kind === 'boarding' && state.mission.activity.progress >= 150) { checkpoints.boarding = state; break; }
        const input = pilot(state); session.advanceTick(input.frame, input.commands);
    }
    assert.ok(checkpoints.boarding, 'Real mission route must reach boarding');
    const tick = (s, moveX = 0, buttons = 0, kinds = []) => s.advanceTick({ tick: s.tick + 1, moveX, moveY: 0, aimAngle: 0, buttons }, kinds.map(kind => ({ tick: s.tick + 1, kind })));
    const reloading = api.ShooterSession.fromSnapshot(checkpoints.scan);
    tick(reloading, 0, 1); for (let i = 0; i < 6; i++) tick(reloading);
    checkpoints.reloadReady = reloading.snapshot(); tick(reloading, 0, 0, ['reload']);
    for (let i = 0; i < 15; i++) tick(reloading);
    checkpoints.reload = reloading.snapshot(); assert.equal(checkpoints.reload.ranged.reloadTotal, 60);
    assert.ok(checkpoints.reload.ranged.reloadRemaining > 0);
    const remaining = checkpoints.reload.ranged.reloadRemaining;
    for (let i = 0; i < remaining; i++) tick(reloading);
    checkpoints.reloadComplete = reloading.snapshot(); assert.equal(checkpoints.reloadComplete.ranged.reloadRemaining, 0);
    const outside = api.ShooterSession.fromSnapshot(checkpoints.scan);
    for (let i = 0; i < 300 && !outside.snapshot().mission.activity.paused; i++) tick(outside, -127);
    checkpoints.scanOutside = outside.snapshot(); assert.equal(checkpoints.scanOutside.mission.activity.paused, true);
    const evac = api.ShooterSession.fromSnapshot(checkpoints.boarding);
    for (let i = 0; i < 300 && !evac.snapshot().mission.activity.paused; i++) tick(evac, 127);
    checkpoints.boardingOutside = evac.snapshot(); const retained = checkpoints.boardingOutside.mission.activity.progress;
    assert.equal(checkpoints.boardingOutside.mission.activity.paused, true);
    for (let i = 0; i < 60; i++) tick(evac);
    assert.equal(evac.snapshot().mission.activity.progress, retained);
    const restored = api.ShooterSession.fromSnapshot(evac.snapshot());
    for (let i = 0; i < 300 && restored.snapshot().mission.activity.paused; i++) tick(restored, -127);
    checkpoints.boardingResumed = restored.snapshot();
    assert.equal(checkpoints.boardingResumed.mission.activity.paused, false);
    assert.equal(checkpoints.boardingResumed.mission.activity.progress, retained + 1);
    assert.equal(api.canonicalState(api.replayShooter(restored.exportReplay()).snapshot()), api.canonicalState(restored.snapshot()));
    for (const [name, snapshot] of Object.entries(checkpoints)) {
        assert.equal(api.canonicalState(api.ShooterSession.fromSnapshot(snapshot).snapshot()), api.canonicalState(snapshot));
        writeFileSync(join(output, `${name}.json`), JSON.stringify(snapshot));
    }
    report.engine = { engineProducedCheckpoints: Object.keys(checkpoints), retainedBoardingTicks: retained, outsidePauseTicks: 60, exactRestoreAndReplay: true };
    server = await preview({ configFile: false, root: process.cwd(), logLevel: 'error', preview: { host: '127.0.0.1', port: 0 } });
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    for (const viewport of [{ width: 1440, height: 1100 }, { width: 390, height: 844 }]) {
        const page = await browser.newPage({ viewport, hasTouch: viewport.width < 600 }), errors = [];
        page.on('pageerror', e => errors.push(String(e)));
        await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/shooter.html`, { waitUntil: 'networkidle' });
        if(await page.getByTestId('training').count())await page.getByTestId('training').click(); await page.waitForSelector('canvas'); await page.locator('.diagnostics summary').click(); await page.getByTestId('save').click();
        const load = async name => {
            await page.evaluate(s => localStorage.setItem('broguejs-shooter-s6-checkpoint-v7', JSON.stringify(s)), checkpoints[name]);
            await page.getByTestId('load').click(); assert.match(await page.getByTestId('message').textContent(), /已恢复/);
            await page.getByTestId('movement-canvas').scrollIntoViewIfNeeded();
        };
        const verify = async (id, value, total) => {
            const row = page.getByTestId(id); await row.waitFor({ state: 'visible' });
            assert.deepEqual(await row.locator('progress').evaluate(el => [el.value, el.max]), [value, total]);
            const rect = await row.boundingBox(), canvas = await page.getByTestId('movement-canvas').boundingBox();
            assert.ok(rect.x >= canvas.x && rect.x + rect.width <= canvas.x + canvas.width && rect.y >= canvas.y && rect.y + rect.height < canvas.y + canvas.height / 2,
                `Readable bar must fit above the player, ${JSON.stringify({ rect, canvas })}`);
        };
        await load('reload');
        await verify('player-progress-reload', 60 - checkpoints.reload.ranged.reloadRemaining, 60);
        await verify('player-progress-region', checkpoints.reload.mission.activity.progress, 3600);
        await page.screenshot({ path: join(output, `two-bars-${viewport.width}.png`), fullPage: true });
        await page.setViewportSize({ width: viewport.width, height: viewport.height - 80 });
        await verify('player-progress-reload', 60 - checkpoints.reload.ranged.reloadRemaining, 60);
        await page.setViewportSize(viewport);
        for (const name of ['scanOutside', 'arrival', 'boardingOutside', 'boardingResumed']) {
            await load(name); const activity = checkpoints[name].mission.activity;
            await verify('player-progress-region', activity.progress, activity.total);
            assert.equal(await page.getByTestId('player-progress-region').getAttribute('data-kind'), activity.kind);
            if (name === 'boardingOutside') {
                assert.match(await page.getByTestId('extraction-status').textContent(), /累计.*已有进度保留/);
                await page.getByTestId('toggle').click();
                await page.waitForFunction(t => Number(document.querySelector('[data-testid="tick"]').textContent) > t + 15, checkpoints[name].tick);
                assert.match(await page.getByTestId('player-progress-region').textContent(), /暂停/);
                assert.equal(await page.getByTestId('player-progress-region').locator('progress').evaluate(el => el.value), activity.progress);
                await page.getByTestId('toggle').click();
            }
        }
        await page.screenshot({ path: join(output, `boarding-${viewport.width}.png`), fullPage: true });
        await load('reloadComplete'); assert.equal(await page.getByTestId('player-progress-reload').count(), 0);
        await load('reloadReady'); await page.getByTestId('toggle').click();
        if (viewport.width > 600) await page.keyboard.press('KeyR'); else await page.getByTestId('reload').tap();
        await page.getByTestId('player-progress-reload').waitFor({ state: 'visible' });
        await page.getByTestId('toggle').click();
        assert.equal(await page.getByTestId('player-progress-reload').count(), 1);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); assert.deepEqual(errors, []);
        report.browser.push({ viewport, simultaneousBars: true, nativeReloadInput: true, resize: true, regionPause: true, arrival: true, boardingPauseAndResume: true, completionHidesReload: true, noOverflow: true, errors });
        await page.close();
    }
    report.status = 'passed';
} catch (error) { report.status = 'failed'; report.error = String(error.stack ?? error); console.error(error); process.exitCode = 1; }
finally { writeFileSync(join(output, 'report.json'), JSON.stringify(report, null, 2)); await browser?.close(); await new Promise(r => server?.httpServer ? server.httpServer.close(r) : r()); await source?.close(); }
