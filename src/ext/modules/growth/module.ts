import i18next from 'i18next';
import type { ControlledActionRequest, ControlledActionResult, ControlledCommandPreparationContext, ActorFacts, ExtensionContext, ExtensionModule, ExtensionCreationResources, ExtensionRuleContext, ExtensionRuleInput, Json, ReadonlyJson, OptionalRewardRequest, OptionalRewardPrepareContext, OptionalQueryProvider } from '../../types';
import type { CreatureBirth } from '../../birth';
import { createGrowthCombatStatsProvider } from './combatStats';
import { canonical, isJson, validId } from '../../json';
import type { DeepReadonly } from './definitions';
import type { GrowthDamageInput, GrowthDefinitionPack, GrowthResourceEffect, GrowthRuleActor, GrowthRulePort } from './types';
import { grantExperience, initialGrowthProgression, reconcileGrowthMaximum,
    reconcileGrowthResources, addGrowthIntegers } from './experience';
import type { GrowthAttributes, GrowthDerived, GrowthFocus, GrowthProgression, GrowthSkills } from './components';
import { growthPartyId, initialGrowthState, isGrowthState, isGrowthReward, validGrowthComponents, validGrowthSources,
    type GrowthReward, type GrowthState } from './state';
import { allocateGrowthAttributes, growthDerived, growthFocusCapacity, growthFocusInterval, growthRuleActor, initialGrowthAttributes, respecGrowthAttributes } from './attributes';
import { evaluateGrowthPhysicalDamage, evaluateGrowthPort, matchesGrowthConditions, type GrowthScopedModifiers } from './evaluator';
import { initialGrowthSkillBuild, canLearnGrowthSkill, growthSkillDefinition, growthSkillScopes, growthSkillCooldown, growthTimedDefinition,
    createGrowthEffectInstance, growthEffectDuration, growthTaggedSources, projectGrowthSkillBuild, advanceGrowthFocus, type GrowthSkillBuild, type GrowthSkillDefinition } from './skills';
import { initialGrowthIdentityBuild, createGrowthIdentityBuild, growthIdentityAttributeValues, growthIdentityFirstVisitEffects, grantGrowthIdentitySkills, type GrowthIdentityBuild } from './identities';
import { selectGrowthMonsterTemplate, initializeGrowthTemplate, initializeGrowthClone, autoAllocateGrowthAlly, type GrowthActorBuild } from './templates';
import { initialGrowthItemLedger, resolveGrowthItemGain, type GrowthItemLedger } from './items';

const getState = (context: Pick<ExtensionContext, 'state'>): GrowthState => context.state as GrowthState;
const saveState = (context: ExtensionContext, state: GrowthState): void => context.setState(state as Json);
const component = <T>(context: Pick<ExtensionContext, 'getComponent'>, id: number, name: string): T => context.getComponent(id,name) as T;
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
        return isJson(input) && !!input && typeof input === 'object' && !Array.isArray(input)
            && Object.keys(input).sort().join(',') === 'action,module,payload' && input.module === 'growth' && input.action === 'create-character';
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
/** P04: caller supplies a configured first-visit effect; the identity owner and current-floor participants are selected by settle. */
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
        const progression = component<GrowthProgression>(context,actorId,'progression'), attributes = component<GrowthAttributes>(context,actorId,'attributes');
        const build = component<GrowthSkillBuild>(context,actorId,'skill-build') ?? initialGrowthSkillBuild();
        const actor = growthRuleActor(actorId,progression,attributes), scopes = growthSkillScopes(pack,build,state.objectiveClock,'actor',component<GrowthIdentityBuild>(context,actorId,'identity'));
        const capacity = growthFocusCapacity(pack,actor,scopes), interval = growthFocusInterval(pack,actor,scopes);
        put(context,actorId,'focus',advanceGrowthFocus(pack,{ ...focus,current: Math.max(0,Math.min(capacity,current)) },capacity,interval,0));
    } else {
        const hp = Number(BigInt(actor.hp) + BigInt(effect.amount));
        context.commitResources(actorId,{ expectedHp: actor.hp,expectedMaxHp: actor.maxHp,hp: Math.max(1,Math.min(actor.maxHp,hp)),maxHp: actor.maxHp });
    }
    remember(state.resourceReceipts,receipt); return true;
}

export function createGrowthGameplay(pack: DeepReadonly<GrowthDefinitionPack>, identity: ExtensionModule['rules']): ExtensionModule {
    const config = pack.config;
    const rejected = (): Error => new Error(i18next.t('ext.growth.command.rejected', {defaultValue:'Character command is not available in the current state.'}));
    const actorIdentity = (context: ExtensionRuleContext,id: number): GrowthIdentityBuild =>
        context.getComponent(id,'identity') as GrowthIdentityBuild | undefined ?? initialGrowthIdentityBuild();
    function creationBuild(payload: Json, native?: ExtensionCreationResources): GrowthActorBuild {
        // The original explicit neutral contract remains useful to programmatic callers; the opening UI sends full selections.
        let identity: GrowthIdentityBuild;
        if (canonical(payload) === canonical({revision:0})) identity = initialGrowthIdentityBuild();
        else {
            if (!payload || typeof payload !== 'object' || Array.isArray(payload) || payload.revision !== 0
                || Object.keys(payload).sort().join(',') !== 'choices,faithId,lineageId,professionId,revision') throw rejected();
            const {revision:_,...selection} = payload;
            identity = createGrowthIdentityBuild(pack,selection);
        }
        const progression = initialGrowthProgression(config.levels), attributes = initialGrowthAttributes(pack,growthIdentityAttributeValues(pack,identity));
        const build = grantGrowthIdentitySkills(pack,identity,growthRuleActor(1,progression,attributes),initialGrowthSkillBuild());
        // Resource calculations are pure preflight too; invalid composite definitions cannot retire a live game.
        const actor = growthRuleActor(1,progression,attributes), effects = growthSkillScopes(pack,build,0,'actor',identity);
        const derived = growthDerived(pack,actor,effects); growthFocusCapacity(pack,actor,effects); growthFocusInterval(pack,actor,effects);
        if (native) {addGrowthIntegers(native.maxHp,derived.appliedMaxHp);addGrowthIntegers(native.strength,derived.appliedStrength);}
        return {progression,attributes,build,identity};
    }
    function validCreation(payload: Json, native?: ExtensionCreationResources): boolean { try {creationBuild(payload,native);return true;} catch {return false;} }
    function readBuild(context: ExtensionContext,id: number): GrowthActorBuild | undefined {
        const progression = component<GrowthProgression>(context,id,'progression');
        return progression ? {progression,attributes:component<GrowthAttributes>(context,id,'attributes'),
            build:component<GrowthSkillBuild>(context,id,'skill-build'),identity:actorIdentity(context,id)} : undefined;
    }
    function view(context: ExtensionRuleContext, id: number): GrowthRuleActor {
        const progression = context.getComponent(id,'progression') as GrowthProgression | undefined;
        const attributes = context.getComponent(id,'attributes') as GrowthAttributes | undefined;
        return growthRuleActor(id,progression ?? initialGrowthProgression(config.levels),attributes ?? initialGrowthAttributes(pack));
    }
    const skillBuild = (context: ExtensionRuleContext, id: number): GrowthSkillBuild =>
        context.getComponent(id,'skill-build') as GrowthSkillBuild | undefined ?? initialGrowthSkillBuild();
    function scopes(context: ExtensionRuleContext, id: number, owner: 'actor'|'target' = 'actor'): readonly GrowthScopedModifiers[] {
        return growthSkillScopes(pack,skillBuild(context,id),(context.state as unknown as GrowthState).objectiveClock,owner,actorIdentity(context,id));
    }
    function policyScopes(input: Readonly<ExtensionRuleInput>, context: ExtensionRuleContext): readonly GrowthScopedModifiers[] {
        return [...scopes(context,input.actorId),...(input.targetId === null ? [] : scopes(context,input.targetId,'target'))];
    }
    function policyInput(input: Readonly<ExtensionRuleInput>, context: ExtensionRuleContext) {
        return { ...input,actor: view(context,input.actorId),target: input.targetId === null ? null : view(context,input.targetId),
            inactiveAttributeActorIds: [input.actorId,...(input.targetId === null ? [] : [input.targetId])].filter(id=>!context.getComponent(id,'progression')),
            actionId: 0,resolutionId: 0,tags: skillBuild(context,input.actorId).effects.filter(instance=>instance.expiresAt === null || instance.expiresAt > (context.state as unknown as GrowthState).objectiveClock).flatMap(instance => growthTimedDefinition(pack,instance)?.tags ?? []) };
    }
    const policy = (port: GrowthRulePort) => (input: Readonly<ExtensionRuleInput>, context: ExtensionRuleContext): number =>
        evaluateGrowthPort(pack,port,policyInput(input,context),policyScopes(input,context));
    function initialize(context: ExtensionContext, state: GrowthState, actor: ActorFacts, birth: CreatureBirth, selected?: GrowthActorBuild): void {
        observe(state,actor);
        if (context.getComponent(actor.id,'reward')) return;
        const quote = config.experience.kills.monsterQuotes.find(entry => entry.monsterId === birth.originalMonsterType);
        const reward: GrowthReward = { ...birth,rewardId: `birth:${actor.id}`,threatRank: quote?.threatRank ?? 0,
            amount: quote ? quote.amount ?? config.experience.kills.base + config.experience.kills.perThreatRank * quote.threatRank : 0 };
        put(context,actor.id,'reward',reward);
        if (!actor.player && !config.monsters.enabled) {
            // Reward provenance and received temporary effects are independent of NPC growth.
            // Copied native fields can carry the source's bonus even if this new body has growth disabled.
            const oldBonus = birth.nativeStatsCopied && birth.sourceId !== null ? component<GrowthDerived>(context,birth.sourceId,'derived')?.appliedMaxHp ?? 0 : 0;
            if (oldBonus) {
                const maximum = reconcileGrowthMaximum(actor.maxHp,oldBonus,0);
                context.commitResources(actor.id,{expectedHp:actor.hp,expectedMaxHp:actor.maxHp,
                    hp:Math.min(actor.hp,maximum)+Math.max(0,actor.hp-actor.maxHp),maxHp:maximum});
            }
            put(context,actor.id,'skill-build',initialGrowthSkillBuild()); return;
        }
        const clone = birth.nativeStatsCopied;
        const birthBuild = selected ?? (clone ? initializeGrowthClone(pack,birth.sourceId === null ? undefined : readBuild(context,birth.sourceId))
            : initializeGrowthTemplate(pack,selectGrowthMonsterTemplate(pack,context.depth)!));
        const {progression,attributes,build,identity} = birthBuild;
        const growthActor = growthRuleActor(actor.id,progression,attributes), initialEffects = growthSkillScopes(pack,build,state.objectiveClock,'actor',identity), derived = growthDerived(pack,growthActor,initialEffects);
        const previous = !clone || birth.sourceId === null ? undefined : component<GrowthDerived>(context,birth.sourceId,'derived');
        // A native clone copies maximum health. Remove the copied contribution before installing this body's build.
        const oldBonus = previous?.appliedMaxHp ?? 0, maxHp = reconcileGrowthMaximum(actor.maxHp,oldBonus,derived.appliedMaxHp);
        const capacity = growthFocusCapacity(pack,growthActor,initialEffects), focus = {current:capacity,remainder:0}, skills = {readyAt:{}};
        const resources = reconcileGrowthResources(config.levels,config.focus,'creation',
            {hp:Math.min(actor.hp,actor.maxHp),maxHp:actor.maxHp,nextMaxHp:maxHp,focus,focusCapacity:capacity,nextFocusCapacity:capacity,skills});
        if (!actor.player) resources.hp = Math.min(actor.hp,actor.maxHp,maxHp) + Math.max(0,actor.hp-actor.maxHp);
        put(context,actor.id,'progression',progression);put(context,actor.id,'attributes',attributes);put(context,actor.id,'derived',derived);
        put(context,actor.id,'identity',identity);put(context,actor.id,'items',initialGrowthItemLedger());put(context,actor.id,'skill-build',build);
        put(context,actor.id,'focus',resources.focus);put(context,actor.id,'skills',resources.skills);
        if (actor.hp !== resources.hp || actor.maxHp !== resources.maxHp)
            context.commitResources(actor.id,{expectedHp:actor.hp,expectedMaxHp:actor.maxHp,hp:resources.hp,maxHp:resources.maxHp});
        const native = context.characterResources(actor.id);
        if (native.strength !== null && derived.appliedStrength) context.commitCharacterResources(actor.id,
            {expectedStrength:native.strength,strength:addGrowthIntegers(native.strength,derived.appliedStrength),expectedGold:native.gold,gold:native.gold});
    }
    /** All grant math and native-resource bounds are checked before any write. */
    function planAward(context: Pick<ExtensionContext, 'getComponent' | 'creature' | 'characterResources'>, state: Readonly<GrowthState>, recipientId: number, amount: number) {
        const old = component<GrowthProgression>(context,recipientId,'progression'), actor = context.creature(recipientId);
        if (!old || !actor || amount === 0) return;
        const reward = component<GrowthReward>(context,recipientId,'reward');
        if (reward?.nativeStatsCopied && !config.monsters.clone.progression) return;
        if (!actor.player && !config.monsters.alliesGrow && actor.allied) return;
        const gain = grantExperience(config.levels,old,amount);
        const priorDerived = component<GrowthDerived>(context,recipientId,'derived');
        const priorAttributes = component<GrowthAttributes>(context,recipientId,'attributes');
        const priorBuild = component<GrowthSkillBuild>(context,recipientId,'skill-build') ?? initialGrowthSkillBuild();
        const identity = component<GrowthIdentityBuild>(context,recipientId,'identity') ?? initialGrowthIdentityBuild();
        const oldScopes = growthSkillScopes(pack,priorBuild,state.objectiveClock,'actor',identity);
        const nextBuild = !actor.player && actor.allied && gain.levelsGained
            ? autoAllocateGrowthAlly(pack,recipientId,{progression:gain.progression,attributes:priorAttributes,build:priorBuild,identity})
            : {progression:gain.progression,attributes:priorAttributes,build:priorBuild,identity};
        const attributes = nextBuild.attributes, allocated = canonical(attributes) !== canonical(priorAttributes);
        const equipped = canonical(nextBuild.build.active) !== canonical(priorBuild.active) || canonical(nextBuild.build.passive) !== canonical(priorBuild.passive);
        gain.progression = nextBuild.progression;
        const nextScopes = growthSkillScopes(pack,nextBuild.build,state.objectiveClock,'actor',identity);
        const oldActor = growthRuleActor(recipientId,old,priorAttributes), levelActor = growthRuleActor(recipientId,gain.progression,priorAttributes);
        const nextActor = growthRuleActor(recipientId,gain.progression,attributes), derived = growthDerived(pack,nextActor,nextScopes);
        const levelDerived = growthDerived(pack,levelActor,oldScopes), levelMaxHp = reconcileGrowthMaximum(actor.maxHp,priorDerived.appliedMaxHp,levelDerived.appliedMaxHp);
        const nextMaxHp = reconcileGrowthMaximum(actor.maxHp,priorDerived.appliedMaxHp,derived.appliedMaxHp);
        const allocatedDerived = growthDerived(pack,nextActor,oldScopes), allocatedMaxHp = reconcileGrowthMaximum(actor.maxHp,priorDerived.appliedMaxHp,allocatedDerived.appliedMaxHp);
        let resources = gain.levelsGained ? reconcileGrowthResources(config.levels,config.focus,'level',{
            hp:Math.min(actor.hp,actor.maxHp),maxHp:actor.maxHp,nextMaxHp:levelMaxHp,focus:component<GrowthFocus>(context,recipientId,'focus'),
            focusCapacity:growthFocusCapacity(pack,oldActor,oldScopes),nextFocusCapacity:growthFocusCapacity(pack,levelActor,oldScopes),skills:component<GrowthSkills>(context,recipientId,'skills'),
        }) : {hp:actor.hp,maxHp:actor.maxHp,focus:component<GrowthFocus>(context,recipientId,'focus'),skills:component<GrowthSkills>(context,recipientId,'skills')};
        if (!actor.player && actor.hp > actor.maxHp && levelMaxHp >= actor.maxHp && config.levels.recovery.levelHp !== 'full') resources.hp = actor.hp;
        if (allocated) {
            const before = resources;
            resources = reconcileGrowthResources(config.levels,config.focus,'allocation',{
                hp:Math.min(before.hp,before.maxHp),maxHp:before.maxHp,nextMaxHp:allocatedMaxHp,focus:before.focus,
                focusCapacity:growthFocusCapacity(pack,levelActor,oldScopes),nextFocusCapacity:growthFocusCapacity(pack,nextActor,oldScopes),skills:before.skills,
            });
            if (!actor.player && before.hp > before.maxHp && allocatedMaxHp >= before.maxHp && config.levels.recovery.allocationHp !== 'full') resources.hp = before.hp;
        }
        if (equipped) {
            resources.hp = nextMaxHp < resources.maxHp ? Math.min(resources.hp,nextMaxHp) : resources.hp; resources.maxHp = nextMaxHp;
        }
        const capacity = growthFocusCapacity(pack,nextActor,nextScopes);
        if (equipped && !config.skills.equipPreservesFocus) resources.focus.current = capacity;
        if (equipped && !config.skills.equipPreservesCooldowns) resources.skills.readyAt = Object.fromEntries(Object.keys(resources.skills.readyAt).map(id=>[id,0]));
        resources.focus = advanceGrowthFocus(pack,{...resources.focus,current:Math.min(resources.focus.current,capacity)},capacity,growthFocusInterval(pack,nextActor,nextScopes),0);
        const native = context.characterResources(recipientId);
        const character = native.strength !== null && derived.appliedStrength !== priorDerived.appliedStrength
            ? { expectedStrength:native.strength,strength:reconcileGrowthMaximum(native.strength,priorDerived.appliedStrength,derived.appliedStrength),expectedGold:native.gold,gold:native.gold }
            : null;
        return { recipientId, progression:gain.progression, derived, attributes, build:nextBuild.build, focus:resources.focus, skills:resources.skills,
            character, resources:actor.hp !== resources.hp || actor.maxHp !== resources.maxHp
                ? {expectedHp:actor.hp,expectedMaxHp:actor.maxHp,hp:resources.hp,maxHp:resources.maxHp} : null,
            revision:gain.gainedExperience ? addGrowthIntegers(state.revision,1) : state.revision,
            announceLevel:gain.levelsGained && actor.player ? gain.progression.level : null };
    }
    function commitAward(context: ExtensionContext, state: GrowthState, plan: NonNullable<ReturnType<typeof planAward>>): void {
        const id = plan.recipientId;
        put(context,id,'progression',plan.progression); put(context,id,'derived',plan.derived);
        put(context,id,'attributes',plan.attributes); put(context,id,'skill-build',plan.build);
        put(context,id,'focus',plan.focus); put(context,id,'skills',plan.skills);
        if (plan.character) context.commitCharacterResources(id,plan.character);
        if (plan.resources) context.commitResources(id,plan.resources);
        state.revision = plan.revision;
        if (plan.announceLevel !== null) context.message(i18next.t('ext.growth.level_gained', { level:plan.announceLevel,defaultValue:'You reached level {{level}}.' }));
    }
    function award(context: ExtensionContext, state: GrowthState, recipientId: number, amount: number): void {
        const plan = planAward(context,state,recipientId,amount);
        if (plan) commitAward(context,state,plan);
    }
    function prepareStoryReward(request: Readonly<OptionalRewardRequest>, context: OptionalRewardPrepareContext) {
        // The provider owns the quote, reason and receipt; the consumer names only its bounded reward key.
        if (!config.experience.sources.story) return {status:'skipped' as const,reason:'disabled' as const};
        const quote = config.experience.story.rewards.find(reward=>reward.id === request.rewardId);
        if (!quote) return {status:'skipped' as const,reason:'unsupported-key' as const};
        const state = context.state as unknown as GrowthState;
        if (request.recipient !== 'player' || !state.created || state.playerId !== context.playerId
            || !context.player?.player || context.player.id !== context.playerId || !context.getPlayerComponent('progression')) throw rejected();
        const receiptId = `${request.issuerId}:${request.rewardId}:${request.instanceId}`;
        const received = state.storyReceipts.includes(receiptId);
        const read = { getComponent:(id: number,name: string): Json | undefined => {
                if (id !== context.playerId) throw rejected();
                const value = context.getPlayerComponent(name);
                return value === undefined ? undefined : structuredClone(value) as Json;
            }, creature:(id: number) => id === context.playerId ? context.player : null,
            characterResources:(id: number) => { if (id !== context.playerId) throw rejected(); return {...context.resources}; } };
        return {status:'ready' as const,plan:{v:1,receiptId,recipientId:context.playerId,amount:quote.amount,reasonKey:quote.reasonKey,
            expectedRevision:state.revision,received,award:received ? null : planAward(read,state,context.playerId,quote.amount) ?? null}};
    }
    const publicCharacter: OptionalQueryProvider = {
        accepts: input => !!input && typeof input === 'object' && !Array.isArray(input)
            && Object.keys(input).length === 1 && 'v' in input && input.v === 1,
        query(_input,context) {
            const state = context.state as unknown as GrowthState;
            const progression = context.getPlayerComponent('progression') as GrowthProgression | undefined;
            const identity = context.getPlayerComponent('identity') as GrowthIdentityBuild | undefined;
            if (!state.created || state.playerId !== context.playerId || !progression || !identity) throw rejected();
            return {level:progression.level,professionId:identity.professionId,lineageId:identity.lineageId,faithId:identity.faithId};
        },
        validate(value): value is Json {
            if (!isJson(value) || !value || typeof value !== 'object' || Array.isArray(value)
                || Object.keys(value).sort().join(',') !== 'faithId,level,lineageId,professionId') return false;
            return Number.isSafeInteger(value.level) && (value.level as number) >= 1 && (value.level as number) <= config.levels.cap
                && ['professionId','lineageId','faithId'].every(field=>value[field] === null || validId(value[field]));
        },
    };
    function planCharacterCommand(action: 'allocate' | 'respec', payload: Json, context: ExtensionContext) {
        const state = getState(context), actor = context.creature(context.playerId);
        if (!state.created || !actor || actor.hp <= 0 || !context.canManageCharacter()
            || !payload || typeof payload !== 'object' || Array.isArray(payload)
            || Object.keys(payload).sort().join(',') !== (action === 'allocate' ? 'attributes,revision' : 'revision')
            || payload.revision !== state.revision) throw rejected();
        const progression = component<GrowthProgression>(context,actor.id,'progression');
        const prior = component<GrowthAttributes>(context,actor.id,'attributes');
        const priorDerived = component<GrowthDerived>(context,actor.id,'derived');
        const native = context.characterResources(actor.id), oldActor = growthRuleActor(actor.id,progression,prior);
        let attributes: GrowthAttributes, next = { ...progression }, gold = native.gold;
        if (action === 'allocate') {
            const proposal = allocateGrowthAttributes(pack,prior,progression.attributePoints,payload.attributes,growthIdentityAttributeValues(pack,actorIdentity(context,actor.id)));
            attributes = proposal.attributes; next.attributePoints -= proposal.cost;
        } else {
            if (!config.respec.enabled) throw rejected();
            const proposal = respecGrowthAttributes(pack,prior);
            attributes = proposal.attributes; next.attributePoints = addGrowthIntegers(next.attributePoints,proposal.refund);
            const fee = config.respec.cost;
            if (fee.resource === 'gold') {
                if (gold === null || gold < fee.amount) throw rejected();
                gold -= fee.amount;
            } else if (fee.resource === 'attribute-points') {
                if (next.attributePoints < fee.amount) throw rejected();
                next.attributePoints -= fee.amount; attributes.attributePointsSpent = addGrowthIntegers(attributes.attributePointsSpent,fee.amount);
            } else if (fee.resource === 'skill-points') {
                if (next.skillPoints < fee.amount) throw rejected();
                next.skillPoints -= fee.amount; attributes.skillPointsSpent = addGrowthIntegers(attributes.skillPointsSpent,fee.amount);
            }
        }
        const nextActor = growthRuleActor(actor.id,next,attributes), derived = growthDerived(pack,nextActor,scopes(context,actor.id));
        const nextMaxHp = reconcileGrowthMaximum(actor.maxHp,priorDerived.appliedMaxHp,derived.appliedMaxHp);
        const priorFocus = component<GrowthFocus>(context,actor.id,'focus'), priorSkills = component<GrowthSkills>(context,actor.id,'skills');
        const resources = action === 'allocate' ? reconcileGrowthResources(config.levels,config.focus,'allocation', {
            hp:actor.hp,maxHp:actor.maxHp,nextMaxHp,focus:priorFocus,focusCapacity:growthFocusCapacity(pack,oldActor,scopes(context,actor.id)),
            nextFocusCapacity:growthFocusCapacity(pack,nextActor,scopes(context,actor.id)),skills:priorSkills,
        }) : { hp:Math.min(actor.hp,nextMaxHp),maxHp:nextMaxHp,
            focus:{...priorFocus,current:Math.min(priorFocus.current,growthFocusCapacity(pack,nextActor,scopes(context,actor.id)))},
            skills:{readyAt:Object.fromEntries(Object.entries(priorSkills.readyAt).map(([id,time]) => [id,config.respec.clearCooldowns ? 0 : time]))} };
        if (action === 'respec' && config.respec.cost.resource === 'focus') {
            if (priorFocus.current < config.respec.cost.amount) throw rejected();
            resources.focus.current = Math.min(priorFocus.current - config.respec.cost.amount,growthFocusCapacity(pack,nextActor,scopes(context,actor.id)));
        }
        // Elapsed recovery credit remains attached to the actor; it is never reset by an attribute query.
        resources.focus = advanceGrowthFocus(pack,resources.focus,growthFocusCapacity(pack,nextActor,scopes(context,actor.id)),growthFocusInterval(pack,nextActor,scopes(context,actor.id)),0);
        const strength = native.strength === null ? null : reconcileGrowthMaximum(native.strength,priorDerived.appliedStrength,derived.appliedStrength);
        const revision = addGrowthIntegers(state.revision,1);
        return {state:{...state,revision},actor,progression:next,attributes,derived,resources,native,strength,gold};
    }
    function commitCharacterCommand(action: 'allocate' | 'respec', payload: Json, context: ExtensionContext): void {
        let plan: ReturnType<typeof planCharacterCommand>;
        try { plan = planCharacterCommand(action,payload,context); } catch { throw rejected(); }
        const {actor,resources,native} = plan;
        // Runtime also snapshots these narrow resources/components, so an exceptional provider cannot half-spend.
        context.commitResources(actor.id,{expectedHp:actor.hp,expectedMaxHp:actor.maxHp,hp:resources.hp,maxHp:resources.maxHp});
        context.commitCharacterResources(actor.id,{expectedStrength:native.strength,strength:plan.strength,expectedGold:native.gold,gold:plan.gold});
        put(context,actor.id,'progression',plan.progression); put(context,actor.id,'attributes',plan.attributes);
        put(context,actor.id,'derived',plan.derived); put(context,actor.id,'focus',resources.focus); put(context,actor.id,'skills',resources.skills);
        saveState(context,plan.state);
    }
    let openAction: number | null = null;
    /** Native fields remain single-owner; every build/effect commit applies only the changed derived delta. */
    function reconcileActor(context: ExtensionContext, id: number, recoverBlocks = 0): void {
        const actor = context.creature(id), prior = component<GrowthDerived>(context,id,'derived');
        if (!actor || !prior) return;
        const ruleActor = view(context,id), effects = scopes(context,id), derived = growthDerived(pack,ruleActor,effects);
        const maximum = reconcileGrowthMaximum(actor.maxHp,prior.appliedMaxHp,derived.appliedMaxHp);
        const hp = maximum < actor.maxHp || actor.player ? Math.min(actor.hp,maximum) : actor.hp;
        if (actor.maxHp !== maximum || actor.hp !== hp) context.commitResources(id,{expectedHp:actor.hp,expectedMaxHp:actor.maxHp,hp,maxHp:maximum});
        const native = context.characterResources(id);
        if (native.strength !== null && derived.appliedStrength !== prior.appliedStrength) context.commitCharacterResources(id,
            {expectedStrength:native.strength,strength:reconcileGrowthMaximum(native.strength,prior.appliedStrength,derived.appliedStrength),expectedGold:native.gold,gold:native.gold});
        put(context,id,'derived',derived);
        const capacity = growthFocusCapacity(pack,ruleActor,effects), interval = growthFocusInterval(pack,ruleActor,effects);
        const focus = component<GrowthFocus>(context,id,'focus');
        put(context,id,'focus',advanceGrowthFocus(pack,{...focus,current:Math.min(focus.current,capacity)},capacity,interval,actor.hp > 0 ? recoverBlocks : 0));
    }
    function planSkillCommand(action: string, payload: Json, context: ControlledCommandPreparationContext, actorId: number) {
        const state = getState(context), actor = context.creature(actorId);
        const keys = action === 'equip-skills' ? 'active,passive,revision' : action === 'use-skill' ? 'revision,skillId,target' : 'revision,skillId';
        if (!state.created || !actor || actor.hp <= 0 || !context.canManageCharacter() || !payload || typeof payload !== 'object'
            || Array.isArray(payload) || Object.keys(payload).sort().join(',') !== keys || payload.revision !== state.revision) throw rejected();
        const progression = component<GrowthProgression>(context,actor.id,'progression'), build = skillBuild(context,actor.id);
        const focus = component<GrowthFocus>(context,actor.id,'focus'), skills = component<GrowthSkills>(context,actor.id,'skills');
        let skill: GrowthSkillDefinition | undefined, request: ControlledActionRequest | null = null;
        if (action === 'equip-skills') {
            for (const mode of ['active','passive'] as const) {
                const list = payload[mode];
                if (!Array.isArray(list) || list.length > config.skills[`${mode}Slots`] || new Set(list).size !== list.length
                    || list.some(id => typeof id !== 'string' || !build.learned.includes(id) || growthSkillDefinition(pack,id)?.mode !== mode)) throw rejected();
            }
            if (canonical(payload.active!) === canonical(build.active) && canonical(payload.passive!) === canonical(build.passive)) throw rejected();
            if (config.skills.equipTime === 'native-wait') request = {actorId,action:'wait',target:{kind:'self'}};
        } else {
            skill = typeof payload.skillId === 'string' ? growthSkillDefinition(pack,payload.skillId) : undefined;
            if (!skill) throw rejected();
            if (action === 'learn-skill') {
                if (progression.skillPoints < skill.cost || !canLearnGrowthSkill(pack,skill,view(context,actor.id),build,actorIdentity(context,actor.id))) throw rejected();
            } else {
                if (!build.active.includes(skill.id) || skill.mode !== 'active' || !skill.action || focus.current < skill.focusCost
                    || (skills.readyAt[skill.id] ?? 0) > state.objectiveClock) throw rejected();
                request = {actorId,action:skill.action.kind,target:payload.target as unknown as ControlledActionRequest['target']};
                addGrowthIntegers(state.objectiveClock,growthSkillCooldown(pack,skill,view(context,actorId),build,state.objectiveClock,actorIdentity(context,actorId)));
                addGrowthIntegers(state.nextActionId,1);
                addGrowthIntegers(state.nextEffectId,skill.effects.filter(effect=>effect.kind==='timed').length);
                for (const effect of skill.effects) if (effect.kind==='timed') {
                    const duration = growthEffectDuration(pack,effect,view(context,actorId),growthTaggedSources(pack,build,actorIdentity(context,actorId)));
                    if (duration !== null) addGrowthIntegers(state.objectiveClock,duration);
                }
            }
        }
        addGrowthIntegers(state.revision,1);
        if (request && !context.validateAction(request)) throw rejected();
        return {state,actor,progression,build,focus,skills,skill,request,payload};
    }
    function applyTimed(context: ExtensionContext, skill: GrowthSkillDefinition, actorId: number, actionId: number,
        phase: 'action-start'|'action-result', target: ControlledActionRequest['target'], result?: Readonly<ControlledActionResult>): void {
        // A native struggled/vomited move attempt is committed and paid, but it did not perform the requested move.
        if (phase === 'action-result' && result?.action === 'move' && !result.moved) return;
        const state = getState(context), source = view(context,actorId), sourceBuild = skillBuild(context,actorId);
        for (const effect of skill.effects) {
            if (effect.kind !== 'timed' || effect.application !== phase || !matchesGrowthConditions(effect.conditions,
                {role:effect.recipient === 'self' ? 'actor' : 'target',hit:result?.hit,hpLost:result?.hpLost,
                    adjacent:skill.action?.kind === 'attack' || skill.action?.kind === 'move' ? true : undefined,
                    probabilityRoll:result ? result.resolutions.some(fact=>fact.defender.id === (target.kind === 'creature' ? target.id : null) && fact.probabilityRolled) : undefined,attackKind:skill.action?.kind === 'attack' ? 'melee' : undefined,
                    damageKind:skill.action?.kind === 'attack' ? 'physical' : undefined,searchMode:skill.action?.kind === 'search' ? 'manual' : undefined,
                    directDamage:skill.action?.kind === 'attack' ? true : undefined,tags:[...skill.tags,...effect.tags]})) continue;
            const recipientId = effect.recipient === 'self' ? actorId : target.kind === 'creature' ? target.id : null;
            if (recipientId === null || !context.getComponent(recipientId,'skill-build')) continue;
            const instance = createGrowthEffectInstance(pack,skill,effect,source,sourceBuild,state.objectiveClock,actionId,state.nextEffectId,actorIdentity(context,actorId));
            state.nextEffectId = addGrowthIntegers(state.nextEffectId,1);
            const build = skillBuild(context,recipientId); build.effects.push(instance); put(context,recipientId,'skill-build',build);
            // Save clock/sequence before reconciling; policies read the same committed state.
            saveState(context,state); reconcileActor(context,recipientId);
        }
        saveState(context,state);
    }
    function closeAction(context: ExtensionContext, actionId: number): void {
        const state = getState(context);
        for (const id of Object.keys(state.actors).map(Number)) {
            const build = skillBuild(context,id), effects = build.effects.filter(effect=>effect.actionId !== actionId);
            if (effects.length !== build.effects.length) {put(context,id,'skill-build',{...build,effects});reconcileActor(context,id);}
        }
        openAction = null;
    }
    function commitSkillCommand(action: string, payload: Json, context: ExtensionContext): void {
        const plan = planSkillCommand(action,payload,context,context.playerId);
        if (action === 'learn-skill') {
            plan.progression.skillPoints -= plan.skill!.cost; plan.build.learned.push(plan.skill!.id); plan.build.learned.sort();
            put(context,plan.actor.id,'progression',plan.progression); put(context,plan.actor.id,'skill-build',plan.build);
            plan.state.revision = addGrowthIntegers(plan.state.revision,1); saveState(context,plan.state); return;
        }
        const equip = (fresh: ExtensionContext): void => {
            const state = getState(fresh), build = skillBuild(fresh,plan.actor.id), skills = component<GrowthSkills>(fresh,plan.actor.id,'skills');
            build.active = [...plan.payload.active as string[]]; build.passive = [...plan.payload.passive as string[]];
            put(fresh,plan.actor.id,'skill-build',build);
            if (!config.skills.equipPreservesCooldowns) put(fresh,plan.actor.id,'skills',{readyAt:Object.fromEntries(Object.keys(skills.readyAt).map(id=>[id,0]))});
            if (!config.skills.equipPreservesFocus) {
                const focus = component<GrowthFocus>(fresh,plan.actor.id,'focus');
                put(fresh,plan.actor.id,'focus',{...focus,current:growthFocusCapacity(pack,view(fresh,plan.actor.id),scopes(fresh,plan.actor.id))});
            }
            reconcileActor(fresh,plan.actor.id); state.revision = addGrowthIntegers(state.revision,1); saveState(fresh,state);
        };
        if (action === 'equip-skills') {
            if (!plan.request) equip(context);
            else context.executeAction(plan.request,{beforeCommit:equip,afterResolve:()=>undefined});
            return;
        }
        const skill = plan.skill!, actorId = plan.actor.id; let actionId = 0;
        context.executeAction(plan.request!,{
            beforeCommit(fresh) {
                const state = getState(fresh), focus = component<GrowthFocus>(fresh,actorId,'focus'), skills = component<GrowthSkills>(fresh,actorId,'skills');
                actionId = state.nextActionId; state.nextActionId = addGrowthIntegers(state.nextActionId,1); openAction = actionId;
                focus.current -= skill.focusCost;
                skills.readyAt[skill.id] = addGrowthIntegers(state.objectiveClock,growthSkillCooldown(pack,skill,view(fresh,actorId),skillBuild(fresh,actorId),state.objectiveClock,actorIdentity(fresh,actorId)));
                put(fresh,actorId,'focus',focus);put(fresh,actorId,'skills',skills);state.revision = addGrowthIntegers(state.revision,1);saveState(fresh,state);
                applyTimed(fresh,skill,actorId,actionId,'action-start',plan.request!.target);
            },
            afterResolve(result,fresh) {
                applyTimed(fresh,skill,actorId,actionId,'action-result',result.target,result);closeAction(fresh,actionId);
            },
        });
    }
    function settle(context: ExtensionContext, knownKinds: {id:string;category:string}[], reachable: number[], sources: number[]): void {
        const state = getState(context);
        if (!state.created) return;
        // Cached actors expire on the same absolute clock; only objectiveTime's participating IDs recover focus.
        for (const id of reachable) {
            const build = skillBuild(context,id), effects = build.effects.filter(effect=>effect.expiresAt === null || effect.expiresAt > state.objectiveClock);
            if (effects.length !== build.effects.length) {put(context,id,'skill-build',{...build,effects});reconcileActor(context,id);}
        }
        for (const fact of state.pending) {
            if (fact.kind === 'visit') {
                if (!remember(state.visitedDepths,fact.depth)) continue;
                for (const id of fact.actorIds) if (context.getComponent(id,'identity'))
                    for (const {effect} of growthIdentityFirstVisitEffects(pack,actorIdentity(context,id),id,fact.depth,state.resourceReceipts))
                        commitFirstVisitResource(context,state,pack,id,fact.depth,effect);
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
                    || (reward.nativeStatsCopied && !config.monsters.clone.rewards)
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
        initializationReady: context => getState(context).created,
        optionalQueries: {'growth.public-character.v1':publicCharacter},
        optionalActorQueries: {'growth.combat-stats.v1':createGrowthCombatStatsProvider(pack)},
        optionalRewards: {'growth.story-reward.v1': {
            prepare(request,context) {
                const prepared = prepareStoryReward(request,context);
                return prepared.status === 'ready' ? {status:'ready',plan:prepared.plan as unknown as Json} : prepared;
            },
            commit(request,plan,context) {
                const prepared = prepareStoryReward(request,{playerId:context.playerId,state:context.state,
                    getPlayerComponent:name=>context.getComponent(context.playerId,name),
                    player:context.creature(context.playerId),resources:context.characterResources(context.playerId)});
                if (prepared.status !== 'ready' || canonical(prepared.plan) !== canonical(plan)) throw rejected();
                if (prepared.plan.received) return;
                const state = getState(context);
                if (prepared.plan.award) commitAward(context,state,prepared.plan.award);
                remember(state.storyReceipts,prepared.plan.receiptId); saveState(context,state);
            },
        }},
        view: { definitions: pack as unknown as ReadonlyJson, stateFields: ['created','revision','objectiveClock'],
            playerComponents: ['progression','attributes','derived','focus','skills','skill-build','identity'],
            componentFields:{identity:['professionId','lineageId','faithId','choices'],'skill-build':['learned','inherited','active','passive','effects']} },
        projectPlayerComponent: (name,value) => name === 'skill-build'
            ? projectGrowthSkillBuild(pack,value as unknown as GrowthSkillBuild) as unknown as Json : structuredClone(value) as Json,
        rulePolicies: {
            hitChance:policy('hitChance'), physicalDamage:(input,context) => evaluateGrowthPhysicalDamage(pack,policyInput(input,context) as GrowthDamageInput,policyScopes(input,context)),
            stealthRange:policy('stealthRange'), searchStrength:policy('searchStrength'), strengthBonus:policy('strengthBonus'),maxHpBonus:policy('maxHpBonus'),
            focusCapacity:policy('focusCapacity'),focusRecoveryInterval:policy('focusRecoveryInterval'),cooldownDuration:policy('cooldownDuration'),
            nativeBonuses(id,context) { const derived = context.getComponent(id,'derived') as GrowthDerived | undefined;
                return {maxHp:derived?.appliedMaxHp ?? 0,strength:derived?.appliedStrength ?? 0}; },
        },
        commitItemGrowth(input,context) {
            try {
            const {actor} = input, items = component<GrowthItemLedger>(context,actor.id,'items');
            if (!items) throw rejected();
            let result: ReturnType<typeof resolveGrowthItemGain>;
            try { result = resolveGrowthItemGain(config.itemGrowth,input.itemId,input.nativeDestination,input.nativeAmount,items); }
            catch { throw rejected(); }
            const progression = component<GrowthProgression>(context,actor.id,'progression');
            if (result.destination !== input.nativeDestination && result.amount) {
                if (result.destination === 'attribute-points') progression.attributePoints = addGrowthIntegers(progression.attributePoints,result.amount);
                else if (result.destination === 'skill-points') progression.skillPoints = addGrowthIntegers(progression.skillPoints,result.amount);
                else if (result.destination === 'maxHpBonus') context.commitResources(actor.id,
                    {expectedHp:actor.hp,expectedMaxHp:actor.maxHp,hp:actor.hp,maxHp:addGrowthIntegers(actor.maxHp,result.amount)});
                else if (result.destination === 'strengthBonus') {
                    const native = context.characterResources(actor.id); if (native.strength === null) throw rejected();
                    context.commitCharacterResources(actor.id,{expectedStrength:native.strength,strength:addGrowthIntegers(native.strength,result.amount),expectedGold:native.gold,gold:native.gold});
                } else throw rejected();
            }
            put(context,actor.id,'progression',progression); put(context,actor.id,'items',result.items);
            const state = getState(context); if (result.amount) state.revision = addGrowthIntegers(state.revision,1); saveState(context,state);
            return {nativeAmount:result.nativeAmount};
            } catch { throw rejected(); }
        },
        initialState: () => initialGrowthState() as unknown as Json,validateState: (value): value is Json => isGrowthState(value,pack),
        componentValidators: { reward: isGrowthReward },
        validateComponents: (state,components,foundation) => validGrowthComponents(state as GrowthState,components,pack)
            && validGrowthSources(state as GrowthState,foundation) && (!(state as GrowthState).created || !(state as GrowthState).pending.length),
        validateWorld(state,components,actors) {
            const growth = state as GrowthState, ids = new Set(actors.map(actor => actor.id));
            if (!growth.created || growth.pending.length || !actors.some(actor => actor.player && actor.id === growth.playerId)) return false;
            return Object.entries(components).every(([id,entries]) => !Object.keys(entries).some(key => key.startsWith('growth:')) || ids.has(Number(id)))
                && actors.every(actor => { const summary = growth.actors[actor.id];
                    return !!components[actor.id]?.['growth:reward'] && (actor.player || config.monsters.enabled ? !!components[actor.id]?.['growth:progression'] : !components[actor.id]?.['growth:progression'])
                        && actor.maxHp > componentBonus(components[actor.id]?.['growth:derived'])
                        && Number.isSafeInteger(actor.hp) && Number.isSafeInteger(actor.maxHp) && actor.maxHp >= 1 && actor.hp >= 0 && (!actor.player || actor.hp <= actor.maxHp)
                        && !!summary && summary.player === actor.player && summary.allied === actor.allied && summary.hostile === actor.hostile
                        && summary.alive === (actor.hp > 0); });
        },
        validateRecording(events) {
            // The foundation validates the complete ordered creation prefix.
            // This module owns only its transition, which need not be event 0.
            const first = events.findIndex(event => event.action === 'ext:command' && isCreationCommand(event.data));
            return first >= 0 && validCreation(JSON.parse(events[first]!.data as string).payload)
                && events.every((event,index) => (event.extensions?.modules.growth as unknown as GrowthState)?.created === (index >= first)
                    && (index === first || event.action !== 'ext:command' || !isCreationCommand(event.data)));
        },
        initialCommand: { action: 'create-character',payload: { revision: 0 } },
        validateInitialCommand: (action,payload,native) => action === 'create-character' && validCreation(payload,native),
        allowInput(action,data,context) {
            const state = getState(context);
            if (!state.created) {
                if (context.isInitialCommand(action, data) && !isCreationCommand(data)) return true;
                const actor = context.creature(context.playerId), native = context.characterResources(context.playerId);
                return !!actor && actor.hp > 0 && native.strength !== null && action === 'ext:command' && isCreationCommand(data)
                    && validCreation(JSON.parse(data as string).payload,{maxHp:actor.maxHp,strength:native.strength});
            }
            if (action !== 'ext:command') return true;
            try {
                const input = JSON.parse(String(data)); if (input.module !== 'growth') return true;
                if (input.action === 'allocate' || input.action === 'respec') planCharacterCommand(input.action,input.payload,context);
                else if (['learn-skill','equip-skills','use-skill'].includes(input.action)) planSkillCommand(input.action,input.payload,context,context.playerId);
                else return false;
                return true;
            } catch { return false; }
        },
        prepareControlledCommand(action, payload, context) {
            if (action !== 'use-skill' && action !== 'equip-skills') return null;
            const plan = planSkillCommand(action, payload, context, context.playerId);
            return plan.request ? { revision: plan.state.revision, request: plan.request } : null;
        },
        readyToSave: context => getState(context).created && getState(context).pending.length === 0 && !openAction,
        creditParty: (actor,context) => growthPartyId(getState(context),actor.id),
        onNewGame(context) { const state = initialGrowthState(); state.playerId = context.playerId; saveState(context,state); },
        commands: { 'create-character'(payload,context) {
            const state = getState(context), actor = context.creature(context.playerId);
            if (state.created || !validCreation(payload) || !actor || actor.hp <= 0)
                throw new Error(i18next.t('ext.growth.command.rejected', {defaultValue:'Character command is not available in the current state.'}));
            initialize(context,state,actor,{creationReason:'scripted',originalMonsterType:null,initiallyHostile:false,sourceId:null,nativeStatsCopied:false},creationBuild(payload,{maxHp:actor.maxHp,strength:context.characterResources(actor.id).strength!}));
            state.created = true; state.revision = 1; state.identifiedKinds = context.knownKinds().map(kind => kind.id).sort();
            saveState(context,state);
        }, allocate(payload,context) { commitCharacterCommand('allocate',payload,context); },
        respec(payload,context) { commitCharacterCommand('respec',payload,context); },
        'learn-skill'(payload,context) { commitSkillCommand('learn-skill',payload,context); },
        'equip-skills'(payload,context) { commitSkillCommand('equip-skills',payload,context); },
        'use-skill'(payload,context) { commitSkillCommand('use-skill',payload,context); } },
        hooks: {
            objectiveTime({ticks,actorIds},context) {
                const state = getState(context); if (!state.created) return;
                const total = addGrowthIntegers(state.objectiveRemainder,ticks), blocks = Math.floor(total / config.focus.objectiveTicksPerBlock);
                state.objectiveRemainder = total % config.focus.objectiveTicksPerBlock;
                state.objectiveClock = addGrowthIntegers(state.objectiveClock,blocks); saveState(context,state);
                const participants = new Set(actorIds);
                for (const id of Object.keys(state.actors).map(Number)) {
                    if (!context.getComponent(id,'skill-build')) continue;
                    const build = skillBuild(context,id), effects = build.effects.filter(effect=>effect.expiresAt === null || effect.expiresAt > state.objectiveClock);
                    if (effects.length !== build.effects.length) put(context,id,'skill-build',{...build,effects});
                    if (effects.length !== build.effects.length || participants.has(id)) reconcileActor(context,id,participants.has(id) ? blocks : 0);
                }
            },
            committedAction({actorId,action},context) {
                // Defense is a separate action; this pack declares no defense interruption.
                if (action === 'parry') return;
                const build = skillBuild(context,actorId), interruption = action === 'throw' ? 'projectile' : action;
                const effects = build.effects.filter(instance=>!growthTimedDefinition(pack,instance)?.interruptions.includes(interruption));
                if (effects.length !== build.effects.length) {put(context,actorId,'skill-build',{...build,effects});reconcileActor(context,actorId);}
            },
            physicalResolved(fact,context) {
                for (const id of [...new Set([fact.attacker.id,fact.defender.id])]) {
                    const build = skillBuild(context,id), clock = getState(context).objectiveClock; let changed = false;
                    for (const instance of build.effects) {
                        if (instance.expiresAt !== null && instance.expiresAt <= clock) continue;
                        const effect = growthTimedDefinition(pack,instance); if (!effect) continue;
                        const consume = effect.consume.event === 'physical-probability-roll' ? id === fact.attacker.id && fact.probabilityRolled
                            : effect.consume.event === 'positive-direct-physical' && id === fact.defender.id && fact.positivePhysicalDamage
                                && (effect.consume.includesShieldAbsorbed || fact.hpLost > 0);
                        if (consume) {instance.remaining--;changed = true;}
                    }
                    if (changed) {build.effects = build.effects.filter(instance=>growthTimedDefinition(pack,instance)?.consume.event === 'none' || instance.remaining > 0);
                        put(context,id,'skill-build',build);reconcileActor(context,id);}
                }
            },
            creatureSpawned(event,context) {
                const actor = context.creature(event.creature.id); if (!actor) return;
                const state = getState(context); observe(state,actor);
                if (!actor.player) initialize(context,state,actor,event.birth ?? {creationReason:'scripted',originalMonsterType:actor.monsterId,initiallyHostile:actor.hostile,sourceId:null,nativeStatsCopied:false});
                saveState(context,state);
            },
            nativeMaximumReset({actor,preserveOverhealth},context) {
                const derived = component<GrowthDerived>(context,actor.id,'derived');
                if (!derived) return;
                context.commitResources(actor.id,{expectedHp:actor.hp,expectedMaxHp:actor.maxHp,
                    hp:preserveOverhealth ? actor.hp : Math.min(actor.hp,addGrowthIntegers(actor.maxHp,derived.appliedMaxHp)),
                    maxHp:addGrowthIntegers(actor.maxHp,derived.appliedMaxHp)});
            },
            actorObserved({actor},context) { const state = getState(context); observe(state,actor); saveState(context,state); },
            deathCaptured({actor,origin,administrative,rewardEligible},context) {
                if (actor.player || rewardEligible === false) return;
                const state = getState(context); state.pending.push({kind:'kill',actor:{...actor},origin,administrative}); saveState(context,state);
            },
            enteredLevel({depth,firstVisit,actorIds},context) {
                if (!firstVisit) return;
                const state = getState(context); state.pending.push({kind:'visit',depth,actorIds:[...(actorIds ?? [context.playerId])]}); saveState(context,state);
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
