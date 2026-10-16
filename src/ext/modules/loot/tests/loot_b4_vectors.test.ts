import {expect,it} from 'vitest';
import {buildEffectiveLootCatalog} from '../catalog';
import {loadLootPack} from '../definitions';
import {rollLoot} from '../generator';
import {validateLootItemData} from '../item';
import {ITEM_RUNIC_TARGETS} from '../../../itemSdk';
import {LOOT_TARGET_NAMES} from '../ui/targets';
import {projectLootKnowledge} from '../ui/knowledge';
import vectors from './fixtures/b4-runic-vectors.json';
import type {LootItemDataV1,LootRollRequest} from '../types';
const legacy=structuredClone(loadLootPack());for(const preset of legacy.presets.presets)preset.rarityWeights.set=0;
const c=buildEffectiveLootCatalog(loadLootPack(legacy),{combat:null,growth:null,giants:null});
it('catalog has exactly 21 reachable runes and stable localized target order',()=>{
 expect(Object.keys(vectors).sort()).toEqual(c.affixes.filter(a=>a.rune).map(a=>a.id).sort());
 expect(ITEM_RUNIC_TARGETS.map(t=>[t.name,t.frequency,t.maxDepth])).toEqual([['abomination',10,-1],['dar',10,22],['animal',10,10],['goblin',10,10],['ogre',10,16],['dragon',10,-1],['undead',10,-1],['jelly',10,15],['turret',5,18],['infernal',10,-1],['mage',10,-1],['waterborne',10,17],['airborne',10,15],['fireborne',10,12],['troll',10,15]]);
 expect(Object.keys(LOOT_TARGET_NAMES)).toEqual(ITEM_RUNIC_TARGETS.map(t=>t.name));
});
for(const [id,v]of Object.entries(vectors))it(`literal enabled-family tape ${id}, seed ${v.seed}`,()=>{
 let index=0;const result=rollLoot(c,v.request as LootRollRequest,{randomInt(lo,hi){const row=v.draws[index++];expect(row?.slice(0,2)).toEqual([lo,hi]);return row![2]!;}});
 expect(index).toBe(v.draws.length);expect(result.draws).toBeLessThanOrEqual(64);expect(result.items).toEqual([{data:v.data,native:v.native}]);expect(validateLootItemData(v.data,c)).toBe(true);
 const def=c.affixes.find(a=>a.id===id)!;expect(v.data.affixes.find(a=>a.id===id)!.tier).toBeLessThanOrEqual(def.maxTier);
 if(def.polarity<0)expect(v.data.corrupted).toBe(true);
 if(['slaying','immunity'].includes(def.rune!.runicType)){
  // D40 retains abomination/dragon/undead/infernal/mage: five weights10.
  // Target selection is the last draw, after corruption and rare naming.
  expect(v.draws[v.draws.length-1]!.slice(0,2)).toEqual([0,49]);expect((v.data as LootItemDataV1).targetClass).toBe('abomination');
  const d=structuredClone(v.data) as LootItemDataV1;delete d.targetClass;expect(validateLootItemData(d,c)).toBe(false);d.targetClass='unknown';expect(validateLootItemData(d,c)).toBe(false);
  const facts={v:1 as const,location:'pack' as const,ringKindKnown:true,magicPolarity:'unknown' as const,curseRevealed:false,hallucinating:false,familiarity:null};
  const hidden=projectLootKnowledge(v.data as LootItemDataV1,c,facts);expect(JSON.stringify(hidden)).not.toContain('targetClass');
  const revealed=structuredClone(v.data) as LootItemDataV1;revealed.affixes.find(a=>a.id===id)!.known=true;revealed.identityKnown=revealed.affixes.every(a=>a.known);
  expect(projectLootKnowledge(revealed,c,facts).affixes.some(a=>a.known&&a.targetClass==='abomination')).toBe(true);
 }
});
