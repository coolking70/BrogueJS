import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
const source=(file:string)=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
describe('Expedition workspace presentation contract',()=>{
 it('uses a shared horizontal HUD, separate context rail and bottom journal for every theme',()=>{
  const app=source('App.vue');
  expect(app.match(/<GameCanvas\b/g)).toHaveLength(1);
  expect(app).toContain('<MobileHud class="area-hud"');
  expect(app).toContain('<ContextPanel v-if="!compact && contextOpen"');
  expect(app).toContain('<MessageStrip class="area-strip"');
  expect(app).not.toContain('<Sidebar');
  expect(app).toContain('variant="journal"');
  expect(app).toContain("displaySettings.sidebarWidthMode === 'proportional'");
  expect(app).toContain("'--context-width': contextWidth");
  const css=source('assets/gameplay-layout.css');
  expect(css).toContain("'hud hud' 'map context' 'cmd context' 'strip strip'");
  expect(css).toContain("'hud hud' 'map map' 'strip strip' 'cmd pad'");
  expect(css).toContain(".replay-controls{position:relative;grid-area:cmd");
 });
 it('keeps every real command reachable while promoting essential actions',()=>{
  const s=source('components/CommandBar.vue');
  for(const action of ['search','search_long','wait','auto_rest','pickup','toggle_inventory','throw_item','auto_explore','travel_stairs','discoveries','help','escape'])expect(s).toContain(`action: '${action}'`);
  expect(s).toContain("'throw_item', 'escape'");
  expect(s).toContain('commands.filter(c => !primary.has(c.action))');
  expect(s).toContain('dispatch(action, data)');
  expect(s).not.toMatch(/activeGame\.|executeCommand/);
 });
 it('isolates drawer, comparison and overflow keys from game movement and supports Escape',()=>{
  for(const file of ['SideDrawer','UiLabToolbar','CommandBar']){
   const s=source(`components/${file}.vue`);
   expect(s,file).toContain('registerModalKeyHandler');
   expect(s,file).toContain("event.key === 'Escape'");
   expect(s,file).toContain('removeKeyboard?.()');
  }
  expect(source('components/CommandBar.vue')).toContain('document.activeElement as HTMLElement)?.blur()');
 });
 it('reads context only through the existing visibility-aware sidebar model',()=>{
  const s=source('components/ContextPanel.vue');
  expect(s).toContain('sidebarEntityRows(game.player, game.grid, game.monsters, game.items, game.hoveredCell, game.depth)');
  expect(s).not.toMatch(/executeCommand|executeItemCommand|rng\./);
  expect(source('components/MobileHud.vue')).toContain('stats.stealthRange');
 });
});
