import i18next from 'i18next';
import type { ActorFacts, ExtensionContext, ExtensionModule, Json } from '../../types';
import type { CreatureBirth } from '../../birth';
import { canonical, isJson } from '../../json';
import type { DeepReadonly } from './definitions';
import type { GrowthDefinitionPack, GrowthResourceEffect } from './types';
import { automaticGrowthDerived, grantExperience, initialGrowthProgression, reconcileGrowthMaximum,
    reconcileGrowthResources, addGrowthIntegers } from './experience';
import type { GrowthDerived, GrowthFocus, GrowthProgression, GrowthSkills } from './components';
import { growthPartyId, initialGrowthState, isGrowthState, isGrowthReward, validGrowthComponents, validGrowthSources,
    type GrowthReward, type GrowthState } from './state';

const getState = (context: ExtensionContext): GrowthState => context.state as GrowthState;
const saveState = (context: ExtensionContext, state: GrowthState): void => context.setState(state as Json);
const component = <T>(context: ExtensionContext, id: number, name: string): T => context.getComponent(id,name) as T;
const put = (context: ExtensionContext,id: number,name: string,value: unknown): void => context.setComponent(id,name,value as Json);
function remember<T extends string | number>(values: T[], value: T): boolean {
    if (values.includes(value)) return false;
    values.push(value); values.sort((a,b) => a < b ? -1 : a > b ? 1 : 0); return true;
}
function observe(state: GrowthState, actor: ActorFacts): void {
    const old = state.actors[actor.id];
    state.actors[actor.id] = { player: actor.player, allied: actor.allied, hostile: actor.hostile, alive: actor.hp > 0,
        relation: old ? old.relation + (old.allied === actor.allied ? 0 : 1) : 0 };
}
function isCreationCommand(data: unknown): boolean {
    if (typeof data !== 'string') return false;
    try {
        const input = JSON.parse(data);
        return isJson(input) && canonical(input) === canonical({ module: 'growth', action: 'create-character', payload: { revision: 0 } });
    } catch { return false; }
}
/** Integral split with an exact rational intermediate, including non-default rounding choices. */
export function splitGrowthReward(amount: number, basisPoints: number, rounding: GrowthDefinitionPack['config']['experience']['allySplit']['rounding']): [number,number] {
    if (!Number.isSafeInteger(amount) || amount < 0 || !Number.isSafeInteger(basisPoints) || basisPoints < 0 || basisPoints > 10000) throw new RangeError('Invalid growth reward split');
    const numerator = BigInt(amount) * BigInt(basisPoints), denominator = 10000n;
    let player = numerator / denominator;
    if (rounding === 'ceil' && numerator % denominator) player++;
    if (rounding === 'nearest' && numerator % denominator >= denominator / 2n) player++;
    return [Number(player),amount - Number(player)];
}
/** P04 substrate: caller supplies an already-authorized first-visit effect. Identity triggering belongs to 1e. */
export function commitFirstVisitResource(context: ExtensionContext, state: GrowthState, pack: DeepReadonly<GrowthDefinitionPack>,
    actorId: number, depth: number, effect: Readonly<GrowthResourceEffect>): boolean {
    if (!state.visitedDepths.includes(depth) || depth < effect.trigger.minDepth || depth > effect.trigger.maxDepth) return false;
    const receipt = `${effect.id}:${actorId}:${depth}`;
    if (state.resourceReceipts.includes(receipt)) return false;
    const actor = context.creature(actorId);
    if (!actor || actor.hp <= 0) return false;
    if (effect.resource === 'focus') {
        const focus = component<GrowthFocus>(context,actorId,'focus');
        if (!focus) return false;
        const current = Number(BigInt(focus.current) + BigInt(effect.amount));
        put(context,actorId,'focus',{ ...focus,current: Math.max(0,Math.min(pack.config.focus.base,current)) });
    } else {
        const hp = Number(BigInt(actor.hp) + BigInt(effect.amount));
        context.commitResources(actorId,{ expectedHp: actor.hp,expectedMaxHp: actor.maxHp,hp: Math.max(1,Math.min(actor.maxHp,hp)),maxHp: actor.maxHp });
    }
    remember(state.resourceReceipts,receipt); return true;
}

export function createGrowthGameplay(pack: DeepReadonly<GrowthDefinitionPack>, identity: ExtensionModule['rules']): ExtensionModule {
    const config = pack.config;
    function initialize(context: ExtensionContext, state: GrowthState, actor: ActorFacts, birth: CreatureBirth): void {
        observe(state,actor);
        if (context.getComponent(actor.id,'progression')) return;
        const progression = initialGrowthProgression(config.levels), derived = automaticGrowthDerived(config.levels,progression.level);
        const quote = config.experience.kills.monsterQuotes.find(entry => entry.monsterId === birth.originalMonsterType);
        const reward: GrowthReward = { ...birth,rewardId: `birth:${actor.id}`,threatRank: quote?.threatRank ?? 0,
            amount: quote ? quote.amount ?? config.experience.kills.base + config.experience.kills.perThreatRank * quote.threatRank : 0 };
        const copied = birth.nativeStatsCopied;
        const previous = !copied || birth.sourceId === null ? undefined : component<GrowthDerived>(context,birth.sourceId,'derived');
        // A CE clone copies native maxHp. Remove copied automatic growth once before installing its neutral progression.
        const oldBonus = previous?.appliedMaxHp ?? 0;
        const maxHp = reconcileGrowthMaximum(actor.maxHp,oldBonus,derived.appliedMaxHp);
        const focus = { current: config.focus.base,remainder: 0 }, skills = { readyAt: {} };
        const resources = reconcileGrowthResources(config.levels,config.focus,'creation',
            { hp: actor.hp,maxHp: actor.maxHp,nextMaxHp: maxHp,focus,focusCapacity: config.focus.base,nextFocusCapacity: config.focus.base,skills });
        if (!actor.player) resources.hp = Math.max(0,Math.min(actor.hp,resources.maxHp));
        put(context,actor.id,'progression',progression); put(context,actor.id,'derived',derived);
        put(context,actor.id,'reward',reward); put(context,actor.id,'focus',resources.focus); put(context,actor.id,'skills',resources.skills);
        if (actor.hp !== resources.hp || actor.maxHp !== resources.maxHp)
            context.commitResources(actor.id,{expectedHp: actor.hp,expectedMaxHp: actor.maxHp,hp: resources.hp,maxHp: resources.maxHp});
    }
    function award(context: ExtensionContext, state: GrowthState, recipientId: number, amount: number): void {
        const old = component<GrowthProgression>(context,recipientId,'progression'), actor = context.creature(recipientId);
        if (!old || !actor || amount === 0) return;
        if (!actor.player && !config.monsters.alliesGrow && actor.allied) return;
        const gain = grantExperience(config.levels,old,amount);
        const priorDerived = component<GrowthDerived>(context,recipientId,'derived');
        const derived = automaticGrowthDerived(config.levels,gain.progression.level);
        const nextMaxHp = reconcileGrowthMaximum(actor.maxHp,priorDerived.appliedMaxHp,derived.appliedMaxHp);
        const resources = gain.levelsGained ? reconcileGrowthResources(config.levels,config.focus,'level',{
            hp: actor.hp,maxHp: actor.maxHp,nextMaxHp,focus: component<GrowthFocus>(context,recipientId,'focus'),
            focusCapacity: config.focus.base,nextFocusCapacity: config.focus.base,skills: component<GrowthSkills>(context,recipientId,'skills'),
        }) : { hp: actor.hp,maxHp: actor.maxHp,focus: component<GrowthFocus>(context,recipientId,'focus'),skills: component<GrowthSkills>(context,recipientId,'skills') };
        put(context,recipientId,'progression',gain.progression); put(context,recipientId,'derived',derived);
        put(context,recipientId,'focus',resources.focus); put(context,recipientId,'skills',resources.skills);
        if (actor.hp !== resources.hp || actor.maxHp !== resources.maxHp)
            context.commitResources(recipientId,{expectedHp: actor.hp,expectedMaxHp: actor.maxHp,hp: resources.hp,maxHp: resources.maxHp});
        if (gain.gainedExperience) state.revision = addGrowthIntegers(state.revision,1);
        if (gain.levelsGained && actor.player) context.message(i18next.t('ext.growth.level_gained', { level: gain.progression.level,defaultValue: 'You reached level {{level}}.' }));
    }
    function settle(context: ExtensionContext, knownKinds: {id:string;category:string}[], reachable: number[], sources: number[]): void {
        const state = getState(context);
        if (!state.created) return;
        for (const fact of state.pending) {
            if (fact.kind === 'visit') {
                if (!remember(state.visitedDepths,fact.depth)) continue;
                const rule = config.experience.firstVisits;
                if (!config.experience.sources.firstVisits || fact.depth < rule.minDepth || fact.depth > rule.maxDepth) continue;
                const quoted = rule.base + rule.perDepth * fact.depth;
                const amount = rule.cap === null ? quoted : Math.min(quoted,rule.cap - state.visitAwarded);
                state.visitAwarded = addGrowthIntegers(state.visitAwarded,amount); award(context,state,state.playerId,amount);
            } else if (fact.kind === 'kill') {
                const reward = component<GrowthReward>(context,fact.actor.id,'reward');
                if (!reward || !remember(state.rewardReceipts,reward.rewardId)) continue;
                const rule = config.experience.kills;
                if (!config.experience.sources.kills || fact.administrative || !state.created
                    || !rule.eligibleCreationReasons.includes(reward.creationReason) || (rule.requireInitiallyHostile && !reward.initiallyHostile)
                    || (rule.requireHostileAtDeath && !fact.actor.hostile) || !fact.origin?.creditActorId) continue;
                const sourceId = fact.origin.creditActorId, source = state.actors[sourceId];
                if (!source) continue;
                if (source.player) {
                    if (fact.origin.creditPartyId === growthPartyId(state,sourceId)) award(context,state,sourceId,reward.amount);
                } else if (fact.origin.creditPartyId !== null) {
                    if (fact.origin.creditPartyId !== growthPartyId(state,sourceId)) continue;
                    const [player,ally] = splitGrowthReward(reward.amount,config.experience.allySplit.playerBasisPoints,config.experience.allySplit.rounding);
                    award(context,state,state.playerId,player); award(context,state,sourceId,ally);
                } else if (!source.allied) award(context,state,sourceId,reward.amount);
            } else {
                if (!remember(state.storyReceipts,fact.rewardKey)) continue;
                const reward = config.experience.story.rewards.find(reward => reward.id === fact.definitionId);
                if (config.experience.sources.story && reward && reward.amount === fact.amount && reward.reasonKey === fact.reasonKey)
                    award(context,state,fact.recipientId,reward.amount);
            }
        }
        state.pending = [];
        for (const kind of knownKinds) {
            if (!remember(state.identifiedKinds,kind.id)) continue;
            const rule = config.experience.identification;
            if (!config.experience.sources.identification || !rule.categories.includes(kind.category)) continue;
            const amount = Math.min(rule.perKind,rule.totalCap - state.identificationAwarded);
            state.identificationAwarded = addGrowthIntegers(state.identificationAwarded,amount); award(context,state,state.playerId,amount);
        }
        const keep = new Set([...reachable,...sources,state.playerId]);
        for (const id of Object.keys(state.actors)) if (!keep.has(Number(id))) delete state.actors[id];
        saveState(context,state);
    }
    const module: ExtensionModule = {
        id: 'growth',version: pack.moduleVersion,rules: identity,resourceCommits: true,
        initialState: () => initialGrowthState() as unknown as Json,validateState: (value): value is Json => isGrowthState(value,pack),
        componentValidators: { reward: isGrowthReward },
        validateComponents: (state,components,foundation) => validGrowthComponents(state as GrowthState,components,pack)
            && validGrowthSources(state as GrowthState,foundation) && (!(state as GrowthState).created || !(state as GrowthState).pending.length),
        validateWorld(state,components,actors) {
            const growth = state as GrowthState, ids = new Set(actors.map(actor => actor.id));
            if (!growth.created || growth.pending.length || !actors.some(actor => actor.player && actor.id === growth.playerId)) return false;
            return Object.entries(components).every(([id,entries]) => !Object.keys(entries).some(key => key.startsWith('growth:')) || ids.has(Number(id)))
                && actors.every(actor => { const summary = growth.actors[actor.id];
                    return !!components[actor.id]?.['growth:progression'] && actor.maxHp > componentBonus(components[actor.id]?.['growth:derived'])
                        && Number.isSafeInteger(actor.hp) && Number.isSafeInteger(actor.maxHp) && actor.maxHp >= 1 && actor.hp >= 0 && actor.hp <= actor.maxHp
                        && !!summary && summary.player === actor.player && summary.allied === actor.allied && summary.hostile === actor.hostile
                        && summary.alive === (actor.hp > 0); });
        },
        validateRecording(events) {
            return events.length > 0 && events[0]!.action === 'ext:command' && isCreationCommand(events[0]!.data)
                && events.every((event,index) => (event.extensions?.modules.growth as unknown as GrowthState)?.created === true
                    && (index === 0 || event.action !== 'ext:command' || !isCreationCommand(event.data)));
        },
        initialCommand: { action: 'create-character',payload: { revision: 0 } },
        allowInput(action,data,context) {
            const state = getState(context);
            if (!state.created) return action === 'ext:command' && isCreationCommand(data) && (context.creature(context.playerId)?.hp ?? 0) > 0;
            if (action !== 'ext:command') return true;
            // 1a exposes only creation. Learning, allocation, skills and story are deliberately not player commands yet.
            try { return JSON.parse(String(data))?.module !== 'growth'; } catch { return false; }
        },
        readyToSave: context => getState(context).created && getState(context).pending.length === 0,
        creditParty: (actor,context) => growthPartyId(getState(context),actor.id),
        onNewGame(context) { const state = initialGrowthState(); state.playerId = context.playerId; saveState(context,state); },
        commands: { 'create-character'(payload,context) {
            const state = getState(context), actor = context.creature(context.playerId);
            if (state.created || canonical(payload) !== canonical({revision:0}) || !actor || actor.hp <= 0)
                throw new Error(i18next.t('ext.growth.command.rejected', {defaultValue:'Character command is not available in the current state.'}));
            initialize(context,state,actor,{creationReason:'scripted',originalMonsterType:null,initiallyHostile:false,sourceId:null,nativeStatsCopied:false});
            state.created = true; state.revision = 1; state.identifiedKinds = context.knownKinds().map(kind => kind.id).sort();
            saveState(context,state);
        } },
        hooks: {
            creatureSpawned(event,context) {
                const actor = context.creature(event.creature.id); if (!actor) return;
                const state = getState(context); observe(state,actor);
                if (!actor.player) initialize(context,state,actor,event.birth ?? {creationReason:'scripted',originalMonsterType:actor.monsterId,initiallyHostile:actor.hostile,sourceId:null,nativeStatsCopied:false});
                saveState(context,state);
            },
            nativeMaximumReset({actor},context) {
                const derived = component<GrowthDerived>(context,actor.id,'derived');
                if (!derived) return;
                context.commitResources(actor.id,{expectedHp:actor.hp,expectedMaxHp:actor.maxHp,hp:Math.min(actor.hp,addGrowthIntegers(actor.maxHp,derived.appliedMaxHp)),maxHp:addGrowthIntegers(actor.maxHp,derived.appliedMaxHp)});
            },
            actorObserved({actor},context) { const state = getState(context); observe(state,actor); saveState(context,state); },
            deathCaptured({actor,origin,administrative},context) {
                if (actor.player) return;
                const state = getState(context); state.pending.push({kind:'kill',actor:{...actor},origin,administrative}); saveState(context,state);
            },
            enteredLevel({depth,firstVisit},context) {
                if (!firstVisit) return;
                const state = getState(context); state.pending.push({kind:'visit',depth}); saveState(context,state);
            },
            itemKnowledgeChanged({kindId},context) {
                // Knowledge is committed by ItemLoader; payment waits for the common command safe point.
                // The known-kind ledger is reconciled there, so inferred kinds and repeated observations are also exact-once.
                if (!context.knownKinds().some(kind => kind.id === kindId)) throw new Error('Invalid knowledge fact');
            },
            rewardGranted({issuerId,recipientId,rewardId,instanceId},context) {
                const reward = config.experience.story.rewards.find(entry => entry.id === rewardId);
                if (!reward || !context.creature(recipientId)) throw new Error(i18next.t('ext.growth.command.rejected', {defaultValue:'Character command is not available in the current state.'}));
                const state = getState(context);
                state.pending.push({kind:'story',recipientId,definitionId:rewardId,rewardKey:`${issuerId}:${rewardId}:${instanceId}`,amount:reward.amount,reasonKey:reward.reasonKey});
                saveState(context,state);
            },
            simulationSettled({knownKinds,reachableIds,sourceIds},context) { settle(context,knownKinds,reachableIds,sourceIds); },
        },
    };
    return module;
}
function componentBonus(value: unknown): number { return (value as GrowthDerived | undefined)?.appliedMaxHp ?? 0; }
