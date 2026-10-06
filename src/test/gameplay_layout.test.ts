import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
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
