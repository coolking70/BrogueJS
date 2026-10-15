import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from '@vue/compiler-sfc';
import { beforeAll, describe, expect, it } from 'vitest';
import { renderLootUiPreview } from '../tools/preview/render';
import { LOOT_UI_PREVIEW_THEMES, LOOT_UI_PREVIEW_WIDTHS, LOOT_UI_STATES } from '../tools/preview/states';

let html: string;
let css: string;
beforeAll(async () => {
  const ui = path.resolve('src/ext/modules/loot/ui');
  const files = [...(await readdir(ui)).filter(file => file.endsWith('.vue')).sort().map(file => path.join(ui, file)), path.resolve('src/ext/modules/loot/tools/preview/LootUiGallery.vue')];
  css = (await Promise.all(files.map(async file => parse(await readFile(file, 'utf8'), { filename: file }).descriptor.styles.map(style => style.content).join('\n')))).join('\n');
  html = await renderLootUiPreview({ css });
  if (process.env.LOOT_UI_PREVIEW_OUT) {
    const out = path.resolve(process.env.LOOT_UI_PREVIEW_OUT);
    const relative = path.relative(process.cwd(), out);
    if (relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) throw new Error('LOOT_UI_PREVIEW_OUT must be outside the repository');
    await mkdir(out, { recursive: true });
    await writeFile(path.join(out, 'loot-ui-preview.html'), html, 'utf8');
  }
});

describe('loot UI self-contained SSR preview', () => {
  it('contains all 52 specified states exactly once', () => {
    expect(LOOT_UI_STATES).toHaveLength(52);
    expect(new Set(LOOT_UI_STATES.map(state => state.id)).size).toBe(52);
    for (const state of LOOT_UI_STATES) expect(html.split(`data-loot-state="${state.id}"`)).toHaveLength(2);
  });
  it('renders every state in both themes and all three container widths', () => {
    expect(html.match(/data-loot-frame=/g)).toHaveLength(52 * 6);
    for (const state of LOOT_UI_STATES) for (const theme of LOOT_UI_PREVIEW_THEMES) for (const width of LOOT_UI_PREVIEW_WIDTHS) {
      expect(html).toContain(`data-loot-frame="${state.id}:${theme}:${width}"`);
    }
    for (const width of LOOT_UI_PREVIEW_WIDTHS) expect(html.match(new RegExp(`data-loot-width="${width}"`, 'g'))).toHaveLength(52 * 2);
  });
  it('includes all SFC CSS inline, with no scripts, external links, or translation fallback keys', () => {
    expect(html).toContain(`<style>${css}</style>`);
    expect(html).not.toMatch(/<script|https?:\/\/|(?:src|href)\s*=/i);
    expect(html).not.toContain('ext.loot.');
    expect(html).not.toContain('runic.name.');
    expect(html).not.toMatch(/>[^<]*\bname\./);
  });
  it('renders meaningful post-interaction states without scripts', () => {
    const slice = (id: string) => html.split(`data-loot-state="${id}"`)[1]!.split('data-loot-state=')[0]!;
    expect(slice('card.folded')).toContain('aria-expanded="false"');
    expect(slice('card.unfolded')).toContain('aria-expanded="true"');
    expect(slice('filter.dirty').match(/<button\b(?=[^>]*data-rarity="rare")(?=[^>]*aria-checked="true")[^>]*>/g)).toHaveLength(6);
    const submitButtons = slice('filter.dirty').match(/<button\b(?=[^>]*data-action="submit")[^>]*>/g)!;
    expect(submitButtons).toHaveLength(6);
    expect(submitButtons.every(button => !button.includes('disabled'))).toBe(true);
    expect(slice('preset.keyboard').match(/<button\b(?=[^>]*data-preset="bountiful")(?=[^>]*aria-checked="true")[^>]*>/g)).toHaveLength(6);
  });
  it('is deterministic across independent translator/render instances', async () => {
    expect(await renderLootUiPreview({ css })).toBe(html);
  });
});
