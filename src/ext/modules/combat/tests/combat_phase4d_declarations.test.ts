import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyProductionArena, installProductionBody, PRODUCTION_BODY_ID, startProductionGame } from '../../../../test/support/productionComposite';
import type { ExtensionModule } from '../../../types';
import { withBodyContact } from '../../../../engine/Combat/BodyCombat';
import { commitCreatureAnchor } from '../../../../engine/Movement/CreatureSpatial';
import { nativeZoneAttackAvailable } from '../../../../engine/Combat/FixedZoneHealth';

import { logger } from '../../../../engine/Systems/Logger';
import { MonsterState } from '../../../../entities/Monster';
import { rng } from '../../../../engine/Random';
import { getNextEntityId } from '../../../../entities/Creature';
import statusRows from '../../../../data/body-status-profile.json';
import type { SpatialStatusProfileDefinition } from '../../../../engine/Movement/SpatialSchema';

const json = <T>(v:T):T => JSON.parse(JSON.stringify(v));
afterEach(() => { vi.restoreAllMocks(); logger.reset(); });
function declaration(options: {zones?:boolean;profiles?:boolean;statuses?:boolean} = {}) {
    const data = installProductionBody(), bodies = data.nativeBodies as NonNullable<ExtensionModule['nativeBodies']>;
    if (options.profiles) {
        Object.assign(bodies, { attackProfiles: [...(bodies.attackProfiles ?? []), {id:'body-fixture.fixture-profile',owner:'body-fixture',providerProfileId:'combat.follow-thrust'}] });
        for (const part of data.definition.parts) if (part.role !== 'core') part.attackProfileIds = ['body-fixture.fixture-profile'];
    }
    if (options.zones) for (const [form, size, key] of [[data.core,2,'core'],[data.leg,1,'leg']] as const) {
        const rule = {id:`body-fixture.${key}-zone-break`,owner:'body-fixture',trigger:'hp-zero' as const,disposition:'keep-zone' as const,
            modifiers:[{kind:'balance-loss' as const,amount:20,fallbackStunTicks:40},{kind:'disable-attack' as const,attackId:'fixture.double-thrust'}]};
        delete (form as {size?:number}).size;
        Object.assign(form, { breakRules:[rule], footprint:{geometry:{kind:'rect',width:size,height:size},poses:['r0'],
            zones:[{id:'socket',nameKey:'ext.body-fixture.shale_weaver.name',health:{kind:'local',maxHp:8,ownerTransfer:{numerator:1,denominator:1}},armor:0,
                damageMultiplier:{numerator:1,denominator:1},breakRuleId:rule.id}],zoneCells:[{x:0,y:0,zoneId:'socket'}]} });
    }
    if (options.statuses) {
        const coreRows = json(statusRows) as SpatialStatusProfileDefinition['rows'];
        const rows = json(statusRows) as SpatialStatusProfileDefinition['rows'];
        coreRows.find(row => row.statusId === 'magical_fear')!.merge = 'stack';
        for (const row of rows) {
            if (['paralyzed','confused','entranced'].includes(row.statusId)) { row.owner = 'entity'; row.merge = 'replace'; }
            if (row.statusId === 'magical_fear') row.merge = 'stack';
        }
        Object.assign(bodies, {statusProfiles:[{id:'body-fixture.fixture-group-status',owner:'body-fixture',kind:'native',rows:coreRows},
            {id:'body-fixture.fixture-local-status',owner:'body-fixture',kind:'native',rows}]});
        data.definition.statusProfileId = 'body-fixture.fixture-group-status';
        for (const part of data.definition.parts) part.statusProfileId = part.role === 'core' ? 'body-fixture.fixture-group-status' : 'body-fixture.fixture-local-status';
    }
    return data;
}
function scene(combat:boolean, options:Parameters<typeof declaration>[0]) {
    const data = declaration(options), game = startProductionGame(combat?['body-fixture','combat']:['body-fixture']); emptyProductionArena(game);
    const core = game.createCompositeMonster(PRODUCTION_BODY_ID,{x:14,y:12})!, leg = game.monsters[1]!;
    core.state=MonsterState.HUNTING;core.behaviorFlags.add('MONST_ALWAYS_HUNTING');
    return {game,core,leg,data,group:game.bodyGroups![0]!};
}
describe('4d declared fixed zones, finite statuses and optional member profiles', () => {
    it.each([true])('local zones on core and leg commit once, with provider/fallback and independent save state (combat=%s)',combat => {
        const {game,core,leg,group}=scene(combat,{zones:true});const hp=core.hp,damage=vi.spyOn(core,'takeDamage');
        withBodyContact(leg,leg.loc,()=>leg.takeDamage(100,true,game.grid,undefined,'physical'));
        expect(leg.hp).toBe(12);expect(core.hp).toBe(hp-2);expect(damage).not.toHaveBeenCalled();
        expect(group.appliedBreaks).toEqual([]);expect(leg.spatial!.zoneState![0]).toMatchObject({hp:0,broken:true});
        expect(nativeZoneAttackAvailable(leg,'fixture.double-thrust')).toBe(false);
        expect(core.spatial!.actionLockInTicks).toBe(combat?undefined:40);
        withBodyContact(leg,leg.loc,()=>leg.takeDamage(100,true));expect(leg.hp).toBe(12);expect(core.hp).toBe(hp-2);
        withBodyContact(core,core.loc,()=>core.takeDamage(100,true));expect(core.hp).toBe(hp-10);
        expect(core.spatial!.zoneState![0]).toMatchObject({hp:0,broken:true});
        const saved=json(game.toSaveSnapshot());expect(game.loadSnapshot(saved)).toBe(true);
        expect(game.monsters.find(m=>m.id===leg.id)!.spatial!.zoneState).toEqual(leg.spatial!.zoneState);
        expect(game.monsters.find(m=>m.id===leg.id)!.spatial!.zoneState).not.toBe(leg.spatial!.zoneState);
    });
    it('a failed zone provider restores protection, body HP, module pools, identity and RNG',()=>{
        const {game,core,leg}=scene(true,{zones:true});leg.applyShield(10);
        const before=json(game.toSaveSnapshot()), random=rng.getState(),id=getNextEntityId();
        const original=game.extensionRuntime!.commitPartBreak.bind(game.extensionRuntime!);
        vi.spyOn(game.extensionRuntime!,'commitPartBreak').mockImplementation((request,native)=>{
            const result=original(request,native);throw new Error(`zone rejected ${request.partId}`);return result;
        });
        expect(()=>withBodyContact(leg,leg.loc,()=>leg.takeDamage(100))).toThrow('zone rejected');
        expect(leg.getStatusDuration('shielded')).toBe(10);expect(core.hp).toBe(before.monsters[0]!.hp);
        const after=json(game.toSaveSnapshot());after.savedAt=before.savedAt;expect(after).toEqual(before);
        expect(rng.getState()).toEqual(random);expect(getNextEntityId()).toBe(id);
    });
    it.each([true])('declared member profiles use actual paid bundles or native fallback without changing the owner (combat=%s)',combat=>{
        const {game,core,leg,group}=scene(combat,{profiles:true});commitCreatureAnchor(game.player,{x:14,y:10});
        game.executeCommand('wait');expect(core.ticksUntilTurn).toBeGreaterThan(0);
        if(combat){const state=game.extensionRuntime!.actorActionBinding()!.state;
            expect(game.actorActions!.bundles).toHaveLength(1);expect(game.actorActions!.bundles[0]).toMatchObject({decisionOwnerId:core.id,timeChargeOwnerId:core.id});
            expect(game.actorActions!.bundles[0]!.subactions.some(s=>s.sourceEntityId===leg.id)).toBe(true);
            expect(state.actors.find(s=>s.actorId===leg.id)!.profileId).toBe('combat.follow-thrust');
            expect(game.loadSnapshot(json(game.toSaveSnapshot()))).toBe(true);
        }else{expect(group.members.filter(s=>s.readyInTicks>0)).toHaveLength(2);expect(game.extensionRuntime!.actorActionBinding()).toBeNull();}
    });

    it('a broken socket disables the declared provider profile without retiring the living member',()=>{
        const data=declaration({zones:true,profiles:true});
        for (const rule of data.leg.breakRules!) rule.modifiers = [{kind:'disable-attack',attackId:'body-fixture.fixture-profile'}];
        const game=startProductionGame(['body-fixture','combat']);emptyProductionArena(game);
        const core=game.createCompositeMonster(PRODUCTION_BODY_ID,{x:14,y:12})!,leg=game.monsters[1]!;
        withBodyContact(leg,leg.loc,()=>leg.takeDamage(8,true,game.grid,undefined,'physical'));
        expect(leg.hp).toBe(12);expect(nativeZoneAttackAvailable(leg,'combat.follow-thrust')).toBe(false);
        core.state=MonsterState.HUNTING;core.behaviorFlags.add('MONST_ALWAYS_HUNTING');commitCreatureAnchor(game.player,{x:14,y:10});game.executeCommand('wait');
        expect(game.actorActions!.bundles[0]!.subactions.some(s=>s.sourceEntityId===leg.id)).toBe(false);
    });
    it.each([true])('all disabled declared profiles cannot regain attacks through immediate fallback (combat=%s)',combat=>{
        const data=declaration({zones:true,profiles:true});
        for(const rule of data.leg.breakRules!)rule.modifiers=[{kind:'disable-attack',attackId:'body-fixture.fixture-profile'}];
        const game=startProductionGame(combat?['body-fixture','combat']:['body-fixture']);emptyProductionArena(game);
        const core=game.createCompositeMonster(PRODUCTION_BODY_ID,{x:14,y:12})!;
        for(const leg of game.monsters.slice(1))withBodyContact(leg,leg.loc,()=>leg.takeDamage(8,true));
        core.state=MonsterState.HUNTING;core.behaviorFlags.add('MONST_ALWAYS_HUNTING');commitCreatureAnchor(game.player,{x:14,y:10});
        game.executeCommand('wait');expect(game.bodyGroups![0]!.members.every(s=>s.readyInTicks===0)).toBe(true);
        expect(game.actorActions?.bundles??[]).toEqual([]);
    });
    it('a disabled first profile permits the next declared profile and pays that actual source policy',()=>{
        const data=declaration({zones:true,profiles:true});
        data.nativeBodies.attackProfiles=[...data.nativeBodies.attackProfiles!,{id:'body-fixture.fixture-second',owner:'body-fixture',providerProfileId:'combat.fan-edge'}];
        for(const part of data.definition.parts)if(part.role!=='core')part.attackProfileIds=[...part.attackProfileIds,'body-fixture.fixture-second'];
        for(const rule of data.leg.breakRules!)rule.modifiers=[{kind:'disable-attack',attackId:'body-fixture.fixture-profile'}];
        const game=startProductionGame(['body-fixture','combat']);emptyProductionArena(game);
        const core=game.createCompositeMonster(PRODUCTION_BODY_ID,{x:14,y:12})!,leg=game.monsters[1]!;
        withBodyContact(leg,leg.loc,()=>leg.takeDamage(8,true));core.state=MonsterState.HUNTING;core.behaviorFlags.add('MONST_ALWAYS_HUNTING');
        commitCreatureAnchor(game.player,{x:14,y:10});game.executeCommand('wait');
        const state=game.extensionRuntime!.actorActionBinding()!.state;
        expect(game.actorActions!.bundles[0]!.subactions.some(s=>s.sourceEntityId===leg.id)).toBe(true);
        expect(state.actors.find(s=>s.actorId===leg.id)!.profileId).toBe('combat.fan-edge');
        expect(game.loadSnapshot(json(game.toSaveSnapshot()))).toBe(true);game.executeCommand('wait');expect(game.lastAdvancementError).toBeNull();
    });
    it('a failed member zone provider restores a declared group shield on its core owner',()=>{
        const data=declaration({zones:true,statuses:true});
        for(const profile of data.nativeBodies.statusProfiles!)profile.rows.find(row=>row.statusId==='shielded')!.owner='group';
        const game=startProductionGame(['body-fixture','combat']);emptyProductionArena(game);const core=game.createCompositeMonster(PRODUCTION_BODY_ID,{x:14,y:12})!,leg=game.monsters[1]!;
        leg.applyShield(10);expect(core.getStatusDuration('shielded')).toBe(10);expect(leg.statusDurations.shielded).toBeUndefined();
        const before=json(game.toSaveSnapshot()),commit=game.extensionRuntime!.commitPartBreak.bind(game.extensionRuntime!);
        vi.spyOn(game.extensionRuntime!,'commitPartBreak').mockImplementation((request,native)=>{commit(request,native);throw new Error('group shield rollback');});
        expect(()=>withBodyContact(leg,leg.loc,()=>leg.takeDamage(100))).toThrow('group shield rollback');
        expect(core.getStatusDuration('shielded')).toBe(10);const after=json(game.toSaveSnapshot());after.savedAt=before.savedAt;expect(after).toEqual(before);
    });

    it('breaking a live source socket cancels paid releases into positive recovery and cannot be forged back on load',()=>{
        const {game,core,leg}=scene(true,{zones:true,profiles:true});commitCreatureAnchor(game.player,{x:14,y:10});game.executeCommand('wait');
        const child=game.actorActions!.bundles[0]!.subactions.find(s=>s.sourceEntityId===leg.id)!;
        const paid=json(game.toSaveSnapshot());
        expect(child.phases.some(p=>p.segmentIndex!==null)).toBe(true);withBodyContact(leg,leg.loc,()=>leg.takeDamage(8,true));
        expect(leg.hp).toBeGreaterThan(0);expect(child.phases[child.phaseIndex]!.kind).toBe('break-recovery');expect(child.phaseRemainingTicks).toBeGreaterThan(0);
        const forged=paid.monsters.find(a=>a.id===leg.id)!;forged.hp=leg.hp;forged.spatial!.zoneState=json(leg.spatial!.zoneState!);
        expect(game.loadSnapshot(paid)).toBe(false);
        expect(core.ticksUntilTurn).toBeGreaterThan(0);expect(game.loadSnapshot(json(game.toSaveSnapshot()))).toBe(true);
        game.executeCommand('wait');expect(game.lastAdvancementError).toBeNull();
    });
});
