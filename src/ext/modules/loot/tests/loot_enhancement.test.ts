import { describe, expect, it } from 'vitest';
import { buildEffectiveLootCatalog } from '../catalog';
import { loadLootPack } from '../definitions';
import { enhanceLoot, lootEnhancementLimit, refinementRows } from '../enhancement';
import { deriveNativeFacts, validateLootItemData } from '../item';
import type { LootItemDataV1 } from '../types';
const catalog=buildEffectiveLootCatalog(loadLootPack(),{combat:null,growth:null,giants:null});
const empty=(baseId='dagger',rarity:LootItemDataV1['rarity']='normal'):LootItemDataV1=>({v: 4,baseId,rarity,ilvl:40,uniqueId:null,setId: null, pieceId: null, identityKnown: true,affixes:[],corrupted:false,enhancement:0,sockets:0,socketed:[],nameParts:rarity==='rare'?[0,0]:null,origin:{source:'floor',depth:26}});
const noDraw={randomInt(){throw Error('Unexpected draw');}};
describe('6B4 independent enhancement and refinement arithmetic',()=>{
 it.each([['normal',10],['magic',8],['rare',6]] as const)('%s accepts only remaining levels to %i', (rarity,cap)=>{
  for(const base of ['dagger','leather_armor','ring_of_light']){
   const data=empty(base,rarity);data.enhancement=cap-1;
   expect(validateLootItemData(data,catalog)).toBe(true);expect(lootEnhancementLimit(data,catalog)).toBe(1);
   const result=enhanceLoot(data,catalog,1,noDraw);expect(result.enhancement).toBe(cap);
   expect(deriveNativeFacts(result,catalog).enchantment).toBe(base==='ring_of_light'?3+Math.floor(cap/2):0);
   expect(lootEnhancementLimit(result,catalog)).toBe(0);expect(()=>enhanceLoot(result,catalog,1,noDraw)).toThrow();
   expect(()=>enhanceLoot(data,catalog,2,noDraw)).toThrow();expect(data.enhancement).toBe(cap-1);
  }
 });
 it('all legal rows including full rows remain in stored candidate order; no improvement still succeeds',()=>{
  const data=empty('dagger','rare');data.enhancement=6;
  data.identityKnown=false;data.affixes=[{id:'loot.affix.keen',tier:1,values:[1500],known:false},{id:'loot.affix.brutal',tier:1,values:[1,2],known:false}];
  const keen=catalog.affixes.find(a=>a.id==='loot.affix.keen')!.tiers[0]!.ranges[0]!;
  data.affixes[0]!.values=[keen[1]];
  const calls:number[][]=[];const result=enhanceLoot(data,catalog,1,{randomInt(lo,hi){calls.push([lo,hi]);return lo;}});
  expect(calls).toEqual([[0,1],[keen[0],keen[1]]]);expect(result).toEqual(data);
  expect(refinementRows(data,catalog).map(r=>r.index)).toEqual([0,1]);
 });
 it('multicomponent refinement takes independent maxima in declared order',()=>{
  const data=empty('dagger','magic');data.enhancement=8;
  data.identityKnown=false;data.affixes=[{id:'loot.affix.brutal',tier:2,values:[2,3],known:false}];
  const calls:number[][]=[];const result=enhanceLoot(data,catalog,1,{randomInt(lo,hi){calls.push([lo,hi]);return hi;}});
  expect(calls).toEqual([[1,2],[3,5]]);expect(result.affixes[0]!.values).toEqual([2,5]);expect(result.affixes[0]!.known).toBe(false);
 });
 it('unique cap4 excludes penalties and includes fixed full positive rows without dice',()=>{
  const u=catalog.pack.uniques.uniques.find(u=>u.id==='loot.unique.colossus-maul')!,data={...empty(u.baseId,'unique'),uniqueId:u.id,identityKnown:false,enhancement:4,affixes:u.rows.map(r=>({id:r.rowId,tier:0,values:r.ranges.map(([lo])=>lo),known:false}))};
  expect(validateLootItemData(data,catalog)).toBe(true);expect(refinementRows(data,catalog).map(r=>r.index)).toEqual([0,1,2,4]);
  const calls:number[][]=[];expect(enhanceLoot(data,catalog,1,{randomInt(lo,hi){calls.push([lo,hi]);return 0;}})).toEqual(data);expect(calls).toEqual([[0,3]]);
 });
 it.each([-1,1.5,Infinity,Number.MAX_SAFE_INTEGER])('rejects invalid or overflowing amount %s',n=>expect(()=>enhanceLoot(empty(),catalog,n,noDraw)).toThrow());
 it('zero output neither draws nor changes any field, even at cap',()=>{const data=empty();data.enhancement=10;expect(enhanceLoot(data,catalog,0,noDraw)).toEqual(data);});
});
