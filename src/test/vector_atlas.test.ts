import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import monsters from '../data/monsters.json';
import { mapText, glyphSemantic, monsterSemantic, playerSemantic, projectileSemantic, type TileSemantic } from '../ui/mapTileSemantics';
import { paintMapText, paintVectorTile } from '../ui/mapTileDrawing';
import { resolveVectorIcon, VECTOR_MONSTER_IDS, VECTOR_ITEM_FAMILIES } from '../ui/vectorAtlas';
import { vectorIconSvg } from '../ui/vectorIconSvg';
const tile=(id:string,hanzi:string,kind:TileSemantic['kind']):TileSemantic=>({id,hanzi,kind,original:'#'});
describe('Complete graphic-only vector atlas',()=>{
 it('covers all 67 creatures, two special images, 214 terrain definitions and 13 item families',()=>{
  expect(VECTOR_MONSTER_IDS).toHaveLength(69);
  expect(VECTOR_ITEM_FAMILIES).toHaveLength(13);
  expect(Object.keys(mapText.terrain)).toHaveLength(214);
  for(const m of monsters){const icon=resolveVectorIcon(monsterSemantic({typeId:m.id,char:m.char},m.char));expect(icon.family,m.id).not.toBe('unknown');expect(icon.group).toBe('creature');}
  for(const [id,hanzi] of Object.entries(mapText.terrain))expect(resolveVectorIcon(tile(id,hanzi,'terrain')).family,id).not.toBe('unknown');
  for(const [id,hanzi] of Object.entries(mapText.items))expect(resolveVectorIcon(tile(id,hanzi,'item')).family,id).not.toBe('unknown');
 });
 it('uses varied coherent anatomy with unique species motifs rather than repeated nameplates',()=>{
  const icons=monsters.map(m=>resolveVectorIcon(monsterSemantic({typeId:m.id,char:m.char},m.char)));
  expect(new Set(icons.map(x=>x.family)).size).toBeGreaterThanOrEqual(20);
  expect(new Set(icons.map(x=>x.family+':'+x.variant)).size).toBe(67);
  expect(resolveVectorIcon(tile('rat','鼠','monster')).family).toBe('rodent');
  expect(resolveVectorIcon(tile('dragon','龙','monster')).family).toBe('dragon');
 });
 it('paints every catalog entry without requesting any text label and emits finite geometry',()=>{
  const entries=[...Object.entries(mapText.terrain).map(([id,h])=>tile(id,h,'terrain')),...Object.entries(mapText.items).map(([id,h])=>tile(id,h,'item')),...monsters.map(m=>monsterSemantic({typeId:m.id,char:m.char},m.char)),playerSemantic('@'),projectileSemantic('*'),glyphSemantic('~'),glyphSemantic('x','marker'),glyphSemantic('🙂')];
  const g=new Proxy({}, {get:(_t,k)=>k==='then'?undefined:(...args:unknown[])=>{for(const a of args.flat(Infinity))if(typeof a==='number')expect(Number.isFinite(a)).toBe(true);return g;}});
  for(const value of entries){expect(paintVectorTile(g as never,value,0xc4b887,2,3,24),value.id).toBe(false);const svg=vectorIconSvg(value);expect(svg).not.toMatch(/<text|NaN|undefined|Infinity|[\p{Script=Han}]/u);if(resolveVectorIcon(value).family!=='blank')expect(svg.length,value.id).toBeGreaterThan(20);}
 });
 it('disguises secrets by known visual family, not internal terrain identity',()=>{
  for(const id of ['SECRET_DOOR','WALL_LEVER_HIDDEN','WALL_MONSTER_DORMANT','TURRET_DORMANT'])expect(resolveVectorIcon(tile(id,'墙','terrain'))).toEqual(resolveVectorIcon(tile('WALL','墙','terrain')));
  for(const id of ['TRAP_DOOR_HIDDEN','AMULET_SWITCH','MACHINE_TRIGGER_FLOOR'])expect(resolveVectorIcon(tile(id,'地','terrain'))).toEqual(resolveVectorIcon(tile('FLOOR','地','terrain')));
  const a=monsterSemantic({typeId:'dragon',char:'d'},'k',true),b=monsterSemantic({typeId:'rat',char:'r'},'k',true);
  expect(resolveVectorIcon(a)).toEqual(resolveVectorIcon(b));
  expect(resolveVectorIcon(a).family).toBe('unknown');
 });
 it('does not populate a text sprite in vector mode, even for unknown cells and bolts',()=>{
  const s={text:'OLD',visible:true};
  for(const value of [playerSemantic('@'),glyphSemantic('🙂'),projectileSemantic('*')]){paintMapText(s as never,value,0xffffff,'tiles',0,0,16);expect(s.text).toBe('');expect(s.visible).toBe(false);}
  const source=readFileSync(new URL('../components/GameCanvas.vue',import.meta.url),'utf8');
  expect(source).toContain("boltSprite.visible = mapMode.value !== 'tiles'");
  expect(source).toContain('paintVectorTile(vectorEntities, projectileSemantic(boltFrame.char)');
 });
});
