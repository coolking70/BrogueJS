import { readCe, hasCeSource, CE_SKIP_REASON } from './support/ceSource';
import { describe, expect, it } from 'vitest';
import { createHeadlessGame } from './harness';
import { DungeonLayer as L, TerrainType as T, DRAW_PRIORITY, TERRAIN_HOME_LAYER } from '../engine/Map/Grid';
import { TERRAIN_FLAGS } from '../engine/Map/TerrainCatalog';
import { TERRAIN_APPEARANCES } from '../engine/UI/TerrainAppearanceCatalog';
import { TERRAIN_COLOR_NAMES } from '../engine/UI/TerrainColorCatalog';
import { cellAppearance } from '../engine/UI/Appearance';
import { terrainSemantic } from '../ui/mapTileSemantics';
import { resolveVectorIcon } from '../ui/vectorAtlas';
import { rng } from '../engine/Random';
import { captiveManaclePlacements } from '../engine/Map/CaptiveManacles';
import { placeCaptiveManacles } from '../engine/Generator/Architect';
import hordes from '../data/hordes.json';
import type { HordeEntry } from '../engine/Core/Game';

const context={gas:undefined,lightChannels:{r:100,g:100,b:100},groundItem:null,carriedItem:null,hallucinating:false,cosmetic:{percent:()=>false,pick:<T>(values:readonly T[])=>values[0]!}};
const names = ['MANACLE_TL', 'MANACLE_BL', 'MANACLE_TR', 'MANACLE_BR', 'MANACLE_T', 'MANACLE_B', 'MANACLE_L', 'MANACLE_R'] as const;
const tile = (name: string): T => (T as unknown as Record<string, T>)[name]!;
const chains = (g: ReturnType<typeof createHeadlessGame>) => Array.from({length:g.grid.width},(_,x)=>Array.from({length:g.grid.height},(_,y)=>g.grid.getCell(x,y)!)).flat().filter(c => names.some(n => c.layers[L.SURFACE] === tile(n))).map(c => ({ x:c.x,y:c.y,t:T[c.layers[L.SURFACE]!] }));
function scene() {
 const g=createHeadlessGame(101,'test');g.monsters=[];g.dormantMonsters=[];g.items=[];g.player.loc={x:3,y:3};
 for(let x=0;x<g.grid.width;x++)for(let y=0;y<g.grid.height;y++)g.grid.setTerrain(x,y,T.FLOOR);
 return g;
}
function spawn(g: ReturnType<typeof scene>, spawnsIn: string | null=null, x=10,y=10) {
 const h={...hordes.find(h=>h.flags.includes('HORDE_LEADER_CAPTIVE')&&!h.spawnsIn)!,leader:'MONKEY',machine:0,members:[],spawnsIn} as HordeEntry;
 expect((g as any).spawnHordeAt(h,{x,y},1,false)).toBe(true);return g.monsters[g.monsters.length-1]!;
}
describe('CE captive manacles',()=>{
 it.skipIf(!hasCeSource())('all eight tile rows match the actual CE source'+(hasCeSource()?'':' - '+CE_SKIP_REASON),()=>{
  const source=readCe('src/brogue/Globals.c');
  for(const name of names) {
   const row=source.split('\n').find(line=>line.includes('/*'+name+'*/'))!;
   const fields=row.slice(row.indexOf('{')+1,row.indexOf('}')).split(',').map(x=>x.trim());
   expect(fields.slice(1,12),name).toEqual(['&gray','0','20','0','0','0','0','0','NO_LIGHT','0','0']);
  }
 });
 it('CE surface assignment replaces fungus foliage and removes only its opacity',()=>{
  const g=scene();g.grid.setTerrainLayer(9,9,L.SURFACE,T.FUNGUS_FOREST);expect(g.grid.getCell(9,9)!.isOpaque).toBe(true);
  const before=rng.getState();placeCaptiveManacles(g.grid,{x:10,y:10});expect(rng.getState()).toEqual(before);
  expect(g.grid.getCell(9,9)).toMatchObject({isOpaque:false,isPassable:true});expect(g.grid.getCell(9,9)!.layers[L.SURFACE]).toBe(tile('MANACLE_TL'));
 });
 it('normal deterministic recording with a naturally generated captive replays and seeks without OOS',()=>{
  const g=createHeadlessGame(777);expect(g.monsters.some(m=>m.isCaged)).toBe(true);const anchors=chains(g);expect(anchors.length).toBeGreaterThan(0);
  for(let n=0;n<5;n++)g.handlePlayerAction('wait');
  const r=g.exportRecording();expect(g.loadReplay(r)).toBe(true);
  while(g.replayCursor<r.events.length&&!g.replayError)g.replayStep();
  expect(g.replayError).toBeNull();expect(g.replayCursor).toBe(r.events.length);expect(chains(g)).toEqual(anchors);
  g.replaySeek(2);expect(g.replayError).toBeNull();expect(g.replayCursor).toBe(2);expect(chains(g)).toEqual(anchors);
 });
 it('four blocked diagonal anchors use up/down before left/right',()=>{
  const g=scene();for(const [x,y] of [[9,9],[9,11],[11,9],[11,11]])g.grid.setTerrain(x!,y!,T.WALL);spawn(g);
  expect(chains(g)).toEqual([{x:10,y:9,t:'MANACLE_T'},{x:10,y:11,t:'MANACLE_B'}]);
 });
 it('selection leaves all grid state and both RNG streams untouched',()=>{
  const g=scene(),before=g.toSnapshot(),random=rng.getState();before.savedAt=0;expect(captiveManaclePlacements(g.grid,{x:10,y:10})).toHaveLength(4);
  const after=g.toSnapshot();after.savedAt=0;expect(after).toEqual(before);expect(rng.getState()).toEqual(random);
 });
 it('placement consumes neither RNG stream and preserves physical passability',()=>{
  const g=scene(),before=rng.getState();placeCaptiveManacles(g.grid,{x:10,y:10});expect(rng.getState()).toEqual(before);
  expect(chains(g)).toHaveLength(4);for(const c of chains(g))expect(g.grid.getCell(c.x,c.y)).toMatchObject({isPassable:true,isOpaque:false});
 });
 it('natural horde entry places the four diagonal chains on the surface without displacing dungeon terrain',()=>{
  const g=scene(),m=spawn(g);expect(m.isCaged).toBe(true);
  expect(chains(g)).toEqual([{x:9,y:9,t:'MANACLE_TL'},{x:9,y:11,t:'MANACLE_BL'},{x:11,y:9,t:'MANACLE_TR'},{x:11,y:11,t:'MANACLE_BR'}]);
  for(const c of chains(g))expect(g.grid.getCell(c.x,c.y)!.layers[L.DUNGEON]).toBe(T.FLOOR);
 });
 it('blocked diagonals fall back vertically first; an invalid vertical anchor falls back horizontally',()=>{
  const g=scene();for(const [x,y] of [[9,9],[9,11],[11,9],[11,11]])g.grid.setTerrain(x!,y!,T.WALL);
  g.grid.setTerrainLayer(10,9,L.LIQUID,T.WATER_SHALLOW);spawn(g);
  expect(chains(g)).toEqual([{x:9,y:10,t:'MANACLE_L'},{x:10,y:11,t:'MANACLE_B'},{x:11,y:10,t:'MANACLE_R'}]);
  expect(g.grid.getCell(10,9)!.layers[L.LIQUID]).toBe(T.WATER_SHALLOW);
 });
 it('ineligible anchors include stairs, a liquid bridge and the map boundary; surface decorations are replaced like CE',()=>{
  const g=scene();g.grid.setTerrain(9,9,T.STAIRS_UP);g.grid.setTerrainLayer(9,11,L.LIQUID,T.BRIDGE);g.grid.setTerrainLayer(11,9,L.SURFACE,T.BLOOD);spawn(g);
  expect(g.grid.getCell(9,9)!.layers[L.SURFACE]).toBe(T.NOTHING);expect(g.grid.getCell(9,11)!.layers[L.SURFACE]).toBe(T.NOTHING);
  expect(g.grid.getCell(11,9)!.layers[L.SURFACE]).toBe(tile('MANACLE_TR'));
  const edge=scene();spawn(edge,null,0,0);expect(chains(edge)).toHaveLength(3);
 });
 it('special-terrain captives do not receive chains; ordinary hostile hordes do not either',()=>{
  const g=scene();spawn(g,'MONSTER_CAGE_CLOSED');expect(chains(g)).toEqual([]);
  const h={...hordes[0],flags:[],machine:0,members:[],spawnsIn:null} as HordeEntry;
  (g as any).spawnHordeAt(h,{x:20,y:10},1,false);expect(chains(g)).toEqual([]);
 });
 it('all eight identities have the complete nonblocking CE decoration fields and visible directional glyphs',()=>{
  const chars=['\\','/','/','\\','|','|','-','-'];
  names.forEach((name,i)=>{const t=tile(name);expect(t,name).toBeDefined();expect(DRAW_PRIORITY[t]).toBe(20);expect(TERRAIN_HOME_LAYER[t]).toBe(L.SURFACE);
   expect(TERRAIN_FLAGS[t]).toMatchObject({flags:0,mechFlags:0,chanceToIgnite:0,promoteChance:0,glowLight:0});
   expect(TERRAIN_APPEARANCES[t]).toEqual({char:chars[i],color:'#7f7f7f',bgColor:null});expect(TERRAIN_COLOR_NAMES[t]).toEqual(['gray',null]);
  });
 });
 it('display keeps known direction in vector mode, conceals undiscovered cells, and uses remembered terrain after leaving sight',()=>{
  const g=scene();spawn(g);const c=g.grid.getCell(9,9)!;c.isVisible=false;c.isDiscovered=false;
  expect(cellAppearance(c,context)).toBeNull();c.isVisible=true;const v=cellAppearance(c,context)!;
  expect(resolveVectorIcon(terrainSemantic(c,v))).toEqual({group:'terrain',family:'manacles',variant:'MANACLE_TL'});
  c.rememberedLayers=[...c.layers];c.rememberedAppearance=v;c.isVisible=false;c.isExplored=true;g.grid.setTerrain(9,9,T.WALL);
  const memory=cellAppearance(c,context)!;expect(terrainSemantic(c,memory).id).toBe('MANACLE_TL');
 });
 it('save/load retains chains and rescuing via a real move releases the monster, leaving the floor anchors as in CE',()=>{
  const g=scene(),m=spawn(g);const expected=chains(g),saved=JSON.parse(JSON.stringify(g.toSnapshot()));
  expect(g.loadSnapshot(saved)).toBe(true);expect(chains(g)).toEqual(expected);
  g.player.loc={x:10,y:9};g.grid.getCell(10,10)!.isVisible=true;g.onConfirmRequest=()=>true;g.animationEnabled=false;
  g.handlePlayerAction('move',{x:0,y:1},'system');expect(g.monsters.find(n=>n.id===m.id)).toMatchObject({isCaged:false,isAlly:true});expect(chains(g)).toEqual(expected);
 });
});
