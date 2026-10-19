import {afterEach,it,expect,vi} from 'vitest';
import '../../../../i18n';
import {logger} from '../../../../engine/Systems/Logger';
import {timeSystem} from '../../../../engine/Systems/Time';
import {installProductionBody,startProductionGame,emptyProductionArena,PRODUCTION_BODY_ID} from '../../../../test/support/productionComposite';
import {commitCreatureAnchor} from '../../../../engine/Movement/CreatureSpatial';
import {partyAiView} from '../../../../engine/Core/PartyAi';
import {MonsterState} from '../../../../entities/Monster';
import {defaultPartyAi} from '../../../../ext/partyAi';
const clear=()=>{while(logger.pendingAcknowledgment)logger.acknowledgeNext();};
afterEach(()=>{vi.restoreAllMocks();clear();});
it.each([{dx:1,dy:0},{dx:0,dy:1}])('R2 composite moves across own previous footprint $dx/$dy',({dx,dy})=>{
 installProductionBody();const g=startProductionGame(['body-fixture','party']);try{emptyProductionArena(g);const core=g.createCompositeMonster(PRODUCTION_BODY_ID,{x:14,y:12})!;expect(core).toBeTruthy();g.monsters.forEach(a=>{a.isAlly=true;a.state=MonsterState.WANDERING;a.ticksUntilTurn=0;});commitCreatureAnchor(g.player,{x:21,y:18});(g as any).updateVision();
 const view=partyAiView(g,core,defaultPartyAi());const own=g.bodyGroups![0]!.members.map(m=>g.monsters.find(a=>a.id===m.entityId)!.loc);expect(view.occupied.some(at=>own.some(p=>p.x===at.x&&p.y===at.y))).toBe(false);
 const target={x:core.x+dx*5,y:core.y+dy*5};clear();g.executeCommand('party:ai',{kind:'party:ai',schema:1,expectedRevision:g.party!.state.revision,issuerSlot:'local:0',change:{kind:'order',actorIds:[core.id],order:{kind:'guard',level:g.depth,...target}}});clear();g.submitPartyWindow({kind:'party:window',schema:2,seq:1,expectedRevision:g.party!.state.revision,issuerSlot:'local:0',startTick:timeSystem.currentTick,length:{kind:'ticks',ticks:100},fineActorId:null,automatic:false,trigger:'manual',plans:[]});expect(core.loc).toEqual({x:14+2*dx,y:12+2*dy});expect(g.party!.state.companionOrders[0]!.ai.ordinal).toBe(2);expect(core.ticksUntilTurn).toBe(100);
 }finally{g.disposeRecording();}
});
