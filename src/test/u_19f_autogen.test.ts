import {describe,it,expect} from 'vitest';
import {TerrainType as T} from '../engine/Map/Grid';
import {blueprintQualifies,RETIRED_INVENTED_BLUEPRINT_IDS,type BlueprintDef} from '../engine/Generator/BlueprintEngine';
import blueprints from '../data/blueprints.json';
import {MonsterState} from '../entities/Monster';
import {restoredAutoRows,runAutoActions} from './fixtures/u19f-auto-actions';

describe('U19f complete CE directory contracts',()=>{


 it('every CE blueprint qualifies under its own flags/depth, only D2 inventions retire',()=>{
  for(const bp of blueprints as BlueprintDef[]){
   const flags=bp.category==='key_guard'?['BP_ADOPT_ITEM']:bp.flags.filter(f=>['BP_ADOPT_ITEM','BP_VESTIBULE'].includes(f));
   expect(blueprintQualifies(bp,bp.depthRange[0],flags),bp.id).toBe(!RETIRED_INVENTED_BLUEPRINT_IDS.has(bp.id));
  }
 });
});

describe('U19f per-row generation → real player action',()=>{
 for(const index of restoredAutoRows)it(`autoGen row ${index} has its CE consumer`,()=>{
  const r=runAutoActions(index),at=(label:string)=>r.phases.find(p=>p.label===label),first=at('generated'),last=at('final');
  expect(r.stats.totalBuilt).toBeGreaterThan(0);expect(r.commands.length).toBeGreaterThan(0);
  expect(first.target).toContain(r.tile);expect(last.hp).toBeGreaterThan(0);
  if([22,24,26,28].includes(index))expect(at('searched').target).not.toContain(r.tile);
  if([15,22].includes(index)){expect(at('interacted').target).toContain(T.NETTING);expect(at('interacted').stuck).toBeGreaterThan(0);expect(at('escaped').player).toEqual(r.entry);expect(at('escaped').target).not.toContain(T.NETTING);}
  else if([17,24].includes(index)){expect(first.witness).toBe(MonsterState.ASLEEP);expect(last.witness).toBe(MonsterState.HUNTING);}
  else if([18,26].includes(index))expect(at('confused').confused).toBeGreaterThan(0);
  else if([20,28].includes(index))expect((last.terrainCounts.FLOOD_WATER_DEEP??0)+(last.terrainCounts.FLOOD_WATER_SHALLOW??0)).toBeGreaterThan(0);
  else if(index===9){expect(at('interacted').target).toContain(T.TRAMPLED_FUNGUS_FOREST);expect(at('regrown').target).toContain(T.FUNGUS_FOREST);}
  else if(index===10){expect(at('bloomed').terrainCounts.DEEP_WATER_ALGAE_2).toBeGreaterThan(0);expect(at('entered').player).toEqual(r.target);}
  else if(index===32){expect(at('steam').terrainCounts.STEAM).toBeGreaterThan(0);expect(at('entered').hp).toBeLessThan(at('steam').hp);}
  else if(index>=34&&index<=37){expect(at('interacted').target).not.toContain(r.tile);expect(at('interacted').target).toContain(T.BROKEN_GLASS);expect(at('interacted').terrainCounts[['POISON_GAS','CONFUSION_GAS','PARALYSIS_GAS','METHANE_GAS'][index-34]!]).toBeGreaterThan(0);expect(at('interacted').player).toEqual(r.entry);}
  else if(r.obstructing){expect(last.player).toEqual(r.entry);expect(last.target).toContain(r.tile);}
  else expect(last.player).toEqual(r.target);
  if([2,9,13,30,38].includes(index))expect(first.light).toBeGreaterThan(0);
  const saved=JSON.parse(JSON.stringify(r.game.toSnapshot()));expect(r.game.loadSnapshot(saved)).toBe(true);
  expect(r.game.grid.getCell(r.target.x,r.target.y).layers).toEqual(last.target);
 });
});
