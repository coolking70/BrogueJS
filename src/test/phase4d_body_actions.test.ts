import { afterEach, describe, expect, it, vi } from 'vitest';
import * as catalog from '../ext/catalog';
import { registryFromDescriptors } from '../ext/descriptor';
import { extensionDataFingerprint } from '../ext/fingerprint';
import type { ActorAttackDefinitions, ProductionActorAttackState } from '../ext/actorActions';
import type { PartBreakPrepareContext, PartBreakRequest, PartBreakProvider } from '../ext/partBreak';
import type { Json } from '../ext/types';
import { emptyProductionArena, installProductionBody, startProductionGame, PRODUCTION_BODY_ID } from './support/productionComposite';
import { commitCreatureAnchor, footprintOf } from '../engine/Movement/CreatureSpatial';
import { productionActorActionScheduler, notifyProductionActorSourceChanged } from '../engine/Core/ActorActionProduction';
import { applyActorPoiseDamage } from '../engine/Core/PhasedAttackProduction';
import { withBodyContact } from '../engine/Combat/BodyCombat';
import { CombatSystem } from '../engine/Combat/Combat';
import { rng } from '../engine/Random';
import { MonsterState } from '../entities/Monster';
import { logger } from '../engine/Systems/Logger';
import type { Game } from '../engine/Core/Game';

const json = <T>(value:T):T => JSON.parse(JSON.stringify(value));
const state = (game:Game):ProductionActorAttackState => game.extensionRuntime!.actorActionBinding()!.state;
// Diagnostic creation/hits are not a new-game recording. Compare every saved
// mechanical field, excluding only wall time and input-history provenance.
function mechanics(snapshot:ReturnType<Game['toSaveSnapshot']>) {
    const value=json(snapshot);value.savedAt=0;value.run.recordedInputEvents=[];value.run.recordedInputIndex=0;
    delete value.run.recordingOrigin;return value;
}
type Mode = 'normal' | 'absent' | 'unsupported' | 'throw' | 'invalid' | 'async';
function configure(mode:Mode='normal', balance=20, mixed=false) {
    const data=installProductionBody(8,undefined,undefined,true);
    const modifier=data.rule.modifiers.find(m=>m.kind==='balance-loss')!;
    if(modifier.kind==='balance-loss')modifier.amount=balance;
    const installed=catalog.createExtensionRegistry();
    const descriptors=catalog.getInstalledModuleDescriptors();
    let seen:Readonly<PartBreakRequest>|undefined,proof:PartBreakPrepareContext['member'];
    const registry=registryFromDescriptors(descriptors.map(d=>{
        const base=installed.create(installed.manifest([d.id]))[0]!;
        if(d.id==='giants'&&mixed){
            data.definition.parts[2]!.formId='giants.fixture-claw';
            const nativeForms=[...base.nativeForms!,{...data.leg,id:'giants.fixture-claw'}];
            const rules={...base.rules!,fingerprint:extensionDataFingerprint({nativeForms,nativeBodies:base.nativeBodies})};
            return {...d,rules,create:()=>({...base,rules,nativeForms})};
        }
        if(d.id!=='combat')return {...d,rules:base.rules,create:()=>base};
        const definitions=json(base.actorActions!.definitions) as unknown as ActorAttackDefinitions;
        definitions.nativeProfiles.push({monsterId:'giants.fixture-leg',profileId:'combat.follow-thrust'});
        if(mixed)definitions.nativeProfiles.push({monsterId:'giants.fixture-claw',profileId:'combat.fan-edge'});
        const original=base.optionalPartBreaks!['combat.part-break.v1']!;
        const provider:PartBreakProvider={prepare:(request,context)=>{
            seen=request;proof=context.member;
            return mode==='unsupported'?{status:'unsupported',reason:'unsupported-target'}:original.prepare(request,context);
        },commit:(request,plan,context)=>{original.commit(request,plan,context);
            if(mode==='throw')throw new Error('after real provider');
            if(mode==='invalid')return 'bad' as never;
            if(mode==='async')return Promise.resolve() as never;
        }};
        const rules={...base.rules!,fingerprint:extensionDataFingerprint({definitions,mode})};
        return {...d,rules,create:()=>({...base,rules,actorActions:{...base.actorActions!,definitions:definitions as unknown as Json},
            optionalPartBreaks:mode==='absent'?undefined:{'combat.part-break.v1':provider}})};
    }));
    vi.mocked(catalog.createExtensionRegistry).mockReturnValue(registry);
    return {data,seen:()=>seen,proof:()=>proof};
}
function scene(mode:Mode='normal',balance=20,mixed=false,dense=false) {
    const evidence=configure(mode,balance,mixed);
    if(dense){
        const offsets=[{x:3,y:-1},{x:4,y:-1},{x:5,y:-1},{x:3,y:0},{x:5,y:0},{x:3,y:1},{x:4,y:1},{x:5,y:1}];
        evidence.data.definition.parts.forEach((part,i)=>{if(i)part.preferredOffset=offsets[i-1]!;});
        evidence.data.definition.constraints.forEach(edge=>{edge.maxDistance=6;});
    }
    const game=startProductionGame(['giants','combat']);emptyProductionArena(game);
    const core=game.createCompositeMonster(PRODUCTION_BODY_ID,{x:14,y:12})!;
    core.state=MonsterState.HUNTING;core.behaviorFlags.add('MONST_ALWAYS_HUNTING');core.givenUpOnScent=true;
    const group=game.bodyGroups![0]!,legs=game.monsters.slice(1);
    commitCreatureAnchor(game.player,dense?{x:18,y:12}:{x:14,y:10});
    return {game,core,group,legs,...evidence};
}
function hit(_game:Game,leg:Game['monsters'][number]) { return withBodyContact(leg,leg.loc,()=>leg.takeDamage(100)); }
afterEach(()=>{vi.restoreAllMocks();logger.reset();});

describe('4d production body with 3b bundles and real 3d part-break provider',()=>{
    it.each(['normal','absent','unsupported'] as const)('attests a live member and exclusively commits provider/fallback (%s)',mode=>{
        const {game,core,group,legs,seen,proof}=scene(mode);core.ticksUntilTurn=20;
        hit(game,legs[0]!);
        expect(group.appliedBreaks).toEqual([{partId:'leg00',zoneId:'body',generation:0}]);
        expect(game.monsters).not.toContain(legs[0]);
        if(mode==='normal'){
            expect(state(game).actors.find(r=>r.actorId===core.id)).toMatchObject({poise:0,staggerRemainingTicks:50});
            expect(core.ticksUntilTurn).toBe(50);expect(core.spatial!.actionLockInTicks).toBeUndefined();
        }else{
            expect(state(game).actors).toEqual([]);expect(core.spatial!.actionLockInTicks).toBe(40);
        }
        if(mode!=='absent'){
            expect(seen()).toMatchObject({actorId:core.id,groupId:core.id,partId:'leg00',zoneId:'body',generation:0});
            expect(proof()).toEqual({entityId:legs[0]!.id,groupId:core.id,partId:'leg00',generation:0,bodyDefinitionId:PRODUCTION_BODY_ID});
            expect(Object.isFrozen(proof())).toBe(true);
        }
        expect(game.loadSnapshot(json(game.toSaveSnapshot()))).toBe(true);
    });
    it('rejects unowned, core, retired, wrong-generation and cross-group member receipts before invoking a provider',()=>{
        const {game,core,legs,seen}=scene();const native={apply:vi.fn(),rollback:vi.fn()};
        const request:PartBreakRequest={schema:1,resolutionId:1,actorId:core.id,groupId:core.id,sourceId:null,
            partId:'leg00',zoneId:'body',generation:0,balanceLoss:20,fallbackStunTicks:40};
        for(const edit of [{partId:'core'},{partId:'missing'},{generation:1},{actorId:game.player.id,groupId:game.player.id}])
            expect(()=>game.extensionRuntime!.commitPartBreak({...request,...edit},native)).toThrow();
        expect(native.apply).not.toHaveBeenCalled();expect(seen()).toBeUndefined();
        hit(game,legs[0]!);expect(()=>game.extensionRuntime!.commitPartBreak(request,native)).toThrow('identity');
        expect(native.apply).not.toHaveBeenCalled();
    });
    it('one real core command selects two member sources, pays once each and keeps the native member timers unchanged',()=>{
        const {game,core,legs,group}=scene('normal',0),timers=legs.map(l=>l.ticksUntilTurn),attack=vi.spyOn(CombatSystem,'attack');
        game.executeCommand('wait');
        const bundle=state(game).scheduler.bundles.find(b=>b.decisionOwnerId===core.id)!;
        expect(bundle).toBeDefined();expect(bundle.timeChargeOwnerId).toBe(core.id);expect(bundle.subactions).toHaveLength(2);
        expect(bundle.subactions.map(s=>[s.sourceEntityId,s.sourcePartId,s.sourceGeneration])).toEqual([[legs[0]!.id,'leg00',0],[legs[1]!.id,'leg01',0]]);
        expect(bundle.elapsedActionTicks).toBe(0);expect(core.ticksUntilTurn).toBe(40);
        expect(group.members.slice(1,3).map(s=>s.readyInTicks)).toEqual([130,130]);
        expect(state(game).actors.filter(r=>[legs[0]!.id,legs[1]!.id].includes(r.actorId)).map(r=>r.stamina)).toEqual([18,18]);
        expect(attack).not.toHaveBeenCalled();game.executeCommand('wait');
        expect(attack.mock.calls.filter(([source])=>legs.includes(source as Game['monsters'][number]))).toHaveLength(4);
        expect(legs.map(l=>l.ticksUntilTurn)).toEqual(timers);
        expect(state(game).actions[0]!.paidCost).toBe(12);expect(group.members[1]!.readyInTicks).toBe(30);
        expect(game.loadSnapshot(json(game.toSaveSnapshot()))).toBe(true);
    });
    it('whole-group self exclusion never includes another live member in any locked shape',()=>{
        const {game,core}=scene('normal',0);game.executeCommand('wait');
        const own=new Set(game.monsters.flatMap(c=>footprintOf(c)).map(p=>`${p.x},${p.y}`));
        for(const sub of state(game).actions[0]!.subactions)expect(sub.lockedCells.every(p=>!own.has(`${p.x},${p.y}`))).toBe(true);
        expect(state(game).scheduler.bundles[0]!.decisionOwnerId).toBe(core.id);
    });
    it('distinct source profiles release at min boundaries but keep the bundle until max duration, with no shared payment pool',()=>{
        const {game,core,legs}=scene('normal',0,true),attack=vi.spyOn(CombatSystem,'attack');game.executeCommand('wait');
        const bundle=state(game).scheduler.bundles[0]!;
        expect(state(game).actions[0]!.subactions.map(s=>s.profileId)).toEqual(['combat.follow-thrust','combat.fan-edge']);
        expect(state(game).actors.filter(r=>legs.slice(0,2).some(l=>l.id===r.actorId)).map(r=>r.stamina)).toEqual([18,20]);
        game.executeCommand('wait');
        expect(attack.mock.calls.filter(([a])=>a.id===legs[0]!.id)).toHaveLength(2);
        expect(attack.mock.calls.filter(([a])=>a.id===legs[1]!.id)).toHaveLength(1);
        expect(bundle.elapsedActionTicks).toBe(100);expect(bundle.subactions[1]!.phaseIndex).toBe(bundle.subactions[1]!.phases.length);
        expect(bundle.subactions[0]!.phaseRemainingTicks).toBe(30);expect(core.ticksUntilTurn).toBe(30);
        expect(game.loadSnapshot(json(game.toSaveSnapshot()))).toBe(true);
    });
    it('caps a surrounded core activation at four independently paid phased sources',()=>{
        const {game,core,group}=scene('normal',0,false,true);game.executeCommand('wait');
        const bundle=state(game).scheduler.bundles[0]!;
        expect(bundle.decisionOwnerId).toBe(core.id);expect(bundle.subactions.map(c=>c.sourcePartId)).toEqual(['leg00','leg01','leg02','leg03']);
        expect(group.members.filter(s=>s.readyInTicks>0)).toHaveLength(4);expect(state(game).actions[0]!.paidCost).toBe(24);
    });
    it('hostile load cannot change a member generation, owner, part or source profile, and leaves the previous run untouched',()=>{
        const {game}=scene('normal',0);game.executeCommand('wait');const saved=json(game.toSaveSnapshot());
        const native=json(game.bodyGroups),ext=json(game.extensionRuntime!.snapshot()),random=rng.getState();
        for(const edit of [
            (s:typeof saved)=>{(s.extensions!.modules.combat as unknown as ProductionActorAttackState).scheduler.bundles[0]!.subactions[0]!.sourceGeneration=1;},
            (s:typeof saved)=>{delete (s.extensions!.modules.combat as unknown as ProductionActorAttackState).scheduler.bundles[0]!.subactions[0]!.sourceGeneration;},
            (s:typeof saved)=>{(s.extensions!.modules.combat as unknown as ProductionActorAttackState).scheduler.bundles[0]!.subactions[0]!.sourcePartId='leg07';},
            (s:typeof saved)=>{(s.extensions!.modules.combat as unknown as ProductionActorAttackState).actions[0]!.subactions[0]!.profileId='combat.fan-edge';},
        ]){const bad=json(saved);edit(bad);expect(game.loadSnapshot(bad)).toBe(false);expect(game.bodyGroups).toEqual(native);expect(game.extensionRuntime!.snapshot()).toEqual(ext);expect(rng.getState()).toEqual(random);}
    });
    it('retiring a windup source cancels only its child, keeps the other source and save/load continuation deterministic',()=>{
        const {game,core,legs}=scene('normal',0);game.executeCommand('wait');
        const bundle=state(game).scheduler.bundles[0]!,dead=bundle.subactions[0]!,live=bundle.subactions[1]!;
        hit(game,legs[0]!);expect(dead.cancelled).toBe(true);expect(dead.phaseIndex).toBe(dead.phases.length);
        expect(live.cancelled).toBe(false);expect(live.phases[live.phaseIndex]!.kind).toBe('windup');
        expect(state(game).actions[0]!.subactions[0]!.lockedCells).toEqual([]);
        const saved=json(game.toSaveSnapshot());const attack=vi.spyOn(CombatSystem,'attack');game.executeCommand('wait');
        expect(attack.mock.calls.some(([source])=>source.id===legs[0]!.id)).toBe(false);
        expect(attack.mock.calls.filter(([source])=>source.id===legs[1]!.id)).toHaveLength(2);
        const expected=json(game.toSaveSnapshot()),random=rng.getState();expect(game.loadSnapshot(saved)).toBe(true);game.executeCommand('wait');
        expect(mechanics(game.toSaveSnapshot())).toEqual(mechanics(expected));expect(rng.getState()).toEqual(random);expect(core.id).toBe(saved.run.spatialWorld!.groups[0]!.coreId);
    });
    it('member break exhausts core poise and converts every pending child into the same positive recovery without fallback',()=>{
        const {game,core,legs}=scene();game.executeCommand('wait');
        const live=state(game),bundle=live.scheduler.bundles[0]!,child=bundle.subactions[1]!,phases=child.phases;
        hit(game,legs[0]!);
        expect(state(game)).toBe(live);expect(live.scheduler.bundles[0]).toBe(bundle);expect(child.phases).toBe(phases);
        expect(child.phases[child.phaseIndex]!.kind).toBe('break-recovery');expect(child.phaseRemainingTicks).toBe(50);
        expect(core.ticksUntilTurn).toBe(50);expect(core.spatial!.actionLockInTicks).toBeUndefined();
        expect(live.actors.find(r=>r.actorId===core.id)).toMatchObject({poise:0,staggerRemainingTicks:0});
        expect(game.loadSnapshot(json(game.toSaveSnapshot()))).toBe(true);
    });
    it.each(['absent','unsupported'] as const)('a busy body with %s provider cancels into positive recovery with only the fallback lock',mode=>{
        const {game,core,legs}=scene(mode);game.executeCommand('wait');hit(game,legs[0]!);
        const bundle=state(game).scheduler.bundles[0]!,child=bundle.subactions[1]!;
        expect(child.phases[child.phaseIndex]!.kind).toBe('break-recovery');expect(child.phaseRemainingTicks).toBe(50);
        expect(core.spatial!.actionLockInTicks).toBe(40);expect(core.ticksUntilTurn).toBe(50);
        expect(state(game).actors.find(r=>r.actorId===core.id)).toMatchObject({poise:12,staggerRemainingTicks:0});
        expect(game.loadSnapshot(json(game.toSaveSnapshot()))).toBe(true);
    });
    it('a local member lock cancels its pending releases without staggering the healthy source or writing a member timer',()=>{
        const {game,legs}=scene('normal',0);game.executeCommand('wait');
        const timers=legs.map(l=>l.ticksUntilTurn),bundle=state(game).scheduler.bundles[0]!;
        legs[0]!.spatial!.actionLockInTicks=40;notifyProductionActorSourceChanged(game,legs[0]!.id);
        expect(bundle.subactions[0]!.phases[bundle.subactions[0]!.phaseIndex]!.kind).toBe('break-recovery');
        expect(bundle.subactions[1]!.phases[bundle.subactions[1]!.phaseIndex]!.kind).toBe('windup');
        const attack=vi.spyOn(CombatSystem,'attack');game.executeCommand('wait');
        expect(attack.mock.calls.some(([a])=>a.id===legs[0]!.id)).toBe(false);
        expect(attack.mock.calls.filter(([a])=>a.id===legs[1]!.id)).toHaveLength(2);
        expect(legs.map(l=>l.ticksUntilTurn)).toEqual(timers);expect(game.loadSnapshot(json(game.toSaveSnapshot()))).toBe(true);
    });
    it.each(['throw','invalid','async'] as const)('%s after the real provider restores shield, HP, receipts, clocks and active graph identities',mode=>{
        const {game,core,legs,group}=scene(mode);game.executeCommand('wait');
        const live=state(game),bundle=live.scheduler.bundles[0]!,child=bundle.subactions[0]!,phases=child.phases,phase=phases[0]!,scheduler=productionActorActionScheduler(game);
        const before=json(live),native=json(group),hp=[core.hp,legs[0]!.hp],timers=game.monsters.map(c=>c.ticksUntilTurn),random=rng.getState();
        legs[0]!.statusDurations.shielded=40;legs[0]!.maxShield=40;
        expect(()=>hit(game,legs[0]!)).toThrow();expect(state(game)).toBe(live);expect(live).toEqual(before);
        expect(live.scheduler.bundles[0]).toBe(bundle);expect(bundle.subactions[0]).toBe(child);expect(child.phases).toBe(phases);expect(phases[0]).toBe(phase);
        expect(productionActorActionScheduler(game)).toBe(scheduler);expect(group).toEqual(native);expect([core.hp,legs[0]!.hp]).toEqual(hp);
        expect(game.monsters.map(c=>c.ticksUntilTurn)).toEqual(timers);expect(rng.getState()).toEqual(random);expect(legs[0]!.statusDurations.shielded).toBe(40);
        expect(()=>game.toSaveSnapshot()).not.toThrow();
    });
    it('a post-provider member cancellation fault restores native mirrors and permits the old prepared bundle to continue',()=>{
        const {game,core,legs,group}=scene();game.executeCommand('wait');
        const live=state(game),bundle=live.scheduler.bundles[0]!,before=json(live),native=json(group),hp=[core.hp,legs[0]!.hp],timers=game.monsters.map(c=>c.ticksUntilTurn);
        const fault=vi.spyOn(game,'footprintOf').mockImplementation(()=>{throw new Error('member cancellation fault');});
        expect(()=>hit(game,legs[0]!)).toThrow('member cancellation fault');fault.mockRestore();
        expect(state(game)).toBe(live);expect(live).toEqual(before);expect(live.scheduler.bundles[0]).toBe(bundle);
        expect(group).toEqual(native);expect([core.hp,legs[0]!.hp]).toEqual(hp);expect(game.monsters.map(c=>c.ticksUntilTurn)).toEqual(timers);
        expect(()=>game.toSaveSnapshot()).not.toThrow();game.executeCommand('wait');expect(game.lastAdvancementError).toBeNull();
    });
    it('physical poise damage on a live member belongs to the core and cannot establish a member timer',()=>{
        const {game,core,legs}=scene('normal',0),ticks=legs[0]!.ticksUntilTurn;
        applyActorPoiseDamage(game,legs[0]!.id,12);
        expect(state(game).actors.find(r=>r.actorId===core.id)).toMatchObject({poise:0,staggerRemainingTicks:100});
        expect(state(game).actors.find(r=>r.actorId===legs[0]!.id)).toBeUndefined();expect(legs[0]!.ticksUntilTurn).toBe(ticks);
    });
    it('a real parry of an immediate member attack breaks the core, stops the remaining sources and mirrors max recovery',()=>{
        installProductionBody();const game=startProductionGame(['giants','combat']);emptyProductionArena(game);
        const core=game.createCompositeMonster(PRODUCTION_BODY_ID,{x:14,y:12})!,legs=game.monsters.slice(1);
        core.state=MonsterState.HUNTING;core.behaviorFlags.add('MONST_ALWAYS_HUNTING');core.ticksUntilTurn=50;
        commitCreatureAnchor(game.player,{x:14,y:10});const timers=legs.map(c=>c.ticksUntilTurn),hp=game.player.hp,attack=vi.spyOn(CombatSystem,'attack');
        game.executeCommand('ext:command',JSON.stringify({module:'combat',action:'parry',payload:{facing:'sw'}}));
        expect(attack.mock.calls.filter(([a])=>legs.includes(a as Game['monsters'][number]))).toHaveLength(1);
        expect(game.player.hp).toBe(hp);expect(legs.map(c=>c.ticksUntilTurn)).toEqual(timers);
        const row=state(game).actors.find(r=>r.actorId===core.id)!;expect(row.poise).toBe(0);
        expect(row.staggerRemainingTicks).toBe(80);expect(core.ticksUntilTurn).toBe(80);
        expect(state(game).actors.find(r=>r.actorId===legs[0]!.id)!.stamina).toBe(22);
        expect(state(game).actors.find(r=>r.actorId===legs[1]!.id)).toBeUndefined();
        expect(game.loadSnapshot(json(game.toSaveSnapshot()))).toBe(true);
    });
});
