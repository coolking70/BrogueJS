import { describe, expect, it, vi } from 'vitest';
import type { CombatEventFact, ExtensionContext, ExtensionModule, Json } from '../../../types';
import { extensionDataFingerprint } from '../../../fingerprint';
import { ExtensionRegistry } from '../../../registry';
import { ExtensionRuntime, type ExtensionPorts } from '../../../runtime';
import { Player } from '../../../../entities/Player';
import { Random, RNGType } from '../../../../engine/Random';
import { NarrativeError } from '../errors';
import { evaluateNarrativeCondition, validateNarrativeFact } from '../conditions';
import { commitNarrativePlan, planNarrativeEffects, planNarrativeFact } from '../effects';
import { createNarrativeModuleFromPack } from '../module';
import { loadNarrativePack, NARRATIVE_LIMITS } from '../schema';
import { initialNarrativeState, validateNarrativeState } from '../state';
import { loadNarrativeDefinitionPack } from '../definitions';
import type { NarrativePack, Trigger } from '../types';
import { keeperOnlyContentFixture } from './contentFixture';
import portraits from '../data/portraits.json';
import locale from '../locales/zh_CN.json';

type Mutable<T> = T extends readonly (infer U)[] ? Mutable<U>[] : T extends object ? { -readonly [K in keyof T]: Mutable<T[K]> } : T;
const clone = <T>(value: T): T => structuredClone(value);
const trigger = (eventKind: CombatEventFact['eventKind'] = 'rest-completed', id = 'combat.first'): Mutable<Trigger> => ({
    id, on: { kind: 'combat-event', eventKind, actorRole: 'player', actorTags: [] }, receiptId: `${id}.receipt`,
    priority: 0, condition: { op: 'true' }, repeat: { kind: 'once-per-run' }, effects: [{ kind: 'set-flag', id: 'archive.read', value: true }],
});
function rawPack(change?: (pack: Mutable<NarrativePack>) => void): Mutable<NarrativePack> {
    const data = keeperOnlyContentFixture() as unknown as Mutable<NarrativePack>;
    data.triggers = [clone(trigger()) as Mutable<Trigger>]; change?.(data); return data;
}
function load(raw: unknown = rawPack()): NarrativePack { return loadNarrativePack(raw, portraits, locale); }
function fact(eventKind: CombatEventFact['eventKind'] = 'rest-completed', factId = 1): CombatEventFact {
    return { kind: 'combat-event', eventKind, factId, depth: 1, turn: factId,
        actor: { entityId: 1, role: 'player', tags: [], partId: null, generation: null },
        actionId: eventKind === 'parried' || eventKind === 'staggered' ? 0 : 1,
        sourceSubactionId: eventKind === 'attack-resolved' ? 1 : null,
        segmentIndex: eventKind === 'attack-resolved' ? 0 : null,
        resolutionId: eventKind === 'parried' ? 1 : null,
        bonfireId: eventKind === 'rest-completed' ? 2 : null,
        visit: eventKind === 'rest-completed' ? 1 : null,
        hitCount: eventKind === 'attack-resolved' ? 1 : 0, hpLost: eventKind === 'attack-resolved' ? 3 : 0 };
}

describe('EXT-3g bounded declarative combat subscriptions', () => {
    it.each(['attack-resolved','staggered','parried','rest-completed'] as const)('consumes only matching committed %s facts with an explicit receipt', kind => {
        const pack = load(rawPack(data => { data.triggers = [clone(trigger(kind)) as Mutable<Trigger>]; }));
        const state = initialNarrativeState(pack), event = fact(kind);
        const plan = planNarrativeFact(pack, state, event), next = commitNarrativePlan(pack, state, plan);
        expect(next.flags['archive.read']).toBe(true);
        expect(next.triggerReceipts).toEqual([{ triggerId: 'combat.first', receiptId: 'combat.first.receipt', scopeKey: 'run',
            firings: 1, lastFactId: 1, lastTurn: 1 }]);
        expect(plan.events).toEqual([event]); expect(plan.usage.events).toBe(0);
        expect(plan.messages).toEqual([]); expect(plan.rewardIntents).toEqual([]);
        expect(next.active).toBeNull(); expect(next.journal).toEqual([]);
        expect(commitNarrativePlan(pack, next, planNarrativeFact(pack, next, event))).toEqual(next);
        const again = commitNarrativePlan(pack, next, planNarrativeFact(pack, next, fact(kind, 2)));
        expect(again.triggerReceipts).toEqual(next.triggerReceipts);
    });
    it('matches public actor roles and every declared public tag without names or private fields', () => {
        const pack = load(rawPack(data => { data.triggers[0]!.on = { kind: 'combat-event', eventKind: 'staggered', actorRole: 'hostile', actorTags: ['guard','armored'] }; }));
        for (const [role,tags,expected] of [['player',['guard','armored'],false],['hostile',['guard'],false],['hostile',['armored','guard','large'],true]] as const) {
            const event = fact('staggered'); event.actor.role = role; event.actor.tags = tags;
            const plan = planNarrativeFact(pack, initialNarrativeState(pack), event);
            expect(plan.nextState.flags['archive.read']).toBe(expected);
        }
        const any = load(rawPack(data => { data.triggers[0]!.on = { kind:'combat-event',eventKind:'staggered',actorRole:'any',actorTags:[] }; }));
        const neutral = fact('staggered'); neutral.actor.role = 'neutral'; neutral.actor.partId = 'arm'; neutral.actor.generation = 0;
        expect(planNarrativeFact(any, initialNarrativeState(any), neutral).triggered).toHaveLength(1);
    });
    it('uses existing bounded counters, conditions, cooldowns and deterministic trigger order', () => {
        const pack = load(rawPack(data => {
            data.counters.push({id:'combat.count',initial:0,min:0,max:4});
            data.triggers = ['z-last','a-first'].map(id => ({...clone(trigger('parried',id)),priority:0,
                repeat:{kind:'bounded',maxFirings:2,cooldownTurns:3},
                condition:{op:'all',args:[{op:'depth',min:1,max:2},{op:'counter',id:'combat.count',compare:'lt',value:4}]},
                effects:[{kind:'add-counter',id:'combat.count',amount:1}]}));
        }));
        let state = initialNarrativeState(pack);
        const run = (id:number) => { const plan = planNarrativeFact(pack,state,fact('parried',id)); state = commitNarrativePlan(pack,state,plan); return plan; };
        expect(run(1).triggered.map(item=>item.triggerId)).toEqual(['a-first','z-last']);
        expect(run(2).triggered).toEqual([]); expect(state.counters['combat.count']).toBe(2);
        expect(run(4).triggered.map(item=>item.triggerId)).toEqual(['a-first','z-last']);
        expect(run(8).triggered).toEqual([]); expect(state.counters['combat.count']).toBe(4);
        expect(state.triggerReceipts.every(receipt=>receipt.firings===2)).toBe(true);
    });
    it('keeps once-per-depth subscription receipts bounded and distinct', () => {
        const pack = load(rawPack(data => { data.triggers[0]!.repeat = {kind:'once-per-depth'}; }));
        let state = initialNarrativeState(pack);
        for (const [id,depth] of [[1,1],[2,1],[3,2]] as const) {
            const event = fact('rest-completed',id); event.depth = depth;
            state = commitNarrativePlan(pack,state,planNarrativeFact(pack,state,event));
        }
        expect(state.triggerReceipts.map(receipt=>receipt.scopeKey)).toEqual(['depth.1','depth.2']);
        expect(validateNarrativeState(clone(state),pack)).toEqual(state);
    });
    it('declares no combat consumer when the pack has no subscriptions', () => {
        const pack = load(keeperOnlyContentFixture()), module = createNarrativeModuleFromPack(pack);
        expect(module.committedFacts?.['combat.event.v1']).toBeUndefined();
        expect(module.committedFacts?.['foundation.story.v1']?.maxDerivedFacts).toBe(0);
    });
    it('reserves only the granted derived interval while sharing the unchanged root identity', () => {
        const pack = load(rawPack(data => {
            data.triggers = [{id:'entry.emit',on:{kind:'entered-level'},priority:0,condition:{op:'true'},repeat:{kind:'once-per-run'},
                effects:[{kind:'emit-story',eventId:'archive.read-done'}]}];
        }));
        const module = createNarrativeModuleFromPack(pack), consumer = module.committedFacts!['foundation.story.v1']!;
        expect(consumer.maxDerivedFacts).toBe(pack.config.limits.eventsPerCommand);
        let state = initialNarrativeState(pack);
        const commitFactRange = vi.fn(), context = { playerId:1,get state(){return clone(state) as unknown as Json;},
            queryOptional:()=>({status:'unavailable',reason:'absent'}),prepareOptionalReward:()=>({status:'skipped',reason:'absent'}),
            setState(value:Json){state=validateNarrativeState(value,pack);},commitFactRange,message:vi.fn() } as unknown as ExtensionContext;
        const plan = consumer.prepare({kind:'entered-level',factId:10,depth:1,turn:0,firstVisit:true},
            {firstDerivedFactId:30,maxDerivedFacts:consumer.maxDerivedFacts},context);
        consumer.commit(plan,context);
        expect(state.lastFactId).toBe(30); expect(commitFactRange).not.toHaveBeenCalled();
        expect(()=>consumer.commit(plan,context)).toThrow(NarrativeError);
        const initial = initialNarrativeState(pack);
        expect(()=>planNarrativeFact(pack,initial,{kind:'entered-level',factId:10,depth:1,turn:0,firstVisit:true},
            {factAllocation:{firstDerivedFactId:30,maxDerivedFacts:0}})).toThrow(/EVENT_LIMIT/);
        expect(initial).toEqual(initialNarrativeState(pack));
    });
    it('unlocks the default NPC branch after the first completed player rest without opening it or awarding anything', () => {
        const pack = loadNarrativeDefinitionPack(), state = initialNarrativeState(pack);
        const dialogue = pack.dialogues.find(dialogue=>dialogue.id==='wick.listener.greeting')!;
        const branch = dialogue.nodes[0]!.choices.find(choice=>choice.id==='ask-warm-ashes')!;
        expect(branch.condition).toEqual({op:'flag',id:'bonfire.rested',equals:true}); expect(branch.unavailable).toBe('hide');
        const branchFact = {kind:'dialogue-choice' as const,dialogueId:dialogue.id,choiceId:branch.id,factId:2,depth:1,turn:1};
        expect(evaluateNarrativeCondition(branch.condition,{pack,state,fact:branchFact})).toBe(false);
        const hostile = fact(); hostile.actor.role = 'hostile';
        expect(planNarrativeFact(pack,state,hostile).nextState.flags['bonfire.rested']).toBe(false);
        const plan = planNarrativeFact(pack,state,fact()), next = commitNarrativePlan(pack,state,plan);
        expect(next.flags['bonfire.rested']).toBe(true); expect(next.active).toBeNull();
        expect(evaluateNarrativeCondition(branch.condition,{pack,state:next,fact:branchFact})).toBe(true);
        expect(next.rewardReceipts).toEqual([]); expect(next.journal).toEqual([]); expect(plan.messages).toEqual([]);
        expect(next.triggerReceipts[0]?.receiptId).toBe('bonfire.first-rest.receipt');
        const afterLoad = validateNarrativeState(clone(next),pack);
        expect(commitNarrativePlan(pack,afterLoad,planNarrativeFact(pack,afterLoad,fact()))).toEqual(afterLoad);
    });
    it('rejects pre-adapter package/state versions and fingerprints all subscription fields', () => {
        const pack = load();
        for (const key of ['moduleVersion','rulesVersion'] as const) {
            const old = rawPack(); Object.assign(old,{[key]:'1.3.0'});
            expect(()=>load(old)).toThrow(`INVALID_VERSION at $.${key}`);
        }
        const oldPack = rawPack(); Object.assign(oldPack,{stateVersion:3}); expect(()=>load(oldPack)).toThrow('INVALID_VERSION at $.stateVersion');
        const oldState = initialNarrativeState(pack); Object.assign(oldState,{schema:3}); expect(()=>validateNarrativeState(oldState,pack)).toThrow('INVALID_STATE at $state.schema');
        const changed = rawPack(); changed.triggers[0]!.receiptId = 'changed.receipt';
        expect(extensionDataFingerprint(load(changed))).not.toBe(extensionDataFingerprint(pack));
    });
    it('rejects injected fields, missing receipt IDs, duplicate receipt IDs, unsupported events and unbounded tag filters', () => {
        const mutations: ((raw: Mutable<NarrativePack>)=>void)[] = [
            raw=>{delete raw.triggers[0]!.receiptId;},
            raw=>{raw.triggers.push({...clone(raw.triggers[0]!),id:'another.trigger'});},
            raw=>{Object.assign(raw.triggers[0]!.on,{actorId:5});},
            raw=>{Object.assign(raw.triggers[0]!.on,{eventKind:'rest-interrupted'});},
            raw=>{Object.assign(raw.triggers[0]!.on,{actorTags:['guard','guard']});},
            raw=>{Object.assign(raw.triggers[0]!.on,{actorTags:Array.from({length:NARRATIVE_LIMITS.maxPublicActorTags+1},(_,i)=>`tag.${i}`)});},
            raw=>{raw.triggers[0]!.repeat={kind:'bounded',maxFirings:0,cooldownTurns:0};},
        ];
        for (const mutate of mutations) expect(()=>load(rawPack(mutate))).toThrow(NarrativeError);
    });
    it.each(['message','journal','emit-story','optional-reward','open-dialogue'])('rejects %s subscription effects, including indirect reward routes', kind => {
        const raw = rawPack(); Object.assign(raw.triggers[0]!,{effects:[{kind}]}); expect(()=>load(raw)).toThrow(/INVALID_TRIGGER/);
    });
    it('keeps pure effect planning from bypassing the combat effect allowlist', () => {
        const pack=load(), state=initialNarrativeState(pack);
        expect(()=>planNarrativeEffects(pack,state,fact(),pack.dialogues[0]!.nodes[0]!.choices[0]!.effects)).toThrow('INVALID_TRIGGER');
        expect(state).toEqual(initialNarrativeState(pack));
    });
    it('rejects forged persisted subscription receipts and fails planning atomically on budgets or counter overflow', () => {
        const pack = load(), initial = initialNarrativeState(pack);
        const next = commitNarrativePlan(pack,initial,planNarrativeFact(pack,initial,fact()));
        const bad = clone(next); bad.triggerReceipts[0]!.receiptId = 'counterfeit';
        expect(()=>validateNarrativeState(bad,pack)).toThrow('INVALID_STATE');
        const overflow = load(rawPack(data=>{data.counters=[{id:'combat.count',initial:1,min:0,max:1}];data.triggers[0]!.effects=[{kind:'add-counter',id:'combat.count',amount:1}];}));
        const unchanged = initialNarrativeState(overflow);
        expect(()=>planNarrativeFact(overflow,unchanged,fact())).toThrow('COUNTER_RANGE'); expect(unchanged).toEqual(initialNarrativeState(overflow));
        const limited = load(rawPack(data=>{data.dialogues[0]!.nodes[0]!.choices[0]!.effects=[];data.config.limits.effectsPerCommand=1;data.triggers.push({...clone(data.triggers[0]!),id:'another.trigger',receiptId:'another.receipt'});}));
        expect(()=>planNarrativeFact(limited,initialNarrativeState(limited),fact())).toThrow('EFFECT_LIMIT');
    });
    it('strictly validates the committed public fact and never accepts failed rests or hidden actor data', () => {
        const pack = load();
        const mutations: ((event:CombatEventFact)=>void)[] = [
            event=>{Object.assign(event,{eventKind:'rest-interrupted'});},
            event=>{event.actionId=0;},event=>{event.bonfireId=null;},event=>{event.visit=null;},event=>{event.hitCount=1;},
            event=>{event.actor.generation=0;},event=>{event.actor.tags=['tag','tag'];},
            event=>{Object.assign(event.actor,{x:10,y:20});},event=>{Object.assign(event,{futureAction:'attack'});},
        ];
        for (const mutate of mutations) {const event=fact();mutate(event);expect(()=>validateNarrativeFact(event,pack)).toThrow(NarrativeError);}
        const attack=fact('attack-resolved'); attack.sourceSubactionId=null; expect(()=>validateNarrativeFact(attack,pack)).toThrow('INVALID_FACT');
        const parry=fact('parried'); parry.resolutionId=null; expect(()=>validateNarrativeFact(parry,pack)).toThrow('INVALID_FACT');
    });
});


describe('EXT-3g narrative consumers in native fact transactions', () => {
    function fixture(content = load(), reverse = false) {
        const player = new Player(1,1), random = new Random(1817), message = vi.fn(), control = {fail:false};
        const extra: ExtensionModule = {id:'z-observer',version:'1.0.0',initialState:()=>({root:0,derived:0}),
            validateState:(value):value is Json=>!!value && typeof value==='object',
            committedFacts:{'combat.event.v1':{maxDerivedFacts:2,
                prepare:(event,allocation)=>({root:event.factId,derived:allocation.firstDerivedFactId}),
                commit:(plan,context)=>{context.setState(plan as Json);context.message('fixture committed');if(control.fail)throw new Error('fixture failure');}}}};
        const narrative = createNarrativeModuleFromPack(content), registry = new ExtensionRegistry();
        for (const module of reverse ? [extra,narrative] : [narrative,extra]) registry.register(module.id,module.version,()=>module,module.rules);
        const ports: ExtensionPorts = {depth:()=>1,turn:()=>0,playerId:()=>player.id,randomInt:(min,max)=>random.randRange(min,max),message,
            actorQueryScope:actor=>actor===player?{depth:1,partId:null,generation:null}:null,
            checkpointRandom:()=>{const before=random.getState();return()=>random.setState(before);},
            checkpointCommittedFacts:()=>{const hp=player.hp;return()=>{player.hp=hp;};}};
        const runtime = new ExtensionRuntime(registry,registry.manifest(reverse?['z-observer','narrative']:['narrative','z-observer']),ports);
        runtime.attachCreature(player);runtime.newGame();
        const publish=()=>runtime.withCommittedFacts(()=>{
            const {kind:_kind,factId:_id,depth:_depth,turn:_turn,actor:_actor,...payload}=fact();
            player.hp--;random.randRange(1,10);random.setRNG(RNGType.RNG_COSMETIC);random.randRange(1,10);random.setRNG(RNGType.RNG_SUBSTANTIVE);
            runtime.commitCombatEvent(player,payload);
        });
        return {runtime,player,random,message,control,publish};
    }
    it('shares one root and stable reserved ranges independently of module registration order', () => {
        const forward=fixture(), reverse=fixture(load(),true);
        forward.publish();reverse.publish();
        expect(forward.runtime.snapshot()).toEqual(reverse.runtime.snapshot());
        const snapshot=forward.runtime.snapshot();
        expect(snapshot.foundation.nextFactId).toBe(4);
        expect(snapshot.modules['z-observer']).toEqual({root:1,derived:2});
        expect((snapshot.modules.narrative as {lastFactId:number}).lastFactId).toBe(1);
        forward.runtime.unload();reverse.runtime.unload();
    });
    it('rolls back narrative receipts, root allocation, the other consumer, native HP, messages and both RNGs on later failure', () => {
        const f=fixture(), snapshot=f.runtime.snapshot(), hp=f.player.hp, random=f.random.getState();
        f.control.fail=true;expect(()=>f.publish()).toThrow('fixture failure');
        expect(f.runtime.snapshot()).toEqual(snapshot);expect(f.player.hp).toBe(hp);expect(f.random.getState()).toEqual(random);
        expect(f.message).not.toHaveBeenCalled();
        f.control.fail=false;f.publish();
        expect((f.runtime.snapshot().modules.narrative as {flags:Record<string,boolean>}).flags['archive.read']).toBe(true);
        expect(f.runtime.snapshot().foundation.nextFactId).toBe(4);expect(f.message).toHaveBeenCalledTimes(1);
        f.runtime.unload();
    });
});
