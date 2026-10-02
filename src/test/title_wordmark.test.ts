import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createSSRApp } from 'vue';
import { renderToString } from '@vue/server-renderer';
import I18NextVue from 'i18next-vue';
import i18next from 'i18next';
import postcss from 'postcss';
import MainMenu from '../components/MainMenu.vue';
import { rng } from '../engine/Random';
import zhCN from '../locales/zh_CN.json';
import '../i18n';

// SSR renders the real menu template; only its browser keyboard adapter is
// replaced because Node has no window and no mounted input lifecycle.
vi.mock('../engine/Input', () => ({ inputManager: { registerModalKeyHandler: vi.fn() } }));

const originalRows = [
    '11110011110001110001111010001011111',
    '10001010001010001010000010001010000',
    '11110011110010001010011010001011110',
    '10001010010010001010001010001010000',
    '11110010001001110001111001110011111',
];
const props = { hasSave: false, hasReplay: false, inGame: false, saveInfo: null, replayInfo: null };
const source = readFileSync(new URL('../components/MainMenu.vue', import.meta.url), 'utf8');
const cssText = readFileSync(new URL('../assets/theme-shells.css', import.meta.url), 'utf8');
const css = postcss.parse(cssText);
function style(property: string) {
    let value: string | undefined;
    css.walkRules(rule => {
        if (rule.selectors.includes('html[data-ui-concept=glyph] .title-glyph')) {
            rule.walkDecls(property, d => { value = d.value; });
        }
    });
    return value;
}
async function render() {
    const random = rng.getState();
    const app = createSSRApp(MainMenu, props).use(I18NextVue, { i18next });
    const html = await renderToString(app);
    expect(rng.getState()).toEqual(random);
    return html;
}
function svg(html: string) {
    const markup = html.match(/<svg\b[^>]*class="title-glyph"[^>]*>[\s\S]*?<\/svg>/)?.[0];
    expect(markup, 'the production menu must render a vector wordmark').toBeDefined();
    return markup!;
}

describe('title wordmark vector and retired subtitle regressions', () => {
    it('renders the original 35×5 bitmap as 83 touching rects with integer shared grid edges', async () => {
        const html = await render(), mark = svg(html);
        expect(mark).toContain('viewBox="0 0 105 25"');
        expect(mark).toContain('width="105"');
        expect(mark).toContain('height="25"');
        expect(mark).toContain('shape-rendering="crispEdges"');
        expect(mark).toContain('preserveAspectRatio="xMidYMid meet"');
        expect(mark).toContain('aria-hidden="true"');
        expect(mark).toContain('fill="currentColor"');
        const pixels = [...mark.matchAll(/<rect\b([^>]*)>/g)].map(([, attrs]) => {
            const attribute = (name: string) => Number(attrs!.match(new RegExp(`\\b${name}="(\\d+)"`))?.[1]);
            return { x: attribute('x'), y: attribute('y'), w: attribute('width'), h: attribute('height') };
        });
        expect(pixels).toHaveLength(83);
        const rows = Array.from({ length: 5 }, () => Array<string>(35).fill('0'));
        for (const pixel of pixels) {
            expect([pixel.w, pixel.h]).toEqual([3, 5]);
            expect(pixel.x % 3).toBe(0); expect(pixel.y % 5).toBe(0);
            expect(pixel.x).toBeGreaterThanOrEqual(0); expect(pixel.x + pixel.w).toBeLessThanOrEqual(105);
            expect(pixel.y).toBeGreaterThanOrEqual(0); expect(pixel.y + pixel.h).toBeLessThanOrEqual(25);
            expect(rows[pixel.y / 5]![pixel.x / 3]).toBe('0'); // no duplicates
            rows[pixel.y / 5]![pixel.x / 3] = '1';
        }
        expect(rows.map(row => row.join(''))).toEqual(originalRows);
        expect(html).not.toMatch(/<pre\b|█/);
        expect(html).toMatch(/<h1[^>]*>BROGUE<\/h1>/);
    });

    it.each([[375, 812], [390, 844], [768, 1024], [1280, 800], [1920, 1080]])(
        'keeps a proportional vector grid within a %i×%i viewport without font metrics', async (width) => {
            const mark = svg(await render());
            expect(mark).toContain('viewBox="0 0 105 25"');
            const clamp = style('width')!.match(/^clamp\((\d+)px,([\d.]+)vw,(\d+)px\)$/)!;
            expect(clamp).not.toBeNull();
            const displayWidth = Math.max(Number(clamp[1]), Math.min(width * Number(clamp[2]) / 100, Number(clamp[3])));
            expect(displayWidth).toBeGreaterThanOrEqual(147);
            expect(displayWidth).toBeLessThanOrEqual(315);
            expect(displayWidth).toBeLessThan(width - 52);
            expect(style('max-width')).toBe('100%');
            expect(style('height')).toBe('auto');
            // Both neighbors project the same edge to CSS/device pixels at any
            // scale. No font advance or independent row line-height is involved.
            for (const dpr of [1, 2, 3]) for (let column = 0; column < 34; column++) {
                const right = (column * 3 + 3) * displayWidth / 105 * dpr;
                const nextLeft = (column + 1) * 3 * displayWidth / 105 * dpr;
                expect(right).toBe(nextLeft);
            }
            expect(style('font')).toBeUndefined(); expect(style('font-size')).toBeUndefined();
            expect(style('line-height')).toBeUndefined(); expect(style('letter-spacing')).toBeUndefined();
            expect(style('color')).toBe('var(--th-fg)');
            expect(style('filter')).toBe('drop-shadow(0 0 10px #e4dfd155)');
            expect(style('animation')).toBe('th-flicker 4.5s infinite steps(1)');
            expect(style('margin')).toBe('22px auto 0');
        },
    );

    it('removes both subtitles, the subpage theme badge, dead styles and active translation keys', async () => {
        expect(await render()).not.toMatch(/刻符|GLYPH CONSOLE|title-chapter|title-code|section-mark/);
        expect(source).not.toMatch(/chapterCode|\bchapter\b|title\.glyph(?:_code)?|title-chapter|title-code|section-mark/);
        expect(Object.keys(zhCN)).not.toContain('title.glyph');
        expect(Object.keys(zhCN)).not.toContain('title.glyph_code');
        const titleCss = readFileSync(new URL('../assets/title-screen.css', import.meta.url), 'utf8');
        expect(cssText + titleCss).not.toMatch(/\.title-chapter\b|\.title-code\b|\.section-mark\b/);
    });
});
