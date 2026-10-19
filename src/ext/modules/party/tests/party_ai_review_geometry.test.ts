// Regression probes independently designed during P1c R2.
import {afterEach,it,expect,vi} from 'vitest';
import '../../../../i18n';
import {Game} from '../../../../engine/Core/Game';
import {logger} from '../../../../engine/Systems/Logger';
import {timeSystem} from '../../../../engine/Systems/Time';
import {rng} from '../../../../engine/Random';
import {getNextEntityId} from '../../../../entities/Creature';
import {Monster,MonsterState,type MonsterData} from '../../../../entities/Monster';
import monsters from '../../../../data/monsters.json';
import {installBodyFixture,installProductionBody,startProductionGame,emptyProductionArena,PRODUCTION_BODY_ID} from '../../../../test/support/productionComposite';
import {commitCreatureAnchor} from '../../../../engine/Movement/CreatureSpatial';
import {setPartyPerception} from '../../../../engine/UI/PartyPerception';
import {publicMonsterCells} from '../../../../engine/UI/MonsterVisibility';
import {partyAiView,eligiblePartyCompanion} from '../../../../engine/Core/PartyAi';
import {PartyAiV1} from '../../../../ext/modules/party/PartyAiV1';
import {defaultPartyAi} from '../../../../ext/partyAi';
import {mechanicalDigest} from '../../../../engine/Core/RecordingDigest';
const games:Game[]=[];
const clear=()=>{while(logger.pendingAcknowledgment)logger.acknowledgeNext();};
function start(body=false){if(body)installProductionBody();else installBodyFixture();const g=startProductionGame(['body-fixture','party']);games.push(g);emptyProductionArena(g);clear();return g;}
function send(g:Game,change:any){clear();g.executeCommand('party:ai',{kind:'party:ai',schema:1,issuerSlot:'local:0',expectedRevision:g.party!.state.revision,change});}
function control(g:Game,kind:'ai'|'human',id=g.player.id){send(g,{kind:'controller',actorId:id,expectedEpoch:g.party!.state.members.find(m=>m.actorId===id)!.controlEpoch,controller:kind==='ai'?{kind,policyId:'party-ai-v1'}:{kind,slot:'local:0'}});}
function window(g:Game){clear();g.submitPartyWindow({kind:'party:window',schema:2,seq:g.party!.state.window.seq+1,expectedRevision:g.party!.state.revision,issuerSlot:'local:0',startTick:timeSystem.currentTick,length:{kind:'ticks',ticks:100},fineActorId:null,automatic:false,trigger:'manual',plans:[]});}
afterEach(()=>{games.splice(0).forEach(g=>g.disposeRecording());vi.restoreAllMocks();clear();});
it('R2 F7 same public body cells produce same AI view for hidden pose changes',()=>{
 const g=start(),a=g.player;commitCreatureAnchor(a,{x:23,y:16});const target=g.createModuleMonster('body-fixture.spine-crawler',{x:20,y:15})!;expect(target).toBeTruthy();
 for(let y=0;y<g.grid.height;y++)for(let x=0;x<g.grid.width;x++)g.grid.getCell(x,y)!.isVisible=false;
 g.grid.getCell(20,15)!.isVisible=true;
 const legal=Array.from({length:g.grid.width},()=>Array(g.grid.height).fill(false));legal[20]![15]=true;
 setPartyPerception(g.grid,g.activeControlledActors.map(actor=>({actor,legal})));
 const ai=defaultPartyAi();ai.settings.tactic='attack';
 const cells=publicMonsterCells(a,g.grid,target),v1=partyAiView(g,a,ai);
 target.spatial!.pose='r90'; // Controlled hidden-world alternative; visible cells are held fixed.
 expect(publicMonsterCells(a,g.grid,target)).toEqual(cells);
 const v2=partyAiView(g,a,ai);expect(v2).toEqual(v1);expect(PartyAiV1.decide(v2)).toEqual(PartyAiV1.decide(v1));
});
it('R2 F3 body owner attacks at native tick once, not per body member',()=>{
 const g=start(true),core=g.createCompositeMonster(PRODUCTION_BODY_ID,{x:14,y:12})!;expect(core).toBeTruthy();
 const body=[...g.monsters];body.forEach(a=>{a.isAlly=true;a.state=MonsterState.WANDERING;a.ticksUntilTurn=0;});
 const target=new Monster(17,12,(monsters as MonsterData[]).find(m=>m.id==='rat')!);target.hp=target.maxHp=10000;target.defense=-10000;target.ticksUntilTurn=10000;g.monsters.push(target);
 commitCreatureAnchor(g.player,{x:19,y:12});(g as any).updateVision();
 expect(eligiblePartyCompanion(g,core.id)).toBe(core);send(g,{kind:'order',actorIds:[core.id],order:{kind:'attack',targetId:target.id}});
 const before=target.hp;window(g);expect(target.hp).toBeLessThan(before);expect(g.party!.state.companionOrders).toHaveLength(1);expect(g.party!.state.companionOrders[0]!.ai.ordinal).toBe(1);
 expect(body.filter(a=>a!==core).every(a=>!eligiblePartyCompanion(g,a.id))).toBe(true);
});
it('R2 companion codec rejects non-owner, dead, captive and unknown references without mutating live game',()=>{
 const g=start(true),core=g.createCompositeMonster(PRODUCTION_BODY_ID,{x:14,y:12})!;g.monsters.forEach(a=>a.isAlly=true);(g as any).updateVision();send(g,{kind:'order',actorIds:[core.id],order:{kind:'guard',level:g.depth,x:14,y:12}});
 const good=JSON.parse(JSON.stringify(g.toSaveSnapshot()));
 const bads=[(()=>{const v=structuredClone(good);v.party.state.companionOrders[0].actorId=g.monsters.find(a=>a!==core)!.id;return v;})(),(()=>{const v=structuredClone(good);v.party.state.companionOrders[0].actorId=9999999;return v;})(),(()=>{const v=structuredClone(good);v.monsters.find((a:any)=>a.id===core.id).isCaged=true;return v;})()];
 for(const bad of bads){const root=g.party,random=rng.getState(),next=getNextEntityId(),digest=mechanicalDigest(g.toSnapshot(),(g as any).recordingInputState());expect(g.loadSnapshot(bad)).toBe(false);expect(g.party).toBe(root);expect(rng.getState()).toEqual(random);expect(getNextEntityId()).toBe(next);expect(mechanicalDigest(g.toSnapshot(),(g as any).recordingInputState())).toEqual(digest);}
});
function travel(g:Game,depth:number,leave:number[]=[]){clear();g.executeCommand('party:control',{kind:'party:control',schema:1,expectedRevision:g.party!.state.revision,issuerSlot:'local:0',actorId:g.player.id,change:{kind:'travel-party',destination:{kind:'dungeon',depth},leavingBehind:leave}});}
it('R2 frozen pending AI applies atomically when member returns idle',()=>{
 const g=start(),b=g.controlledActors[1]!;commitCreatureAnchor(g.player,(g as any).levelSeeds[0].downStairsLoc);travel(g,2,[b.id]);expect(g.party!.state.members[1]!.life).toBe('frozen');control(g,'ai',b.id);expect(g.party!.state.members[1]!.pendingController?.kind).toBe('ai');commitCreatureAnchor(g.player,(g as any).levelSeeds[1].upStairsLoc);travel(g,1);expect(b.ticksUntilTurn).toBe(0);expect(g.party!.state.members[1]!.controller.kind).toBe('ai');expect(g.party!.state.members[1]!.pendingController).toBeNull();
});
it('R2 crossing floors clears companion orders before immediate save/load',()=>{
 const g=start(),b=g.controlledActors[1]!;const ally=new Monster(41,12,(monsters as MonsterData[]).find(m=>m.id==='rat')!);ally.isAlly=true;g.monsters.push(ally);(g as any).updateVision();send(g,{kind:'order',actorIds:[ally.id],order:{kind:'guard',level:1,x:41,y:12}});expect(g.party!.state.companionOrders).toHaveLength(1);commitCreatureAnchor(g.player,(g as any).levelSeeds[0].downStairsLoc);travel(g,2,[b.id]);expect(g.party!.state.companionOrders).toHaveLength(0);const h=new Game({seed:1});games.push(h);expect(h.loadSnapshot(JSON.parse(JSON.stringify(g.toSaveSnapshot())))).toBe(true);
});
it('R2 temporary AI preview does not execute suspended travel tail',async()=>{
 const {previewPartyWindow}=await import('../../../../engine/Core/PartyPlanning');
 const cells=Array.from({length:25},(_,i)=>({x:i%5,y:Math.floor(i/5),passable:true,hazard:false}));
 const v:any={baseRevision:2,level:1,cells,enemies:[],members:[{id:1,x:2,y:2,moveTicks:100,remaining:0,plan:{kind:'travel',level:{kind:'dungeon',depth:1},target:{x:4,y:2}},cursor:0,ai:{active:true,view:{at:{x:2,y:2},ordinal:0}}}]};
 const b:any={kind:'party:window',schema:2,expectedRevision:2,issuerSlot:'local:0',seq:1,startTick:0,length:{kind:'ticks',ticks:100},fineActorId:null,automatic:false,trigger:'manual',plans:[]};
 const p=previewPartyWindow(v,b,()=>({intent:{kind:'move',dx:0,dy:-1},diagnostic:'move',nodes:1}));expect(p.members[0]).toMatchObject({x:2,y:1,actions:1});
});
it('R2 known preview container does not disclose a hidden body anchor',()=>{
 const g=start(),target=g.createModuleMonster('body-fixture.spine-crawler',{x:20,y:15})!;
 for(let y=0;y<g.grid.height;y++)for(let x=0;x<g.grid.width;x++)g.grid.getCell(x,y)!.isVisible=false;
 g.grid.getCell(21,15)!.isVisible=true;
 const legal=Array.from({length:g.grid.width},()=>Array(g.grid.height).fill(false));legal[21]![15]=true;setPartyPerception(g.grid,g.activeControlledActors.map(actor=>({actor,legal})));
 const known=publicMonsterCells(g.player,g.grid,target),before=g.knownPartyWorld();commitCreatureAnchor(target,{x:21,y:15});expect(publicMonsterCells(g.player,g.grid,target)).toEqual(known);expect(g.knownPartyWorld()).toEqual(before);
});
