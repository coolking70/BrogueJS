import {afterEach,it,expect} from 'vitest';
import '../../../../i18n';
import {Game} from '../../../../engine/Core/Game';
import {logger} from '../../../../engine/Systems/Logger';
import {timeSystem} from '../../../../engine/Systems/Time';
import {PartyAiV1} from '../../../../ext/modules/party/PartyAiV1';
import {defaultPartyAi,type PartyAiView} from '../../../../ext/partyAi';
import {arena,attackCommand} from '../../../../ext/modules/combat/tests/support/combat2Harness';
import {preparePhasedAttackCommand,commitPhasedAttackCommand} from '../../../../engine/Core/PhasedAttackProduction';
const games:Game[]=[];const clear=()=>{while(logger.pendingAcknowledgment)logger.acknowledgeNext();};
function start(n=2,combat=false){const g=new Game({seed:1});games.push(g);g.startNewGame({seed:42,mode:'wizard',ruleSet:'extended',extensions:combat?['combat','party']:['party'],extensionConfigurations:{party:{schema:1,members:n}},initialCommands:[JSON.stringify({module:'party',action:'create',payload:{schema:1,members:n}})]});g.animationEnabled=false;clear();return g;}
function control(g:Game){clear();g.executeCommand('party:ai',{kind:'party:ai',schema:1,issuerSlot:'local:0',expectedRevision:g.party!.state.revision,change:{kind:'controller',actorId:g.player.id,expectedEpoch:g.party!.state.members[0]!.controlEpoch,controller:{kind:'ai',policyId:'party-ai-v1'}}});}
function step(g:Game,id:number){clear();g.executeCommand('party:actor-step',{kind:'party:actor-step',schema:1,issuerSlot:'local:0',expectedRevision:g.party!.state.revision,actorId:id,intent:{kind:'wait'}});}
const view=():PartyAiView=>({seed:'42',fingerprint:'rule',actorId:1,ordinal:0,level:1,at:{x:2,y:2},hp:20,maxHp:20,leader:null,cells:Array.from({length:49},(_,i)=>({x:i%7,y:Math.floor(i/7),passable:true,danger:false,stairs:false})),occupied:[],enemies:[],recovery:[],rangedItem:null,pickups:[],settings:defaultPartyAi().settings,order:null});
afterEach(()=>{games.splice(0).forEach(g=>g.disposeRecording());clear();});
it('R2 closes F4 retreat has order priority',()=>{const v=view();v.order={kind:'retreat',level:1,x:6,y:2};v.enemies=[{id:5,x:1,y:2,attackable:true,ranged:false}];expect(PartyAiV1.decide(v).intent).toEqual({kind:'move',dx:1,dy:0});});
it('R2 closes F5 guard shares available neighborhood',()=>{const v=view();v.order={kind:'guard',level:1,x:4,y:2};v.occupied=[{x:4,y:2}];expect(PartyAiV1.decide(v).intent).toEqual({kind:'move',dx:1,dy:0});});
it('R2 closes F6 budget is cumulative',()=>{const v=view();v.at={x:1,y:1};v.cells=[];for(let x=0;x<92;x++)for(let y=0;y<32;y++)v.cells=[...v.cells,{x,y,passable:y>0&&y<31&&x>0&&x<91,danger:false,stairs:x===90&&y===30}];v.order={kind:'explore',level:1};const result=PartyAiV1.decide(v);expect(result.intent.kind).toBe('wait');expect(result.diagnostic).toBe('budget');expect(result.nodes).toBe(4096);});
it('R2 closes F2 pending AI cannot be bypassed with public actor steps',()=>{const g=start();g.monsters=[];g.dormantMonsters=[];step(g,g.player.id);control(g);expect(g.party!.state.members[0]!.pendingController?.kind).toBe('ai');step(g,g.controlledActors[1]!.id);expect(g.player.ticksUntilTurn).toBe(0);const before=timeSystem.currentTick;expect(()=>step(g,g.player.id)).toThrow('NOT_CONTROLLER');expect(g.party!.state.members[0]!.controller.kind).toBe('ai');expect(g.party!.state.members[0]!.pendingController).toBeNull();expect(g.player.ticksUntilTurn).toBe(0);expect(timeSystem.currentTick).toBe(before);});
it('R2 closes F1 busy controller command is accepted',()=>{const g=start(1,true);arena(g);const plan=preparePhasedAttackCommand(g,attackCommand('combat.advancing-point'));expect(plan).toBeTruthy();commitPhasedAttackCommand(g,plan!);expect(g.isInputLocked()).toBe(true);const revision=g.party!.state.revision;control(g);expect(g.party!.state.members[0]!.pendingController?.kind).toBe('ai');expect(g.party!.state.revision).toBe(revision+1);});
