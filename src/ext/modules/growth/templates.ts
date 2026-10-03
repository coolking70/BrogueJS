import type { DeepReadonly } from './definitions';
import type { GrowthDefinitionPack, GrowthTemplate } from './types';
import type { GrowthAttributes, GrowthProgression } from './components';
import { growthRuleActor, initialGrowthAttributes } from './attributes';
import { addGrowthIntegers, initialGrowthProgression } from './experience';
import { growthIdentityDefinitions, initialGrowthIdentityBuild, type GrowthIdentityBuild } from './identities';
import { canLearnGrowthSkill, growthSkillDefinition, inheritGrowthSkillBuild, initialGrowthSkillBuild, type GrowthSkillBuild } from './skills';

type Pack = DeepReadonly<GrowthDefinitionPack>;
export type GrowthActorBuild = {
    progression: GrowthProgression; attributes: GrowthAttributes; build: GrowthSkillBuild; identity: GrowthIdentityBuild;
};

/** Birth depth is observed once by the caller; neither moving nor loading selects a new template. */
export function selectGrowthMonsterTemplate(pack: Pack, depth: number): DeepReadonly<GrowthTemplate> | null {
    if (!Number.isSafeInteger(depth) || depth < 1) throw new RangeError('Invalid growth template depth');
    if (!pack.config.monsters.enabled) return null;
    let selected = pack.config.monsters.defaultTemplateId, priority = -1;
    for (const row of pack.config.monsters.depthTemplates) {
        if (depth < row.minDepth || depth > row.maxDepth || row.priority <= priority) continue;
        selected = row.templateId; priority = row.priority;
    }
    const template = pack.config.monsters.templates.find(template => template.id === selected);
    if (!template) throw new RangeError('Unknown growth template');
    return template;
}

/** A template describes the COMPLETE birth build, including identity-funded ranks and gifts.
 * It is actor-neutral: callers use the same result for a player or an NPC. Identity grants must
 * not be added again. Its starting points are explicit; future level grants are incremental. */
export function initializeGrowthTemplate(pack: Pack, template: DeepReadonly<GrowthTemplate>): GrowthActorBuild {
    const attributes = initialGrowthAttributes(pack), build = initialGrowthSkillBuild();
    for (const grant of template.attributes) attributes.values[grant.attributeId] = addGrowthIntegers(attributes.values[grant.attributeId]!, grant.amount);
    const identity: GrowthIdentityBuild = { ...initialGrowthIdentityBuild(), templateId: template.id,
        professionId: template.professionId, lineageId: template.lineageId, faithId: template.faithId };
    const gifts = new Set(growthIdentityDefinitions(pack, identity).flatMap(definition => definition.gifts.map(gift => gift.skillId)));
    build.learned = [...template.skills].sort(); build.inherited = [...build.learned];
    build.gifted = build.learned.filter(id => gifts.has(id));
    build.active = [...template.activeSlots]; build.passive = [...template.passiveSlots];
    return { progression: { level: template.level, experience: template.experience,
        attributePoints: template.unspentAttributePoints, skillPoints: template.unspentSkillPoints }, attributes, build, identity };
}

/** Native copied health/strength are reconciled separately by the runtime, exactly once.
 * progression enables FUTURE awards; clones are born at L1/XP0 and never receive birth grants.
 * Copying build/unspent points are independent switches. Transient effects are never inherited. */
export function initializeGrowthClone(pack: Pack, source?: DeepReadonly<GrowthActorBuild>): GrowthActorBuild {
    const progression = initialGrowthProgression(pack.config.levels), inherit = pack.config.monsters.clone.inheritBuild && !!source;
    const attributes = initialGrowthAttributes(pack, inherit ? source.attributes.values : undefined);
    const build = inherit ? inheritGrowthSkillBuild(source.build) : initialGrowthSkillBuild();
    const identity = inherit ? structuredClone(source.identity) as GrowthIdentityBuild : initialGrowthIdentityBuild();
    attributes.inheritedAttributePoints = pack.config.monsters.clone.inheritUnspentPoints ? source?.progression.attributePoints ?? 0 : 0;
    attributes.inheritedSkillPoints = pack.config.monsters.clone.inheritUnspentPoints ? source?.progression.skillPoints ?? 0 : 0;
    progression.attributePoints = attributes.inheritedAttributePoints; progression.skillPoints = attributes.inheritedSkillPoints;
    return { progression, attributes, build, identity };
}

function unique(values: readonly string[]): string[] { return [...new Set(values)]; }

/** Equal paid-rank counts form each round of the public priority cycle. This stateless cursor
 * survives save/load and split awards. Full rounds are batched, so editable safe-integer caps
 * cannot create a per-point loop. Capped, disabled or currently unaffordable choices are skipped. */
function allocateAttributes(pack: Pack, result: GrowthActorBuild, priorities: readonly string[]): void {
    const { attributes, progression } = result, config = pack.config;
    const candidates = priorities.flatMap((id, order) => {
        const definition = config.attributes.find(attribute => attribute.id === id);
        if (!definition || (id === config.strengthTraining.attributeId && !config.strengthTraining.enabled)) return [];
        const cap = id === config.strengthTraining.attributeId ? Math.min(definition.cap, config.strengthTraining.cap) : definition.cap;
        return [{ id, order, cap, cost: BigInt(definition.pointCost) }];
    });
    let points = BigInt(progression.attributePoints);
    let room = config.attributeTotalCap === null ? null : BigInt(config.attributeTotalCap)
        - Object.values(attributes.values).reduce((sum, rank) => sum + BigInt(rank), 0n);
    while (points > 0n && (room === null || room > 0n)) {
        const available = candidates.filter(candidate => attributes.values[candidate.id]! < candidate.cap && candidate.cost <= points)
            .sort((left, right) => attributes.allocated[left.id]! - attributes.allocated[right.id]! || left.order - right.order);
        if (!available.length) break;
        const first = available[0]!, minimum = attributes.allocated[first.id]!;
        const group = available.filter(candidate => attributes.allocated[candidate.id] === minimum);
        const cost = group.reduce((sum, candidate) => sum + candidate.cost, 0n);
        let rounds = points / cost;
        for (const candidate of group) rounds = rounds < BigInt(candidate.cap - attributes.values[candidate.id]!) ? rounds : BigInt(candidate.cap - attributes.values[candidate.id]!);
        const next = available.find(candidate => attributes.allocated[candidate.id]! > minimum);
        if (next) rounds = rounds < BigInt(attributes.allocated[next.id]! - minimum) ? rounds : BigInt(attributes.allocated[next.id]! - minimum);
        if (room !== null) rounds = rounds < room / BigInt(group.length) ? rounds : room / BigInt(group.length);
        const chosen = rounds > 0n ? group : [first], count = rounds > 0n ? rounds : 1n;
        for (const candidate of chosen) {
            const amount = Number(count);
            attributes.values[candidate.id] = addGrowthIntegers(attributes.values[candidate.id]!, amount);
            attributes.allocated[candidate.id] = addGrowthIntegers(attributes.allocated[candidate.id]!, amount);
            points -= candidate.cost * count;
            if (room !== null) room -= count;
        }
    }
    progression.attributePoints = Number(points);
}

/** Pure ally proposal: no resource restoration, cooldown changes, RNG, UI or active-skill AI.
 * Existing equipment is retained; the automatic learner buys only skills it can equip. */
export function autoAllocateGrowthAlly(pack: Pack, actorId: number, source: DeepReadonly<GrowthActorBuild>): GrowthActorBuild {
    const result = structuredClone(source) as GrowthActorBuild;
    if (!pack.config.monsters.alliesGrow || !source.identity.professionId) return result;
    const identities = growthIdentityDefinitions(pack, result.identity);
    if (!identities.some(identity => identity.kind === 'profession')) return result;
    const recommendations = unique(identities.flatMap(identity => identity.recommendedAttributes));
    allocateAttributes(pack, result, recommendations.length ? recommendations : pack.config.attributes.map(attribute => attribute.id));
    const priorities = unique([...identities.flatMap(identity => identity.recommendedSkills),
        ...pack.definitions.filter(definition => definition.kind === 'skill').map(definition => definition.id)]);
    const { progression, attributes, build, identity } = result, actor = growthRuleActor(actorId, progression, attributes);
    // First fill any free slots with already-known skills, preserving configured slot order.
    for (const id of priorities) {
        const skill = growthSkillDefinition(pack, id);
        if (skill && build.learned.includes(id) && !build[skill.mode].includes(id)
            && build[skill.mode].length < pack.config.skills[`${skill.mode}Slots`]) build[skill.mode].push(id);
    }
    // A later prerequisite may unlock an earlier recommendation; each pass must learn a new ID.
    let learned: boolean;
    do {
        learned = false;
        for (const id of priorities) {
            const skill = growthSkillDefinition(pack, id);
            if (!skill || skill.cost > progression.skillPoints || build[skill.mode].length >= pack.config.skills[`${skill.mode}Slots`]
                || !canLearnGrowthSkill(pack, skill, actor, build, { professionId: identity.professionId ?? undefined,
                    lineageId: identity.lineageId ?? undefined, faithId: identity.faithId ?? undefined })) continue;
            progression.skillPoints -= skill.cost; build.learned.push(id); build.learned.sort(); build[skill.mode].push(id); learned = true; break;
        }
    } while (learned);
    return result;
}
