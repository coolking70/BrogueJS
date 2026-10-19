import {afterEach,it,expect} from 'vitest';
import '../../../../i18n';
import {Game} from '../../../../engine/Core/Game';
import {TerrainType} from '../../../../engine/Map/Grid';
import {commitCreatureAnchor} from '../../../../engine/Movement/CreatureSpatial';
import {Monster,type MonsterData} from '../../../../entities/Monster';
import monsters from '../../../../data/monsters.json';
import {logger} from '../../../../engine/Systems/Logger';
const games:Game[]=[];
const clear=()=>{while(logger.pendingAcknowledgment)logger.acknowledgeNext();};
afterEach(()=>{games.splice(0).forEach(g=>g.disposeRecording());clear();});
function start(){const g=new Game({seed:1});games.push(g);g.startNewGame({seed:42,ruleSet:'extended',extensions:['party'],extensionConfigurations:{party:{schema:1,members:2}},initialCommands:[JSON.stringify({module:'party',action:'create',payload:{schema:1,members:2}})]});g.animationEnabled=false;clear();return g;}
function send(g:Game,change:any){clear();g.executeCommand('party:ai',{kind:'party:ai',schema:1,issuerSlot:'local:0',expectedRevision:g.party!.state.revision,change});}
function travel(g:Game,depth:number,leave:number[]=[]){clear();g.executeCommand('party:control',{kind:'party:control',schema:1,issuerSlot:'local:0',expectedRevision:g.party!.state.revision,actorId:g.player.id,change:{kind:'travel-party',destination:{kind:'dungeon',depth},leavingBehind:leave}});}
function roundtrip(g:Game){const save=JSON.parse(JSON.stringify(g.toSaveSnapshot())),h=new Game({seed:1});games.push(h);expect(h.loadSnapshot(save)).toBe(true);expect(h.party!.state).toEqual(g.party!.state);expect(h.depth).toBe(g.depth);}
function humanFall(g:Game){
 // Legal fixture geometry, real human command. No direct partyFalls invocation.
 g.monsters=[];g.dormantMonsters=[];g.items=[];
 for(let y=10;y<=16;y++)for(let x=17;x<=25;x++){g.grid.setTerrain(x,y,TerrainType.FLOOR);g.grid.getCell(x,y)!.isDiscovered=true;}
 commitCreatureAnchor(g.player,{x:20,y:13});g.grid.setTerrain(21,13,TerrainType.CHASM);g.grid.getCell(21,13)!.isDiscovered=true;
 clear();g.onConfirmRequest=()=>true;g.submitPartyIntent({kind:'move',dx:1,dy:0},g.player.id);
 while(g.pendingCommandConfirmation)g.resolveCommandDecision(g.pendingCommandConfirmation.token,true);
}
it('R2-F10 human fall clears old-level companion order before immediate save/load',()=>{
 const g=start(),b=g.controlledActors[1]!;g.monsters=[];g.dormantMonsters=[];g.items=[];
 for(let y=10;y<=16;y++)for(let x=17;x<=27;x++){g.grid.setTerrain(x,y,TerrainType.FLOOR);g.grid.getCell(x,y)!.isDiscovered=true;}
 commitCreatureAnchor(g.player,{x:20,y:13});commitCreatureAnchor(b,{x:26,y:13});const ally=new Monster(24,13,(monsters as MonsterData[]).find(m=>m.id==='rat')!);ally.isAlly=true;ally.ticksUntilTurn=10000;g.monsters.push(ally);(g as any).updateVision();
 send(g,{kind:'order',actorIds:[ally.id],order:{kind:'guard',level:1,x:24,y:13}});expect(g.party!.state.companionOrders).toHaveLength(1);
 // Retain the real ally throughout this specific fall; helper's cleanup is not used.
 g.grid.setTerrain(21,13,TerrainType.CHASM);g.grid.getCell(21,13)!.isDiscovered=true;clear();g.onConfirmRequest=()=>true;g.submitPartyIntent({kind:'move',dx:1,dy:0},g.player.id);while(g.pendingCommandConfirmation)g.resolveCommandDecision(g.pendingCommandConfirmation.token,true);
 expect(g.depth).toBe(2);expect(g.party!.state.companionOrders).toEqual([]);expect(g.party!.state.members.find(m=>m.actorId===b.id)!.life).toBe('frozen');roundtrip(g);
});
it('R2-F10 returning frozen member pending control applies after human fall publication',()=>{
 const g=start(),b=g.controlledActors[1]!;
 const down=g.levelSeeds[0]!.downStairsLoc;commitCreatureAnchor(g.player,down);
 // Adjacent fixture placement uses the existing legal travel validation.
 let adjacent:{x:number;y:number}|undefined;
 for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const p={x:down.x+dx!,y:down.y+dy!};if((g as any).entryQualifiesForPlacement(p.x,p.y)){adjacent=p;break;}}
 expect(adjacent).toBeTruthy();commitCreatureAnchor(b,adjacent!);g.monsters=[];travel(g,2);
 // Leave b on D2 and return the human primary to D1.
 commitCreatureAnchor(g.player,g.levelSeeds[1]!.upStairsLoc);travel(g,1,[b.id]);expect(g.party!.state.members[1]!.life).toBe('frozen');expect(b.ticksUntilTurn).toBe(0);
 send(g,{kind:'controller',actorId:b.id,expectedEpoch:g.party!.state.members[1]!.controlEpoch,controller:{kind:'ai',policyId:'party-ai-v1'}});expect(g.party!.state.members[1]!.pendingController?.kind).toBe('ai');
 humanFall(g);expect(g.depth).toBe(2);const m=g.party!.state.members[1]!;expect(m.life).toBe('active');expect(b.ticksUntilTurn).toBe(0);expect(m.controller.kind).toBe('ai');expect(m.pendingController).toBeNull();expect(m.temporaryAiSeq).toBeNull();roundtrip(g);
});
