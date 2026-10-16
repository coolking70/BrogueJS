import {Monster,MonsterState,type MonsterData} from '../../../../entities/Monster';
import monsters from '../../../../data/monsters.json';
import {Game} from '../../../../engine/Core/Game';
import {TerrainType} from '../../../../engine/Map/Grid';
import '../../../../i18n';
import {afterEach,expect,it,vi} from 'vitest';
import {createWorldHarness,worldHarnessGame} from '../../../testing/worldHarness';
import {descriptor as growthDescriptor} from '../../growth/descriptor';
import definitions from '../../growth/data/definitions.json';
import {parseGrowthDefinitionPack} from '../../growth/definitions';
import {createGrowthGameplay} from '../../growth/module';
import type {GrowthDefinitionPack} from '../../growth/types';
import {extensionDataFingerprint} from '../../../fingerprint';
import {resolveLootCatalog} from '../session';
import {deriveNativeFacts} from '../item';
import {assembleDropItem} from '../../../../engine/Items/FixedItemAssembly';
import {ItemLoader} from '../../../../engine/Items/ItemLoader';
import {logger} from '../../../../engine/Systems/Logger';
import type {LootItemDataV1} from '../types';
const handles:ReturnType<typeof createWorldHarness>[]=[];
afterEach(()=>(handles.splice(0).forEach(h=>h.dispose()),vi.restoreAllMocks()));
function open(rule:Record<string,unknown>){const pack=structuredClone(definitions) as unknown as GrowthDefinitionPack;Object.assign(pack.config.itemGrowth.rules[2]!,rule);const parsed=parseGrowthDefinitionPack(pack,{moduleVersion:pack.moduleVersion,hasText:()=>true}),rules={schema:1,version:pack.moduleVersion,fingerprint:extensionDataFingerprint(pack)};
 const h=createWorldHarness({seed:42,mode:'easy',modules:['growth','loot']},[{...growthDescriptor,rules,create:()=>createGrowthGameplay(parsed,rules)}]);handles.push(h);return worldHarnessGame(h);}
function add(g:ReturnType<typeof open>,enhancement=7){const c=resolveLootCatalog(g.extensionRuntime!.queryOptional.bind(g.extensionRuntime)),data:LootItemDataV1={v: 4,baseId:'dagger',ilvl:12,rarity:'magic',uniqueId:null,setId: null, pieceId: null, identityKnown: false,affixes:[{id:'loot.affix.keen',tier:1,values:[1500],known:false}],corrupted:false,enhancement,sockets:0,socketed:[],nameParts:null,origin:{source:'floor',depth:8}},n=deriveNativeFacts(data,c),i=assembleDropItem({native:{kind:n.kind,category:n.category,enchantment:n.enchantment,runicType:n.runicType,isCursed:n.isCursed,identified:n.identified,familiarityRemaining:1000},moduleData:{loot:JSON.parse(JSON.stringify(data))}});g.player.inventory.addItem(i);g.extensionRuntime!.bindItemData(i);return i;}
function enchant(g:ReturnType<typeof open>,target:ReturnType<typeof add>){while(logger.pendingAcknowledgment)logger.acknowledgeNext();const s=ItemLoader.spawnScroll('scroll_of_enchantment',-1,-1)!;g.player.inventory.addItem(s);const scroll=g.player.inventory.stackFor(s)!;ItemLoader.identifyItemKind(scroll);g.executeItemCommand('read',scroll);expect(g.pendingEnchantment).toBe(true);g.executeItemCommand('enchant',target);expect(g.pendingEnchantment).toBe(false);expect(g.player.inventory.items).not.toContain(scroll);}
const ledger=(g:ReturnType<typeof open>)=>g.extensionRuntime!.snapshot().components[g.player.id]!['growth:items'];
it('multilevel output clamps before receipt; next scroll refines at most once; run cap spans targets',()=>{
 const g=open({conversion:5,perItemCap:3,runCap:3}),a=add(g),b=add(g,0);enchant(g,a);expect((a.moduleData!.loot as unknown as LootItemDataV1).enhancement).toBe(8);expect(a.timesEnchanted).toBe(1);expect(ledger(g)).toEqual({awarded:{scroll_of_enchantment:1}});
 enchant(g,a);expect(a.timesEnchanted).toBe(2);expect(ledger(g)).toEqual({awarded:{scroll_of_enchantment:2}});enchant(g,b);expect((b.moduleData!.loot as unknown as LootItemDataV1).enhancement).toBe(1);expect(ledger(g)).toEqual({awarded:{scroll_of_enchantment:3}});
});
it('zero output consumes the accepted action but never secretly refines or increments counters',()=>{const g=open({conversion:0}),a=add(g,8),before=JSON.stringify(a.moduleData);enchant(g,a);expect(JSON.stringify(a.moduleData)).toBe(before);expect(a.timesEnchanted).toBe(0);expect(ledger(g)).toEqual({awarded:{}});});
it.each(['attribute-points','skill-points'])('replacement %s works even when target is full with no refinable values',destination=>{
 const g=open({nativeEffect:'replace',destination,conversion:4,runCap:5}),a=add(g,8);(a.moduleData!.loot as unknown as LootItemDataV1).affixes[0]!.values=[2500];a.isCursed=true;
 expect(g.canEnchantTarget(a)).toBe(true);enchant(g,a);expect(a.timesEnchanted).toBe(0);expect(a.isCursed).toBe(false);expect(ledger(g)).toEqual({awarded:{scroll_of_enchantment:4}});enchant(g,a);expect(ledger(g)).toEqual({awarded:{scroll_of_enchantment:5}});expect(g.loadSnapshot(g.toSnapshot())).toBe(true);
});

it('controlled current-version enhancement/refinement/rune chain spans checkpoint boundaries and continues',async()=>{
 // Controlled birth fixture, installed for scratch seek Games too; never a natural-drop claim.
 const prototype=Game.prototype as unknown as {generateDepth(up?:boolean,first?:boolean,fell?:boolean):void},generate=prototype.generateDepth;
 vi.spyOn(prototype,'generateDepth').mockImplementation(function(this:Game,up,first,fell){
  generate.call(this,up,first,fell);if(!first||!this.extensionRuntime)return;
  const c=resolveLootCatalog(this.extensionRuntime.queryOptional.bind(this.extensionRuntime)),a=c.affixes.find(a=>a.rune?.runicType==='absorption')!;
  const data:LootItemDataV1={v: 4,baseId:'leather_armor',ilvl:40,rarity:'rare',uniqueId:null,setId: null, pieceId: null, identityKnown: false,affixes:[{id:'loot.affix.fireward',tier:1,values:[800],known:false},{id:a.id,tier:1,values:a.tiers[0]!.ranges.map(r=>r[0]),known:false}],corrupted:false,enhancement:5,sockets:0,socketed:[],nameParts:[0,0],origin:{source:'floor',depth:1}},n=deriveNativeFacts(data,c);
  const item=assembleDropItem({native:{kind:n.kind,category:n.category,enchantment:n.enchantment,runicType:n.runicType,isCursed:false,identified:false,familiarityRemaining:1000},moduleData:{loot:JSON.parse(JSON.stringify(data))}});
  this.player.inventory.addItem(item);this.extensionRuntime.bindItemData(item);
  const scroll=ItemLoader.spawnScroll('scroll_of_enchantment',-1,-1)!;scroll.quantity=2;this.player.inventory.addItem(scroll);ItemLoader.identifyItemKind(scroll);
  this.grid.setTerrain(this.player.x+1,this.player.y,TerrainType.FLOOR);const rat=new Monster(this.player.x+1,this.player.y,(monsters as MonsterData[]).find(m=>m.id==='rat')!);rat.hp=rat.maxHp=10000;rat.state=MonsterState.HUNTING;rat.accuracy=1000;this.monsters.push(rat);this.extensionRuntime.attachCreature(rat);
 });
 const h=createWorldHarness({seed:42,mode:'easy',modules:['growth','loot']});handles.push(h);const g=worldHarnessGame(h);
 const item=()=>g.player.inventory.items.find(i=>i.runicType==='absorption')!,data=()=>item().moduleData!.loot as unknown as LootItemDataV1;
 const command=(action:string)=>{while(logger.pendingAcknowledgment)logger.acknowledgeNext();h.command(action);};
 const pad=(n:number)=>{while(g.recordedInputEvents.length<n){const before=g.recordedInputEvents.length;command('escape');expect(g.recordedInputEvents.length).toBe(before+1);}};
 pad(254);
 const use=()=>{while(logger.pendingAcknowledgment)logger.acknowledgeNext();g.executeItemCommand('read',g.player.inventory.items.find(i=>i.consumableId==='scroll_of_enchantment')!);g.executeItemCommand('enchant',item());};
 use();expect(data().enhancement).toBe(6);expect(item().timesEnchanted).toBe(1);use();expect(item().timesEnchanted).toBe(2);
 expect(data().affixes.find(a=>a.id.includes('rune'))!.known).toBe(false);
 while(logger.pendingAcknowledgment)logger.acknowledgeNext();g.executeItemCommand('equip',item());for(let turn=0;turn<10&&!data().affixes.find(a=>a.id.includes('rune'))!.known;turn++)command('wait');
 expect(data().affixes.find(a=>a.id.includes('rune'))!.known).toBe(true);expect(data().affixes.some(a=>!a.known)).toBe(true);
 pad(2049);await g.flushRecording();const save=h.save(),recording=JSON.stringify(await g.exportRecordingAsync()),digest=h.digest();
 h.load(save);expect(h.digest()).toBe(digest);expect(h.replay(recording)).toEqual({ok:true,firstMismatch:null});expect(h.digest()).toBe(digest);
 for(const cursor of [255,256,257,2047,2048,2049]){h.seek(recording,cursor);expect(g.replayCursor).toBe(cursor);expect(g.replayError).toBeNull();}
 h.load(save);command('escape');const continued=h.exportRecording(),final=h.digest();expect(h.replay(continued)).toEqual({ok:true,firstMismatch:null});expect(h.digest()).toBe(final);
},60000);
it.each(['enchantment','attribute-points','skill-points'])('C2 socket hard veto survives growth destination %s without changing capped C1 behavior',async destination=>{
 const g=open(destination==='enchantment'?{conversion:5}:{nativeEffect:'replace',destination,conversion:4}),a=add(g,0);
 a.moduleData={loot:{...a.moduleData!.loot as Record<string,import('../../../types').Json>,rarity:'normal',affixes:[],sockets:2,socketed:['loot.rune.ka']}};
 g.extensionRuntime!.validateItemData(a,'update');
 expect(g.canEnchantTarget(a)).toBe(false);expect(g.extensionRuntime!.itemEnhancementAllowed(a)).toBe(false);
 const s=ItemLoader.spawnScroll('scroll_of_enchantment',-1,-1)!;g.player.inventory.addItem(s);ItemLoader.identifyItemKind(s);
 while(logger.pendingAcknowledgment)logger.acknowledgeNext();g.executeItemCommand('read',s);
 const before=JSON.stringify(a.moduleData),awards=structuredClone(ledger(g)),random=(await import('../../../../engine/Random')).rng.getState();
 g.executeItemCommand('enchant',a);expect(g.player.inventory.items).toContain(s);expect(JSON.stringify(a.moduleData)).toBe(before);expect(ledger(g)).toEqual(awards);expect((await import('../../../../engine/Random')).rng.getState()).toEqual(random);
});
