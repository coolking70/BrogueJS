/** Data-only growth contract. No engine objects, executable expressions or balance constants. */
export const GROWTH_RULE_PORTS = [
    'hitChance', 'physicalDamage', 'receivedPhysicalDamage', 'stealthRange', 'searchStrength',
    'strengthBonus', 'maxHpBonus', 'focusCapacity', 'focusRecoveryInterval', 'cooldownDuration',
] as const;
export type GrowthRulePort = typeof GROWTH_RULE_PORTS[number];
export type GrowthRounding = 'floor' | 'ceil' | 'nearest' | 'truncate';
export type GrowthActionKind = 'attack' | 'move' | 'wait' | 'search';
export type GrowthLockMode = 'none' | 'soft' | 'hard';
export interface GrowthBounds { min: number; max: number }
export type GrowthScalarSource = { kind: 'constant' } | { kind: 'attribute'; attributeId: string } | { kind: 'level' };
/** clamp(round(source * coefficient / divisor), min, max); constant source is exactly 1. */
export interface GrowthMagnitude extends GrowthBounds {
    source: GrowthScalarSource; coefficient: number; divisor: number; rounding: GrowthRounding;
}
export type GrowthCondition =
    | { kind: 'attack-kind'; values: ('melee' | 'thrown' | 'bolt' | 'reprisal' | 'other')[] }
    | { kind: 'damage-kind'; values: ('physical' | 'fire' | 'poison' | 'other')[] }
    | { kind: 'role'; value: 'actor' | 'target' }
    | { kind: 'search-mode'; value: 'manual' | 'automatic' }
    | { kind: 'adjacent' | 'probability-roll' | 'hit' | 'positive-hp-damage' | 'direct-damage'; value: boolean }
    | { kind: 'tag'; tag: string };
export interface GrowthModifier {
    kind: 'modifier'; port: GrowthRulePort; operation: 'add' | 'multiply';
    /** null for add; declared multiplier slot ID for multiply. */
    slot: string | null; magnitude: GrowthMagnitude; conditions: GrowthCondition[];
}
/** Tag intensity adjusts the already-clamped magnitude, before the shared budget; duration tags precede duration.cap.
 * Cooldown tags adjust the declared base before cooldownDuration and its base-ratio floor. */
export interface GrowthTaggedModifier {
    kind: 'tagged-modifier'; tag: string; property: 'duration' | 'intensity' | 'cooldown';
    operation: 'add' | 'multiply'; slot: string | null; magnitude: GrowthMagnitude; conditions: GrowthCondition[];
}
export interface GrowthTimedEffect {
    kind: 'timed'; id: string; tags: string[]; recipient: 'self' | 'target';
    application: 'action-start' | 'action-result'; conditions: GrowthCondition[];
    duration: { kind: 'action' } | { kind: 'objective-blocks'; blocks: number; cap: number };
    modifiers: GrowthModifier[];
    consume: { event: 'none' | 'positive-direct-physical' | 'physical-probability-roll'; count: number;
        phase: 'per-resolution-commit'; includesShieldAbsorbed: boolean };
    interruptions: ('attack' | 'projectile' | 'cast' | 'move' | 'search' | 'wait')[];
}
export interface GrowthResourceEffect {
    kind: 'resource'; id: string; resource: 'focus' | 'hp'; amount: number;
    trigger: { kind: 'first-visit'; minDepth: number; maxDepth: number; receipt: 'depth' };
    clamp: 'resource-bounds';
}
export type GrowthEffect = GrowthModifier | GrowthTaggedModifier | GrowthTimedEffect | GrowthResourceEffect;
export type GrowthPrerequisite = { kind: 'level'; min: number } | { kind: 'attribute'; attributeId: string; min: number }
    | { kind: 'skill'; skillId: string } | { kind: 'profession'; professionId: string }
    | { kind: 'lineage'; lineageId: string } | { kind: 'faith'; faithId: string };
export interface GrowthNamed { id: string; nameKey: string; descriptionKey: string }
export interface GrowthAttribute extends GrowthNamed {
    min: number; cap: number; initial: number; pointCost: number; effects: GrowthModifier[];
}
export type GrowthAction =
    | { kind: 'attack'; target: 'adjacent-creature'; attackKind: 'melee'; time: 'native-attack' }
    | { kind: 'move'; target: 'adjacent-cell'; occupied: 'reject'; time: 'native-move' }
    | { kind: 'wait'; target: 'self'; time: 'native-wait' }
    | { kind: 'search'; target: 'self'; mode: 'manual'; time: 'native-search' };
export interface GrowthSkill extends GrowthNamed {
    kind: 'skill'; mode: 'active' | 'passive'; tags: string[]; cost: number; prerequisites: GrowthPrerequisite[];
    lock: { mode: GrowthLockMode; professionIds: string[]; lineageIds: string[]; faithIds: string[] };
    focusCost: number; cooldown: number; action: GrowthAction | null; effects: GrowthEffect[];
}
export interface GrowthAttributeGrant { attributeId: string; amount: number }
export interface GrowthIdentity extends GrowthNamed {
    kind: 'profession' | 'lineage' | 'faith'; attributes: GrowthAttributeGrant[];
    choices: { attributeIds: string[]; points: number; perAttributeCap: number }[];
    gifts: { skillId: string; waivePrerequisites: boolean }[];
    effects: GrowthEffect[]; oaths: { id: string; descriptionKey: string; effects: GrowthEffect[] }[];
    recommendedAttributes: string[]; recommendedSkills: string[];
}
export type GrowthDefinition = GrowthSkill | GrowthIdentity;
export type GrowthSchedule = { kind: 'periodic'; firstLevel: number; every: number; amount: number }
    | { kind: 'table'; grants: number[] };
/** Same-budget outgoing/received damage contributions aggregate together and scale the native value ONCE.
 * Multiplier slots run in declared list order, then globalClamp, then rounding. No last-writer wins. */
export interface GrowthRuleConfig {
    additiveMode: 'flat' | 'base-basis-points'; budgetId: string;
    multiplierSlots: { id: string; min: number; max: number }[];
    globalClamp: GrowthBounds; rounding: GrowthRounding; preserveZero: boolean;
    minimumPositive: number | null; minimumBaseRatio: number | null;
}
export interface GrowthTemplate extends GrowthNamed {
    level: number; experience: number; attributes: GrowthAttributeGrant[];
    professionId: string | null; lineageId: string | null; faithId: string | null;
    skills: string[]; activeSlots: string[]; passiveSlots: string[];
    unspentAttributePoints: number; unspentSkillPoints: number;
}
export interface GrowthDefinitionPack {
    schema: 1; moduleId: 'growth'; moduleVersion: string; rulesVersion: string;
    config: {
        experience: {
            sources: { kills: boolean; firstVisits: boolean; identification: boolean; story: boolean };
            kills: { base: number; perThreatRank: number; threatRank: GrowthBounds;
                eligibleCreationReasons: ('natural' | 'summoned' | 'split' | 'clone' | 'periodic' | 'scripted' | 'test')[];
                requireInitiallyHostile: boolean; requireHostileAtDeath: boolean;
                monsterQuotes: { monsterId: string; threatRank: number; amount: number | null }[] };
            firstVisits: { minDepth: number; maxDepth: number; base: number; perDepth: number; cap: number | null };
            identification: { perKind: number; totalCap: number; categories: string[] };
            story: { rewards: { id: string; amount: number; reasonKey: string }[] };
            allySplit: { playerBasisPoints: number; remainder: 'credited-actor'; rounding: GrowthRounding };
        };
        levels: {
            cap: number;
            experience: { kind: 'table'; cumulative: number[] } | { kind: 'curve'; base: number; linear: number; quadratic: number };
            attributePoints: GrowthSchedule; skillPoints: GrowthSchedule;
            maxHp: { grants: GrowthSchedule; cap: number };
            recovery: { levelHp: 'none' | 'increase' | 'full'; allocationHp: 'none' | 'increase' | 'full';
                levelFocus: 'none' | 'increase' | 'full'; allocationFocus: 'none' | 'increase' | 'full';
                clearCooldownOnLevel: boolean; clearCooldownOnAllocation: boolean; creationHp: 'native' | 'full' };
        };
        attributes: GrowthAttribute[];
        /** Sum of allocated attribute ranks, including identity grants; null means no combined cap. */
        attributeTotalCap: number | null;
        strengthTraining: { enabled: boolean; attributeId: string | null; pointCost: number; cap: number };
        respec: { enabled: boolean; cost: { resource: 'gold' | 'attribute-points' | 'skill-points' | 'focus'; amount: number };
            refundBasisPoints: number; clearCooldowns: boolean };
        /** Effective lock severity is min(global, per-skill), ordered none < soft < hard; soft is recommendation only. */
        skills: { activeSlots: number; passiveSlots: number; equipTime: 'native-wait' | 'none';
            lockMode: GrowthLockMode; prerequisites: 'all'; equipPreservesCooldowns: boolean; equipPreservesFocus: boolean };
        focus: { base: number; min: number; cap: number; recoveryAmount: number; recoveryInterval: number;
            objectiveTicksPerBlock: number; resetRemainderWhenFull: boolean };
        rules: { budgets: ({ id: string } & GrowthBounds)[]; ports: Record<GrowthRulePort, GrowthRuleConfig>;
            taggedProperties: Record<'duration' | 'intensity' | 'cooldown', GrowthRuleConfig>;
            order: ['add', 'multiply', 'global-clamp', 'round'];
            hitPrecedence: { guaranteedHit: 'preserve'; guaranteedMiss: 'preserve'; guaranteedRoll: 'preserve-roll' } };
        identities: { enabled: { professions: boolean; lineages: boolean; faiths: boolean };
            defaults: { professionId: string; lineageId: string; faithId: string };
            budgets: { profession: number; lineage: number; faith: number };
            giftLimits: { active: number; passive: number }; changeFaith: boolean };
        /** conversion is the native permanent gain multiplier under preserve (1 = unchanged),
         * or replacement output per use under replace; perItemCap/runCap limit that permanent output only. */
        itemGrowth: { rules: { itemId: string; nativeEffect: 'preserve' | 'replace';
            destination: 'strengthBonus' | 'maxHpBonus' | 'attribute-points' | 'skill-points' | 'enchantment';
            conversion: number; perItemCap: number | null; runCap: number | null }[] };
        monsters: { enabled: boolean; defaultTemplateId: string; alliesGrow: boolean;
            clone: { inheritBuild: boolean; inheritUnspentPoints: boolean; rewards: boolean; progression: boolean };
            templates: GrowthTemplate[]; depthTemplates: { minDepth: number; maxDepth: number; templateId: string; priority: number }[] };
    };
    definitions: GrowthDefinition[];
}
export interface GrowthPackIdentity { readonly schema: 1; readonly version: string; readonly fingerprint: string }

/** Ports are read-only snapshots: no live Creature/Game, callbacks, RNG, UI or mutation context. */
export interface GrowthRuleActor {
    readonly id: number; readonly level: number; readonly attributes: Readonly<Record<string, number>>;
}
export interface GrowthRuleInput {
    readonly actor: GrowthRuleActor; readonly target: GrowthRuleActor | null;
    readonly baseValue: number; readonly actionId: number; readonly resolutionId: number;
    readonly tags: readonly string[];
}
export interface GrowthHitInput extends GrowthRuleInput {
    readonly attackKind: 'melee' | 'thrown'; readonly adjacent: boolean;
    /** Both guaranteed variants bypass probability clamps; roll-guaranteed retains the native RNG draw. */
    readonly rollMode: 'skip-guaranteed-hit' | 'skip-guaranteed-miss' | 'roll-guaranteed' | 'roll-probability';
}
export interface GrowthDamageInput extends GrowthRuleInput {
    readonly attackKind: 'melee' | 'thrown'; readonly damageKind: 'physical'; readonly direct: boolean;
    readonly immune: boolean;
}
export interface GrowthStealthInput extends GrowthRuleInput { readonly nativeMinimum: number; readonly invisible: boolean }
export interface GrowthSearchInput extends GrowthRuleInput { readonly mode: 'manual' | 'automatic' }
export interface GrowthCooldownInput extends GrowthRuleInput { readonly skillId: string; readonly baseCooldown: number }
/** Implementations must return a finite synchronous scalar within the configured port bounds.
 * Evaluation is pure and cannot consume an effect. Adapters enforce this when 1b is implemented. */
export interface GrowthRulePolicies {
    hitChance(input: Readonly<GrowthHitInput>): number;
    physicalDamage(input: Readonly<GrowthDamageInput>): number;
    receivedPhysicalDamage(input: Readonly<GrowthDamageInput>): number;
    stealthRange(input: Readonly<GrowthStealthInput>): number;
    searchStrength(input: Readonly<GrowthSearchInput>): number;
    strengthBonus(input: Readonly<GrowthRuleInput>): number;
    maxHpBonus(input: Readonly<GrowthRuleInput>): number;
    focusCapacity(input: Readonly<GrowthRuleInput>): number;
    focusRecoveryInterval(input: Readonly<GrowthRuleInput>): number;
    cooldownDuration(input: Readonly<GrowthCooldownInput>): number;
}
export interface GrowthActionResult {
    readonly actionId: number; readonly resolutionId: number; readonly actorId: number; readonly targetId: number | null;
    readonly kind: GrowthActionKind; readonly committed: boolean; readonly hit: boolean;
    readonly hpLost: number; readonly positiveDirectPhysicalBeforeShield: boolean; readonly probabilityRollCommitted: boolean;
}
/** Emitted once after each eligible native resolution, before the next strike of a multi-hit action. */
export interface GrowthEffectConsumptionFact {
    readonly effectId: string; readonly actorId: number; readonly actionId: number; readonly resolutionId: number;
    readonly event: 'positive-direct-physical' | 'physical-probability-roll'; readonly consumedCount: number;
}
