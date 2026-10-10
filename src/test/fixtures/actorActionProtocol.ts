/** Complete data-only backend for foundation actor clock tests.
 * The foundation protocol reserves combat.* stat keys and bundle ownership.
 * This test descriptor has its own version/rules, never installs the real pack.
 */
import { vi } from 'vitest';
import * as catalog from '../../ext/catalog';
import { FOUNDATION_PROTOCOL, type ModuleDescriptor } from '../../ext/descriptor';
import { extensionDataFingerprint } from '../../ext/fingerprint';
import type { ActorAttackDefinitions, ActorAttackFacing, ProductionActorAttackState } from '../../ext/actorActions';
import { validateActorAttackDefinitions, validateProductionActorAttackState } from '../../ext/actorActionValidation';
import { initialBonfireState, validateBonfireState, bonfireInstanceKey } from '../../ext/worldRest';
import type { StatKeyDeclaration } from '../../ext/stats';
import type { Json, ExtensionModule } from '../../ext/types';

const facings: ActorAttackFacing[] = ['n','ne','e','se','s','sw','w','nw'];
const directions = [{x:0,y:-1},{x:1,y:-1},{x:1,y:0},{x:1,y:1},{x:0,y:1},{x:-1,y:1},{x:-1,y:0},{x:-1,y:-1}];
const offsets = Object.fromEntries(facings.map((f,i) => [f, [directions[i]!]])) as Record<ActorAttackFacing,{x:number;y:number}[]>;
const shape = {kind:'footprint-offset-union' as const, offsets, selfExclusion:'whole-group' as const, occlusion:'line-of-effect' as const};
const segment = {shape, locationPolicy:'locked-world' as const, targetPolicy:'part' as const,
  damageProfile:'native-melee' as const, poiseDamage:2, dodgeable:true, parryable:true};
const definitions: ActorAttackDefinitions = {
  attacks:[{id:'fixture.double-thrust',nameKey:'ext.combat.protocol.attack',cost:4,windupTicks:80,recoveryTicks:50,
    segments:[{...segment,delayTicks:0},{...segment,delayTicks:50}]}],
  profiles:[{id:'fixture.profile',resourcePolicyId:'fixture.resources',attackIds:['fixture.double-thrust']}],
  resourcePolicies:[{id:'fixture.resources',initialStamina:24,staminaCapacity:24,regenPerTickNumerator:1,
    regenPerTickDenominator:20,regenDelayTicks:40,nativeAttackCost:2,regenPhases:['idle','recovery','break-recovery'],
    poiseCapacity:12,poiseRecoveryNumerator:1,poiseRecoveryDenominator:30,poiseRecoveryDelayTicks:40,
    poiseBreakRecoveryValue:12,nativePoiseDamage:2,poiseImmune:false}],
  nativeProfiles:['rat','kobold','ogre'].map(monsterId=>({monsterId,profileId:'fixture.profile'})),
  playerProfileId:'fixture.profile',breakRecoveryTicks:50,dodge:{cost:4,windowTicks:40,recoveryTicks:80},
  parry:{cost:3,windowTicks:60,recoveryTicks:100,poiseDamage:12,contactRange:1},
  bonfires:{definitions:[{id:'combat.protocol-fire',nameKey:'ext.combat.protocol.fire',descriptionKey:'ext.combat.protocol.fire_description',
    glyph:'♨',color:'#E7A34B',interactionDistance:1,placement:{minDepth:1,maxDepth:40,maxPerDepth:1,maxPerRun:40,
      minStairDistance:2,maxEntranceDistance:6,onNoSpace:'skip'},restTicks:500,
    restorePolicy:{hp:'full',stamina:'full',poise:'full'},resetPolicy:'none'}],
    limits:{maxActive:40,maxPlacements:40,maxRestReceipts:128}}
};
validateActorAttackDefinitions(definitions);
const keys: readonly StatKeyDeclaration[] = ['stamina-capacity','poise-capacity','stamina-regen','poise-recovery','native-attack-cost'].map(id=>({
  id:`combat.${id}`,owner:'combat',unit:'resource',kind:id.endsWith('capacity')?'materialized':'query',
  minimum:id.endsWith('capacity')?1:0,maximum:1_000_000,rounding:'floor',categories:['override','flat','increased','more','clamp'],
  increased:{minimum:-9000,maximum:50000},moreSlots:[{id:'growth.slot.final',minimum:-10000,maximum:30000},
    {id:'equipment',minimum:0,maximum:40000},{id:'environment',minimum:0,maximum:40000}]}));
const version='0.0.1',rules={schema:1,version,fingerprint:extensionDataFingerprint({definitions,keys,fixture:'actor-action-protocol'})};
export const actorActionProtocolFixture: ModuleDescriptor = {
  id:'combat',version,foundation:FOUNDATION_PROTOCOL,rules,defaultEnabled:false,labelKey:'ext.combat.protocol.label',
  locales:{zh_CN:{'ext.combat.protocol.label':'底座动作测试声明','ext.combat.protocol.attack':'测试双段攻击',
    'ext.combat.protocol.fire':'测试炉火','ext.combat.protocol.fire_description':'独立底座时钟测试炉火。'}},
  create:()=>({id:'combat',version,rules,actorActions:{definitions:definitions as unknown as Json},
    statSources:{keys,collect:()=>[]},worldInteractables:true,initializationReady:()=>true,
    initialState:()=>({schema:4,revision:0,actions:[],actors:[],bonfires:initialBonfireState()}) as unknown as Json,
    validateState:(value):value is Json=>{try{validateProductionActorAttackState(value,definitions);return true;}catch{return false;}},
    readyToSave:ctx=>(ctx.state as unknown as ProductionActorAttackState).bonfires!.active?.phase!=='settling',
    validateComponents:(_state,components)=>Object.values(components).every(values=>Object.keys(values).every(k=>!k.startsWith('combat:'))),
    validateWorld:(value,_components,actors,world)=>{
      const state=value as unknown as ProductionActorAttackState,fire=definitions.bonfires!.definitions[0]!,b=state.bonfires!;
      const owned=world.entities.filter(e=>e.owner==='combat');
      return !world.gate?.owner?.startsWith('combat') && owned.length===Object.keys(b.bindings).length
        && owned.every(e=>e.contentId===fire.id&&e.nameKey===fire.nameKey&&e.descriptionKey===fire.descriptionKey
          &&e.glyph===fire.glyph&&e.color===fire.color&&e.interactionDistance===fire.interactionDistance&&e.priority===0
          &&b.bindings[e.id]?.instanceKey===e.instanceKey&&b.bindings[e.id]?.definitionId===fire.id
          &&b.placements.some(p=>p.instanceKey===e.instanceKey&&p.depth===e.depth&&p.result==='placed'))
        &&(!b.active||b.active.phase==='resting'&&b.active.depth===world.depth&&!world.isGameOver
          &&actors.some(a=>a.id===b.active!.actorId&&a.player&&a.hp>0)
          &&owned.some(e=>e.id===b.active!.bonfireId&&e.depth===b.active!.depth&&e.instanceKey===b.active!.instanceKey))
        &&b.receipts.every(p=>p.bonfireId<world.nextEntityId&&p.actorId<world.nextEntityId&&actors.some(a=>a.id===p.actorId&&a.player))
        &&state.actors.every(a=>a.actorId<world.nextEntityId&&actors.some(live=>live.id===a.actorId))
        &&state.actions.every(a=>a.subactions.every(s=>s.approvedRisks.every(r=>r.targetId<world.nextEntityId)));
    },
    hooks:{enteredLevel:(event,ctx)=>{
      if(!event.firstVisit)return;
      const state=structuredClone(ctx.state) as unknown as ProductionActorAttackState,b=validateBonfireState(state.bonfires,definitions.bonfires!),
        fire=definitions.bonfires!.definitions[0]!,instanceKey=bonfireInstanceKey(fire.id,event.depth);
      if(b.placements.some(p=>p.instanceKey===instanceKey))return;
      const placed=ctx.placeInteractables([{instanceKey,contentId:fire.id,nameKey:fire.nameKey,descriptionKey:fire.descriptionKey,
        glyph:fire.glyph,color:fire.color,interactionDistance:fire.interactionDistance,priority:0,
        minStairDistance:fire.placement.minStairDistance,maxEntranceDistance:fire.placement.maxEntranceDistance}]);
      const entity=placed[0]!.entity;
      if(entity)b.bindings[entity.id]={definitionId:fire.id,instanceKey};
      b.placements.push({definitionId:fire.id,instanceKey,depth:event.depth,result:entity?'placed':'skipped',visits:0,completedRests:0});
      b.placements.sort((a,b)=>a.instanceKey<b.instanceKey?-1:a.instanceKey>b.instanceKey?1:0);
      state.bonfires=b;state.revision++;ctx.setState(state as unknown as Json);
    },interactablesRemoved:(event,ctx)=>{
      const state=structuredClone(ctx.state) as unknown as ProductionActorAttackState;
      for(const id of event.entityIds){delete state.bonfires!.bindings[id];if(state.bonfires!.active?.bonfireId===id)state.bonfires!.active.interrupted='target-removed';}
      state.revision++;ctx.setState(state as unknown as Json);
    }}
  } as ExtensionModule)
};
/** Only opt-in capability fixtures call this. Fresh production registries and
 * the actual missing-module save/recording probes never invoke it. */
export function installActorActionProtocolFixtureIfAbsent(): boolean {
  const installed=catalog.getInstalledModuleDescriptors();
  if(installed.some(d=>d.id==='combat'))return false;
  vi.spyOn(catalog,'getInstalledModuleDescriptors').mockReturnValue([...installed,actorActionProtocolFixture]);
  return true;
}
