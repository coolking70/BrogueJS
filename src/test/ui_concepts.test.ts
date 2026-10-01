import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
const source = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
afterEach(() => vi.unstubAllGlobals());
describe('DESIGN-3 fixed glyph interface', () => {
  it('ignores retired theme queries and always initializes the glyph CSS scope', async () => {
    const dataset: Record<string, string> = {};
    const replaceState = vi.fn();
    vi.stubGlobal('document', { documentElement: { dataset } });
    vi.stubGlobal('window', { location: { search: '?concept=umbra' }, history: { replaceState } });
    vi.resetModules();
    const module = await import('../ui/concept');
    expect(dataset.uiConcept).toBe('glyph');
    expect(Object.keys(module)).toEqual([]);
    expect(replaceState).not.toHaveBeenCalled();
  });
  it('removes switching UI, tools, retired theme CSS and bitmap assets', () => {
    for (const path of ['components/UiLabToolbar.vue', 'components/MobileHud.vue', 'components/MessageStrip.vue', 'components/theme/ThemeCodex.vue', 'components/theme/ThemeKit.vue', 'assets/ui-concepts.css']) {
      expect(existsSync(new URL('../' + path, import.meta.url)), path).toBe(false);
    }
    for (const path of ['App.vue', 'ui/concept.ts', 'assets/theme-shells.css', 'assets/gameplay-layout.css', 'components/MainMenu.vue']) {
      const text = source(path);
      expect(text).not.toMatch(/UiLabToolbar|registerConceptTool|select_ui_concept|--lab-h|data-ui-concept=(?:classic|tactical|immersive|umbra|ember|codex|zen|manual)/);
    }
    expect(existsSync(new URL('../../public/art', import.meta.url))).toBe(false);
    expect(source('components/MainMenu.vue')).toContain('<TitleFx v-if="!inGame" />');
  });
});
