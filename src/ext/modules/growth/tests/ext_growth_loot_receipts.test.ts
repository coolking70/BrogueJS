import {afterEach,expect,it} from 'vitest';
import {createWorldHarness,worldHarnessGame} from '../../../testing/worldHarness';
import {descriptor} from '../descriptor';
import {createGrowthGameplay} from '../module';
import {parseGrowthDefinitionPack} from '../definitions';
import {extensionDataFingerprint} from '../../../fingerprint';
import {assembleDropItem} from '../../../../engine/Items/FixedItemAssembly';
import data from '../data/definitions.json';
import {readGrowthCharacterView,createGrowthAllocationDraft,buildGrowthAllocateCommand} from '../view';
import {auditFullObjectGraph} from '../../../../test/support/fullGenerationCheckpointOracle';
import {rng} from '../../../../engine/Random';
const handles:ReturnType<typeof createWorldHarness>[]=[];
afterEach(()=>handles.splice(0).forEach(h=>h.dispose()));
it('capped XP never commits a scholar receipt, including repeated rewards and load',()=>{
 // Test-only level cap; shipped numerical data is untouched. Loot is discovered publicly.
 const raw=structuredClone(data);raw.config.levels.cap=1;
 raw.config.levels.attributePoints.firstLevel=1;raw.config.levels.skillPoints.firstLevel=1;raw.config.levels.maxHp.grants.firstLevel=1;
 for(const definition of raw.definitions)for(const requirement of definition.prerequisites??[])if(requirement.kind==='level')requirement.min=1;
 const pack=parseGrowthDefinitionPack(raw,{moduleVersion:raw.moduleVersion,hasText:()=>true});
 const rules={schema:1,version:raw.rulesVersion,fingerprint:extensionDataFingerprint(raw)};
 const h=createWorldHarness({seed:42,mode:'easy',modules:['growth','loot']},[{...descriptor,rules,create:()=>createGrowthGameplay(pack,rules)}]);handles.push(h);
 const g=worldHarnessGame(h),r=g.extensionRuntime!;
 const item=assembleDropItem({native:{kind:'ring_of_regeneration',category:'ring',enchantment:1,runicType:null,isCursed:false,identified:false,familiarityRemaining:1500},moduleData:{loot:{v:1,baseId:'ring_of_regeneration',ilvl:1,rarity:'magic',uniqueId:null,setId:null,affixes:[{id:'loot.affix.scholar',tier:1,values:[600],known:false}],corrupted:false,enhancement:0,sockets:0,socketed:[],nameParts:null,origin:{source:'floor',depth:1}}}});
 g.player.inventory.addItem(item);r.bindItemData(item);g.executeItemCommand('equip',item);
 const known=()=>JSON.stringify(item.moduleData!.loot).includes('"known":true');expect(known()).toBe(false);
 for(let i=0;i<2;i++)r.emit('simulationSettled',{knownKinds:[{id:'b3-cap-fixture',category:'potion'}],reachableIds:[g.player.id,...g.monsters.map(m=>m.id)],sourceIds:[]});
 expect(r.readModuleView('growth')!.components.progression).toMatchObject({experience:0,level:1});expect(known()).toBe(false);
 expect(g.loadSnapshot(g.toSaveSnapshot())).toBe(true);
 expect(JSON.stringify(g.player.inventory.items.find(i=>i.id===item.id)!.moduleData!.loot)).toContain('"known":false');
});

it('character and allocation projections filter an unknown attribute before downstream HP',()=>{
 const raw=structuredClone(data);raw.config.levels.attributePoints.firstLevel=1;
 const pack=parseGrowthDefinitionPack(raw,{moduleVersion:raw.moduleVersion,hasText:()=>true}),rules={schema:1,version:raw.rulesVersion,fingerprint:extensionDataFingerprint(raw)};
 const h=createWorldHarness({seed:42,mode:'easy',modules:['growth','loot']},[{...descriptor,rules,create:()=>createGrowthGameplay(pack,rules)}]);handles.push(h);
 const g=worldHarnessGame(h),r=g.extensionRuntime!,before=readGrowthCharacterView(g)!;
 const item=assembleDropItem({native:{kind:'ring_of_regeneration',category:'ring',enchantment:1,runicType:null,isCursed:false,identified:false,familiarityRemaining:1500},moduleData:{loot:{v:1,baseId:'ring_of_regeneration',ilvl:1,rarity:'magic',uniqueId:null,setId:null,affixes:[{id:'loot.affix.adept.growth.attribute.constitution',tier:1,values:[1],known:false}],corrupted:false,enhancement:0,sockets:0,socketed:[],nameParts:null,origin:{source:'floor',depth:1}}}});
 g.player.inventory.addItem(item);r.bindItemData(item);g.player.equip(item);
 const audit=auditFullObjectGraph([g,rng]),view=readGrowthCharacterView(g)!;
 expect(view.preview.maxHp.current).toBe(before.preview.maxHp.current);expect(g.player.maxHp).toBe(view.preview.maxHp.current+3);
 expect(view.attributes.find(a=>a.id==='growth.attribute.constitution')).toMatchObject({value:0,effective:0,external:0,sources:[]});
 const draft=createGrowthAllocationDraft(view);draft.attributes['growth.attribute.constitution']=1;
 const proposal=readGrowthCharacterView(g,draft)!;expect(proposal.preview.maxHp.delta).toBe(3);expect(audit.differences()).toEqual([]);
 g.executeCommand('ext:command',buildGrowthAllocateCommand(proposal,g)!);
 expect(readGrowthCharacterView(g)!.preview.maxHp.current).toBe(proposal.preview.maxHp.preview);
 expect(JSON.stringify(item.moduleData!.loot)).toContain('"known":false');
});
