import { describe, expect, it } from 'vitest';
import data from '../data/definitions.json';
import { parseGrowthDefinitionPack } from '../definitions';
import type { GrowthDefinitionPack, GrowthIdentity, GrowthSkill, GrowthTemplate } from '../types';
import { experienceThreshold, grantExperience } from '../experience';
import { growthDerived, growthRuleActor } from '../attributes';
import { createGrowthEffectInstance, growthLearnedCost, growthSkillDefinition, growthSkillScopes } from '../skills';
import { autoAllocateGrowthAlly, initializeGrowthClone, initializeGrowthTemplate, selectGrowthMonsterTemplate } from '../templates';
import { rng } from '../../../../engine/Random';

const con = 'growth.attribute.constitution', agi = 'growth.attribute.agility', will = 'growth.attribute.will', per = 'growth.attribute.perception';
const guard = 'growth.profession.guardian', scout = 'growth.profession.scout';
const close = 'growth.skill.close-guard', brace = 'growth.skill.brace';
const mutable = () => structuredClone(data) as unknown as GrowthDefinitionPack;
function parsed(change: (pack: GrowthDefinitionPack) => void = () => {}) {
    const pack = mutable(); change(pack);
    return parseGrowthDefinitionPack(pack, { moduleVersion: pack.moduleVersion, hasText: () => true });
}
function profession(pack: GrowthDefinitionPack, id = guard): GrowthIdentity {
    return pack.definitions.find(definition => definition.kind === 'profession' && definition.id === id) as GrowthIdentity;
}
function template(pack: GrowthDefinitionPack, id = 'growth.template.guard'): GrowthTemplate {
    return { ...structuredClone(pack.config.monsters.templates[0]!), id, professionId: guard };
}
function ally(pack: ReturnType<typeof parsed>) {
    return initializeGrowthTemplate(pack, { ...pack.config.monsters.templates[0]!, professionId: guard });
}
function addedSkill(pack: GrowthDefinitionPack, id: string, change: Partial<GrowthSkill> = {}): GrowthSkill {
    const skill = { ...structuredClone(pack.definitions.find(definition => definition.kind === 'skill' && definition.id === close) as GrowthSkill),
        id, prerequisites: [], cost: 1, ...change };
    pack.definitions.push(skill); return skill;
}

describe('EXT-1e pure monster templates and clone builds', () => {
    it('disables NPC templates independently of the data-driven default', () => {
        const pack = parsed(pack => { pack.config.monsters.enabled = false; });
        expect(selectGrowthMonsterTemplate(pack, 1)).toBeNull();
        // Explicit actor templates remain usable by the shared player/NPC initializer.
        expect(initializeGrowthTemplate(pack, pack.config.monsters.templates[0]!).progression.level).toBe(1);
    });
    it('rejects the reserved faith-change flag rather than accepting an inert gameplay switch', () => {
        expect(()=>parsed(pack=>{pack.config.identities.changeFaith=true;})).toThrow();
    });
    it('enforces combined gift limits in complete templates as in player identity selection', () => {
        const make=(duplicate:boolean)=>()=>parsed(pack=>{
            const human=pack.definitions.find(definition=>definition.id==='growth.lineage.human') as GrowthIdentity;
            human.gifts=(duplicate?[brace,close]:['growth.skill.hold-breath','growth.skill.careful-step']).map(skillId=>({skillId,waivePrerequisites:true}));
            const skills=[...new Set([brace,close,...human.gifts.map(gift=>gift.skillId)])];
            pack.config.monsters.templates.push({...template(pack),lineageId:human.id,skills});
        });
        expect(make(false)).toThrow();expect(make(true)).not.toThrow();
    });
    it('chooses the highest-priority matching inclusive depth interval regardless of row order', () => {
        const pack = parsed(pack => {
            pack.config.monsters.templates.push(template(pack, 'growth.template.wide'), template(pack, 'growth.template.deep'));
            pack.config.monsters.depthTemplates = [
                { minDepth: 5, maxDepth: 10, templateId: 'growth.template.deep', priority: 20 },
                { minDepth: 2, maxDepth: 20, templateId: 'growth.template.wide', priority: 1 },
            ];
        });
        expect([1, 2, 5, 10, 11, 20, 21].map(depth => selectGrowthMonsterTemplate(pack, depth)!.id))
            .toEqual(['neutral', 'wide', 'deep', 'deep', 'wide', 'wide', 'neutral'].map(id => `growth.template.${id}`));
        const shuffled = structuredClone(pack) as GrowthDefinitionPack; shuffled.config.monsters.depthTemplates.reverse();
        expect(selectGrowthMonsterTemplate(shuffled, 7)).toEqual(selectGrowthMonsterTemplate(pack, 7));
    });
    it('rejects ambiguous equal-priority ranges and invalid depths instead of consuming RNG', () => {
        expect(() => parsed(pack => {
            pack.config.monsters.depthTemplates = [1, 1].map(priority => ({ minDepth: 2, maxDepth: 5,
                templateId: pack.config.monsters.defaultTemplateId, priority }));
        })).toThrow();
        const pack = parsed(), before = rng.getState();
        for (const depth of [0, -1, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1]) expect(() => selectGrowthMonsterTemplate(pack, depth)).toThrow();
        expect(rng.getState()).toEqual(before);
    });
    it('instantiates complete template ranks, points and declared gifts exactly once for every actor', () => {
        const pack = parsed(pack => {
            const build = template(pack); build.level = 4; build.experience = experienceThreshold(pack.config.levels, 4);
            build.attributes = [{ attributeId: con, amount: 2 }]; build.skills = [close, brace];
            build.activeSlots = [brace]; build.passiveSlots = [close]; build.unspentAttributePoints = 3; build.unspentSkillPoints = 2;
            pack.config.monsters.templates.push(build);
        });
        const definition = pack.config.monsters.templates[1]!, before = structuredClone(pack), random = rng.getState();
        const player = initializeGrowthTemplate(pack, definition), npc = initializeGrowthTemplate(pack, definition);
        expect(npc).toEqual(player); expect(player.attributes.values[con]).toBe(2);
        expect(player.attributes.allocated[con]).toBe(0); expect(player.identity.templateId).toBe(definition.id);
        expect(player.progression).toEqual({ level: 4, experience: definition.experience, attributePoints: 3, skillPoints: 2 });
        expect(player.build.learned).toEqual([brace, close].sort()); expect(player.build.inherited).toEqual(player.build.learned);
        expect(player.build.gifted).toEqual(player.build.learned); expect(growthLearnedCost(pack, player.build)).toBe(0);
        expect(growthDerived(pack, growthRuleActor(71, player.progression, player.attributes), growthSkillScopes(pack, player.build)).appliedMaxHp).toBe(8);
        player.attributes.values[con] = 4; player.build.active.length = 0;
        expect(npc.attributes.values[con]).toBe(2); expect(npc.build.active).toEqual([brace]);
        expect(pack).toEqual(before); expect(rng.getState()).toEqual(random);
    });
    it('does not auto-add identity gifts omitted by a complete template or remap an existing build after travel', () => {
        const pack = parsed(pack => { pack.config.monsters.templates.push(template(pack));
            pack.config.monsters.depthTemplates = [{ minDepth: 2, maxDepth: 9, templateId: 'growth.template.guard', priority: 1 }]; });
        const actor = initializeGrowthTemplate(pack, selectGrowthMonsterTemplate(pack, 2)!);
        expect(actor.build.learned).toEqual([]); expect(actor.attributes.values[con]).toBe(0);
        expect(selectGrowthMonsterTemplate(pack, 10)!.id).toBe('growth.template.neutral');
        expect(actor.identity.templateId).toBe('growth.template.guard');
    });
    it('grants only crossed-level points after the explicit template starting balance', () => {
        const pack = parsed(pack => { const build = template(pack); build.level = 4; build.experience = experienceThreshold(pack.config.levels, 4);
            build.unspentAttributePoints = 1; build.unspentSkillPoints = 1; pack.config.monsters.templates.push(build); });
        const actor = initializeGrowthTemplate(pack, pack.config.monsters.templates[1]!);
        const leveled = grantExperience(pack.config.levels, actor.progression, experienceThreshold(pack.config.levels, 6) - actor.progression.experience);
        expect(leveled.progression).toEqual({ level: 6, experience: experienceThreshold(pack.config.levels, 6), attributePoints: 3, skillPoints: 2 });
    });
    it.each([false, true])('independently copies a build and clears live effects with unspent inheritance=%s', inheritUnspentPoints => {
        const pack = parsed(pack => { pack.config.monsters.clone.inheritUnspentPoints = inheritUnspentPoints; });
        const source = ally(pack); source.attributes.values[con] = 3; source.attributes.allocated[con] = 1;
        source.progression = { level: 8, experience: experienceThreshold(pack.config.levels, 8), attributePoints: 7, skillPoints: 5 };
        source.build.learned = [brace, close].sort(); source.build.gifted = [...source.build.learned]; source.build.passive = [close]; source.build.active = [brace];
        const skill = growthSkillDefinition(pack, brace)!, effect = skill.effects.find(effect => effect.kind === 'timed')!;
        if (effect.kind !== 'timed') throw new Error('Expected configured temporary effect');
        source.build.effects.push(createGrowthEffectInstance(pack, skill, effect, growthRuleActor(2, source.progression, source.attributes), source.build, 0, 1, 1));
        const before = structuredClone(source), result = initializeGrowthClone(pack, source);
        expect(result.progression).toEqual({ level: 1, experience: 0, attributePoints: inheritUnspentPoints ? 7 : 0, skillPoints: inheritUnspentPoints ? 5 : 0 });
        expect(result.attributes.values[con]).toBe(3); expect(result.attributes.allocated[con]).toBe(0);
        expect(result.attributes.inheritedAttributePoints).toBe(inheritUnspentPoints ? 7 : 0);
        expect(result.build.inherited).toEqual([brace, close].sort()); expect(result.build.passive).toEqual([close]); expect(result.build.effects).toEqual([]);
        expect(result.identity).toEqual(source.identity); result.identity.professionId = null; result.attributes.values[con] = 8;
        expect(source).toEqual(before);
    });
    it('copies unspent points without copying identity/build, and withholds configured L1 grants even without a source', () => {
        const pack = parsed(pack => { pack.config.monsters.clone.inheritBuild = false; pack.config.monsters.clone.inheritUnspentPoints = true;
            pack.config.levels.attributePoints = { kind: 'periodic', firstLevel: 1, every: 1, amount: 7 }; });
        const source = ally(pack); source.progression.attributePoints = 3; source.attributes.values[con] = 4;
        expect(initializeGrowthClone(pack, source).progression.attributePoints).toBe(3);
        expect(initializeGrowthClone(pack, source).attributes.values[con]).toBe(0);
        expect(initializeGrowthClone(pack, source).identity.professionId).toBeNull();
        expect(initializeGrowthClone(pack).progression.attributePoints).toBe(0);
    });
    it.each([false, true])('future clone progression=%s never copies source experience or double-grants identity ranks', progression => {
        const pack = parsed(pack => { pack.config.monsters.clone.progression = progression; });
        const source = ally(pack); source.attributes.values[con] = 2;
        source.progression = { level: 4, experience: experienceThreshold(pack.config.levels, 4), attributePoints: 0, skillPoints: 0 };
        const clone = initializeGrowthClone(pack, source), reclone = initializeGrowthClone(pack, clone);
        expect(clone).toEqual(reclone); expect(clone.progression.level).toBe(1); expect(clone.attributes.values[con]).toBe(2);
    });
});

describe('EXT-1e deterministic ally allocation', () => {
    it('retains budgets for neutral/no-profession actors and when allied growth is disabled', () => {
        const pack = parsed(), actor = initializeGrowthTemplate(pack, pack.config.monsters.templates[0]!);
        actor.progression.attributePoints = 5; actor.progression.skillPoints = 3;
        expect(autoAllocateGrowthAlly(pack, 2, actor)).toEqual(actor);
        actor.identity.professionId = guard;
        const disabled = parsed(pack => { pack.config.monsters.alliesGrow = false; });
        expect(autoAllocateGrowthAlly(disabled, 2, actor)).toEqual(actor);
    });
    it('cycles public recommendations across separate awards without spending or mutating any source twice', () => {
        const pack = parsed(), actor = ally(pack); actor.progression.attributePoints = 5;
        const before = structuredClone(actor), random = rng.getState(), result = autoAllocateGrowthAlly(pack, 2, actor);
        expect([con, agi, will, per].map(id => result.attributes.allocated[id])).toEqual([2, 1, 1, 1]);
        result.progression.attributePoints++;
        expect([con, agi, will, per].map(id => autoAllocateGrowthAlly(pack, 2, result).attributes.allocated[id])).toEqual([2, 2, 1, 1]);
        expect(actor).toEqual(before); expect(rng.getState()).toEqual(random);
    });
    it('produces the same cyclic build from one budget or one-point awards, skipping reached caps', () => {
        const pack = parsed(), actor = ally(pack); actor.progression.attributePoints = 35;
        const together = autoAllocateGrowthAlly(pack, 2, actor);
        let separate = ally(pack);
        for (let i = 0; i < 35; i++) { separate.progression.attributePoints++; separate = autoAllocateGrowthAlly(pack, 2, separate); }
        expect(together).toEqual(separate); expect(together.progression.attributePoints).toBe(3);
        expect([con, agi, will, per].map(id => together.attributes.allocated[id])).toEqual([8, 8, 8, 8]);
    });
    it('skips unaffordable and disabled recommendations, respects the total cap, and retains leftover points', () => {
        const pack = parsed(pack => {
            for (const identity of pack.definitions) if (identity.kind !== 'skill') { identity.attributes = []; identity.choices = []; }
            const def = profession(pack); def.recommendedAttributes = ['growth.attribute.strength-training', con, agi];
            pack.config.strengthTraining.enabled = false; pack.config.attributeTotalCap = 4;
            pack.config.attributes.find(attribute => attribute.id === con)!.pointCost = 3;
        });
        const actor = ally(pack); actor.attributes.values[con] = 2; actor.progression.attributePoints = 2;
        const result = autoAllocateGrowthAlly(pack, 2, actor);
        expect(result.attributes.values[con]).toBe(2); expect(result.attributes.values[agi]).toBe(2);
        expect(result.attributes.values['growth.attribute.strength-training']).toBe(0); expect(result.progression.attributePoints).toBe(0);
        result.progression.attributePoints = 10;
        expect(autoAllocateGrowthAlly(pack, 2, result).progression.attributePoints).toBe(10);
    });
    it('falls back to configured attribute order only for a profession with no recommendations', () => {
        const pack = parsed(pack => { profession(pack).recommendedAttributes = []; });
        const actor = ally(pack); actor.progression.attributePoints = 3;
        const result = autoAllocateGrowthAlly(pack, 2, actor);
        expect(result.attributes.allocated['growth.attribute.strength-training']).toBe(1);
        expect(result.progression.attributePoints).toBe(0);
    });
    it('batches huge editable integer caps and point balances without a per-point loop', () => {
        const pack = parsed(pack => {
            profession(pack).recommendedAttributes = [con]; pack.config.attributeTotalCap = null;
            const attribute = pack.config.attributes.find(attribute => attribute.id === con)!;
            attribute.cap = Number.MAX_SAFE_INTEGER; attribute.effects = [];
        });
        const actor = ally(pack); actor.progression.attributePoints = Number.MAX_SAFE_INTEGER;
        const result = autoAllocateGrowthAlly(pack, 2, actor);
        expect(result.attributes.values[con]).toBe(Number.MAX_SAFE_INTEGER); expect(result.progression.attributePoints).toBe(0);
    });
    it('matches a one-rank reference cycle across unequal costs, paid counts and cap boundaries', () => {
        const priorities = [con, agi, will, per];
        const pack = parsed(pack => {
            for (const identity of pack.definitions) if (identity.kind !== 'skill') { identity.attributes = []; identity.choices = []; }
            pack.config.attributeTotalCap = 15;
            pack.config.attributes.find(attribute => attribute.id === con)!.pointCost = 3;
        });
        for (let budget = 0; budget <= 40; budget++) {
            const actor = ally(pack); actor.progression.attributePoints = budget;
            for (const [index, id] of priorities.entries()) { actor.attributes.allocated[id] = index % 3; actor.attributes.values[id] = index % 3; }
            actor.attributes.values[con]!++; // A fixed template/inherited rank is not a paid-cycle turn.
            const reference = structuredClone(actor);
            while (Object.values(reference.attributes.values).reduce((sum, value) => sum + value, 0) < pack.config.attributeTotalCap!) {
                const candidate = priorities.map((id, order) => ({ id, order, definition: pack.config.attributes.find(attribute => attribute.id === id)! }))
                    .filter(({ id, definition }) => reference.attributes.values[id]! < definition.cap && definition.pointCost <= reference.progression.attributePoints)
                    .sort((left, right) => reference.attributes.allocated[left.id]! - reference.attributes.allocated[right.id]! || left.order - right.order)[0];
                if (!candidate) break;
                reference.attributes.values[candidate.id]!++; reference.attributes.allocated[candidate.id]!++;
                reference.progression.attributePoints -= candidate.definition.pointCost;
            }
            expect(autoAllocateGrowthAlly(pack, 2, actor)).toEqual(reference);
        }
    });
    it('fills already-known slots first and purchases prerequisites in later passes without replacing equipped skills', () => {
        const first = 'growth.skill.test-first', second = 'growth.skill.test-second';
        const pack = parsed(pack => {
            addedSkill(pack, first); addedSkill(pack, second, { prerequisites: [{ kind: 'skill', skillId: first }] });
            profession(pack).recommendedSkills = [second, first]; pack.config.skills.passiveSlots = 3; pack.config.skills.activeSlots = 0;
        });
        const actor = ally(pack); actor.build.learned = [close]; actor.build.inherited = [close]; actor.progression.skillPoints = 2;
        const result = autoAllocateGrowthAlly(pack, 2, actor);
        expect(result.build.passive).toEqual([close, first, second]);
        expect(result.build.learned).toEqual([close, first, second].sort()); expect(result.progression.skillPoints).toBe(0);
        expect(growthLearnedCost(pack, result.build)).toBe(2); expect(result.build.effects).toEqual([]);
    });
    it('respects skill costs, hard locks, attributes, levels and typed slot limits', () => {
        const locked = 'growth.skill.test-locked', pricey = 'growth.skill.test-pricey', level = 'growth.skill.test-level', attr = 'growth.skill.test-attr', allowed = 'growth.skill.test-allowed';
        const pack = parsed(pack => {
            addedSkill(pack, locked, { lock: { mode: 'hard', professionIds: [scout], lineageIds: [], faithIds: [] } });
            addedSkill(pack, pricey, { cost: 5 }); addedSkill(pack, level, { prerequisites: [{ kind: 'level', min: 2 }] });
            addedSkill(pack, attr, { prerequisites: [{ kind: 'attribute', attributeId: con, min: 2 }] }); addedSkill(pack, allowed);
            profession(pack).recommendedSkills = [locked, pricey, level, attr, allowed];
            pack.config.skills.lockMode = 'hard'; pack.config.skills.passiveSlots = 1; pack.config.skills.activeSlots = 0;
        });
        const actor = ally(pack); actor.progression.skillPoints = 2;
        const result = autoAllocateGrowthAlly(pack, 2, actor);
        expect(result.build.passive).toEqual([allowed]); expect(result.build.active).toEqual([]);
        expect(result.build.learned).toEqual([allowed]); expect(result.progression.skillPoints).toBe(1);
    });
    it('treats soft locks as recommendations and never spends on a skill with no free typed slot', () => {
        const custom = 'growth.skill.test-soft';
        const pack = parsed(pack => {
            addedSkill(pack, custom, { lock: { mode: 'hard', professionIds: [scout], lineageIds: [], faithIds: [] } });
            profession(pack).recommendedSkills = [custom]; pack.config.skills.passiveSlots = 1; pack.config.skills.activeSlots = 0;
        });
        const actor = ally(pack); actor.progression.skillPoints = 5;
        const result = autoAllocateGrowthAlly(pack, 2, actor);
        expect(result.build.passive).toEqual([custom]); expect(result.progression.skillPoints).toBe(4);
        expect(autoAllocateGrowthAlly(pack, 2, result)).toEqual(result);
    });
});
