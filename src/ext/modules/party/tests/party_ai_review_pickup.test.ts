import {afterEach,it,expect} from 'vitest';
import '../../../../i18n';
import {createWorldHarness,worldHarnessGame} from '../../../../ext/testing/worldHarness';
import {stateOf} from '../../../../ext/modules/loot/session';
import {TerrainType} from '../../../../engine/Map/Grid';
import {Item,ItemCategory} from '../../../../engine/Items/Item';
import {ItemLoader} from '../../../../engine/Items/ItemLoader';
import {partyAiView,decidePartyAi} from '../../../../engine/Core/PartyAi';
import {commitCreatureAnchor} from '../../../../engine/Movement/CreatureSpatial';
import {logger} from '../../../../engine/Systems/Logger';
import {timeSystem} from '../../../../engine/Systems/Time';
import {mechanicalDigest} from '../../../../engine/Core/RecordingDigest';
import {rng} from '../../../../engine/Random';
import {getNextEntityId} from '../../../../entities/Creature';
const handles:ReturnType<typeof createWorldHarness>[]=[];
const clear=()=>{while(logger.pendingAcknowledgment)logger.acknowledgeNext();};
afterEach(()=>{handles.splice(0).forEach(h=>h.dispose());clear();});
const pickup={kind:'module',owner:'foundation',commandId:'native-action',payload:{action:'pickup'}} as const;
function scene(){
 const h=createWorldHarness({seed:42,mode:'normal',modules:['loot','party']});handles.push(h);const g=worldHarnessGame(h);clear();
 g.monsters=[];g.dormantMonsters=[];g.items=[];g.animationEnabled=false;
 for(let y=8;y<=17;y++)for(let x=8;x<=24;x++){g.grid.setTerrain(x,y,TerrainType.FLOOR);const c=g.grid.getCell(x,y)!;c.isVisible=true;c.hasMemory=true;c.rememberedTerrain=TerrainType.FLOOR;c.rememberedFlags={passable:true,opaque:false,trapFree:true};}
 g.controlledActors.forEach((a,i)=>commitCreatureAnchor(a,{x:10+i*8,y:12}));
 const send=(change:any)=>{clear();g.executeCommand('party:ai',{kind:'party:ai',schema:1,expectedRevision:g.party!.state.revision,issuerSlot:'local:0',change});};
 const control=(ai=true)=>send({kind:'controller',actorId:g.player.id,expectedEpoch:g.party!.state.members[0]!.controlEpoch,controller:ai?{kind:'ai',policyId:'party-ai-v1'}:{kind:'human',slot:'local:0'}});
 const filter=(allow:boolean)=>{clear();h.ext('loot','set-filter',{v:1,revision:stateOf(g.extensionRuntime!.snapshot().modules.loot!).revision,minRarity:'normal',classes:['weapon','armor','ring'],autoPickupGold:allow});expect(stateOf(g.extensionRuntime!.snapshot().modules.loot!).filter.autoPickupGold).toBe(allow);};
 const gold=(x=10)=>{const i=new Item('gold','$',0xffff00,ItemCategory.GOLD);i.loc={x,y:12};i.quantity=17;g.items.push(i);return i;};
 const food=(x=10,avoids=false)=>{const i=ItemLoader.spawnFood('ration_of_food',x,12)!;expect(i).toBeTruthy();if(avoids)i.flags=['ITEM_PLAYER_AVOIDS'];g.items.push(i);return i;};
 const view=()=>{for(const i of g.items)g.grid.getCell(i.x,i.y)!.isVisible=true;return partyAiView(g,g.player,g.party!.state.members[0]!.ai);};
 const window=()=>{clear();g.submitPartyWindow({kind:'party:window',schema:2,seq:g.party!.state.window.seq+1,expectedRevision:g.party!.state.revision,issuerSlot:'local:0',startTick:timeSystem.currentTick,length:{kind:'ticks',ticks:100},fineActorId:null,automatic:false,trigger:'manual',plans:[]});};
 return {g,h,send,control,filter,gold,food,view,window};
}
it('R2-F9 real loot switch and avoids exclude only disallowed visible candidates',()=>{
 const {g,filter,gold,food,view}=scene();filter(false);const blocked=gold(11),avoided=food(12,true),eligible=food(13);
 expect(g.extensionRuntime!.itemAutoPickup(blocked)).toBe(false);expect(view().pickups.map(i=>i.id)).toEqual([eligible.id]);
 filter(true);expect(view().pickups.map(i=>i.id)).toEqual([blocked.id,eligible.id]);expect(view().pickups.map(i=>i.id)).not.toContain(avoided.id);
});
it.each(['filtered-first','avoided-first'] as const)('R2-F9 effective AI execution revalidates actual native first item: %s',kind=>{
 const {g,filter,gold,food,control,view}=scene();filter(false);const blocked=kind==='filtered-first'?gold():food(10,true),eligible=food();control();
 expect(view().pickups.map(i=>i.id)).toContain(eligible.id);expect(view().pickups.map(i=>i.id)).not.toContain(blocked.id);
 const digest=mechanicalDigest(g.toSnapshot(),(g as any).recordingInputState()),random=rng.getState(),id=getNextEntityId();
 // Private production validation boundary: no synthetic policy output or bypassed commit.
 expect(()=>(g as any).preparePartyNativeCommand(g.player,pickup)).toThrow('INVALID_TARGET');
 expect(mechanicalDigest(g.toSnapshot(),(g as any).recordingInputState())).toEqual(digest);expect(rng.getState()).toEqual(random);expect(getNextEntityId()).toBe(id);
 // A real policy chooses this same-cell eligible candidate; actual window must safely wait.
 const m=g.party!.state.members[0]!;g.executeCommand('party:ai',{kind:'party:ai',schema:1,expectedRevision:g.party!.state.revision,issuerSlot:'local:0',change:{kind:'settings',actorId:g.player.id,expectedEpoch:m.controlEpoch,settings:{...m.ai.settings,tactic:'defend',autoPickup:true}}});
 // Defend with no enemies reaches the explicitly enabled pickup priority.
 expect(decidePartyAi(g,g.player.id).intent).toEqual(pickup);
 const t=timeSystem.currentTick;clear();g.submitPartyWindow({kind:'party:window',schema:2,seq:1,expectedRevision:g.party!.state.revision,issuerSlot:'local:0',startTick:t,length:{kind:'ticks',ticks:100},fineActorId:null,automatic:false,trigger:'manual',plans:[]});
 expect(timeSystem.currentTick-t).toBe(100);expect(g.items.map(i=>i.id)).toContain(blocked.id);expect(g.items.map(i=>i.id)).toContain(eligible.id);expect(g.party!.state.members[0]!.ai.ordinal).toBe(1);expect(g.party!.state.window.receipt!.interrupts.some(f=>f.kind==='plan-invalid')).toBe(false);
});
it.each(['filtered','avoided'] as const)('R2-F9 human explicit pickup still overrides %s',kind=>{
 const {g,filter,gold,food}=scene();filter(false);const item=kind==='filtered'?gold():food(10,true),before=g.stats.gold,foodBefore=g.player.inventory.items.filter(i=>i.consumableId==='ration_of_food').reduce((n,i)=>n+i.quantity,0);clear();g.submitPartyIntent(pickup,g.player.id);
 expect(g.items.map(i=>i.id)).not.toContain(item.id);if(kind==='filtered')expect(g.stats.gold).toBe(before+17);else expect(g.player.inventory.items.filter(i=>i.consumableId==='ration_of_food').reduce((n,i)=>n+i.quantity,0)).toBe(foodBefore+1);
});
it.each([true,false])('R2-F9 crossing avoided food respects automatic control: AI=%s',ai=>{
 const {g,food,control,send,window}=scene();const item=food(11,true);if(ai){control();send({kind:'order',actorIds:[g.player.id],order:{kind:'retreat',level:g.depth,x:14,y:12}});expect(decidePartyAi(g,g.player.id).intent).toEqual({kind:'move',dx:1,dy:0});window();}else{clear();g.submitPartyIntent({kind:'move',dx:1,dy:0},g.player.id);}
 expect(g.player.loc).toEqual({x:11,y:12});expect(g.items.some(i=>i.id===item.id)).toBe(ai);
});
it('R2-F9 default disabled active collection preserves ordinary eligible displacement pickup',()=>{
 const {g,food,control,send,window}=scene();const item=food(11);control();expect(g.party!.state.members[0]!.ai.settings.autoPickup).toBe(false);send({kind:'order',actorIds:[g.player.id],order:{kind:'retreat',level:g.depth,x:14,y:12}});window();expect(g.player.loc).toEqual({x:11,y:12});expect(g.items.some(i=>i.id===item.id)).toBe(false);
});
