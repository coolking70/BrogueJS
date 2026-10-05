import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** Product-specific real-runtime composition, alongside the existing real Game
 * matrix. No concrete module implementation imports and no browser test hooks. */
export async function shooterCompositionEngine(source, removed = []) {
    const api = await source.ssrLoadModule('/src/products/shooter/ShooterSession.ts');
    const catalog = await source.ssrLoadModule('/src/ext/realtimeCatalog.ts');
    const descriptors = catalog.getRealtimeModules();
    const {CampaignSession}=await source.ssrLoadModule('/src/products/shooter/CampaignSession.ts');
    const strategicDescriptors=catalog.getStrategicModules();
    const strategicSets=strategicDescriptors.reduce((sets,d)=>[...sets,...sets.map(s=>[...s,d])],[[]]);
    const strategic=[];
    for(const installed of strategicSets){const c=new CampaignSession(installed);const initial=c.snapshot();assert.deepEqual(CampaignSession.fromSnapshot(initial).snapshot(),initial);
        if(c.view().operation){c.execute({kind:'start',region:0,difficulty:0});const {ticket,setup}=c.deploy();
            const ids=descriptors.map(d=>d.id);if(descriptors.some(d=>d.kind==='mission')){const battle=new api.ShooterSession(ticket.seed,{modules:ids,setup});battle.advanceTick(inputFrame(1),[{tick:1,kind:'abort'}]);
                const restored=CampaignSession.fromSnapshot(c.snapshot());restored.settle(ticket,battle.snapshot().mission);assert.equal(restored.view().operation.status,'failed');assert.throws(()=>restored.settle(ticket,battle.snapshot().mission));}
        }
        for(const d of installed)assert.throws(()=>CampaignSession.fromSnapshot(initial,strategicDescriptors.filter(m=>m.id!==d.id)),/Missing/);
        strategic.push({modules:installed.map(d=>d.id),initial,restore:true,transactionAndContinuation:true,missingModuleRejected:true});
    }
    function inputFrame(tick){return {tick,moveX:0,moveY:0,aimAngle:0,buttons:0};}
    const installed = descriptors.map(d => d.id);
    const rangedIds = descriptors.filter(d => d.kind === 'ranged').map(d => d.id);
    const subsets = installed.reduce((sets, id) => [...sets, ...sets.map(set => [...set, id])], [[]]);
    const input = tick => ({ tick, moveX: tick % 80 < 40 ? 100 : -100, moveY: 20, aimAngle: tick * 11 % 4096, buttons: tick % 13 ? 1 : 0 });
    const unavailable = [...new Set([...removed, 'composition-unavailable'])].filter(id => !installed.includes(id));
    const cases = [];
    for (const ids of subsets) {
        const session = new api.ShooterSession(7301, { modules: ids });
        for (let tick = 1; tick <= 120; tick++) session.advanceTick(input(tick), ids.some(id => rangedIds.includes(id)) && tick === 1 ? [{ tick, kind: 'equip', slot: 1 }] : []);
        const checkpoint = JSON.parse(JSON.stringify(session.snapshot()));
        const restored = api.ShooterSession.fromSnapshot(checkpoint);
        for (let tick = 121; tick <= 160; tick++) { session.advanceTick(input(tick)); restored.advanceTick(input(tick)); }
        assert.equal(api.canonicalState(restored.snapshot()), api.canonicalState(session.snapshot()));
        assert.equal(api.canonicalState(api.replayShooter(restored.exportReplay()).snapshot()), api.canonicalState(session.snapshot()));
        for (const id of unavailable) {
            const bad = structuredClone(checkpoint);
            bad.modules = [{ id, version: '1.0.0', rules: { schema: 1, version: '1.0.0', fingerprint: `sha256:${'0'.repeat(64)}` } }]; bad.moduleStates = { [id]: {} };
            assert.throws(() => api.ShooterSession.fromSnapshot(bad), /Missing/);
            const replay = session.exportReplay(); replay.initial = bad; assert.throws(() => api.replayShooter(replay), /Missing/);
        }
        cases.push({ modules: ids, newPlay: true, checkpoint: true, replay: true, checkpointSeekContinuation: true, missingModuleRejected: unavailable });
    }
    return { api, installed, subsets, unavailable, cases, rangedIds,strategic };
}
export async function shooterCompositionBrowser(browser, url, engine) {
    const cases = [];
    for (const ids of engine.subsets) {
        const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
        const errors = []; page.on('pageerror', e => errors.push(String(e)));
        await page.goto(url, { waitUntil: 'networkidle' }); if(await page.getByTestId('training').count())await page.getByTestId('training').click(); await page.waitForSelector('canvas');
        await page.locator('.diagnostics summary').click();
        for (const id of engine.installed) await page.getByTestId(`module-${id}`).setChecked(ids.includes(id));
        await page.getByTestId('restart').click();
        assert.equal(Number(await page.getByTestId('tick').textContent()), 0);
        await page.getByTestId('toggle').click(); await page.keyboard.down('KeyD');
        await page.waitForFunction(() => Number(document.querySelector('[data-testid="tick"]').textContent) >= 8);
        await page.keyboard.up('KeyD');
        if (ids.some(id => engine.rangedIds.includes(id))) {
            await page.getByTestId('weapon-1').click();
            await page.getByTestId('movement-canvas').scrollIntoViewIfNeeded();
            const rect = await page.getByTestId('movement-canvas').boundingBox();
            await page.mouse.move(rect.x + rect.width * .8, rect.y + rect.height * .5); await page.mouse.down();
            await page.waitForFunction(() => Number(document.querySelector('[data-testid="shots"]').textContent) >= 2);
            await page.mouse.up();
        }
        await page.getByTestId('toggle').click(); await page.getByTestId('save').click();
        const checkpoint = JSON.parse(await page.evaluate(() => localStorage.getItem('broguejs-shooter-s6-checkpoint-v7')));
        assert.deepEqual(checkpoint.modules.map(m => m.id), ids); assert.notEqual(checkpoint.actors[0].pose.x, 5632);
        const download = page.waitForEvent('download'); await page.getByTestId('export').click();
        const replay = JSON.parse(readFileSync(await (await download).path(), 'utf8'));
        assert.equal(engine.api.canonicalState(engine.api.replayShooter(replay).snapshot()), engine.api.canonicalState(checkpoint));
        await page.getByTestId('step').click(); await page.getByTestId('load').click();
        assert.equal(Number(await page.getByTestId('tick').textContent()), checkpoint.tick);
        await page.getByTestId('step').click(); await page.getByTestId('verify').click();
        assert.match(await page.getByTestId('message').textContent(), /重放验证通过/);
        await page.locator('input[type=file]').setInputFiles({ name: 'composition-replay.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(replay)) });
        await page.waitForFunction(() => document.querySelector('[data-testid="message"]').textContent.includes('录像已验证'));
        assert.equal(Number(await page.getByTestId('tick').textContent()), checkpoint.tick);
        const bad = structuredClone(checkpoint), id = engine.unavailable[0];
        bad.modules = [{ id, version: '1.0.0', rules: { schema: 1, version: '1.0.0', fingerprint: `sha256:${'0'.repeat(64)}` } }]; bad.moduleStates = { [id]: {} };
        await page.evaluate(value => localStorage.setItem('broguejs-shooter-s6-checkpoint-v7', value), JSON.stringify(bad));
        await page.getByTestId('load').click(); assert.match(await page.getByTestId('message').textContent(), /Missing/);
        assert.equal(Number(await page.getByTestId('tick').textContent()), checkpoint.tick); assert.deepEqual(errors, []);
        cases.push({ modules: ids, builtUiPlay: true, checkpoint: true, replay: true, continuedRecording: true, import: true, missingModuleRejected: true, errors });
        await page.close();
    }
    return cases;
}
