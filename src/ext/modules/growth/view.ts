import type { Game } from '../../../engine/Core/Game';
import type { DeepReadonly } from './definitions';
import type { GrowthAttributes, GrowthDerived, GrowthFocus, GrowthProgression, GrowthSkills } from './components';
import type { GrowthCondition, GrowthDefinitionPack, GrowthIdentity, GrowthPrerequisite, GrowthRuleActor, GrowthRulePort, GrowthSkill } from './types';
import { allocateGrowthAttributes, growthDerived, growthFocusCapacity, growthFocusInterval, growthRuleActor, growthScalarInput,
    respecGrowthAttributes, type GrowthPack } from './attributes';
import { addGrowthIntegers, automaticMaxHpBonus, experienceThreshold, reconcileGrowthMaximum, reconcileGrowthResources } from './experience';
import { evaluateGrowthPort, meetsGrowthPrerequisites, type GrowthEvaluationFacts, type GrowthEvaluationInput } from './evaluator';
import { canonical } from '../../json';

export interface GrowthAllocationDraft {
    /** Opaque, session-local identity. A load, replay seek or new game invalidates the old draft. */
    readonly session: object;
    readonly revision: number;
    attributes: Record<string, number>;
}
export interface GrowthValuePreview { readonly current: number; readonly preview: number; readonly delta: number }
export interface GrowthResourcePreview {
    readonly hp: GrowthValuePreview; readonly maxHp: GrowthValuePreview; readonly strength: GrowthValuePreview;
    readonly focus: GrowthValuePreview; readonly focusCapacity: GrowthValuePreview;
}
export interface GrowthAttributeView {
    readonly id: string; readonly nameKey: string; readonly descriptionKey: string;
    readonly value: number; readonly allocated: number; readonly increment: number; readonly preview: number;
    readonly pointCost: number; readonly cap: number; readonly enabled: boolean;
    readonly canIncrease: boolean; readonly canDecrease: boolean;
}
export type GrowthPrerequisiteView = DeepReadonly<GrowthPrerequisite> & { readonly nameKey: string; readonly met: boolean; readonly min?: number };
export type GrowthSkillView = Omit<DeepReadonly<GrowthSkill>, 'prerequisites'> & {
    readonly prerequisites: readonly GrowthPrerequisiteView[];
    readonly prerequisitesMet: boolean; readonly affordable: boolean; readonly available: false; readonly futurePhase: '1d';
    readonly learned: false; readonly equipped: false; readonly effectiveLockMode: 'none' | 'soft' | 'hard';
    readonly adjustedCooldown: GrowthValuePreview;
};
export interface GrowthIdentityGroupView {
    readonly kind: GrowthIdentity['kind']; readonly nameKey: string; readonly enabled: boolean;
    readonly selectedId: null; readonly available: false; readonly futurePhase: '1e';
    readonly definitions: readonly DeepReadonly<GrowthIdentity>[];
}
export interface GrowthPortPreview extends GrowthValuePreview {
    readonly port: GrowthRulePort; readonly nameKey: string; readonly baseValue: number;
    readonly contextKey: string; readonly facts: GrowthEvaluationFacts;
    /** These are illustrative known inputs, never hidden enemy facts or a claim about the current attack. */
    readonly reference: boolean; readonly conditions: readonly DeepReadonly<GrowthCondition>[];
    readonly subject: 'actor' | 'target';
}
export interface GrowthCharacterViewModel {
    readonly session: object; readonly revision: number; readonly created: boolean; readonly readOnly: boolean;
    readonly disabledReason: 'replay' | 'unavailable' | 'creation-required' | null;
    readonly level: number; readonly levelCap: number; readonly experience: number;
    readonly experienceInLevel: number; readonly experienceToNext: number | null; readonly atLevelCap: boolean;
    readonly attributePoints: number; readonly skillPoints: number; readonly hasUnspentPoints: boolean;
    readonly focus: { readonly current: number; readonly capacity: number };
    readonly attributes: readonly GrowthAttributeView[];
    readonly draft: { readonly valid: boolean; readonly stale: boolean; readonly changed: boolean; readonly cost: number;
        readonly remainingPoints: number; readonly errorKey: string | null };
    readonly preview: GrowthResourcePreview & { readonly ports: readonly GrowthPortPreview[] };
    readonly recovery: { readonly hp: 'none' | 'increase' | 'full'; readonly focus: 'none' | 'increase' | 'full'; readonly clearCooldowns: boolean };
    readonly skills: readonly GrowthSkillView[];
    readonly slots: readonly { readonly mode: 'active' | 'passive'; readonly count: number; readonly available: false; readonly futurePhase: '1d' }[];
    readonly identities: readonly GrowthIdentityGroupView[];
    readonly respec: { readonly enabled: boolean; readonly available: boolean;
        readonly cost: DeepReadonly<GrowthDefinitionPack['config']['respec']['cost']>;
        readonly refundBasisPoints: number; readonly refund: number; readonly clearCooldowns: boolean; readonly preview: GrowthResourcePreview | null };
    /** Exact proposal only; submission must still revalidate against the current session. */
    readonly allocation: { readonly revision: number; readonly attributes: Readonly<Record<string, number>> };
}
interface CharacterInput {
    pack: GrowthPack; session: object; revision: number; created: boolean; playerId: number;
    canManage: boolean; replay: boolean; progression: GrowthProgression; attributes: GrowthAttributes;
    derived: GrowthDerived; focus: GrowthFocus; skills: GrowthSkills;
    hp: number; maxHp: number; strength: number; effectiveStrength: number; gold: number;
}
function freeze<T>(value: T): T {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.values(value).forEach(freeze); Object.freeze(value);
    }
    return value;
}
const delta = (current: number, preview: number): GrowthValuePreview => ({ current, preview, delta: preview - current });
const errorKey = (reason: string): string => `ext.growth.view.error.${reason}`;

/** Same pure attribute/resource proposals as the command, with no capabilities or live component aliases. */
function plan(input: CharacterInput, action: 'allocate' | 'respec', increments: unknown) {
    const { pack, progression, attributes: prior, derived: oldDerived, focus, skills } = input, config = pack.config;
    const oldActor = growthRuleActor(input.playerId, progression, prior);
    let attributes: GrowthAttributes, cost = 0, refund = 0, nextPoints = progression.attributePoints;
    if (action === 'allocate') {
        const proposal = allocateGrowthAttributes(pack, prior, progression.attributePoints, increments);
        attributes = proposal.attributes; cost = proposal.cost; nextPoints -= cost;
    } else {
        if (!config.respec.enabled) throw new RangeError('Disabled respec');
        const proposal = respecGrowthAttributes(pack, prior);
        attributes = proposal.attributes; refund = proposal.refund; nextPoints = addGrowthIntegers(nextPoints, refund);
        const fee = config.respec.cost;
        if ((fee.resource === 'gold' && input.gold < fee.amount)
            || (fee.resource === 'skill-points' && progression.skillPoints < fee.amount)
            || (fee.resource === 'focus' && focus.current < fee.amount)) throw new RangeError('Insufficient respec resource');
        if (fee.resource === 'attribute-points') {
            if (nextPoints < fee.amount) throw new RangeError('Insufficient respec points');
            nextPoints -= fee.amount;
            addGrowthIntegers(attributes.attributePointsSpent, fee.amount);
        } else if (fee.resource === 'skill-points') addGrowthIntegers(attributes.skillPointsSpent, fee.amount);
    }
    const nextActor = growthRuleActor(input.playerId, progression, attributes), derived = growthDerived(pack, nextActor);
    const maxHp = reconcileGrowthMaximum(input.maxHp, oldDerived.appliedMaxHp, derived.appliedMaxHp);
    const strength = reconcileGrowthMaximum(input.strength, oldDerived.appliedStrength, derived.appliedStrength);
    const capacity = growthFocusCapacity(pack, nextActor);
    const resources = action === 'allocate' ? reconcileGrowthResources(config.levels, config.focus, 'allocation', {
        hp: input.hp, maxHp: input.maxHp, nextMaxHp: maxHp, focus, focusCapacity: growthFocusCapacity(pack, oldActor),
        nextFocusCapacity: capacity, skills,
    }) : { hp: Math.min(input.hp, maxHp), focus: { ...focus, current: Math.min(focus.current, capacity) } };
    if (action === 'respec' && config.respec.cost.resource === 'focus')
        resources.focus.current = Math.min(focus.current - config.respec.cost.amount, capacity);
    if (resources.focus.remainder >= growthFocusInterval(pack, nextActor)) throw new RangeError('Invalid recovery remainder');
    addGrowthIntegers(input.revision, 1);
    return { attributes, nextActor, cost, refund, remainingPoints: nextPoints, maxHp, strength, hp: resources.hp, focus: resources.focus.current, capacity };
}
function prerequisiteName(prerequisite: DeepReadonly<GrowthPrerequisite>, pack: GrowthPack): string {
    if (prerequisite.kind === 'level') return 'ext.growth.view.level';
    const id = prerequisite.kind === 'attribute' ? prerequisite.attributeId : prerequisite.kind === 'skill' ? prerequisite.skillId
        : prerequisite.kind === 'profession' ? prerequisite.professionId : prerequisite.kind === 'lineage' ? prerequisite.lineageId : prerequisite.faithId;
    return [...pack.config.attributes, ...pack.definitions].find(definition => definition.id === id)!.nameKey;
}
/** Enumerate known condition examples from the data instead of branching on any attribute or skill ID. */
function examples(conditions: readonly DeepReadonly<GrowthCondition>[]): GrowthEvaluationFacts[] {
    let result: GrowthEvaluationFacts[] = [{}];
    for (const condition of conditions) {
        if (condition.kind === 'attack-kind') result = result.flatMap(facts => condition.values.map(attackKind => ({ ...facts, attackKind })));
        else if (condition.kind === 'damage-kind') result = result.flatMap(facts => condition.values.map(damageKind => ({ ...facts, damageKind })));
        else result = result.map(facts => {
            switch (condition.kind) {
                case 'role': return { ...facts, role: condition.value };
                case 'search-mode': return { ...facts, searchMode: condition.value };
                case 'adjacent': return { ...facts, adjacent: condition.value };
                case 'probability-roll': return { ...facts, probabilityRoll: condition.value };
                case 'hit': return { ...facts, hit: condition.value };
                case 'positive-hp-damage': return { ...facts, hpLost: condition.value ? 1 : 0 };
                case 'direct-damage': return { ...facts, directDamage: condition.value };
                case 'tag': return { ...facts, tags: [...(facts.tags ?? []), condition.tag] };
            }
        });
    }
    return result;
}
function previewPorts(pack: GrowthPack, actor: GrowthRuleActor, nextActor: GrowthRuleActor): GrowthPortPreview[] {
    const rows: GrowthPortPreview[] = [], seen = new Set<string>();
    const neutral: GrowthRuleActor = { id: 0, level: 1, attributes: Object.fromEntries(pack.config.attributes.map(attribute => [attribute.id, 0])) };
    for (const modifier of pack.config.attributes.flatMap(attribute => attribute.effects)) for (const facts of examples(modifier.conditions)) {
        const port = modifier.port, subject = facts.role ?? (port === 'receivedPhysicalDamage' ? 'target' : 'actor');
        const key = canonical({ port, subject, facts }); if (seen.has(key)) continue; seen.add(key);
        // Explicit examples for contextual ports, as opposed to pretending to read a hidden target or native solver.
        const reference = ['hitChance', 'physicalDamage', 'receivedPhysicalDamage', 'stealthRange', 'searchStrength', 'cooldownDuration'].includes(port);
        const baseValue = port === 'hitChance' ? facts.probabilityRoll === false ? 10000 : 5000 : port === 'physicalDamage' || port === 'receivedPhysicalDamage' || port === 'searchStrength' ? 100
            : port === 'stealthRange' || port === 'cooldownDuration' ? 10 : port === 'maxHpBonus' ? automaticMaxHpBonus(pack.config.levels, actor.level)
            : port === 'focusCapacity' ? pack.config.focus.base : port === 'focusRecoveryInterval' ? pack.config.focus.recoveryInterval : 0;
        const value = (owner: GrowthRuleActor): number => {
            const input: GrowthEvaluationInput = { ...growthScalarInput(subject === 'actor' ? owner : neutral, baseValue),
                target: subject === 'target' ? owner : null, baseCooldown: baseValue,
                ...(port === 'hitChance' ? { rollMode: facts.probabilityRoll === false ? 'roll-guaranteed' : 'roll-probability' } : {}) };
            return evaluateGrowthPort(pack, port, input, [], facts);
        };
        rows.push({ port, nameKey: `ext.growth.view.port.${port}`, baseValue, contextKey: key, facts, reference, conditions: modifier.conditions,
            subject, ...delta(value(actor), value(nextActor)) });
    }
    return rows;
}

/** No world snapshot, rule dispatch, RNG, serialization checkpoint, or mutable module context is used here. */
export function readGrowthCharacterView(game: Game | null | undefined, draft?: GrowthAllocationDraft | null): GrowthCharacterViewModel | null {
    const runtime = game?.extensionRuntime;
    if (!runtime || !game?.player) return null;
    const source = runtime.readModuleView('growth');
    if (!source || source.playerId !== game.player.id) return null;
    const components = source.components;
    if (!components.progression || !components.attributes || !components.derived || !components.focus || !components.skills) return null;
    const pack = source.definitions as unknown as GrowthPack;
    const input: CharacterInput = { pack, session: source.session, revision: source.state.revision as number,
        created: source.state.created === true, playerId: source.playerId, canManage: source.canManageCharacter,
        replay: !!game.replayRecording, progression: components.progression as unknown as GrowthProgression,
        attributes: components.attributes as unknown as GrowthAttributes, derived: components.derived as unknown as GrowthDerived,
        focus: components.focus as unknown as GrowthFocus, skills: components.skills as unknown as GrowthSkills,
        hp: game.player.hp, maxHp: game.player.maxHp, strength: game.player.strength, effectiveStrength: game.player.effectiveStrength, gold: game.stats.gold };
    const { progression, attributes } = input, config = pack.config;
    const disabledReason = input.replay ? 'replay' : !input.created ? 'creation-required' : !input.canManage || input.hp <= 0 ? 'unavailable' : null;
    const readOnly = disabledReason !== null;
    const stale = !!draft && (draft.session !== input.session || draft.revision !== input.revision);
    const increments = draft?.attributes ? { ...draft.attributes } : {};
    const changed = Object.values(increments).some(value => value !== 0);
    let proposal: ReturnType<typeof plan> | null = null, problem: string | null = null;
    if (stale) problem = errorKey('stale');
    else if (changed) { try { proposal = plan(input, 'allocate', increments); } catch { problem = errorKey('invalid'); } }
    else if (Object.entries(increments).some(([id, amount]) => !config.attributes.some(attribute => attribute.id === id) || amount !== 0)) problem = errorKey('invalid');
    else problem = errorKey('empty');
    if (readOnly && !stale) problem = errorKey(disabledReason === 'creation-required' ? 'creation_required' : disabledReason!);
    const actor = growthRuleActor(input.playerId, progression, attributes), nextActor = proposal?.nextActor ?? actor;
    const facts = { level: progression.level, attributes: nextActor.attributes, skills: [] as string[], professionId: null, lineageId: null, faithId: null };
    const attributeRows: GrowthAttributeView[] = config.attributes.map(definition => {
        const training = definition.id === config.strengthTraining.attributeId;
        const enabled = !training || config.strengthTraining.enabled;
        const cap = training ? Math.min(definition.cap, config.strengthTraining.cap) : definition.cap;
        const increment = increments[definition.id] ?? 0;
        let canIncrease = false;
        if (!readOnly && !stale && enabled && (proposal || !changed)) {
            try { plan(input, 'allocate', { ...increments, [definition.id]: increment + 1 }); canIncrease = true; } catch { /* Unaffordable or capped. */ }
        }
        return { id: definition.id, nameKey: definition.nameKey, descriptionKey: definition.descriptionKey,
            value: attributes.values[definition.id]!, allocated: attributes.allocated[definition.id]!, increment,
            preview: nextActor.attributes[definition.id]!, pointCost: definition.pointCost, cap, enabled,
            canIncrease, canDecrease: !readOnly && !stale && Number.isSafeInteger(increment) && increment > 0 };
    });
    const skills: GrowthSkillView[] = pack.definitions.filter((definition): definition is DeepReadonly<GrowthSkill> => definition.kind === 'skill').map(definition => {
        const modes = ['none', 'soft', 'hard'] as const;
        const effectiveLockMode = modes[Math.min(modes.indexOf(config.skills.lockMode), modes.indexOf(definition.lock.mode))]!;
        const cooldown = (owner: GrowthRuleActor) => evaluateGrowthPort(pack, 'cooldownDuration', { ...growthScalarInput(owner, definition.cooldown), baseCooldown: definition.cooldown });
        return { ...definition, prerequisites: definition.prerequisites.map(requirement => ({ ...requirement,
            nameKey: prerequisiteName(requirement, pack), met: meetsGrowthPrerequisites([requirement], facts) })),
            prerequisitesMet: meetsGrowthPrerequisites(definition.prerequisites, facts), affordable: progression.skillPoints >= definition.cost,
            available: false, futurePhase: '1d', learned: false, equipped: false, effectiveLockMode,
            adjustedCooldown: delta(cooldown(actor), cooldown(nextActor)) };
    });
    const slots = Object.entries(config.skills).filter(([key]) => key.endsWith('Slots')).map(([key, count]) => ({
        mode: key.slice(0, -5) as 'active' | 'passive', count: count as number, available: false as const, futurePhase: '1d' as const,
    }));
    const identities: GrowthIdentityGroupView[] = Object.entries(config.identities.enabled).map(([key, enabled]) => {
        const kind = key.slice(0, -1) as GrowthIdentity['kind'];
        return { kind, nameKey: `ext.growth.view.identity.${kind}`, enabled, selectedId: null, available: false, futurePhase: '1e',
            definitions: pack.definitions.filter((definition): definition is DeepReadonly<GrowthIdentity> => definition.kind === kind) };
    });
    let respecProposal: ReturnType<typeof plan> | null = null;
    try { respecProposal = plan(input, 'respec', {}); } catch { /* Disabled or unaffordable. */ }
    const respecAvailable = !!respecProposal && !readOnly && !stale;
    const refund = respecGrowthAttributes(pack, attributes).refund;
    const atLevelCap = progression.level === config.levels.cap;
    const threshold = experienceThreshold(config.levels, progression.level);
    const capacity = growthFocusCapacity(pack, actor);
    const resources = (planned: ReturnType<typeof plan> | null): GrowthResourcePreview => ({
        hp: delta(input.hp, planned?.hp ?? input.hp), maxHp: delta(input.maxHp, planned?.maxHp ?? input.maxHp),
        strength: delta(input.effectiveStrength, input.effectiveStrength + (planned ? planned.strength - input.strength : 0)),
        focus: delta(input.focus.current, planned?.focus ?? input.focus.current), focusCapacity: delta(capacity, planned?.capacity ?? capacity),
    });
    return freeze({ session: input.session, revision: input.revision, created: input.created, readOnly, disabledReason,
        level: progression.level, levelCap: config.levels.cap, experience: progression.experience,
        experienceInLevel: progression.experience - threshold,
        experienceToNext: atLevelCap ? null : experienceThreshold(config.levels, progression.level + 1) - threshold, atLevelCap,
        attributePoints: progression.attributePoints, skillPoints: progression.skillPoints,
        hasUnspentPoints: progression.attributePoints > 0 || progression.skillPoints > 0,
        focus: { current: input.focus.current, capacity }, attributes: attributeRows,
        draft: { valid: !!proposal && !readOnly && !stale, stale, changed, cost: proposal?.cost ?? 0,
            remainingPoints: proposal?.remainingPoints ?? progression.attributePoints, errorKey: problem },
        preview: { ...resources(proposal), ports: previewPorts(pack, actor, nextActor) },
        recovery: { hp: config.levels.recovery.allocationHp, focus: config.levels.recovery.allocationFocus,
            clearCooldowns: config.levels.recovery.clearCooldownOnAllocation }, skills, slots, identities,
        respec: { enabled: config.respec.enabled, available: respecAvailable, cost: config.respec.cost,
            refundBasisPoints: config.respec.refundBasisPoints, refund, clearCooldowns: config.respec.clearCooldowns,
            preview: respecProposal ? resources(respecProposal) : null },
        allocation: { revision: draft?.revision ?? input.revision, attributes: increments } });
}
export function createGrowthAllocationDraft(view: GrowthCharacterViewModel): GrowthAllocationDraft {
    return { session: view.session, revision: view.revision, attributes: {} };
}
/** Builds only the exact supported payload. The caller sends it through the normal game command boundary. */
export function buildGrowthAllocateCommand(view: GrowthCharacterViewModel, game: Game | null | undefined): string | null {
    if (!view.draft.valid) return null;
    const current = readGrowthCharacterView(game, { session: view.session, revision: view.allocation.revision, attributes: { ...view.allocation.attributes } });
    if (!current?.draft.valid || current.session !== view.session || current.revision !== view.revision) return null;
    return JSON.stringify({ module: 'growth', action: 'allocate', payload: current.allocation });
}
export function buildGrowthRespecCommand(view: GrowthCharacterViewModel, game: Game | null | undefined): string | null {
    if (!view.respec.available) return null;
    const current = readGrowthCharacterView(game);
    if (!current?.respec.available || current.session !== view.session || current.revision !== view.revision) return null;
    return JSON.stringify({ module: 'growth', action: 'respec', payload: { revision: view.revision } });
}
