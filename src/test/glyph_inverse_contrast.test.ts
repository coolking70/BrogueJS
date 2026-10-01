import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';

const css = postcss.parse(readFileSync(new URL('../assets/theme-shells.css', import.meta.url), 'utf8'));
function declaration(selector: string, property: string) {
    let result: postcss.Declaration | undefined;
    css.walkRules(rule => {
        if (rule.selectors.includes(selector)) rule.walkDecls(property, d => { result = d; });
    });
    return result;
}
const glyph = 'html[data-ui-concept=glyph]';
function luminance(hex: string) {
    const channels = hex.slice(1).match(/../g)!.map(c => parseInt(c, 16) / 255)
        .map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
    return channels[0]! * .2126 + channels[1]! * .7152 + channels[2]! * .0722;
}
function contrast(a: string, b: string) {
    const first = luminance(a), second = luminance(b);
    return (Math.max(first, second) + .05) / (Math.min(first, second) + .05);
}

describe('glyph inverse selection contrast', () => {
    const foreground = declaration(glyph, '--th-bg')!.value;
    const background = declaration(glyph, '--th-fg')!.value;
    it('uses an opaque light background and dark foreground with at least 4.5:1 contrast', () => {
        expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
        expect(declaration(`${glyph} .inventory-modal .selected-row`, 'background')?.value).toBe('var(--th-fg)');
        expect(declaration(`${glyph} .inventory-modal .selected-row`, 'color')?.value).toBe('var(--th-bg)');
    });

    it.each([
        '.inventory-modal .selected-row',
        '.theme-nearby .tn-row.focused',
        '.app-layout.theme-shell .cmd-btn:hover',
        '.app-layout.theme-shell .cmd-btn:focus-visible',
        '.inventory-modal .action-btn:hover',
        '.title-action.primary-action',
        '.title-action:hover',
    ])('%s overrides every descendant color, including inline colors and dimmed labels', selector => {
        const root = `${glyph} ${selector}`;
        // Keep the inverse pair together even when later hover/immersive rules
        // would otherwise restore a dark background or inherited light ink.
        expect(declaration(root, 'background')?.value).toBe('var(--th-fg)');
        expect(declaration(root, 'background')?.important).toBe(true);
        expect(declaration(root, 'color')?.value).toBe('var(--th-bg)');
        expect(declaration(root, 'color')?.important).toBe(true);
        const full = `${glyph} ${selector} *`;
        // Universal descendant coverage is intentional: item-name has a scoped
        // light color; sigils/glyphs/statuses can have arbitrary inline colors;
        // quantities and future annotations must inherit the same readable ink.
        expect(declaration(full, 'color')?.value).toBe('var(--th-bg)');
        expect(declaration(full, 'color')?.important).toBe(true);
        expect(declaration(full, 'opacity')?.value).toBe('1');
        expect(declaration(full, 'opacity')?.important).toBe(true);
        expect(declaration(full, 'text-shadow')?.value).toBe('none');
        expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
    });
});
