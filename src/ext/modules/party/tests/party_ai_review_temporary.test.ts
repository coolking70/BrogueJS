import {it,expect} from 'vitest';
import '../../../../i18n';
import {Game} from '../../../../engine/Core/Game';
import {logger} from '../../../../engine/Systems/Logger';
import {timeSystem} from '../../../../engine/Systems/Time';
const clear=()=>{while(logger.pendingAcknowledgment)logger.acknowledgeNext();};
it('R2 real temporary AI survives another member confirmation save/load and clears without consuming tail',()=>{
 const g=new Game({seed:1}),h=new Game({seed:2});try{
 g.startNewGame({seed:42,ruleSet:'extended',extensions:['party'],extensionConfigurations:{party:{schema:1,members:2}},initialCommands:[JSON.stringify({module:'party',action:'create',payload:{schema:1,members:2}})]});g.animationEnabled=false;clear();
 const [a,b]=g.controlledActors,food=b!.inventory.items.find(i=>i.consumableId==='ration_of_food')!;
 g.submitPartyWindow({kind:'party:window',schema:2,seq:1,expectedRevision:g.party!.state.revision,issuerSlot:'local:0',startTick:timeSystem.currentTick,length:{kind:'ticks',ticks:300},fineActorId:null,automatic:false,trigger:'manual',plans:[{actorId:a!.id,controllerSlot:'local:0',update:'replace',plan:{kind:'ai-this-window'}},{actorId:b!.id,controllerSlot:'local:0',update:'replace',plan:{kind:'queue',actions:[{kind:'item',operation:'use',itemId:food.id,target:null},{kind:'search'}]}}]});
 expect(g.party!.state.window.phase).toBe('awaiting-decision');expect(g.party!.state.members[0]!.temporaryAiSeq).toBe(1);expect(g.party!.state.members[0]!.controller.kind).toBe('human');
 const save=JSON.parse(JSON.stringify(g.toSaveSnapshot()));clear();g.choosePartyDecision('no');const expected=structuredClone(g.party!.state);expect(expected.members[0]!.temporaryAiSeq).toBeNull();expect(expected.members[0]!.ai.ordinal).toBe(1);
 expect(h.loadSnapshot(save)).toBe(true);expect(h.party!.state.members[0]!.temporaryAiSeq).toBe(1);clear();h.choosePartyDecision('no');expect(h.party!.state).toEqual(expected);
 }finally{g.disposeRecording();h.disposeRecording();clear();}
});
