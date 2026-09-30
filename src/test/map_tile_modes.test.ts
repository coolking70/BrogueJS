import { normalizeMapGlyph } from '../ui/mapGlyph';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Cell, TerrainType, DungeonLayer } from '../engine/Map/Grid';
import { TERRAIN_APPEARANCES } from '../engine/UI/TerrainAppearanceCatalog';
import { cellAppearance, HALLUCINATION_CHARS } from '../engine/UI/Appearance';
import { ItemCategory } from '../engine/Items/Item';
import monsters from '../data/monsters.json';
import { mapText, terrainSemantic, itemSemantic, monsterSemantic, rememberedItemSemantic, glyphSemantic, playerSemantic, projectileSemantic, floatingHanzi } from '../ui/mapTileSemantics';
import { paintVectorTile, paintMapText, mapInk } from '../ui/mapTileDrawing';
import { mapMode, selectMapMode } from '../ui/mapTiles';
import { concept } from '../ui/concept';
const han = /^\p{Script=Han}$/u;
const ctx = {gas:undefined,lightChannels:{r:100,g:100,b:100},groundItem:null,carriedItem:null,hallucinating:false,cosmetic:{percent:()=>false,pick:<T>(a:readonly T[])=>a[0]!}};
const visible = (type:TerrainType) => {const c=new Cell(1,2);c.layers=[type,TerrainType.NOTHING,TerrainType.NOTHING,TerrainType.NOTHING];c.isVisible=true;c.isExplored=true;return c;};
const rendered = (c:Cell,hall=false) => {const v=cellAppearance(c,{...ctx,hallucinating:hall});return v ? terrainSemantic(c,v,hall) : null;};
describe('Independent map renderer catalog and knowledge boundaries',()=>{
 it('covers every terrain identity, every species, and every item category',()=>{
  const ids=Object.values(TerrainType).filter(x=>typeof x==='number') as TerrainType[];
  expect(ids.length).toBe(214);expect(Object.keys(mapText.terrain).length).toBe(214);
  for(const id of ids) expect(mapText.terrain[TerrainType[id] as keyof typeof mapText.terrain],TerrainType[id]).toMatch(han);
  expect(monsters.length).toBe(67);
  for(const m of monsters) expect(monsterSemantic({typeId:m.id,char:m.char},m.char).hanzi,m.id).toMatch(han);
  for(const id of Object.values(ItemCategory).filter(v=>typeof v==='number') as ItemCategory[]) expect(itemSemantic({category:id,char:'!'},'!').hanzi).toMatch(han);
 });
 it('converts every drawable terrain to exactly one Hanzi, preserving intentionally blank tiles',()=>{
  for(const id of Object.values(TerrainType).filter(x=>typeof x==='number') as TerrainType[]){
   const c=visible(id), v=TERRAIN_APPEARANCES[id];
   const glyph=terrainSemantic(c,v).hanzi;
   expect(glyph, TerrainType[id]).toMatch(v.char.trim() ? han : /^$/);
  }
 });
 it('never reveals unexplored cells and preserves remote magic markers without exposing terrain',()=>{
  const c=new Cell(1,2);c.terrain=TerrainType.SECRET_DOOR;
  expect(rendered(c)).toBeNull();
  for(const [char,expected] of [['⧳','吉'],['⧲','凶'],['♀','坠']]) expect(terrainSemantic(c,{char:char!,color:'#ffffff',bgColor:null}).hanzi).toBe(expected);
 });
 it('keeps all wall and floor secrets disguised in direct view and memory',()=>{
  const walls=['SECRET_DOOR','WORM_TUNNEL_OUTER_WALL','WALL_LEVER_HIDDEN','WALL_MONSTER_DORMANT','RAT_TRAP_WALL_DORMANT','TURRET_DORMANT','WALL_LEVER_HIDDEN_DORMANT'];
  const floors=['TRAP_DOOR_HIDDEN','GAS_TRAP_PARALYSIS_HIDDEN','MACHINE_PARALYSIS_VENT_HIDDEN','MACHINE_METHANE_VENT_HIDDEN','AMULET_SWITCH','MACHINE_TRIGGER_FLOOR','MACHINE_POISON_GAS_VENT_HIDDEN','PORTCULLIS_DORMANT','FLAMETHROWER_HIDDEN','GAS_TRAP_POISON_HIDDEN','FLOOR_FLOODABLE','DARK_FLOOR_DORMANT','MACHINE_COLLAPSE_EDGE_DORMANT','DARK_FLOOR_DARKENING','DARK_FLOOR','NET_TRAP_HIDDEN','ALARM_TRAP_HIDDEN','GAS_TRAP_CONFUSION_HIDDEN','FLOOD_TRAP_HIDDEN','DEEP_WATER_ALGAE_WELL'];
  for(const [names,expected] of [[walls,'墙'],[floors,'地']] as const) for(const name of names){
   const c=visible(TerrainType[name as keyof typeof TerrainType]);expect(rendered(c)?.hanzi,name).toBe(expected);
   c.rememberedLayers=[...c.layers];c.isVisible=false;c.hasMemory=true;expect(rendered(c)?.hanzi,name+' memory').toBe(expected);
  }
 });
 it('uses remembered layers after the live world changes, never live hidden identity',()=>{
  const c=visible(TerrainType.FLOOR);c.rememberedLayers=[...c.layers];c.isVisible=false;c.hasMemory=true;
  c.layers[0]=TerrainType.LAVA;expect(rendered(c)?.hanzi).toBe('地');
  c.rememberedLayers=[];expect(terrainSemantic(c,{char:'·',color:'#333333',bgColor:null}).hanzi).toBe('地');
 });
 it('follows transparent glyph inheritance and skips modern gas glyphs',()=>{
  const c=visible(TerrainType.FLOOR);c.layers[DungeonLayer.SURFACE]=TerrainType.GUARDIAN_GLOW;
  expect(rendered(c)?.hanzi).toBe('地');c.layers[DungeonLayer.GAS]=TerrainType.POISON_GAS;expect(rendered(c)?.hanzi).toBe('地');
  c.layers[DungeonLayer.LIQUID]=TerrainType.WATER_SHALLOW;expect(rendered(c)?.hanzi).toBe('水');
  c.layers[DungeonLayer.DUNGEON]=TerrainType.NOTHING;c.layers[DungeonLayer.SURFACE]=TerrainType.NOTHING;expect(rendered(c)?.hanzi).toBe('水');
  c.rememberedLayers=[...c.layers];c.isVisible=false;c.hasMemory=true;expect(rendered(c)?.hanzi).toBe('水');
 });
 it('remembered items use their captured category and never true consumable effect',()=>{
  const c=new Cell(1,2);c.rememberedItemCategory=ItemCategory.SCROLL;expect(rememberedItemSemantic(c,'?').hanzi).toBe('卷');
  expect(itemSemantic({category:ItemCategory.POTION,char:'!'},'!').hanzi).toBe('药');
 });
 it('preserves player, noncatalog monsters, location-only markers and hallucination suppression',()=>{
  expect(playerSemantic('@').hanzi).toBe('我');
  expect(monsterSemantic({typeId:'player_clone',char:'@'},'@').hanzi).toBe('傀');
  expect(monsterSemantic({typeId:'spectral_image',char:'g'},'g').hanzi).toBe('影');
  expect(monsterSemantic({typeId:'dragon',char:'d'},'x',false,true).hanzi).toBe('踪');
  for(const char of HALLUCINATION_CHARS){
   expect(monsterSemantic({typeId:'dragon',char:'d'},char,true).hanzi).toBe(glyphSemantic(char).hanzi);
   expect(itemSemantic({category:ItemCategory.ARMOR,char:'['},char,true).hanzi).toBe(glyphSemantic(char).hanzi);
   expect(terrainSemantic(visible(TerrainType.LAVA),{char,color:'#fff',bgColor:null},true).hanzi).toBe(glyphSemantic(char).hanzi);
  }
 });
 it('handles all projectile, alert, numeric and unknown glyphs without ASCII leakage',()=>{
  for(const char of ['*','!','?','~','&','x','→','♠','%','\\','未知','123','a','🙂']){
   expect(glyphSemantic(char).hanzi).toMatch(han);expect(projectileSemantic(char).hanzi).toBe('弹');
  }
  expect(floatingHanzi('-12')).toBe('-12');expect(floatingHanzi('+5')).toBe('+5');expect(floatingHanzi('!')).toBe('警');
 });
 it('style selection is independent of interface themes and invalid values do nothing',()=>{
  const before=concept.value;
  for(const mode of ['original','refined','hanzi','tiles'] as const){selectMapMode(mode);expect(mapMode.value).toBe(mode);expect(concept.value).toBe(before);}
  selectMapMode('bad' as never);expect(mapMode.value).toBe('tiles');
 });
 it('all vector paths use only valid geometry; every unpictured tile retains its label',()=>{
  const g=new Proxy({}, {get:(_t,k)=> k==='then'?undefined:(...args:unknown[])=>{for(const a of args)if(typeof a==='number')expect(Number.isFinite(a)).toBe(true);return g;}});
  for(const [id,hanzi] of Object.entries(mapText.terrain)) expect(typeof paintVectorTile(g as never,{id,hanzi,kind:'terrain',original:'#'},'#aaaaff',0,0,16)).toBe('boolean');
  for(const [id,hanzi] of Object.entries(mapText.items)) expect(paintVectorTile(g as never,{id,hanzi,kind:'item',original:'!'},0xffaa33,0,0,16)).toBe(false);
 });
 it('centers CJK inside the same square cell and retains original Latin positioning',()=>{
  const sprite={style:{},text:'',anchor:{set:(v:number)=>{anchor=v;}},x:0,y:0,visible:false};let anchor=0;
  paintMapText(sprite as never,playerSemantic('@'),'#ffcc00','hanzi','classic',2,3,16);
  expect(sprite.text).toBe('我');expect(anchor).toBe(.5);expect(sprite.x).toBe(40);expect(sprite.y).toBe(56);expect((sprite.style as {fontSize:number}).fontSize).toBeLessThan(16);
  paintMapText(sprite as never,playerSemantic('@'),'#ffcc00','original','classic',2,3,16);expect(sprite.text).toBe('@');expect(anchor).toBe(0);expect(sprite.x).toBe(32);
 });
 it('leaves original colors, monster status colors and saturated terrain hazards unchanged',()=>{
  for(const theme of ['classic','tactical','immersive'] as const){expect(mapInk('#ff3300',theme,'hanzi','terrain')).toBe('#ff3300');expect(mapInk('#6688aa',theme,'tiles','monster')).toBe('#6688aa');expect(mapInk('#999999',theme,'original','terrain')).toBe('#999999');}
 });
 it('retains engine appearance and command pipeline; maps only at renderer boundaries',()=>{
  const src=readFileSync(new URL('../components/GameCanvas.vue',import.meta.url),'utf8');
  for(const marker of ['terrainSemantic(cell!, visual','rememberedItemSemantic(cell','itemSemantic(item','monsterSemantic(m','playerSemantic(playerVisual.char)','projectileSemantic(boltFrame.char)','floatingHanzi(ft.text)','watch([mapMode, concept]'])expect(src).toContain(marker);
  expect(src).toContain('game.handlePlayerAction(action, data)');
 });
});

it('terrain color animation reuses white glyph ink while preserving entity colors', () => {
 const terrain = glyphSemantic('#', 'terrain');
 const sprite = {style: {fill: 0xffffff}, text: '', tint: 0xffffff, anchor: {set() {}}, x: 0, y: 0, visible: false};
 for (const color of [0x554433, 0x665544, 0xff3300]) {
  paintMapText(sprite as never, terrain, color, 'original', 'classic', 1, 2, 16, true);
  expect(sprite.style.fill).toBe(0xffffff);
  expect(sprite.tint).toBe(color);
  expect(sprite.text).toBe(normalizeMapGlyph('#'));
 }
 paintMapText(sprite as never, playerSemantic('@'), 0xffcc00, 'original', 'classic', 1, 2, 16);
 expect(sprite.style.fill).toBe(0xffcc00);
 expect(sprite.tint).toBe(0xffffff);
});
