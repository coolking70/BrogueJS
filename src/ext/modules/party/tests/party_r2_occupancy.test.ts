import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import '../../../../i18n';
import {Monster,type MonsterData} from '../../../../entities/Monster';
import monsters from '../../../../data/monsters.json';
import {Game} from '../../../../engine/Core/Game';
import {TerrainType} from '../../../../engine/Map/Grid';
import {restoreSquareTravelPosition} from '../../../../engine/Movement/LevelTravel';
import {commitCreatureAnchor} from '../../../../engine/Movement/CreatureSpatial';
import {clearWorldCell} from '../../../../engine/Core/WorldWorkWorld';
import {ItemLoader} from '../../../../engine/Items/ItemLoader';
import {getNextEntityId} from '../../../../entities/Creature';
import {logger} from '../../../../engine/Systems/Logger';
import {rng} from '../../../../engine/Random';
import {withPartyActor} from '../../../../engine/Core/PartyRuntime';
import {mechanicalDigest} from '../../../../engine/Core/RecordingDigest';
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


function sealed(g:Game,cells:{x:number,y:number}[]){g.monsters=[];g.dormantMonsters=[];for(let y=0;y<g.grid.height;y++)for(let x=0;x<g.grid.width;x++)g.grid.setTerrain(x,y,TerrainType.WALL);for(const p of cells)g.grid.setTerrain(p.x,p.y,TerrainType.FLOOR);}
it.each([false,true])('R2-F1: public secondary teleport excludes the third member (free cell=%s), save/replay/seek',free=>{
 const g=fixture(g=>{const cells=[{x:9,y:10},{x:10,y:10},{x:60,y:10}];sealed(g,[...cells,...(free?[{x:62,y:10}]:[])]);g.controlledActors.forEach((a,i)=>commitCreatureAnchor(a,cells[i]!));g.controlledActors[1]!.inventory.addItem(ItemLoader.spawnScroll('scroll_of_teleportation',-1,-1)!);},3);
 const [a,b,c]=g.controlledActors,scroll=b!.inventory.items.find(i=>i.consumableId==='scroll_of_teleportation')!;
 wait(g,a!.id);clear();g.submitPartyIntent({kind:'item',operation:'use',itemId:scroll.id,target:null},b!.id);
 expect(b!.loc).toEqual(free?{x:62,y:10}:{x:10,y:10});expect(b!.loc).not.toEqual(c!.loc);roundtrip(g);
},120000);
it.each(['primary','secondary'] as const)('R2-F1: rejects same-floor %s overlap before publishing',kind=>{const g=fixture(()=>{},3),s=JSON.parse(JSON.stringify(g.toSnapshot()));s.party.actors[0].loc={...(kind==='primary'?s.player.loc:s.party.actors[1].loc)};unchanged(g,()=>expect(g.loadSnapshot(s)).toBe(false));});
it('audit: direct displacement and stagger cannot land on a secondary',()=>{const g=fixture(()=>{},3),[a,b,c]=g.controlledActors;unchanged(g,()=>expect(g.placeCreature(b!,c!.loc)).toBe(false));commitCreatureAnchor(a!,{x:20,y:10});commitCreatureAnchor(b!,{x:21,y:10});commitCreatureAnchor(c!,{x:22,y:10});g.processStaggerHit(a!,b!);expect(b!.loc).toEqual({x:21,y:10});});
it('audit: blade summons exclude every controlled member',()=>{const g=fixture(g=>g.player.inventory.addItem(ItemLoader.spawnStaff('staff_of_conjuration',-1,-1)!),3),b=g.controlledActors[1]!,staff=g.player.inventory.items.find(i=>i.identityId==='staff_of_conjuration')!;g.submitPartyIntent({kind:'item',operation:'use',itemId:staff.id,target:{...b.loc}},g.player.id);expect(g.monsters.length).toBeGreaterThan(0);expect(g.monsters.every(m=>g.activeControlledActors.every(a=>a.x!==m.x||a.y!==m.y))).toBe(true);roundtrip(g);},120000);
it('audit: native monster step cannot walk through a non-target member',()=>{const g=fixture(()=>{},3),b=g.controlledActors[1]!,m=new Monster(b.x-1,b.y,(monsters as MonsterData[]).find(m=>m.id==='rat')!);g.monsters.push(m);withPartyActor(g,g.player,()=>m.moveResidentStep({...b.loc},g));expect(m.loc).not.toEqual(b.loc);});
function crowd(g:Game){sealed(g,[{x:19,y:10},{x:20,y:10},{x:21,y:10},{x:22,y:10},{x:23,y:10}]);g.controlledActors.forEach((a,i)=>commitCreatureAnchor(a,{x:19+2*i,y:10}));}
function rat(g:Game,x=20,y=10){const m=new Monster(x,y,(monsters as MonsterData[]).find(m=>m.id==='rat')!);g.monsters.push(m);g.extensionRuntime!.attachCreature(m);return m;}
function diagnosticRoundtrip(g:Game){clear();const s=JSON.parse(JSON.stringify(g.toSnapshot())),d=digest(g);expect(g.loadSnapshot(s)).toBe(true);expect(digest(g)).toEqual(d);}
it.each(['blade','clone','minion','resurrect','dormancy','stairs-follower'] as const)('audit: crowded %s placement avoids secondary cells',kind=>{
 const g=fixture(crowd,3),b=g.controlledActors[1]!,m=rat(g);
 if(kind==='blade')(g as any).conjureBladesAt({...b.loc},1);
 if(kind==='clone')expect(g.cloneMonster(m)?.loc).toEqual({x:22,y:10});
 if(kind==='minion')expect((g as any).findMinionSpawnSpot({...b.loc},m.snapshotForm(),null,true)).toEqual({x:22,y:10});
 if(kind==='resurrect'){const dead=new Monster(b.x,b.y,m.snapshotForm());dead.hp=0;g.purgatory.push(dead);expect(g.resurrectAlly({...b.loc})).toBe(true);}
 if(kind==='dormancy'){const dormant=new Monster(b.x,b.y,m.snapshotForm());dormant.isDormant=true;g.dormantMonsters.push(dormant);g.toggleMonsterDormancy(dormant);expect(dormant.isDormant).toBe(false);expect(dormant.loc).toEqual({x:22,y:10});}
 if(kind==='stairs-follower'){const newcomer=new Monster(b.x,b.y,m.snapshotForm());newcomer.preplaced=true;g.monsters.push(newcomer);(g as any).restoreLevelResident(newcomer);expect(newcomer.loc).toEqual({x:22,y:10});}
 expect(g.monsters.every(m=>!g.controlledOccupies(m.loc))).toBe(true);diagnosticRoundtrip(g);
});
it('audit: no-space dormant activation retains its dormant owner',()=>{const g=fixture(crowd,3),b=g.controlledActors[1]!;rat(g);g.grid.setTerrain(22,10,TerrainType.WALL);const m=new Monster(b.x,b.y,(monsters as MonsterData[]).find(m=>m.id==='rat')!);m.isDormant=true;g.dormantMonsters.push(m);g.toggleMonsterDormancy(m);expect(m.isDormant).toBe(true);expect(g.dormantMonsters).toContain(m);expect(g.monsters).not.toContain(m);});
it('audit: fall dry-land fallback cannot select another member',()=>{const g=fixture(g=>{sealed(g,[{x:9,y:10},{x:20,y:10},{x:31,y:10},{x:32,y:10}]);g.controlledActors.forEach((a,i)=>commitCreatureAnchor(a,[{x:9,y:10},{x:20,y:10},{x:32,y:10}][i]!));g.grid.setTerrain(31,10,TerrainType.WATER_DEEP);},3),b=g.controlledActors[1]!,c=g.controlledActors[2]!;withPartyActor(g,b,()=>(g as any).placePlayerOnFallLanding(30,10));expect(b.loc).not.toEqual(c.loc);diagnosticRoundtrip(g);});
it('audit: all four falling members land separately and preserve save/replay/seek',()=>{const g=fixture(g=>{for(const a of g.controlledActors)g.grid.setTerrain(a.x,a.y,TerrainType.CHASM);},4);for(let i=0;i<8&&g.depth===1;i++)wait(g,g.readyPartyActorId!);expect(g.depth).toBe(2);expect(g.activeControlledActors).toHaveLength(4);expect(new Set(g.activeControlledActors.map(a=>`${a.x},${a.y}`)).size).toBe(4);expect(g.monsters.every(m=>m.hp<=0||!g.controlledOccupies(m.loc))).toBe(true);roundtrip(g);},120000);
it('audit: frozen members reserve only their own floor, and same-floor frozen overlap is rejected',()=>{
 const g=fixture(g=>{const at=g.levelSeeds[0]!.downStairsLoc;for(let y=at.y-1;y<=at.y+1;y++)for(let x=at.x-1;x<=at.x+1;x++)g.grid.setTerrain(x,y,TerrainType.FLOOR);commitCreatureAnchor(g.controlledActors[2]!,at);commitCreatureAnchor(g.controlledActors[3]!,{x:at.x+1,y:at.y});},4),[a,b,c]=g.controlledActors;
 control(g,c!.id,{kind:'travel-party',destination:{kind:'dungeon',depth:2},leavingBehind:[a!.id,b!.id]});
 for(const m of g.monsters)m.hp=0;g.monsters=[];g.grid.setTerrain(a!.x,a!.y,TerrainType.FLOOR);expect(g.controlledOccupies(a!.loc)).toBe(false);expect(g.placeCreature(c!,{...a!.loc})).toBe(true);
 const bad=JSON.parse(JSON.stringify(g.toSnapshot()));bad.party.actors[0].loc={...bad.player.loc};unchanged(g,()=>expect(g.loadSnapshot(bad)).toBe(false));diagnosticRoundtrip(g);
});
it('audit: dead member coordinates do not reserve a cell',()=>{const g=fixture(),[a,b]=g.controlledActors;a!.hp=0;g.triggerGameOver(false,'fixture');expect(g.placeCreature(b!,{...a!.loc})).toBe(true);diagnosticRoundtrip(g);});
it('audit: monster/member overlap is rejected by detached decode',()=>{const g=fixture(),b=g.controlledActors[1]!;rat(g);const bad=JSON.parse(JSON.stringify(g.toSnapshot()));bad.party.actors[0].loc={x:20,y:10};unchanged(g,()=>expect(g.loadSnapshot(bad)).toBe(false));expect(b.loc).toEqual({x:21,y:10});});
it('audit: step/dodge geometry and raid creation reject secondary occupancy without allocation',()=>{const g=fixture(()=>{},3),[a,b,c]=g.controlledActors;commitCreatureAnchor(b!,{x:22,y:10});expect(g.canStepFootprint(b!,c!.loc)).toBe(false);expect(g.canActorDodgeStep(b!,c!.loc)).toBe(false);unchanged(g,()=>expect(g.createRaidMonster('rat',c!.loc)).toBeNull());expect(g.player).toBe(a);});
it('audit: captive drops and world resource placement exclude secondary cells',()=>{const g=fixture(crowd,3),b=g.controlledActors[1]!,m=rat(g);m.isCaged=true;m.carriedItem=ItemLoader.spawnGold(3,m.x,m.y)!;const id=m.carriedItem.id;g.grid.setTerrain(m.x,m.y,TerrainType.WALL);g.makeMonsterDropItem(m);expect(g.items.find(i=>i.id===id)?.loc).toEqual({x:22,y:10});expect(clearWorldCell(g,b.loc)).toBe(false);});
it('audit: unsafe ally exchange fallback cannot move the ally onto a member, with replay',()=>{const g=fixture(g=>{crowd(g);const m=rat(g);m.isAlly=true;m.ticksUntilTurn=1000;g.grid.setTerrain(21,10,TerrainType.STAIRS_UP);},3),[a,b]=g.controlledActors;wait(g,a!.id);g.submitPartyIntent({kind:'move',dx:-1,dy:0},b!.id);expect(b!.loc).toEqual({x:20,y:10});expect(g.monsters[0]!.loc).toEqual({x:22,y:10});roundtrip(g);},120000);
it('audit: force knockback stops before a secondary',()=>{const g=fixture(crowd,3),m=rat(g),at={...m.loc};(g as any).applyWeaponRunicEffect(m,0,'force');expect(m.loc).toEqual(at);diagnosticRoundtrip(g);});
it('audit: falling onto a floor with a frozen member restores distinct current-floor occupants',()=>{
 const flatten=(g:Game,at:{x:number,y:number})=>{for(let y=at.y-1;y<=at.y+1;y++)for(let x=at.x-1;x<=at.x+1;x++)g.grid.setTerrain(x,y,TerrainType.FLOOR);};
 const g=fixture(g=>{const at=g.levelSeeds[0]!.downStairsLoc;flatten(g,at);commitCreatureAnchor(g.player,at);commitCreatureAnchor(g.controlledActors[2]!,{x:at.x+1,y:at.y});},3),[a,b,c]=g.controlledActors;
 control(g,a!.id,{kind:'travel-party',destination:{kind:'dungeon',depth:2},leavingBehind:[b!.id]});
 const exit=g.levelSeeds[1]!.upStairsLoc;flatten(g,exit);commitCreatureAnchor(a!,exit);
 control(g,a!.id,{kind:'travel-party',destination:{kind:'dungeon',depth:1},leavingBehind:[c!.id]});
 g.party!.native[a!.id]!.falling=true;(g as any).partyFalls();
 expect(g.depth).toBe(2);expect(g.activeControlledActors.map(a=>a.id)).toEqual([a!.id,c!.id]);expect(a!.loc).not.toEqual(c!.loc);expect(g.party!.state.members.find(m=>m.actorId===b!.id)!.life).toBe('frozen');diagnosticRoundtrip(g);
});
it('audit: public secondary blinking stops before the next member, save/replay/seek',()=>{const g=fixture(g=>g.controlledActors[1]!.inventory.addItem(ItemLoader.spawnStaff('staff_of_blinking',-1,-1)!),3),[a,b,c]=g.controlledActors,staff=b!.inventory.items.find(i=>i.identityId==='staff_of_blinking')!;wait(g,a!.id);g.submitPartyIntent({kind:'item',operation:'use',itemId:staff.id,target:{...c!.loc}},b!.id);expect(b!.loc).toEqual({x:22,y:10});expect(b!.loc).not.toEqual(c!.loc);roundtrip(g);},120000);
it('audit: beckoning cannot pull a secondary through a third member',()=>{const g=fixture(()=>{},3),[a,b,c]=g.controlledActors;commitCreatureAnchor(b!,{x:24,y:10});commitCreatureAnchor(c!,{x:22,y:10});(g as any).beckonCreature(b!,a!);expect(b!.x).toBeGreaterThan(c!.x);expect(b!.loc).not.toEqual(c!.loc);diagnosticRoundtrip(g);});

it('audit: square placement sees secondary footprints and travel uses one physical exit occupant',()=>{const g=fixture(g=>{for(let y=4;y<8;y++)for(let x=18;x<=24;x++)g.grid.setTerrain(x,y,TerrainType.FLOOR);},3),b=g.controlledActors[1]!,data=(monsters as MonsterData[]).find(m=>m.id==='rat')!;unchanged(g,()=>expect(g.createSquareMonster(data,2,{x:b.x-1,y:b.y})).toBeNull());const m=g.createSquareMonster(data,2,{x:20,y:5})!;expect(m).toBeTruthy();m.entersLevelIn=1;expect(()=>restoreSquareTravelPosition(g.spatialWorldPort(),m,g.player.loc)).not.toThrow();expect(m.loc).not.toEqual({x:20,y:5});expect(g.footprintOf(m).every(p=>!g.controlledOccupies(p))).toBe(true);diagnosticRoundtrip(g);});
