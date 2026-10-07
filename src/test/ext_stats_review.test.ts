import { afterEach, describe, expect, it, vi } from 'vitest';
import monsters from '../data/monsters.json';
import mutations from '../data/mutations.json';
import { Monster, MonsterState, type MonsterData, type MutationData } from '../entities/Monster';
import { Player } from '../entities/Player';
import { Item, ItemCategory } from '../engine/Items/Item';
import { ItemLoader } from '../engine/Items/ItemLoader';
import { swapItemToEnchantLevel } from '../engine/Items/Commutation';
import { StatPipeline, evaluateStat, type OwnedStatRow } from '../engine/Stats/StatPipeline';
import { MaterializedStats } from '../engine/Stats/MaterializedStats';
import { NATIVE_STAT_KEYS, NATIVE_STAT_DAG } from '../engine/Stats/NativeStatKeys';
import { nativeStat, nativeRational, markStatsDirty } from '../engine/Stats/NativeStatSources';
import { validateStatRows } from '../ext/stats';
import type { StatModifierRow } from '../ext/stats';
import { ExtensionRegistry } from '../ext/registry';
import { createExtensionRegistry } from '../ext/catalog';
import { ExtensionRuntime } from '../ext/runtime';
import { isJson } from '../ext/json';
import { CombatSystem } from '../engine/Combat/Combat';
import { rng, Random } from '../engine/Random';
import { createHeadlessGame } from './harness';
import type { Game } from '../engine/Core/Game';
import { TerrainType } from '../engine/Map/Grid';
import { logger } from '../engine/Systems/Logger';
const data=(id:string)=>(monsters as MonsterData[]).find(row=>row.id===id)!;
const row=(stat:string,value:number,extra:Partial<StatModifierRow>={}):OwnedStatRow=>({owner:'loot',stat,value,category:'flat',layer:'equipment',sourceKind:'fixture',sourceId:'loot.fixture',...extra});
function fixture(collect:(id:number)=>readonly OwnedStatRow[], actors:Player|Monster=new Player(4,4)){
 const registry=new ExtensionRegistry();registry.register('loot','1.0.0',()=>({id:'loot',version:'1.0.0',initialState:()=>({}),validateState:isJson,statSources:{collect:a=>collect(a.id).map(({owner:_,...r})=>r)}}));
 const runtime=new ExtensionRuntime(registry,registry.manifest(['loot']),{playerId:()=>actors.id,depth:()=>1,randomInt:()=>0,message:()=>undefined});runtime.attachCreature(actors);return runtime;
}
type AttackOptions=NonNullable<Parameters<typeof CombatSystem.attack>[2]>;
function attackInDelivery(runtime:ExtensionRuntime|undefined,attacker:Monster,defender:Player,options:AttackOptions){
 const execute=()=>CombatSystem.attack(attacker,defender,options);
 // Production BE_ATTACK inherits the bolt's causality scope; delivery alone
 // only classifies the stamina gate and does not select the resolver.
 return runtime&&options.delivery==='bolt'?runtime.causality.withOrigin(runtime.causality.create('bolt',attacker.id,attacker.id,null),execute):execute();
}
afterEach(()=>{vi.restoreAllMocks();logger.reset();});
describe('5A2-S review regressions',()=>{
 it('F1 preserves every CE monster speed under slow/haste and all mutations, including spell-slow actors',()=>{
  let high=0,spell=0;
  for(const info of monsters as MonsterData[])for(const mutation of [undefined,...mutations as MutationData[]])for(const status of [undefined,'slowed','hasted'] as const){
   const actor=new Monster(4,4,info);if(mutation)actor.mutate(mutation);if(status)actor.applyStatus(status,10);
   expect(nativeStat(actor,'native.attack-speed'),`${info.id}/${mutation?.id}/${status}`).toBe(actor.attackSpeed);
   expect(nativeStat(actor,'native.move-speed')).toBe(actor.movementSpeed);
   if(actor.attackSpeed>400)high++;if(actor.hasBehavior('MONST_CAST_SPELLS_SLOWLY'))spell++;
  }
  expect(high).toBeGreaterThan(0);expect(spell).toBeGreaterThan(0);
 });
 it('F1 clamps module speeds to 25..max(400, CE speed), and zero rows preserve slow turret identity',()=>{
  const actor=new Monster(4,4,data('ogre_totem'));actor.applyStatus('slowed',10);let amount=0;
  const runtime=fixture(()=>[row('native.attack-speed',amount)],actor);
  expect(nativeStat(actor,'native.attack-speed')).toBe(800);
  amount=1000;markStatsDirty(actor);expect(nativeStat(actor,'native.attack-speed')).toBe(800);
  amount=-1000;markStatsDirty(actor);expect(nativeStat(actor,'native.attack-speed')).toBe(25);runtime.assertStats();
 });
 it('F2 equipment cannot refill when a permanent growth row shares max HP; permanent recovery is explicit',()=>{
  const actor={maxHp:40,hp:20};let equipment=0,permanent=10;const ledger=new MaterializedStats();ledger.set(1,'native.max-hp',10);
  const pipeline=new StatPipeline({actor:()=>({id:1,name:'',hp:actor.hp,maxHp:actor.maxHp,x:0,y:0,player:true,allied:true,hostile:false,monsterId:null,statuses:[],tags:[]}),revision:()=>0,
   base:(_id,key)=>key==='native.max-hp'?actor.maxHp-ledger.bonus(1,key):key==='native.strength'?12:0,
   collect:()=>[{...row('native.max-hp',permanent,{layer:'character',grantPolicy:'refill-delta'}),owner:'growth'},...(equipment?[row('native.max-hp',equipment)]:[])]},NATIVE_STAT_KEYS,NATIVE_STAT_DAG);
  const reconcile=()=>{pipeline.clear();ledger.reconcile(1,pipeline,()=>undefined,(key,value,refill)=>{if(key==='native.max-hp'){actor.maxHp=value;actor.hp=Math.min(value,actor.hp+refill);}});};
  reconcile();for(let i=0;i<3;i++){equipment=30;reconcile();expect(actor).toEqual({maxHp:70,hp:20});equipment=0;reconcile();expect(actor).toEqual({maxHp:40,hp:20});}
  permanent=13;reconcile();expect(actor).toEqual({maxHp:43,hp:20});
  // A provider's resource proposal adds only its three permanent HP.
  actor.hp+=3;equipment=30;reconcile();expect(actor).toEqual({maxHp:73,hp:23});
 });
 it.each(['native.attack-speed','native.move-speed'])('F4 %s accepts negative more and clamps its slot at -5000 bp',stat=>{
  const key=NATIVE_STAT_KEYS.find(key=>key.id===stat)!;
  expect(evaluateStat(key,100,[row(stat,-2500,{category:'more',slot:'equipment'})]).value).toBe(75);
  expect(evaluateStat(key,100,[row(stat,-9000,{category:'more',slot:'equipment'})]).value).toBe(50);
 });
 it('F5 mending ring units traverse the regeneration DAG and equal a physical ring in exact fractions',()=>{
  const actor=new Player(4,4);let bonus=0;fixture(()=>[row('native.regeneration-bonus',bonus)],actor);
  for(bonus=1;bonus<=5;bonus++){markStatsDirty(actor);const expected=new Player(4,4),ring=new Item('ring','=',1,ItemCategory.RING);ring.identityId='ring_of_regeneration';ring.enchantment=bonus;expected.inventory.items.push(ring);expected.equip(ring);expect(nativeRational(actor)).toEqual(nativeRational(expected));}
 });
 it.each(['native.max-hp','native.strength','combat.stamina-capacity','combat.poise-capacity','growth.focus-capacity'])('F6 rejects every conditional row on materialized %s before publication',stat=>{
  const declaration=NATIVE_STAT_KEYS.find(key=>key.id===stat)??{...NATIVE_STAT_KEYS.find(key=>key.id==='native.max-hp')!,id:stat,owner:stat.split('.')[0]!};
  const keys=new Map([[stat,declaration]]);
  for(const conditions of [[{kind:'hp-ratio',comparison:'at-least',value:10000}],[{kind:'self-status',value:'slowed'}],[{kind:'attack-kind',value:'melee'}],[]])expect(()=>validateStatRows([{...row(stat,10,{conditions:conditions as never}),owner:undefined}].map(({owner:_,...r})=>r),'loot',keys)).toThrow();
 });
 it('F7 other resistance scales ordinary damage but cannot prevent draining current HP or kamikaze',()=>{
  const actor=new Monster(4,4,data('bloat'));fixture(()=>[row('native.resist.other',7500)],actor);actor.hp=20;
  actor.takeDamage(8,true);expect(actor.hp).toBe(18);actor.hp=8;actor.takeDamage(8,true);expect(actor.hp).toBe(6);actor.drainCurrentHp();expect(actor.hp).toBe(0);
  const attacker=new Monster(4,4,data('bloat')),defender=new Player(5,4);fixture(()=>[row('native.resist.other',7500)],attacker);const hp=defender.hp;
  expect(CombatSystem.attack(attacker,defender).kamikazeSelfDestruct).toBe(true);expect(attacker.hp).toBe(0);expect(defender.hp).toBe(hp);
 });
 it.each([{}, {delivery:'bolt' as const}, {isWeaponAttack:false}])('F8 hit preview and physical pairs cover delivery %j with the same RNG sites',options=>{
  const attacker=new Monster(4,4,{...data('rat'),accuracy:50,damage:'4'}),defender=new Player(5,4);
  const runtime=fixture(id=>id===attacker.id?[row('native.hit-chance',1000),row('native.physical-damage-dealt',2500,{category:'increased'})]:[row('native.physical-damage-taken',2500,{category:'increased'})],attacker);runtime.attachCreature(defender);
  const percent=vi.spyOn(rng,'randPercent').mockReturnValue(true);
  expect(CombatSystem.previewHitChance(attacker,defender,options)).toBe(60);const result=attackInDelivery(runtime,attacker,defender,options);
  expect(percent.mock.calls[0]![0]).toBe(60);expect(result.damage).toBe(6);expect(defender.hp).toBe(defender.maxHp-6);
 });
 it.each([{}, {delivery:'bolt' as const}, {isWeaponAttack:false}])('F8 zero modifiers preserve CE damage and random consumption for %j',options=>{
  const run=(modified:boolean)=>{const attacker=new Monster(4,4,{...data('rat'),accuracy:55,damage:'2d3'}),defender=new Player(5,4);
   let runtime:ExtensionRuntime|undefined;if(modified){runtime=fixture(()=>[row('native.hit-chance',0),row('native.physical-damage-dealt',0,{category:'increased'})],attacker);runtime.attachCreature(defender);}
   rng.setState(new Random(510901).getState());const result=attackInDelivery(runtime,attacker,defender,options);return {result,hp:defender.hp,random:rng.getState()};};
  expect(run(true)).toEqual(run(false));
 });
 it.each([{}, {delivery:'bolt' as const}])('F8 theft uses the same adjusted second probability in delivery %j',options=>{
  const attacker=new Monster(4,4,{...data('monkey'),accuracy:50,damage:'0'}),defender=new Player(5,4);defender.inventory.items.push(new Item('food',':',1,ItemCategory.FOOD));
  const runtime=fixture(id=>id===attacker.id?[row('native.hit-chance',1000)]:[],attacker);runtime.attachCreature(defender);const percent=vi.spyOn(rng,'randPercent').mockReturnValue(true);
  attackInDelivery(runtime,attacker,defender,options);expect(percent.mock.calls.map(args=>args[0])).toEqual([60,60]);expect(attacker.carriedItem).not.toBeNull();
 });
 it('lazy dirtiness only sets flags, coalesces native writes, and recomputes at the next read',()=>{
  const actor=new Player(4,4);let calls=0;fixture(()=>{calls++;return [];},actor);nativeStat(actor,'native.defense');const before=calls;
  for(let i=0;i<20;i++)markStatsDirty(actor);expect(calls).toBe(before);nativeStat(actor,'native.defense');expect(calls).toBe(before+1);nativeStat(actor,'native.defense');expect(calls).toBe(before+1);
 });
 it('admission reuse revalidates changed native inputs and activated conditions',()=>{
  const actor=new Player(4,4),conditional=['native','equipment','character','temporary','environment'].map(slot=>row('native.regeneration',1,{category:'more',slot,sourceId:`loot.${slot}`,conditions:[{kind:'hp-ratio',comparison:'at-most',value:5000}]}));
  const runtime=fixture(()=>conditional,actor);runtime.stats.validateSources(actor.id);actor.hp=10;markStatsDirty(actor);expect(()=>runtime.stats.validateSources(actor.id)).toThrow();
  actor.hp=actor.maxHp;runtime.stats.validateSources(actor.id);actor.strength=NaN;markStatsDirty(actor);expect(()=>runtime.stats.validateSources(actor.id)).toThrow();
 });
 it('identical module state/component writes do not invalidate source preflight',()=>{
  const actor=new Player(4,4),registry=new ExtensionRegistry();let calls=0;
  registry.register('loot','1.0.0',()=>({id:'loot',version:'1.0.0',initialState:()=>({}),validateState:isJson,statSources:{collect:()=>{calls++;return [];}},commands:{same(_payload,c){c.setState({});c.setComponent(actor.id,'fixture',{});c.setComponent(actor.id,'fixture',{});}}}));
  const runtime=new ExtensionRuntime(registry,registry.manifest(['loot']),{playerId:()=>actor.id,depth:()=>1,randomInt:()=>0,message:()=>undefined});runtime.attachCreature(actor);
  const command=()=>runtime.command(JSON.stringify({module:'loot',action:'same',payload:{}}));command();const before=calls;command();expect(calls).toBe(before);
 });
 it('F3 invalidates commutation, unidentified ring discovery and inventory stack merging',()=>{
  const actor=new Player(4,4);fixture(()=>[],actor);const ring=new Item('ring','=',1,ItemCategory.RING);ring.identityId='ring_of_regeneration';ring.enchantment=4;ring.identified=false;actor.inventory.items.push(ring);actor.equip(ring);
  expect(nativeStat(actor,'native.regeneration-bonus')).toBe(1);ItemLoader.identifyInstance(ring);expect(nativeStat(actor,'native.regeneration-bonus')).toBe(4);swapItemToEnchantLevel(ring,2,true);expect(nativeStat(actor,'native.regeneration-bonus')).toBe(2);
  const weapon=new Item('dart',')',1,ItemCategory.WEAPON);weapon.identityId='dart';weapon.damage='1';weapon.strengthRequired=12;weapon.quiverNumber=9;actor.inventory.items.push(weapon);actor.equip(weapon);expect(nativeStat(actor,'native.weapon-enchant')).toBe(0);
  const incoming=new Item('dart',')',1,ItemCategory.WEAPON);incoming.identityId='dart';incoming.quiverNumber=9;incoming.enchantment=2;incoming.strengthRequired=12;actor.inventory.addItem(incoming);expect(nativeStat(actor,'native.weapon-enchant')).toBe(8);
 });
 it('F3 a stacked known strength potion invalidates the native grant before any flare/turn/knowledge callback',()=>{
  const registry=createExtensionRegistry(),initialCommands=registry.create(registry.manifest(['combat'])).flatMap(module=>module.initialCommand?[JSON.stringify({module:module.id,...module.initialCommand})]:[]);
  const game=createHeadlessGame(81431,'wizard');game.startNewGame({seed:81431,mode:'wizard',ruleSet:'extended',extensions:['combat'],initialCommands});game.animationEnabled=false;game.monsters=[];
  const potion=ItemLoader.spawnPotion('potion_of_strength',-1,-1)!;potion.quantity=2;ItemLoader.identifyInstance(potion);game.player.inventory.addItem(potion);const before=nativeStat(game.player,'native.effective-strength');let atFlare:number|undefined;
  vi.spyOn(game as unknown as {playerTurnEnded():void},'playerTurnEnded').mockImplementation(()=>{});
  const flares=game as unknown as {createFlare(...args:unknown[]):void},original=flares.createFlare.bind(game);vi.spyOn(flares,'createFlare').mockImplementation((...args)=>{atFlare=nativeStat(game.player,'native.effective-strength');original(...args);});
  game.executeItemCommand('quaff',game.player.inventory.stackFor(potion)!);expect(atFlare).toBe(before+1);expect(potion.quantity).toBe(1);
 });
 it.each(['reflection','weapon'])('F3 runic discovery in %s invalidates sources that read equipped runic knowledge',path=>{
  const game=createHeadlessGame(7397,'wizard'),actor=game.player,item=path==='reflection'?actor.equippedArmor!:actor.equippedWeapon!;
  item.runicType=path==='reflection'?'reflection':'paralyzing';item.runicKnown=false;
  const registry=new ExtensionRegistry();registry.register('loot','1.0.0',()=>({id:'loot',version:'1.0.0',initialState:()=>({}),validateState:isJson,
   statSources:{collect:(_actor,c)=>c.equippedItems().some(i=>i.runic.kind!==null&&i.runic.identified)?[{stat:'native.defense',value:10,category:'flat',layer:'equipment',sourceKind:'fixture',sourceId:'loot.runic-known'}]:[]}}));
  const runtime=new ExtensionRuntime(registry,registry.manifest(['loot']),{playerId:()=>actor.id,depth:()=>1,randomInt:()=>0,message:()=>undefined});runtime.attachCreature(actor);const before=nativeStat(actor,'native.defense');
  if(path==='reflection')(game as unknown as {observeBoltReflection(r:{creature:Player}):void}).observeBoltReflection({creature:actor});
  else {const target=new Monster(actor.x+1,actor.y,data('rat'));vi.spyOn(game as unknown as {canObserveBoltTarget(t:Monster):boolean},'canObserveBoltTarget').mockReturnValue(true);(game as unknown as {applyWeaponRunicEffect(t:Monster,d:number,r:string):void}).applyWeaponRunicEffect(target,1,'paralyzing');}
  expect(item.runicKnown).toBe(true);expect(nativeStat(actor,'native.defense')).toBe(before+10);
 });
 it.each(['geometry','takeTurn'])('F3 acid corrosion in %s invalidates cached defense before the next read and across save/load',path=>{
  const game=createHeadlessGame(7397,'wizard');game.startNewGame({seed:7397,mode:'wizard',ruleSet:'extended',extensions:['growth'],initialCommands:[JSON.stringify({module:'growth',action:'create-character',payload:{revision:0}})]});game.animationEnabled=false;game.monsters=[];game.player.loc={x:4,y:5};game.player.hp=game.player.maxHp;
  for(let x=2;x<=7;x++)for(let y=2;y<=7;y++){game.grid.setTerrain(x,y,TerrainType.FLOOR,'.',1);game.grid.getCell(x,y)!.isVisible=true;}
  const armor=game.player.equippedArmor!;armor.enchantment=0;markStatsDirty(game.player);const before=nativeStat(game.player,'native.defense');const mound=new Monster(5,5,{...data('acid_mound'),accuracy:10000});mound.state=MonsterState.HUNTING;game.monsters.push(mound);game.extensionRuntime!.attachCreature(mound);
  // Prime the exact vulnerable cache window after combat's damage/status dirtiness.
  const original=CombatSystem.attack;vi.spyOn(CombatSystem,'attack').mockImplementation((...args)=>{const result=original(...args);nativeStat(game.player,'native.defense');return result;});
  if(path==='takeTurn')mound.takeTurn(game,10);else (mound as unknown as {resolveGeometryAttackOn(g:Game,target:Player,voice:string):void}).resolveGeometryAttackOn(game,game.player,'hostile');
  expect(armor.enchantment).toBe(-1);expect(nativeStat(game.player,'native.defense')).toBe(before-10);game.executeCommand('escape');const saved=game.toSaveSnapshot();expect(game.loadSnapshot(saved)).toBe(true);expect(nativeStat(game.player,'native.defense')).toBe(before-10);
 });
});
