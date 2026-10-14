import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse, compileStyle } from '@vue/compiler-sfc';
import { parse as parseCss } from 'postcss';
import { computeLayoutMode } from '../ui/layout';
const source=(file:string)=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
describe('Expedition workspace presentation contract',()=>{
 it('keeps one canvas across glyph and immersive layouts with responsive panels and a replay row',()=>{
  const app=source('App.vue');
  expect(app.match(/<GameCanvas\b/g)).toHaveLength(1);
  expect(app).toContain('<ThemeHud class="area-vitals"');
  expect(app).toContain('<ThemeNearby class="area-near"');
  expect(app).toContain('<ThemeLog class="area-log"');
  expect(app).toContain('<ContextPanel v-if="!compact && themePanelOpen && !displaySettings.immersiveMode"');
  expect(app).not.toContain('<Sidebar');
  expect(app).toContain('variant="journal"');
  expect(app).toContain("displaySettings.sidebarWidthMode === 'proportional'");
  expect(app).toContain("'--context-width': contextWidth");
  expect(app).toContain('v-if="displaySettings.immersiveMode && !replayActive"');
  const css=source('assets/theme-shells.css');
  for(const mode of ['desktop','portrait','landscape']) expect(css).toContain(`.layout-${mode}`);
  expect(css).toContain("grid-template-areas:'vitals' 'map' 'log'");
  expect(css).toContain("grid-template-areas:'vitals' 'map' 'log' 'cmd'");
  expect(css).not.toContain('--lab-h');
  expect(source('assets/gameplay-layout.css')).toContain('.replay-controls{position:relative;grid-area:cmd');
 });
 it('keeps every real command reachable while promoting essential actions',()=>{
  const s=source('components/CommandBar.vue');
  for(const action of ['search','search_long','wait','auto_rest','pickup','toggle_inventory','throw_item','auto_explore','travel_stairs','discoveries','help','escape'])expect(s).toContain(`action: '${action}'`);
  expect(s).toContain("'throw_item', 'escape'");
  expect(s).toContain('commands.filter(c => (primary.has(c.action) || props.moduleCommands?.some(entry => entry.id === c.action)))');
  expect(s).toContain('commands.filter(c => !(primary.has(c.action) || props.moduleCommands?.some(entry => entry.id === c.action)))');
  expect(s).toContain('dispatch(action, data)');
  expect(s).not.toMatch(/activeGame\.|executeCommand/);
 });
 it('isolates drawer and overflow keys from game movement and supports Escape',()=>{
  for(const file of ['SideDrawer','CommandBar']){
   const s=source(`components/${file}.vue`);
   expect(s,file).toContain('registerModalKeyHandler');
   expect(s,file).toContain("event.key === 'Escape'");
   expect(s,file).toContain('removeKeyboard?.()');
  }
  expect(source('components/CommandBar.vue')).toContain('document.activeElement as HTMLElement)?.blur()');
 });
 it('reads context only through the existing visibility-aware sidebar model',()=>{
  const s=source('components/ContextPanel.vue');
  // 4d groups add a visibility-aware adapter; the original model still owns entity rows.
  expect(s).toContain('displayedFrame(game)?.rows ?? publicSidebarEntityRows(game)');
  expect(source('engine/UI/MonsterGroups.ts')).toContain('sidebarEntityRows(game.player, game.grid, game.monsters, game.items, game.hoveredCell, game.depth)');
  expect(s).not.toMatch(/executeCommand|executeItemCommand|rng\./);
  expect(source('components/theme/ThemeHud.vue')).toContain('stats.stealthRange');
 });
});

describe('seven-module compact map budget', () => {
 const { descriptor } = parse(source('App.vue'));
 const css = parseCss(descriptor.styles.map(style => compileStyle({
  source: style.content, filename: 'App.vue', id: 'data-v-layout-test', scoped: true,
 }).code).join('\n') + '\n' + source('assets/gameplay-layout.css'));
 const portrait = 'html[data-ui-concept=glyph] .app-layout.theme-shell.layout-portrait.has-module-bars:not(.immersive-mode)';
 const declaration = (selector: string, property: string) => {
  let result: string | undefined;
  css.walkRules(rule => {
   if (rule.selectors.includes(selector)) rule.walkDecls(property, d => { result = d.value; });
  });
  return result;
 };
 it.each([[390,844],[320,844],[800,991],[1440,900]])('reserves map space at %i×%i without changing desktop tracks', (width,height) => {
  const mode = computeLayoutMode(width!,height!);
  if (mode === 'desktop') {
   expect(declaration(portrait.replace('layout-portrait','layout-desktop'),'grid-template-rows'))
    .toBe('auto auto minmax(0,1fr) auto auto');
   return;
  }
  expect(mode).toBe('portrait');
  const tracks = declaration(portrait,'grid-template-rows')!;
  expect(tracks).toBe('fit-content(22%) fit-content(10%) minmax(40%,1fr) fit-content(10%) fit-content(18%)');
  const caps = [...tracks.matchAll(/fit-content\((\d+)%\)/g)].map(m => Number(m[1])/100);
  // Even arbitrarily tall module content must fit these four track caps. The
  // compiled production CSS, not module counts/text lengths, defines the budget.
  const reserved = height! * (Number(/minmax\((\d+)%/.exec(tracks)![1])/100);
  expect(height! - caps.reduce((sum,cap)=>sum+height!*cap,0)).toBeCloseTo(reserved);
  expect(reserved).toBeGreaterThanOrEqual(height!*0.4);
  for (const area of ['vitals','log','skills','cmd','pad']) {
   expect(declaration(`${portrait} > .area-${area}`,'min-height')).toBe('0');
   expect(declaration(`${portrait} > .area-${area}`,'overflow')).toBe('auto');
  }
 });
 it('keeps secondary bars and every command reachable by scrolling', () => {
  expect(declaration(`${portrait} > .area-skills`,'display')).toBe('flex');
  expect(declaration(`${portrait} > .area-skills > *`,'flex')).toBe('0 0 100%');
  expect(declaration(`${portrait} > .area-cmd`,'display')).toBe('flex');
  expect(declaration(`${portrait} > .area-cmd > .cmd-btn`,'min-height')).toBe('44px');
  expect(declaration(`${portrait} > .area-cmd > .cmd-btn`,'flex')).toBe('0 0 auto');
 });
});
