import {afterEach,expect,it} from 'vitest';
import {createWorldHarness,worldHarnessGame} from '../../../testing/worldHarness';
import {getLootUiFixture} from '../tools/preview/fixtures';
import {deriveNativeFacts} from '../item';
import {resolveLootCatalog} from '../session';
import {assembleDropItem,assembleNativeTemplate} from '../../../../engine/Items/FixedItemAssembly';
import {nativeStat,markStatsDirty} from '../../../../engine/Stats/NativeStatSources';
import {ItemLoader} from '../../../../engine/Items/ItemLoader';
import {CombatSystem} from '../../../../engine/Combat/Combat';
import {Monster,type MonsterData} from '../../../../entities/Monster';
import species from '../../../../data/monsters.json';
import type {LootItemDataV1} from '../types';
import {adaptLootModifier} from '../statSources';
const handles:ReturnType<typeof createWorldHarness>[]=[];
function open(){const h=createWorldHarness({seed:42,mode:'easy',modules:['loot']});handles.push(h);const g=worldHarnessGame(h);for(const item of g.player.inventory.items)g.player.unequip(item,true);return {g,r:g.extensionRuntime!,p:g.player};}
function add(g:ReturnType<typeof worldHarnessGame>,id:Parameters<typeof getLootUiFixture>[0]){const data=getLootUiFixture(id).data,n=deriveNativeFacts(data,resolveLootCatalog(g.extensionRuntime!.queryOptional.bind(g.extensionRuntime))),item=assembleDropItem({native:{kind:n.kind,category:n.category,enchantment:n.enchantment,runicType:n.runicType,isCursed:n.isCursed,identified:n.identified,familiarityRemaining:20},moduleData:{loot:JSON.parse(JSON.stringify(data))}});g.player.inventory.addItem(item);g.extensionRuntime!.bindItemData(item);return item;}
afterEach(()=>handles.splice(0).forEach(h=>h.dispose()));
it.each([8,20])('real brutal endpoints, hidden comparison and cache recalculation at strength %i',strength=>{
 const {g,p,r}=open();p.strength=strength;markStatsDirty(p);const item=add(g,'R07'),data=item.moduleData!.loot as unknown as LootItemDataV1,brutal=data.affixes.find(a=>a.id==='loot.affix.brutal')!;
 const native=assembleNativeTemplate(data.baseId);p.inventory.addItem(native);p.equip(native);
 const min=nativeStat(p,'native.weapon-base-min'),max=nativeStat(p,'native.weapon-base-max');p.equip(item);
 expect(nativeStat(p,'native.weapon-base-min')).toBe(min+brutal.values[0]!);expect(nativeStat(p,'native.weapon-base-max')).toBe(max+brutal.values[1]!);
 expect(r.stats.hypothetical(p.id,{},true)['native.weapon-base-min']).toBe(min);
 ItemLoader.identifyInstance(item);expect(r.stats.hypothetical(p.id,{},true)['native.damage-max']).toBe(nativeStat(p,'native.damage-max'));r.assertStats();
 p.unequip(item);r.assertStats();
});
it('same-kind normal loot rings carry native implicit exactly once in both slots',()=>{
 const {g,p,r}=open(),a=add(g,'R03'),b=add(g,'R03');p.equip(a);p.equip(b);
 const actual=r.stats.hypothetical(p.id,{},false),make=(source:typeof a)=>{const item=assembleNativeTemplate(source.identityId!);item.enchantment=source.enchantment;item.identified=true;return item;};
 p.unequip(a);p.unequip(b);for(const item of [make(a),make(b)]){p.inventory.addItem(item);p.equip(item);}
 expect(r.stats.hypothetical(p.id,{},false)).toEqual(actual);r.assertStats();
});
it('real melee settlement reveals brutal without revealing unrelated rows',()=>{
 const {g,p,r}=open(),item=add(g,'R07');p.equip(item);const target=new Monster(p.x+1,p.y,(species as MonsterData[]).find(m=>m.id==='ogre')!);target.isCaged=true;g.monsters.push(target);r.attachCreature(target);
 for(let i=0;i<20&&!(item.moduleData!.loot as unknown as LootItemDataV1).affixes.find(a=>a.id==='loot.affix.brutal')!.known;i++)CombatSystem.attack(p,target);
 const rows=(item.moduleData!.loot as unknown as LootItemDataV1).affixes;expect(rows.find(a=>a.id==='loot.affix.brutal')!.known).toBe(true);expect(rows.some(a=>!a.known)).toBe(true);r.assertStats();
});
it.each([['native.weapon-enchant','int',2,'native.weapon-enchant',8],['native.defense','display-armor',3,'native.armor-base',30],['native.awareness','ring-point',4,'native.awareness',80],['native.stealth-range','ring-point',-2,'native.stealth-points',-2]])('unit adapter %s is explicit and applies once',(stat,unit,value,key,expected)=>{
 const row=adaptLootModifier({sourceId:'fixture',stat:String(stat),unit:unit as 'int',value:Number(value),category:'flat',slot:null,runicType:null,conditions:undefined,known:false},123,0)!;
 expect(row).toMatchObject({stat:key,value:expected,sourceId:'loot.item.123.affix.0',known:false,layer:'equipment'});
});
it('pruning a retired drop birth invalidates the extension digest token exactly once',()=>{
 const {g,r}=open(),ids=Object.keys(r.snapshot().foundation.itemDrops!.births).map(Number),retired=ids.find(id=>id!==g.player.id)!;
 expect(retired).toBeDefined();const before=r.recordingDigestToken();
 const fact={knownKinds:[],reachableIds:ids.filter(id=>id!==retired),sourceIds:[]};r.emit('simulationSettled',fact);
 expect(r.snapshot().foundation.itemDrops!.births[String(retired)]).toBeUndefined();expect(r.recordingDigestToken()).not.toEqual(before);
 const after=r.recordingDigestToken();r.emit('simulationSettled',fact);expect(r.recordingDigestToken()).toEqual(after);
});
