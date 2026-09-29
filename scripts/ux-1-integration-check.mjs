/** Actual Vue/Pixi/Game integration; screenshots remain outside the repository. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const url = process.env.UX1_URL ?? 'http://127.0.0.1:5393';
const output = process.env.UX1_OUTPUT ?? '/tmp/broguejs-ux1-browser/integration';
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
const errors = [];
const results = {};
const observe = page => {
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', message => { if (message.type() === 'error' && !message.text().includes('ERR_CERT_AUTHORITY_INVALID')) errors.push(message.text()); });
    page.on('dialog', dialog => dialog.accept());
};
const button = (page, name) => page.getByRole('button', { name, exact: true });
async function start(page, seed = '27027') {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator('input[inputmode="numeric"]').fill(seed);
    await button(page, '新游戏').click();
    await page.waitForFunction(() => window.render_game_to_text && document.querySelector('canvas'));
    await page.waitForTimeout(350);
}
async function snapshot(page, name) {
    await page.screenshot({ path: path.join(output, `${name}.png`) });
    if (await page.evaluate(() => !!window.render_game_to_text)) {
        await fs.writeFile(path.join(output, `${name}.json`), await page.evaluate(() => window.render_game_to_text()));
    }
}

try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
    const page = await context.newPage(); observe(page);
    await start(page);
    assert.equal(await page.locator('.agent-controls').count(), 0);
    assert.equal(await page.locator('.dpad').count(), 0);
    assert.equal(await page.evaluate(() => localStorage.getItem('brogue-web-replay-v1')), null);
    const before = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
    await button(page, '放大地图').click();
    await page.waitForTimeout(100);
    const enlarged = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
    assert.ok(enlarged.mapLayout.scaleX > before.mapLayout.scaleX);
    assert.equal(enlarged.recordedInputEvents, before.recordedInputEvents);
    const box = await page.locator('canvas').boundingBox();
    const px = box.x + enlarged.mapLayout.offsetX + (enlarged.player.x + .5) * enlarged.mapLayout.tile * enlarged.mapLayout.scaleX;
    const py = box.y + enlarged.mapLayout.offsetY + (enlarged.player.y + .5) * enlarged.mapLayout.tile * enlarged.mapLayout.scaleY;
    await page.mouse.move(px, py);
    assert.deepEqual(await page.evaluate(() => window.activeGame.hoveredCell), { x: enlarged.player.x, y: enlarged.player.y });
    await snapshot(page, 'desktop-zoom-hover');
    await page.mouse.down(); await page.mouse.move(px + 70, py - 30, { steps: 5 }); await page.mouse.up();
    assert.equal(await page.evaluate(() => window.activeGame.recordedInputEvents.length), before.recordedInputEvents);
    await button(page, '适配全图').click();
    await button(page, '放大地图').click();
    const moveTarget = await page.evaluate(() => {
        const g = window.activeGame, p = g.player.loc;
        return [[0,-1],[1,0],[0,1],[-1,0]].map(([dx,dy]) => ({x:p.x+dx,y:p.y+dy}))
            .find(p => g.grid.getCell(p.x,p.y)?.isVisible && g.canMoveTo(p.x,p.y));
    });
    assert.ok(moveTarget);
    const clickCell = async target => {
        const view = await page.evaluate(() => JSON.parse(window.render_game_to_text()).mapLayout);
        const canvas = await page.locator('canvas').boundingBox();
        await page.mouse.click(canvas.x + view.offsetX + (target.x+.5)*view.tile*view.scaleX,
            canvas.y + view.offsetY + (target.y+.5)*view.tile*view.scaleY);
    };
    await clickCell(moveTarget);
    await page.waitForFunction(target => window.activeGame.player.loc.x === target.x && window.activeGame.player.loc.y === target.y, moveTarget);
    await page.waitForFunction(() => !window.activeGame.isAdvancing);
    // The initial dart stack gives a natural, independently replayable targeting check.
    await page.keyboard.press('i'); await page.locator('.inventory-overlay').waitFor();
    await page.keyboard.press('c'); await page.keyboard.press('t');
    await page.locator('.inventory-overlay').waitFor({state:'hidden'});
    assert.equal(await page.evaluate(() => window.activeGame.isThrowing), true);
    const throwTarget = {x:before.player.x,y:before.player.y};
    await clickCell(throwTarget);
    await page.waitForFunction(() => !window.activeGame.isAdvancing && !window.activeGame.isThrowing);
    const targetCommand = await page.evaluate(() => window.activeGame.recordedInputEvents.at(-1));
    assert.equal(targetCommand.action,'mouse_travel'); assert.deepEqual(targetCommand.data,throwTarget);
    results.zoomedTargeting = {moveTarget,throwTarget};
    await snapshot(page,'zoomed-throw');
    await page.keyboard.press('i');
    await page.locator('.inventory-overlay').waitFor();
    const countBeforeLetter = await page.evaluate(() => window.activeGame.recordedInputEvents.length);
    await page.keyboard.press('d');
    assert.ok((await page.locator('.selected-row .item-letter').textContent()).startsWith('d'));
    assert.equal(await page.evaluate(() => window.activeGame.inventoryAction), null);
    assert.equal(await page.evaluate(() => window.activeGame.recordedInputEvents.length), countBeforeLetter);
    await snapshot(page, 'inventory-letter');
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    await page.locator('.inventory-overlay').waitFor({ state: 'hidden' });
    await button(page, '菜单').click();
    await page.evaluate(() => { window.activeGame.disturbed = false; });
    await button(page, '保存录像').click();
    assert.equal(await page.evaluate(() => window.activeGame.disturbed), false);
    await page.waitForFunction(() => !!localStorage.getItem('brogue-web-replay-v1'));
    await button(page, '保存游戏').click();
    assert.equal(await page.evaluate(() => window.activeGame.disturbed), false);
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent === '继续游戏' && !b.disabled));
    await button(page, '继续游戏').click();
    await page.locator('.menu-overlay').waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => window.activeGame.disturbed), false);
    await page.keyboard.press('z');
    await page.waitForFunction(() => !window.activeGame.isAdvancing);
    assert.equal(await page.evaluate(() => window.activeGame.hasCompleteRecording), true);
    await button(page, '菜单').click();
    const downloaded = page.waitForEvent('download');
    await button(page, '导出本局 JSON').click();
    const download = await downloaded;
    const jsonPath = path.join(output, 'continued-run.json');
    await download.saveAs(jsonPath);
    const recording = JSON.parse(await fs.readFile(jsonPath, 'utf8'));
    const savedBeforeImport = await page.evaluate(() => localStorage.getItem('brogue-web-replay-v1'));
    await page.evaluate(() => {
        window.__ux1SetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function(key, value) {
            if (key === 'brogue-web-replay-v1') throw new DOMException('Quota test', 'QuotaExceededError');
            return window.__ux1SetItem.call(this, key, value);
        };
    });
    await button(page, '保存录像').click();
    await page.waitForFunction(() => document.querySelector('.recording-feedback')?.textContent.includes('JSON'));
    assert.equal(await page.evaluate(() => localStorage.getItem('brogue-web-replay-v1')), savedBeforeImport);
    const fallbackDownload = page.waitForEvent('download');
    await button(page, '导出本局 JSON').click();
    await (await fallbackDownload).saveAs(path.join(output, 'quota-fallback.json'));
    const fallback = JSON.parse(await fs.readFile(path.join(output, 'quota-fallback.json'), 'utf8'));
    // exportedAt metadata is the time of each explicit export; commands must match.
    assert.deepEqual({ ...fallback, recordedAt: 0 }, { ...recording, recordedAt: 0 });
    await page.evaluate(() => { Storage.prototype.setItem = window.__ux1SetItem; delete window.__ux1SetItem; });
    await page.locator('input[type="file"]').setInputFiles(jsonPath);
    await page.waitForFunction(() => !!window.activeGame.replayRecording);
    assert.equal(await page.evaluate(() => localStorage.getItem('brogue-web-replay-v1')), savedBeforeImport);
    const replay = await page.evaluate(total => {
        const g = window.activeGame; g.replaySeek(total);
        return { cursor: g.replayCursor, error: g.replayError };
    }, recording.events.length);
    assert.deepEqual(replay, { cursor: recording.events.length, error: null });
    results.recording = { events: recording.events.length, replay };
    await snapshot(page, 'continued-replay');

    // Fine-pointer compact desktop must not gain a direction pad on browser zoom/resize.
    await page.setViewportSize({ width: 844, height: 560 });
    assert.equal(await page.locator('.dpad').count(), 0);
    await snapshot(page, 'compact-desktop');
    await context.close();

    for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
        const mobile = await browser.newContext({ viewport, isMobile: true, hasTouch: true });
        const phone = await mobile.newPage(); observe(phone);
        await start(phone, '33008');
        const death = await phone.evaluate(async () => {
            const g = window.activeGame;
            const { Monster, MonsterState } = await import('/src/entities/Monster.ts');
            const { TerrainType } = await import('/src/engine/Map/Grid.ts');
            const monsters = (await import('/src/data/monsters.json')).default;
            const { logger } = await import('/src/engine/Systems/Logger.ts');
            g.monsters = []; g.dormantMonsters = []; g.items = [];
            for (let x = 8; x <= 12; x++) for (let y = 8; y <= 12; y++) g.grid.setTerrain(x, y, TerrainType.FLOOR);
            g.player.loc = { x: 10, y: 10 }; g.player.hp = 1; g.player.setStatusDuration('paralyzed', 50);
            const rat = new Monster(11, 10, monsters.find(m => m.id === 'rat'));
            rat.state = MonsterState.HUNTING; rat.ticksUntilTurn = 0; g.monsters.push(rat);
            logger.reset();
            g.executeCommand('wait'); g.update();
            // A held acknowledgment represents the presentation backlog, not a bypassed command.
            logger.log('麻痹死亡结算测试消息', '#fff', { acknowledge: true });
            return { over: g.isGameOver, advancing: g.isAdvancing, error: String(g.lastAdvancementError), end: g.recordedInputEvents[g.recordedInputEvents.length - 1]?.end };
        });
        assert.equal(death.over, true); assert.equal(death.advancing, false); assert.equal(death.error, 'null'); assert.ok(death.end);
        await phone.locator('.message-ack button').waitFor();
        assert.equal(await phone.locator('.game-end-overlay').count(), 0);
        while (await phone.locator('.message-ack button').count()) { await phone.locator('.message-ack button').tap(); await phone.waitForTimeout(80); }
        await phone.locator('.game-end-overlay').waitFor();
        await phone.locator('.save-replay-btn').tap();
        await phone.waitForFunction(() => !!localStorage.getItem('brogue-web-replay-v1'));
        const last = await phone.evaluate(() => JSON.parse(localStorage.getItem('brogue-web-replay-v1')).events.at(-1));
        assert.ok(last.end);
        await snapshot(phone, `death-${viewport.width}`);
        await phone.locator('.return-btn').tap();
        await phone.locator('.menu-overlay').waitFor();
        assert.equal(await button(phone, '保存录像').isVisible(), true);
        await button(phone, '保存录像').tap();
        await button(phone, '新游戏').tap();
        await phone.waitForFunction(() => window.activeGame && !window.activeGame.isGameOver && !!window.render_game_to_text);
        results[`death-${viewport.width}`] = death;
        await mobile.close();
    }
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ results, errors }, null, 2));
    console.log(JSON.stringify({ results, errors }));
} finally { await browser.close(); }
