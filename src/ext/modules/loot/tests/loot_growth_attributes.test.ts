import {writeFileSync} from 'node:fs';
import {TerrainType} from '../../../../engine/Map/Grid';
import {isAutoDescent,isDeepWater} from '../../../../engine/Map/TerrainCatalog';
import {afterEach,expect,it,vi} from 'vitest';
import {Game} from '../../../../engine/Core/Game';
import {createWorldHarness,worldHarnessGame} from '../../../testing/worldHarness';
import {resolveLootCatalog} from '../session';
import {deriveNativeFacts,validateLootItemData} from '../item';
import type {LootItemDataV1} from '../types';
import {assembleDropItem} from '../../../../engine/Items/FixedItemAssembly';
import {rng} from '../../../../engine/Random';
import {getNextEntityId} from '../../../../entities/Creature';
import {auditFullObjectGraph} from '../../../../test/support/fullGenerationCheckpointOracle';
import {validateAttributeCatalog} from '../../../attributeCatalog';
import {Monster,MonsterState,type MonsterData} from '../../../../entities/Monster';
import species from '../../../../data/monsters.json';
import {markCreatureBirth} from '../../../birth';
import {prepareModuleCreation,buildModuleCreationCommands,buildModuleCreationConfigurations} from '../../../ui/creation';
import growthData from '../../growth/data/definitions.json';
import {descriptor as growthDescriptor} from '../../growth/descriptor';
import {parseGrowthDefinitionPack} from '../../growth/definitions';
import {createGrowthGameplay} from '../../growth/module';
import {extensionDataFingerprint} from '../../../fingerprint';
import type {GrowthAttributes} from '../../growth/components';
import type {GrowthSkillBuild} from '../../growth/skills';
const handles:ReturnType<typeof createWorldHarness>[]=[];
function open(modules=['loot','growth']){const h=createWorldHarness({seed:42,mode:'easy',modules:modules});handles.push(h);const g=worldHarnessGame(h);return {g,r:g.extensionRuntime!,p:g.player};}
afterEach(()=>{handles.splice(0).forEach(h=>h.dispose());vi.restoreAllMocks();});
it.each(['scarce','standard','bountiful'])('binds recommended growth+loot %s creation before first-floor drops and rejects malformed batches atomically',presetId=>{
 const plan=prepareModuleCreation(['growth','loot']),selected=new Map([
  ['growth',[JSON.stringify({module:'growth',action:'create-character',payload:{revision:0}})]],
  ['loot',[JSON.stringify({module:'loot',action:'create',payload:{v:1,presetId}})]],
 ]);
 const extensionConfigurations=buildModuleCreationConfigurations(plan,selected),initialCommands=buildModuleCreationCommands(plan,selected);
 expect(initialCommands).toHaveLength(2);expect(extensionConfigurations).toEqual({loot:{presetId}});
 const {g}=open(['growth','loot']);
 g.startNewGame({seed:42,mode:'wizard',ruleSet:'extended',extensions:plan.extensions,extensionConfigurations,initialCommands});g.animationEnabled=false;
 const r=g.extensionRuntime!,c=resolveLootCatalog(r.queryOptional.bind(r));expect(c.availability.growth?.attributes).toHaveLength(5);
 expect(r.snapshot().modules.loot).toMatchObject({created:true,presetId,catalogFingerprint:c.fingerprint});expect(r.snapshot().modules.growth).toMatchObject({created:true});
 expect(g.items.some(i=>i.moduleData?.loot)).toBe(true);
 for(const commands of [initialCommands.slice(1),[...initialCommands,initialCommands[0]!]]){
  const audit=auditFullObjectGraph([g,rng]),id=getNextEntityId();
  expect(()=>g.startNewGame({seed:43,mode:'wizard',ruleSet:'extended',extensions:['growth','loot'],extensionConfigurations,initialCommands:commands})).toThrow();
  expect(audit.differences()).toEqual([]);expect(getNextEntityId()).toBe(id);
 }
});
function ring(g:ReturnType<typeof worldHarnessGame>,affix:string,value=1,known=false,tier=1){
 const c=resolveLootCatalog(g.extensionRuntime!.queryOptional.bind(g.extensionRuntime));
 const data:LootItemDataV1={v: 6,baseId:'ring_of_regeneration',ilvl:tier===6?40:1,rarity:'magic',uniqueId:null,setId: null, pieceId: null, identityKnown: known,affixes:[{id:affix,tier,values:[value],known}],corrupted:false,enhancement:0,sockets:0,socketed:[],nameParts:null,origin:{source:'floor',depth:1}};
 validateLootItemData(data,c);const n=deriveNativeFacts(data,c),item=assembleDropItem({native:{kind:n.kind,category:n.category,enchantment:n.enchantment,runicType:n.runicType,isCursed:n.isCursed,identified:n.identified,familiarityRemaining:1500},moduleData:{loot:JSON.parse(JSON.stringify(data))}});
 g.player.inventory.addItem(item);g.extensionRuntime!.bindItemData(item);return item;
}
it('publishes five real fully mapped keys before and after load; fallback remains independent',()=>{
 const {g,r}=open(['loot','growth']),q=r.queryOptional('growth.attributes.v1',{v:1});expect(q.status).toBe('available');if(q.status!=='available')throw Error();validateAttributeCatalog(q.value);
 expect(q.value.attributes).toHaveLength(5);for(const a of q.value.attributes)expect(r.stats.value(g.player.id,a.stat)).toBe(0);
 expect(r.queryOptional('growth.attributes.v1',{v:2})).toEqual({status:'unavailable',reason:'unsupported-input'});
 const c=resolveLootCatalog(r.queryOptional.bind(r));expect(c.affixes.filter(a=>a.id.startsWith('loot.affix.adept.'))).toHaveLength(5);
 expect(c.affixes.some(a=>a.id==='loot.affix.sage')).toBe(true);expect(c.affixes.some(a=>a.id==='loot.affix.scholar')).toBe(true);
 expect(g.loadSnapshot(g.toSaveSnapshot())).toBe(true);expect(resolveLootCatalog(g.extensionRuntime!.queryOptional.bind(g.extensionRuntime)).fingerprint).toBe(c.fingerprint);
 const single=open(['loot']);const fallback=resolveLootCatalog(single.r.queryOptional.bind(single.r));expect(fallback.availability.growth).toBeNull();expect(fallback.affixes.some(a=>a.id.startsWith('loot.affix.adept'))).toBe(false);
});
it.each([['constitution','native.max-hp',3],['will','growth.focus-capacity',0],['strength-training','native.strength',1]])('effective %s derives once, known projection filters upstream, equip never refills',(attribute,downstream,delta)=>{
 const {g,r,p}=open(['loot','growth']),key=`growth.attribute:growth.attribute.${attribute}`,before=r.stats.value(p.id,downstream as string),item=ring(g,`loot.affix.adept.growth.attribute.${attribute}`);
 p.hp=10;const permanent=structuredClone(r.snapshot().components[p.id]!['growth:attributes']);p.equip(item);
 expect(r.stats.value(p.id,key)).toBe(1);expect(r.stats.value(p.id,downstream as string)).toBe(before+Number(delta));
 expect(r.stats.hypothetical(p.id,{},true)[key]).toBe(0);expect(r.stats.hypothetical(p.id,{},true)[downstream as string]).toBe(before);
 const audit=auditFullObjectGraph([g,rng]),id=getNextEntityId();for(let i=0;i<3;i++)r.stats.hypothetical(p.id,{},true);expect(audit.differences()).toEqual([]);expect(getNextEntityId()).toBe(id);
 expect(r.snapshot().components[p.id]!['growth:attributes']).toEqual(permanent);expect(p.hp).toBe(10);r.assertStats();
 p.unequip(item,true);expect(r.stats.value(p.id,downstream as string)).toBe(before);expect(p.hp).toBe(10);
 g.executeItemCommand('equip',item);expect((item.moduleData!.loot as unknown as LootItemDataV1).affixes[0]!.known).toBe(true);r.assertStats();
});
it('sage and scholar reveal only their actual commit; repeat reads and rebuild never trigger',()=>{
 const {g,r,p}=open(['loot','growth']),sage=ring(g,'loot.affix.sage'),scholar=ring(g,'loot.affix.scholar',600);
 const focus=r.stats.value(p.id,'growth.focus-capacity');p.equip(sage);p.equip(scholar);
 expect(r.stats.value(p.id,'growth.focus-capacity')).toBe(focus+1);expect(r.stats.value(p.id,'growth.xp-gain',{baseValue:100})).toBe(106);
 expect([sage,scholar].every(i=>!(i.moduleData!.loot as unknown as LootItemDataV1).affixes[0]!.known)).toBe(true);
 p.unequip(sage,true);g.executeItemCommand('equip',sage);expect((sage.moduleData!.loot as unknown as LootItemDataV1).affixes[0]!.known).toBe(true);
 expect((scholar.moduleData!.loot as unknown as LootItemDataV1).affixes[0]!.known).toBe(false);
 // Real identification award via the existing settled-kind hook, controlled reward fixture.
 r.emit('simulationSettled',{knownKinds:[{id:'b3-fixture-kind',category:'potion'}],reachableIds:[p.id,...g.monsters.map(m=>m.id)],sourceIds:[]});
 expect((scholar.moduleData!.loot as unknown as LootItemDataV1).affixes[0]!.known).toBe(true);
});

it('agility uses probability basis points on both sides, and two will rings cross the floor once',()=>{
 const {g,r,p}=open(['loot','growth']),target=g.monsters[0]!;
 const facts={baseValue:5000,attackKind:'melee' as const,probabilityRoll:true};
 const attack=r.stats.evaluatePair(p.id,target.id,'hit',facts),defense=r.stats.evaluatePair(target.id,p.id,'hit',facts),accuracy=r.stats.value(p.id,'native.accuracy');
 const item=ring(g,'loot.affix.adept.growth.attribute.agility');p.equip(item);
 expect(r.stats.evaluatePair(p.id,target.id,'hit',facts)).toBe(attack+100);
 expect(r.stats.evaluatePair(target.id,p.id,'hit',facts)).toBe(defense-50);
 expect(r.stats.value(p.id,'native.accuracy')).toBe(accuracy);
 expect(r.stats.hypotheticalValue(p.id,{},'native.hit-chance',true,facts)).toBe(5000);
 p.unequip(item,true);
 const capacity=r.stats.value(p.id,'growth.focus-capacity');
 p.equip(ring(g,'loot.affix.adept.growth.attribute.will'));expect(r.stats.value(p.id,'growth.focus-capacity')).toBe(capacity);
 p.equip(ring(g,'loot.affix.adept.growth.attribute.will'));expect(r.stats.value(p.id,'growth.focus-capacity')).toBe(capacity+1);
});

it('a real command kill commits scholar XP; an unequipped spare and zero reward do not reveal',()=>{
 const {g,r,p}=open(['loot','growth']),item=ring(g,'loot.affix.scholar',600),spare=ring(g,'loot.affix.scholar',600);
 p.equip(item);const known=(i:typeof item)=>(i.moduleData!.loot as unknown as LootItemDataV1).affixes[0]!.known;
 const xp=()=>Number((r.readModuleView('growth')!.components.progression as {experience:number}).experience);
 const before=xp();g.executeCommand('wait');expect(xp()).toBe(before);expect(known(item)).toBe(false);
 const target=new Monster(p.x+1,p.y,(species as MonsterData[]).find(m=>m.id==='rat')!);target.hp=1;target.state=MonsterState.HUNTING;
 g.grid.setTerrain(target.x,target.y,TerrainType.FLOOR,'.',0x999999);markCreatureBirth(target,'natural');g.monsters.push(target);r.attachCreature(target);
 for(let i=0;i<20&&target.hp>0;i++)g.executeCommand('move',{x:1,y:0});
 expect(target.hp).toBeLessThanOrEqual(0);expect(xp()).toBeGreaterThan(before);expect(known(item)).toBe(true);expect(known(spare)).toBe(false);
 const after=xp();r.stats.value(p.id,'growth.xp-gain',{baseValue:0});expect(xp()).toBe(after);expect(known(spare)).toBe(false);
});

it('two training rings share cap four without permanent investment, and known projection caps after filtering',()=>{
 const {g,r,p}=open(['loot','growth']),key='growth.attribute:growth.attribute.strength-training';
 const before=r.stats.value(p.id,'native.strength'),permanent=structuredClone(r.snapshot().components[p.id]!['growth:attributes']);
 const first=ring(g,'loot.affix.adept.growth.attribute.strength-training',3,true,6),second=ring(g,'loot.affix.adept.growth.attribute.strength-training',3,false,6);
 p.equip(first);p.equip(second);expect(r.stats.value(p.id,key)).toBe(4);expect(r.stats.value(p.id,'native.strength')).toBe(before+4);
 expect(r.stats.hypothetical(p.id,{},true)[key]).toBe(3);expect(r.stats.hypothetical(p.id,{},true)['native.strength']).toBe(before+3);
 expect(r.snapshot().components[p.id]!['growth:attributes']).toEqual(permanent);
 p.unequip(second,true);expect(r.stats.value(p.id,'native.strength')).toBe(before+3);
 g.executeItemCommand('equip',second);expect((second.moduleData!.loot as unknown as LootItemDataV1).affixes[0]!.known).toBe(true);
 expect(r.stats.value(p.id,key)).toBe(4);r.assertStats();
});

it('a real skill captures effective equipment attributes without making them permanent',()=>{
 const {g}=open(['loot','growth']);
 g.startNewGame({seed:42,mode:'wizard',ruleSet:'extended',extensions:['growth','loot'],initialCommands:[JSON.stringify({module:'growth',action:'create-character',payload:{revision:0,professionId:'growth.profession.scout',lineageId:'growth.lineage.stoneborn',faithId:'growth.faith.unaffiliated',choices:[]}}),JSON.stringify({module:'loot',action:'create',payload:{v:1,presetId:'standard'}})]});g.animationEnabled=false;
 const r=g.extensionRuntime!,item=ring(g,'loot.affix.adept.growth.attribute.will',3,true,6);g.executeItemCommand('equip',item);
 g.executeCommand('ext:command',JSON.stringify({module:'growth',action:'use-skill',payload:{revision:r.readModuleView('growth')!.state.revision,skillId:'growth.skill.hold-breath',target:{kind:'self'}}}));
 const effects=()=>((r.snapshot().components[g.player.id]!['growth:skill-build'] as unknown as {effects:{source:{attributes:Record<string,number>}}[]}).effects);
 expect(effects()).toHaveLength(1);expect(effects()[0]!.source.attributes['growth.attribute.will']).toBe(3);
 g.executeItemCommand('unequip',item);expect(r.stats.value(g.player.id,'growth.attribute:growth.attribute.will')).toBe(0);
 expect(effects()[0]!.source.attributes['growth.attribute.will']).toBe(3);
});

it('R1-F1 saves and replays effective skill snapshots above the permanent total cap',()=>{
 const raw=structuredClone(growthData);raw.config.attributeTotalCap=4;
 const pack=parseGrowthDefinitionPack(raw,{moduleVersion:raw.moduleVersion,hasText:()=>true});
 const rules={schema:1,version:raw.rulesVersion,fingerprint:extensionDataFingerprint(raw)};
 // Deterministic test-only birth scene: seek also creates scratch Games, so use this Game,
 // never a captured live-game reference. This is controlled equipment, not a natural drop.
 const prototype=Game.prototype as unknown as {generateDepth(up?:boolean,first?:boolean,fell?:boolean):void};
 const generate=prototype.generateDepth;
 vi.spyOn(prototype,'generateDepth').mockImplementation(function(this:Game,up,first,fell){
  generate.call(this,up,first,fell);
  if(first&&this.extensionRuntime)ring(this,'loot.affix.adept.growth.attribute.will',3,true,6);
 });
 const h=createWorldHarness({seed:42,mode:'easy',modules:['growth','loot']},[{...growthDescriptor,rules,create:()=>createGrowthGameplay(pack,rules)}]);
 handles.push(h);const game=worldHarnessGame(h);
 game.startNewGame({seed:42,mode:'wizard',ruleSet:'extended',extensions:['growth','loot'],initialCommands:[JSON.stringify({module:'growth',action:'create-character',payload:{revision:0,professionId:'growth.profession.scout',lineageId:'growth.lineage.stoneborn',faithId:'growth.faith.unaffiliated',choices:[]}}),JSON.stringify({module:'loot',action:'create',payload:{v:1,presetId:'standard'}})]});game.animationEnabled=false;
 const attributes=()=>game.extensionRuntime!.snapshot().components[game.player.id]!['growth:attributes'] as unknown as GrowthAttributes;
 const build=()=>game.extensionRuntime!.snapshot().components[game.player.id]!['growth:skill-build'] as unknown as GrowthSkillBuild;
 const permanent=structuredClone(attributes());expect(Object.values(permanent.values).reduce((a,b)=>a+b,0)).toBe(3);
 const item=game.player.inventory.items.find(i=>(i.moduleData?.loot as unknown as LootItemDataV1|undefined)?.affixes.some(a=>a.id==='loot.affix.adept.growth.attribute.will'))!;
 expect(item).toBeDefined();game.executeItemCommand('equip',item);
 expect(game.extensionRuntime!.stats.value(game.player.id,'growth.attribute:growth.attribute.will')).toBe(3);
 h.load(h.save()); // Before casting remains valid, as in the independent reproduction.
 h.ext('growth','use-skill',{revision:game.extensionRuntime!.readModuleView('growth')!.state.revision!,skillId:'growth.skill.hold-breath',target:{kind:'self'}});
 expect(build().effects).toHaveLength(1);
 const captured=structuredClone(build().effects[0]!.source);
 expect(captured.attributes['growth.attribute.will']).toBe(3);expect(Object.values(captured.attributes).reduce((a,b)=>a+b,0)).toBe(6);
 expect(attributes()).toEqual(permanent);
 const save=h.save(),recording=h.exportRecording(),digest=h.digest(),events=JSON.parse(recording).events.length;
 h.load(save);expect(h.digest()).toBe(digest);expect(build().effects[0]!.source).toEqual(captured);
 expect(h.replay(recording)).toEqual({ok:true,firstMismatch:null});expect(h.digest()).toBe(digest);
 h.seek(recording,events-1);h.seek(recording,events);expect(h.digest()).toBe(digest);expect(build().effects[0]!.source).toEqual(captured);
 h.load(save);game.executeItemCommand('unequip',game.player.inventory.items.find(i=>i.id===item.id)!);
 expect(game.extensionRuntime!.stats.value(game.player.id,'growth.attribute:growth.attribute.will')).toBe(0);
 expect(build().effects[0]!.source).toEqual(captured);expect(attributes()).toEqual(permanent);
 const continuedSave=h.save(),continued=h.exportRecording(),continuedDigest=h.digest();h.load(continuedSave);
 expect(build().effects[0]!.source).toEqual(captured);expect(h.digest()).toBe(continuedDigest);
 expect(h.replay(continued)).toEqual({ok:true,firstMismatch:null});expect(h.digest()).toBe(continuedDigest);
});

async function walk(g:ReturnType<typeof worldHarnessGame>,target:{x:number;y:number}){
 const initialDepth=g.depth;
 const key=(p:{x:number;y:number})=>`${p.x},${p.y}`;
 for(let attempt=0;attempt<500;attempt++){
  if(g.recordingInputBlocked)await g.flushRecording();
  if(g.depth!==initialDepth||key(g.player.loc)===key(target))return;
  const queue=[{...g.player.loc}],previous=new Map<string,{x:number;y:number}|null>([[key(g.player.loc),null]]);
  for(let n=0;n<queue.length&&!previous.has(key(target));n++)for(const [dx,dy]of [[0,-1],[-1,0],[1,0],[0,1]]){
   const p=queue[n]!,at={x:p.x+dx!,y:p.y+dy!},c=g.grid.getCell(at.x,at.y);
   if(c&&(c.isPassable||c.layers.includes(TerrainType.DOOR)||c.layers.includes(TerrainType.SECRET_DOOR))&&!c.layers.some(t=>isAutoDescent(t)||isDeepWater(t)||t===TerrainType.LAVA)&&!previous.has(key(at))){previous.set(key(at),p);queue.push(at);}
  }
  if(!previous.has(key(target)))throw Error(`No safe loot route D${g.depth} ${JSON.stringify(target)} terrain=${JSON.stringify(g.grid.getCell(target.x,target.y)?.layers)}`);
  let at=target,next=at;while(previous.get(key(at))){next=at;at=previous.get(key(at))!;}
  if(g.grid.getCell(next.x,next.y)!.layers.includes(TerrainType.SECRET_DOOR))g.executeCommand('search');else g.executeCommand('move',{x:next.x-g.player.x,y:next.y-g.player.y});
  while(g.pendingCommandConfirmation)g.resolveCommandDecision(g.pendingCommandConfirmation.token,true);
 }
 throw Error('Loot route budget '+JSON.stringify({depth:g.depth,loc:g.player.loc,target,locked:g.isInputLocked(),over:g.isGameOver,pending:g.pendingCommandConfirmation,inventory:g.isInventoryOpen}));
}

it('natural growth+loot creation, XP, allocation and attribute equipment replay and resume',async()=>{
 const h=createWorldHarness({seed:36,mode:'easy',modules:['loot','growth']});handles.push(h);const g=worldHarnessGame(h);
 g.startNewGame({seed:36,mode:'wizard',ruleSet:'extended',extensions:['growth','loot'],initialCommands:[JSON.stringify({module:'growth',action:'create-character',payload:{revision:0}}),JSON.stringify({module:'loot',action:'create',payload:{v:1,presetId:'standard'}})]});g.animationEnabled=false;
 const progression=()=>g.extensionRuntime!.readModuleView('growth')!.components.progression as {level:number;attributePoints:number};
 let equipped=false;
 for(let floor=0;floor<6&&(!equipped||progression().attributePoints<1);floor++){
  const item=[...g.items,...g.player.inventory.items].find(i=>!i.isCursed&&(i.moduleData?.loot as unknown as LootItemDataV1|undefined)?.affixes.some(a=>a.id.startsWith('loot.affix.adept.')));
  if(item&&!equipped){
   if(!g.player.inventory.items.includes(item)){await walk(g,item.loc);g.executeCommand('pickup');}
   expect(g.player.inventory.items).toContain(item);
   g.executeItemCommand('equip',item);expect([g.player.equippedWeapon,g.player.equippedArmor,g.player.ringLeft,g.player.ringRight]).toContain(item);
   expect((item.moduleData!.loot as unknown as LootItemDataV1).affixes.find(a=>a.id.startsWith('loot.affix.adept.'))!.known).toBe(true);
   g.executeItemCommand('unequip',item);g.executeItemCommand('equip',item);equipped=true;
  }
  if(equipped&&progression().attributePoints>=1)break;
  const depth=g.depth;await walk(g,g.levelSeeds[g.depth-1]!.downStairsLoc);if(g.depth===depth)g.executeCommand('stairs_down');
 }
 expect(equipped).toBe(true);expect(progression().level).toBeGreaterThan(1);
 const points=progression().attributePoints,revision=g.extensionRuntime!.readModuleView('growth')!.state.revision;
 g.executeCommand('ext:command',JSON.stringify({module:'growth',action:'allocate',payload:{revision,attributes:{'growth.attribute.constitution':1}}}));
 expect(progression().attributePoints).toBe(points-1);g.extensionRuntime!.assertStats();
 const save=h.save(),recording=h.exportRecording(),digest=h.digest();h.load(save);expect(h.digest()).toBe(digest);
 expect(h.replay(recording)).toEqual({ok:true,firstMismatch:null});expect(h.digest()).toBe(digest);
 h.seek(recording,Math.floor(JSON.parse(recording).events.length/2));h.seek(recording,JSON.parse(recording).events.length);expect(h.digest()).toBe(digest);
 h.load(save);h.command('escape');const continued=h.exportRecording();expect(h.replay(continued).ok).toBe(true);
 if(process.env.PHASE6B3_EXPORT){writeFileSync(process.env.PHASE6B3_EXPORT+'-save.json',save);writeFileSync(process.env.PHASE6B3_EXPORT+'-recording.json',continued);}
},60000);
