import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import '../../../../i18n';
import {Monster,MonsterState,type MonsterData} from '../../../../entities/Monster';
import monsters from '../../../../data/monsters.json';
import {Game} from '../../../../engine/Core/Game';
import {TerrainType} from '../../../../engine/Map/Grid';
import {commitCreatureAnchor} from '../../../../engine/Movement/CreatureSpatial';
import {ItemLoader} from '../../../../engine/Items/ItemLoader';
import {getNextEntityId} from '../../../../entities/Creature';
import {logger} from '../../../../engine/Systems/Logger';
import {rng} from '../../../../engine/Random';
import {nativeStat,markStatsDirty} from '../../../../engine/Stats/NativeStatSources';
import {withPartyActor,assertPartyRuntime} from '../../../../engine/Core/PartyRuntime';
import {mechanicalDigest} from '../../../../engine/Core/RecordingDigest';
import {withActorActionScope} from '../../../../engine/Core/ActorActionScope';
const games:Game[]=[];
const clear=()=>{while(logger.pendingAcknowledgment)logger.acknowledgeNext();};
beforeEach(()=>{vi.spyOn(Date,'now').mockReturnValue(1792252800000);});
afterEach(()=>{for(const g of games.splice(0))g.disposeRecording();clear();vi.restoreAllMocks();});
/** Deterministic test-world preparation precedes the real recording header on
 * both new game and seed replay. Commands, snapshots and checkpoint code are real. */
function fixture(prepare:(g:Game)=>void=()=>{},count=2,onDepth?:(g:Game)=>void){
 if(onDepth){const generate=(Game.prototype as any).generateDepth;vi.spyOn(Game.prototype as any,'generateDepth').mockImplementation(function(this:Game,...args:unknown[]){generate.apply(this,args);if(this.party)onDepth(this);});}
 const original=(Game.prototype as any).initializeParty;
 vi.spyOn(Game.prototype as any,'initializeParty').mockImplementation(function(this:Game){original.call(this);if(!this.party)return;this.monsters=[];for(let y=8;y<=12;y++)for(let x=18;x<=24;x++)this.grid.setTerrain(x,y,TerrainType.FLOOR);this.controlledActors.forEach((a,i)=>commitCreatureAnchor(a,{x:19+i*2,y:10}));prepare(this);(this as any).updateVision();});
 const g=new Game({seed:1});games.push(g);g.startNewGame({seed:42,ruleSet:'extended',extensions:['party'],extensionConfigurations:{party:{schema:1,members:count}},initialCommands:[JSON.stringify({module:'party',action:'create',payload:{schema:1,members:count}})]});g.animationEnabled=false;clear();return g;
}
function wait(g:Game,id:number){clear();g.submitPartyIntent({kind:'wait'},id);}
function control(g:Game,actorId:number,change:object){clear();g.executeCommand('party:control',{kind:'party:control',schema:1,expectedRevision:g.party!.state.revision,issuerSlot:'local:0',actorId,change});}
function digest(g:Game){return mechanicalDigest(g.toSnapshot(),(g as any).recordingInputState());}
function roundtrip(g:Game){clear();const expected=digest(g),random=rng.getState(),save=JSON.parse(JSON.stringify(g.toSaveSnapshot())),record=JSON.parse(JSON.stringify(g.exportRecording()));expect(g.loadSnapshot(save)).toBe(true);expect(digest(g)).toEqual(expected);expect(rng.getState()).toEqual(random);expect(g.loadReplay(record)).toBe(true);for(let i=0;i<record.events.length+5&&g.replayCursor<record.events.length&&!g.replayError;i++){clear();g.replayStep(true);}expect(g.replayCursor).toBe(record.events.length);clear();expect(g.replayError).toBeNull();expect(digest(g)).toEqual(expected);expect(rng.getState()).toEqual(random);g.replaySeek(0);expect(g.replayError).toBeNull();g.replaySeek(record.events.length);expect(g.replayError).toBeNull();expect(digest(g)).toEqual(expected);expect(rng.getState()).toEqual(random);}
function unchanged(g:Game,work:()=>void){clear();const player=g.player,actors=[...g.controlledActors],before=JSON.stringify(g.toSnapshot()),random=rng.getState(),allocator=getNextEntityId(),events=structuredClone(g.exportRecording().events);work();expect(g.player).toBe(player);g.controlledActors.forEach((a,i)=>expect(a).toBe(actors[i]));expect(JSON.stringify(g.toSnapshot())).toBe(before);expect(rng.getState()).toEqual(random);expect(getNextEntityId()).toBe(allocator);expect(g.exportRecording().events).toEqual(events);}

it.each([0,1])('calibration: phased melee binds defender %i, including armor and member-local aftermath',index=>{
 const g=fixture(),target=g.controlledActors[index]!,other=g.controlledActors[1-index]!;
 const m=new Monster(20,10,{...(monsters as MonsterData[]).find(m=>m.id==='rat')!,damage:'5',accuracy:10000,hp:999,abilityFlags:['MA_HIT_DEGRADE_ARMOR','MA_HIT_HALLUCINATE']});
 g.monsters.push(m);g.extensionRuntime!.attachCreature(m);
 target.equippedArmor!.runicType='reprisal';target.equippedArmor!.enchantment=3;
 const targetEnchant=target.equippedArmor!.enchantment,otherEnchant=other.equippedArmor!.enchantment,otherHp=other.hp;
 const armor=vi.spyOn(g,'tryTriggerArmorRunic'),split=vi.spyOn(g as any,'trySplitMonster');
 withPartyActor(g,other,()=>{
  const result=withActorActionScope(g,'npc-scheduler',m.id,scope=>g.resolveActorNativeMelee(scope,m,target));
  expect(result.hit).toBe(true);expect(result.damage).toBeGreaterThan(0);
  expect(g.commandActor).toBe(other);
 });
 expect(armor).toHaveBeenCalledOnce();expect(split).not.toHaveBeenCalled();
 expect(target.hp).toBeLessThan(target.maxHp);expect(m.hp).toBeLessThan(m.maxHp);
 expect(target.equippedArmor!.enchantment).toBe(targetEnchant-1);expect(target.hasStatus('hallucinating')).toBe(true);
 expect(g.party!.native[target.id]!.lastDamageSource).toBe(m.name);
 expect(other.hp).toBe(otherHp);expect(other.equippedArmor!.enchantment).toBe(otherEnchant);
 expect(other.hasStatus('hallucinating')).toBe(false);expect(g.party!.native[other.id]!.lastDamageSource).toBe('');
 expect(g.commandActor).toBe(g.player);
});

it('calibration: one geometry sweep applies native armor and aftermath to both members',()=>{
 const g=fixture(),[a,b]=g.controlledActors;
 const m=new Monster(20,10,{...(monsters as MonsterData[]).find(m=>m.id==='rat')!,damage:'5',accuracy:10000,hp:999,abilityFlags:['MA_ATTACKS_ALL_ADJACENT','MA_HIT_DEGRADE_ARMOR']});
 g.monsters.push(m);g.extensionRuntime!.attachCreature(m);
 const enchantments=g.controlledActors.map(a=>a.equippedArmor!.enchantment);
 const armor=vi.spyOn(g,'tryTriggerArmorRunic'),split=vi.spyOn(g as any,'trySplitMonster');
 withPartyActor(g,a!,()=>{(m as any).performSweepAttack(g,a!);expect(g.commandActor).toBe(a);});
 expect(armor).toHaveBeenCalledTimes(2);expect(split).not.toHaveBeenCalled();
 for(const [i,actor] of [a!,b!].entries()){
  expect(actor.hp).toBeLessThan(actor.maxHp);expect(actor.equippedArmor!.enchantment).toBe(enchantments[i]!-1);
  expect(g.party!.native[actor.id]!.lastDamageSource).toBe(m.name);
 }
});

it('R1-F1: secondary enters fire using a real confirmed move',()=>{const g=fixture(g=>g.grid.setTerrain(20,10,TerrainType.PLAIN_FIRE)),[a,b]=g.controlledActors;g.onConfirmRequest=()=>true;wait(g,a!.id);clear();g.submitPartyIntent({kind:'move',dx:-1,dy:0},b!.id);expect(b!.hp).toBeLessThan(b!.maxHp);expect((b!.statusDurations as any).burning).toBeGreaterThan(0);roundtrip(g);},120000);
it('R1-F1: preexisting secondary burning ticks as a controlled member',()=>{const g=fixture(g=>(g.controlledActors[1]!.statusDurations as any).burning=4),[a,b]=g.controlledActors;wait(g,a!.id);wait(g,b!.id);expect(b!.hp).toBeLessThan(b!.maxHp);expect((b!.statusDurations as any).burning).toBe(3);roundtrip(g);},120000);
it('R1-F2: poison wipes the team exactly once without a monster kill',()=>{const g=fixture(g=>{for(const a of g.controlledActors){a.hp=1;a.poisonAmount=2;a.setStatusDuration('poisoned',3);}}),ids=g.controlledActors.map(a=>a.id),deaths=vi.spyOn(g.extensionRuntime!,'captureDeath');wait(g,ids[0]!);wait(g,ids[1]!);expect(deaths.mock.calls.map(c=>c[0].id)).toEqual(ids);expect(g.isGameOver).toBe(true);expect(g.party!.state.members.every(m=>m.life==='dead')).toBe(true);expect(g.stats.kills).toBe(0);expect(g.readyPartyActorId).toBeNull();const score=g.gameOverScore;g.triggerGameOver(false,'repeat');expect(g.gameOverScore).toBe(score);roundtrip(g);},120000);
it('R1-F3: targeting cannot be bypassed by leaving its actor on another floor',()=>{const g=fixture(g=>{g.player.inventory.addItem(ItemLoader.spawnWand('wand_of_teleportation',-1,-1)!);commitCreatureAnchor(g.controlledActors[1]!,g.levelSeeds[0]!.downStairsLoc);}),[a,b]=g.controlledActors,wand=a!.inventory.items.find(i=>i.identityId==='wand_of_teleportation')!;g.submitPartyIntent({kind:'item',operation:'use',itemId:wand.id,target:null},a!.id);expect(g.pendingArcana).toBeTruthy();unchanged(g,()=>expect(()=>wait(g,a!.id)).toThrow('DECISION_REQUIRED'));unchanged(g,()=>expect(()=>control(g,b!.id,{kind:'leader',actorId:b!.id})).toThrow('DECISION_REQUIRED'));unchanged(g,()=>expect(()=>control(g,b!.id,{kind:'travel-party',destination:{kind:'dungeon',depth:2},leavingBehind:[a!.id]})).toThrow('DECISION_REQUIRED'));g.executeCommand('escape');expect(g.pendingArcana).toBeNull();roundtrip(g);},120000);
it('R1-F5: objective terrain falling on the other member resolves before human input',()=>{const g=fixture(g=>g.grid.setTerrain(g.player.x,g.player.y,TerrainType.CHASM)),[a,b]=g.controlledActors;wait(g,a!.id);wait(g,b!.id);expect(g.depth).toBe(2);expect(g.party!.state.members[0]!.life).toBe('active');expect(g.party!.state.members[1]!.life).toBe('frozen');expect(g.party!.native[a!.id]!.falling).toBe(false);roundtrip(g);},120000);
it('R1-F6: native environmental sources bind every member, independent of actor scope and load',()=>{const g=fixture(),a=g.player,b=g.controlledActors[1]!;const check=()=>{const [a,b]=g.controlledActors;vi.spyOn(g.lightMap,'lightAt').mockImplementation(x=>x===a!.x?{r:1000,g:1000,b:1000}:{r:0,g:0,b:0});vi.spyOn(g.lightMap,'inShadowAt').mockReturnValue(true);markStatsDirty(a!);const own=nativeStat(a!,'native.stealth-range');const scoped=withPartyActor(g,b!,()=>{markStatsDirty(a!);return nativeStat(a!,'native.stealth-range');});expect(scoped).toBe(own);markStatsDirty(b!);expect(nativeStat(b!,'native.stealth-range')).toBeLessThan(own);};check();const save=JSON.parse(JSON.stringify(g.toSnapshot()));expect(g.loadSnapshot(save)).toBe(true);check();expect(a.id).toBe(g.player.id);expect(b.id).toBe(g.controlledActors[1]!.id);});
it.each(['count','frozen-level','temporary','bounds','missing-terminal'] as const)('R1-F7: rejects %s in a provenance-free diagnostic snapshot',kind=>{const g=fixture(),s=JSON.parse(JSON.stringify(g.toSnapshot())),id=s.party.actors[0].id;if(kind==='count'){s.party.actors=[];s.party.state.members=s.party.state.members.filter((m:any)=>m.actorId!==id);delete s.party.native[id];}if(kind==='frozen-level'){s.party.state.members[1].life='frozen';s.party.state.members[1].level.depth=2;}if(kind==='bounds')s.party.actors[0].loc.x=-1;if(kind==='missing-terminal'){for(const a of [s.player,...s.party.actors])a.hp=0;for(const m of s.party.state.members)m.life='dead';}if(kind==='temporary'){s.party.actors[0].statusDurations.lifespan_remaining=100;s.party.actors[0].maxStatus.lifespan_remaining=100;}unchanged(g,()=>expect(g.loadSnapshot(s)).toBe(false));});
it('R1-F4: recovery issuer must belong to the chosen frozen floor',()=>{const g=fixture(()=>{},3),[a,b,c]=g.controlledActors;const stairs=g.levelSeeds[0]!.downStairsLoc;for(let y=stairs.y-1;y<=stairs.y+1;y++)for(let x=stairs.x-1;x<=stairs.x+1;x++)g.grid.setTerrain(x,y,TerrainType.FLOOR);commitCreatureAnchor(a!,stairs);commitCreatureAnchor(c!,{x:stairs.x,y:stairs.y+1});control(g,a!.id,{kind:'travel-party',destination:{kind:'dungeon',depth:2},leavingBehind:[b!.id]});g.monsters=[];commitCreatureAnchor(a!,g.levelSeeds[1]!.downStairsLoc);control(g,a!.id,{kind:'travel-party',destination:{kind:'dungeon',depth:3},leavingBehind:[c!.id]});a!.hp=0;g.triggerGameOver(false,'fixture');unchanged(g,()=>expect(()=>control(g,b!.id,{kind:'recover-level',destination:{kind:'dungeon',depth:2}})).toThrow('TRAVEL_NOT_READY'));const before={...b!.loc};control(g,c!.id,{kind:'recover-level',destination:{kind:'dungeon',depth:2}});expect(b!.loc).toEqual(before);expect(g.activeControlledActors.map(a=>a.id)).toEqual([c!.id]);const save=JSON.parse(JSON.stringify(g.toSnapshot()));expect(g.loadSnapshot(save)).toBe(true);});

// All these worlds are installed before the real seed header; replay and seek
// must reproduce both the actual hazard and its member-local consequences.
it.each([
 ['gas',TerrainType.POISON_GAS,'damage'],['steam',TerrainType.STEAM,'damage'],
 ['vines',TerrainType.ANCIENT_SPIRIT_VINES,'damage'],['explosion',TerrainType.GAS_EXPLOSION,'damage'],
 ['confusion',TerrainType.CONFUSION_GAS,'confused'],['paralysis',TerrainType.PARALYSIS_GAS,'paralyzed'],
 ['lichen',TerrainType.LICHEN,'poisoned'],['nausea',TerrainType.ROT_GAS,'nauseous'],
] as const)('audit: secondary %s contact survives save/replay/seek',(_name,tile,result)=>{
 const g=fixture(g=>{const b=g.controlledActors[1]!;g.grid.setTerrain(b.x,b.y,tile);if(tile===TerrainType.ROT_GAS)g.grid.getCell(b.x,b.y)!.volume=1000;});
 const [a,b]=g.controlledActors;wait(g,a!.id);wait(g,b!.id);
 if(result==='damage')expect(b!.hp).toBeLessThan(b!.maxHp);else expect(b!.hasStatus(result)).toBe(true);
 expect(g.stats.kills).toBe(0);expect(g.party!.state.members[1]!.life).toBe('active');roundtrip(g);
},120000);
it.each(['fire','gas','lava','starvation'] as const)('audit: %s team wipe is terminal and persistent',kind=>{
 const g=fixture(g=>{for(const a of g.controlledActors){a.hp=1;if(kind==='fire')(a.statusDurations as any).burning=4;
 else if(kind==='starvation'){a.nutrition=0;for(const item of [...a.inventory.items])if(item.consumableId==='ration_of_food')a.inventory.removeItem(item);}else g.grid.setTerrain(a.x,a.y,kind==='gas'?TerrainType.POISON_GAS:TerrainType.LAVA);}});
 const ids=g.controlledActors.map(a=>a.id);wait(g,ids[0]!);if(!g.isGameOver)wait(g,ids[1]!);
 expect(g.isGameOver).toBe(true);expect(g.party!.state.members.every(m=>m.life==='dead')).toBe(true);expect(g.stats.kills).toBe(0);roundtrip(g);
},120000);
it.each(['immune-fire','respiration','dampening','water-extinguishes'] as const)('audit: secondary %s uses its own protection',kind=>{
 const g=fixture(g=>{const b=g.controlledActors[1]!;
 if(kind==='immune-fire'){b.setStatusDuration('immune_fire',10);(b.statusDurations as any).burning=4;}
 else if(kind==='water-extinguishes'){(b.statusDurations as any).burning=4;g.grid.setTerrain(b.x,b.y,TerrainType.WATER_SHALLOW);}
 else {b.equippedArmor!.runicType=kind;b.equippedArmor!.runicKnown=false;g.grid.setTerrain(b.x,b.y,kind==='respiration'?TerrainType.POISON_GAS:TerrainType.GAS_EXPLOSION);if(kind==='dampening')b.setStatusDuration('immune_fire',10);}
 });const [a,b]=g.controlledActors;wait(g,a!.id);wait(g,b!.id);expect(b!.hp).toBe(b!.maxHp);if(kind==='water-extinguishes')expect((b!.statusDurations as any).burning??0).toBe(0);roundtrip(g);
},120000);
it('audit: real thrown incineration potion contacts a secondary through the DF callbacks',()=>{
 const g=fixture(g=>{g.player.inventory.addItem(ItemLoader.spawnPotion('potion_of_incineration',-1,-1)!);});
 const [a,b]=g.controlledActors,potion=a!.inventory.items.find(i=>i.consumableId==='potion_of_incineration')!;
 g.submitPartyIntent({kind:'item',operation:'throw',itemId:potion.id,target:{...b!.loc}},a!.id);
 expect((b!.statusDurations as any).burning).toBeGreaterThan(0);expect(a!.ticksUntilTurn).toBeGreaterThan(0);roundtrip(g);
},120000);
it('R1-F4: frozen survivors recover after a real poison death, including seed replay and seek',()=>{
 const flatten=(g:Game)=>{g.monsters=[];const at=g.levelSeeds[g.depth-1]!.downStairsLoc;for(let y=at.y-1;y<=at.y+1;y++)for(let x=at.x-1;x<=at.x+1;x++)g.grid.setTerrain(x,y,TerrainType.FLOOR);return at;};
 const g=fixture(g=>{const at=flatten(g);commitCreatureAnchor(g.player,at);commitCreatureAnchor(g.controlledActors[2]!,{x:at.x+1,y:at.y});},3,g=>{commitCreatureAnchor(g.commandActor,flatten(g));if(g.depth===3){g.commandActor.hp=1;g.commandActor.poisonAmount=2;g.commandActor.setStatusDuration('poisoned',3);}});
 const [a,b,c]=g.controlledActors;control(g,a!.id,{kind:'travel-party',destination:{kind:'dungeon',depth:2},leavingBehind:[b!.id]});
 control(g,a!.id,{kind:'travel-party',destination:{kind:'dungeon',depth:3},leavingBehind:[c!.id]});wait(g,a!.id);
 expect(g.party!.state.members[0]!.life).toBe('dead');expect(g.isGameOver).toBe(false);expect(g.readyPartyActorId).toBeNull();
 const frozen=JSON.stringify(b);unchanged(g,()=>expect(()=>control(g,b!.id,{kind:'recover-level',destination:{kind:'dungeon',depth:2}})).toThrow('TRAVEL_NOT_READY'));
 control(g,c!.id,{kind:'recover-level',destination:{kind:'dungeon',depth:2}});expect(JSON.stringify(b)).toBe(frozen);expect(g.activeControlledActors.map(a=>a.id)).toEqual([c!.id]);roundtrip(g);
},120000);
it('audit: wait/rested is per member and survives persistence',()=>{const g=fixture(),[a,b]=g.controlledActors;wait(g,a!.id);expect(g.party!.native[a!.id]!.justRested).toBe(true);expect(g.party!.native[b!.id]!.justRested).toBe(false);roundtrip(g);},120000);
it('audit: secondary enters a native confusion gas trap through a recorded move',()=>{
 const g=fixture(g=>g.grid.setTerrain(20,10,TerrainType.GAS_TRAP_CONFUSION)),[a,b]=g.controlledActors;g.onConfirmRequest=()=>true;
 wait(g,a!.id);clear();g.submitPartyIntent({kind:'move',dx:-1,dy:0},b!.id);expect(b!.hasStatus('confused')).toBe(true);roundtrip(g);
},120000);
it('audit: deep water takes inventory only from its secondary carrier',()=>{
 const g=fixture(g=>{const b=g.controlledActors[1]!;g.grid.setTerrain(b.x,b.y,TerrainType.WATER_DEEP);}),[a,b]=g.controlledActors,primary=a!.inventory.items.map(i=>[i.id,i.quantity]),secondary=new Set(b!.inventory.items.map(i=>i.id));
 for(let i=0;i<8;i++){wait(g,a!.id);wait(g,b!.id);}expect(a!.inventory.items.map(i=>[i.id,i.quantity])).toEqual(primary);expect(g.items.some(i=>secondary.has(i.id))).toBe(true);roundtrip(g);
},120000);
it('audit: an incapacitated member cannot use party travel',()=>{
 const g=fixture(g=>{commitCreatureAnchor(g.player,g.levelSeeds[0]!.downStairsLoc);g.player.setStatusDuration('paralyzed',3);});
 unchanged(g,()=>expect(()=>control(g,g.player.id,{kind:'travel-party',destination:{kind:'dungeon',depth:2},leavingBehind:[g.controlledActors[1]!.id]})).toThrow('ACTOR_BUSY'));
});

it('audit: native enemy decisions use the selected secondary stealth, not the caller range',()=>{
 const g=fixture(),[a,b]=g.controlledActors,m=new Monster(22,10,(monsters as MonsterData[]).find(m=>m.id==='rat')!);g.monsters.push(m);
 vi.spyOn(g.lightMap,'lightAt').mockImplementation(x=>x===a!.x?{r:1000,g:1000,b:1000}:{r:0,g:0,b:0});vi.spyOn(g.lightMap,'inShadowAt').mockReturnValue(true);for(const actor of g.controlledActors)markStatsDirty(actor);
 let selected:number|undefined,range:number|undefined;vi.spyOn(m,'takeTurn').mockImplementation((game,value)=>{selected=game.commandActor.id;range=value;});
 (g as any).timePorts().effects.monsterTakeTurn(m,999);expect(selected).toBe(b!.id);expect(range).toBe(nativeStat(b!,'native.stealth-range'));expect(range).not.toBe(999);
});
it('audit: native melee deaths retire each member and finish the team once, with replay and seek',()=>{
 const g=fixture(g=>{for(const a of g.controlledActors)a.hp=1;const m=new Monster(20,10,{...(monsters as MonsterData[]).find(m=>m.id==='rat')!,damage:'10d10',accuracy:100,hp:999});m.state=MonsterState.HUNTING;g.monsters.push(m);g.extensionRuntime!.attachCreature(m);});
 for(let i=0;i<12&&!g.isGameOver;i++){expect(g.readyPartyActorId).not.toBeNull();wait(g,g.readyPartyActorId!);}
 expect(g.isGameOver).toBe(true);expect(g.party!.state.members.every(m=>m.life==='dead')).toBe(true);expect(g.stats.kills).toBe(0);roundtrip(g);
},120000);
it('audit: direct native bolt recipient uses secondary armor, source and death cleanup',()=>{
 const g=fixture(),[a,b]=g.controlledActors,m=new Monster(23,10,(monsters as MonsterData[]).find(m=>m.id==='goblin_mystic')!);g.monsters.push(m);g.extensionRuntime!.attachCreature(m);b!.hp=1;
 expect(g.castMonsterBolt(m,b!,'SPARK')).toBeTruthy();expect(b!.hp).toBe(0);expect(a!.hp).toBe(a!.maxHp);expect(g.party!.state.members[1]!.life).toBe('dead');expect(g.isGameOver).toBe(false);expect(g.party!.native[b!.id]!.lastDamageSource).toBe(m.name);expect(g.party!.native[a!.id]!.lastDamageSource).toBe('');
 const save=JSON.parse(JSON.stringify(g.toSnapshot()));expect(g.loadSnapshot(save)).toBe(true);
});

it.each(['resident','raider'] as const)('R1-F7: runtime eligibility reads the real %s ownership root',kind=>{
 const g=fixture(),id=g.controlledActors[1]!.id;
 const world={player:g.player,depth:g.depth,world5:{residents:kind==='resident'?[{actorId:id}]:[],raidCamps:kind==='raider'?[{event:{actorIds:[id]}}]:[]}};
 expect(()=>assertPartyRuntime(world as any,g.party!)).toThrow('BAD_ACTOR');expect(()=>assertPartyRuntime(g,g.party!)).not.toThrow();
});

it.each(['entrancement','negation','negation-blast'] as const)('audit: %s applies controlled status semantics to a secondary and replays',kind=>{
 const g=fixture(g=>{const item=kind==='entrancement'?ItemLoader.spawnStaff('staff_of_entrancement',-1,-1):kind==='negation'?ItemLoader.spawnWand('wand_of_negation',-1,-1):ItemLoader.spawnScroll('scroll_of_negation',-1,-1);g.player.inventory.addItem(item!);if(kind!=='entrancement'){g.controlledActors[1]!.setStatusDuration('levitating',5);g.controlledActors[1]!.setStatusDuration('darkness',5);}}),[a,b]=g.controlledActors;
 const item=a!.inventory.items.find(i=>kind==='negation-blast'?i.consumableId==='scroll_of_negation':i.identityId===(kind==='entrancement'?'staff_of_entrancement':'wand_of_negation'))!;g.onConfirmRequest=()=>true;
 g.submitPartyIntent({kind:'item',operation:'use',itemId:item.id,target:kind==='negation-blast'?null:{...b!.loc}},a!.id);
 if(kind==='entrancement'){expect(b!.hasStatus('confused')).toBe(true);expect(b!.hasStatus('entranced')).toBe(false);expect(a!.hasStatus('confused')).toBe(false);}else {expect(b!.getStatusDuration('levitating')).toBe(1);expect(b!.hasStatus('darkness')).toBe(false);}
 roundtrip(g);
},120000);
it('audit: secondary on-hit status honors its own temporary immunity outside its scope',()=>{
 const g=fixture(),[a,b]=g.controlledActors;b!.temporaryImmunities.confused=2;
 expect(g.applyMonsterOnHitStatus(b!,'fixture','confused',8)).toBe(false);delete b!.temporaryImmunities.confused;
 expect(g.applyMonsterOnHitStatus(b!,'fixture','confused',8)).toBe(true);expect(b!.hasStatus('confused')).toBe(true);expect(a!.hasStatus('confused')).toBe(false);
 const save=JSON.parse(JSON.stringify(g.toSnapshot()));expect(g.loadSnapshot(save)).toBe(true);
});

it('audit: localized member death labels follow the native digest presentation contract',()=>{
 const g=fixture(),first=JSON.parse(JSON.stringify(g.toSnapshot())),second=structuredClone(first),id=g.controlledActors[1]!.id;
 first.party.native[id].lastDamageSource='Rat';second.party.native[id].lastDamageSource='老鼠';
 expect(mechanicalDigest(first,(g as any).recordingInputState())).toEqual(mechanicalDigest(second,(g as any).recordingInputState()));
 second.party.native[id].justRested=true;expect(mechanicalDigest(first,(g as any).recordingInputState()).root).not.toBe(mechanicalDigest(second,(g as any).recordingInputState()).root);
});
