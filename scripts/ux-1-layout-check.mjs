/** Real page layout checks. Reduced CSS viewport sizes model desktop browser zoom's reflow;
 * they do not claim native browser chrome zoom was driven. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
const output = process.env.UX1_OUTPUT ?? '/tmp/broguejs-ux1-browser/layout';
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
const results = [], errors = [];
try {
  for (const touch of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, hasTouch: touch, isMobile: touch });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(process.env.UX1_URL ?? 'http://127.0.0.1:5393', { waitUntil: 'domcontentloaded' });
    await page.locator('input[inputmode="numeric"]').fill('27027');
    // Exercise the public setting rather than only changing a test fixture.
    const scaleSelect = page.locator('select').filter({ has: page.locator('option[value="1.25"]') });
    await scaleSelect.selectOption('1.25');
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize), '20px');
    await page.getByRole('button', { name: '新游戏', exact: true }).click();
    await page.waitForFunction(() => window.render_game_to_text && document.querySelector('canvas'));
    const initial = await page.evaluate(async () => {
      const g = window.activeGame;
      const { logger } = await import('/src/engine/Systems/Logger.ts');
      for (let i = 0; i < 35; i++) logger.log(`布局验收 ${i}：${'这是用于确认完整换行和滚动可达的长日志。'.repeat(4)}`);
      return { player: g.player, events: g.recordedInputEvents.length, rng: JSON.stringify(g.toSnapshot().rngState) };
    });
    const sizes = touch ? [[390,844],[844,390]] : [[1440,900],[1280,720],[1024,768],[1280,560],[1152,720],[960,600],[720,450]];
    for (const [width,height] of sizes) for (const scale of [.8,1,1.25,1.5]) {
      await page.setViewportSize({width,height});
      await page.evaluate(async scale => { (await import('/src/engine/Settings.ts')).displaySettings.uiScale = scale; }, scale);
      await page.waitForTimeout(150);
      if (!touch) assert.equal(await page.locator('.dpad').count(), 0);
      const compact = await page.locator('.mobile-hud').count() > 0;
      if (compact) await page.locator('.hud-tools button').click();
      // A long message may exceed the pane height: verify its final line can be
      // scrolled fully into view, rather than demanding the whole paragraph fit.
      for (const selector of ['.log-message:last-child', '.log-latest']) {
        const visible = await page.locator(selector).evaluate(element => {
          const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
          let last = null, next;
          while ((next = walker.nextNode())) if (next.textContent.trim()) last = next;
          const range = document.createRange();
          range.setStart(last, last.textContent.length - 1); range.setEnd(last, last.textContent.length);
          for (let parent = element.parentElement; parent; parent = parent.parentElement) {
            if (!/(auto|scroll)/.test(getComputedStyle(parent).overflowY)) continue;
            const r = range.getBoundingClientRect(), b = parent.getBoundingClientRect();
            if (r.bottom > b.bottom) parent.scrollTop += r.bottom - b.bottom + 2;
            if (r.top < b.top) parent.scrollTop -= b.top - r.top + 2;
          }
          const r = range.getBoundingClientRect();
          let fullyVisible = r.top >= 0 && r.bottom <= innerHeight;
          for (let parent = element.parentElement; parent; parent = parent.parentElement) {
            if (!/(auto|scroll|hidden)/.test(getComputedStyle(parent).overflowY)) continue;
            const b = parent.getBoundingClientRect();
            fullyVisible &&= r.top >= b.top - 1 && r.bottom <= b.bottom + 1;
          }
          return { fullyVisible, top:r.top, bottom:r.bottom };
        });
        assert.equal(visible.fullyVisible, true, `final line unreachable ${selector} ${width}x${height} ${scale}: ${JSON.stringify(visible)}`);
      }
      const bounds = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, events: window.activeGame.recordedInputEvents.length, rng: JSON.stringify(window.activeGame.toSnapshot().rngState) }));
      assert.equal(bounds.overflow,false); assert.equal(bounds.events,initial.events); assert.equal(bounds.rng,initial.rng);
      if (scale === 1.5) await page.screenshot({ path: `${output}/${touch?'touch':'fine'}-${width}x${height}-150.png` });
      if (compact) { await page.locator('.drawer-close').click(); await page.locator('.drawer-panel').waitFor({state:'hidden'}); }
      const canvas = await page.locator('canvas').boundingBox();
      assert.ok(canvas && canvas.width > 0 && canvas.height > 0);
      results.push({ touch,width,height,scale,compact });
    }
    await context.close();
  }
  assert.deepEqual(errors,[]);
  await fs.writeFile(`${output}/results.json`,JSON.stringify({results,errors},null,2));
  console.log(JSON.stringify({ cases:results.length,errors }));
} finally { await browser.close(); }
