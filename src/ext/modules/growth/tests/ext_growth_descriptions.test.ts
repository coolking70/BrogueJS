import { beforeAll, describe, expect, it } from 'vitest';
import i18next from 'i18next';
import baseZhCN from '../../../../locales/zh_CN.json';
import growthZhCN from '../locales/zh_CN.json';
const zhCN = { ...baseZhCN, ...growthZhCN };
import data from '../data/definitions.json';
import type { GrowthDefinitionPack, GrowthSkill } from '../types';
import { describeGrowthAttribute, describeGrowthSkill, describeGrowthEffects } from '../describe';
import { GROWTH_RULE_PORTS } from '../types';

beforeAll(async () => { await i18next.init({ lng: 'zh_CN', fallbackLng: false, resources: { zh_CN: { translation: zhCN } }, initImmediate: false }); });
const pack = () => structuredClone(data) as unknown as GrowthDefinitionPack;
describe('EXT-1d data-derived localized effect descriptions', () => {
    it('renders coefficient and cap directly and follows newly named attributes without ID cases', () => {
        const p = pack(), attribute = p.config.attributes.find(item => item.id.endsWith('.constitution'))!;
        expect(describeGrowthAttribute(p, attribute)[0]).toEqual('每点：最大生命 +3（单项上限 +24）');
        attribute.id = 'growth.attribute.unseen'; attribute.effects[0]!.magnitude.source = { kind: 'attribute', attributeId: attribute.id };
        attribute.effects[0]!.magnitude.coefficient = 7; attribute.effects[0]!.magnitude.max = 42;
        expect(describeGrowthAttribute(p, attribute)[0]).toEqual('每点：最大生命 +7（单项上限 +42）');
    });
    it('describes rounding, signed bounds, actor/target and probability conditions without numeric unit confusion', () => {
        const p = pack(), attribute = p.config.attributes.find(item => item.id.endsWith('.agility'))!;
        const lines = describeGrowthAttribute(p, attribute);
        expect(lines[0]).toContain('命中率 +1 个百分点（单项上限 +8 个百分点）');
        expect(lines[0]).toContain('作用对象：行动者'); expect(lines[0]).toContain('近战 / 投掷');
        expect(lines[1]).toContain('-0.5 个百分点'); expect(lines[1]).toContain('作用对象：目标');
        expect(lines).toContain('普通命中概率范围：5% 至 95%；原生必中、必失与保证命中的判定不变');
        expect(lines[2]).toContain('每 3 点：潜行被察觉距离 -1（单项上限 -2；向上取整）');
    });
    it('preserves declared rounding for fractional coefficients even with divisor one', () => {
        const p = pack(), attribute = p.config.attributes.find(item => item.id.endsWith('.constitution'))!;
        attribute.effects[0]!.magnitude.coefficient = 1.5; attribute.effects[0]!.magnitude.rounding = 'nearest';
        expect(describeGrowthAttribute(p, attribute)[0]).toEqual('每点：最大生命 +1.5（单项上限 +24；四舍五入）');
        attribute.effects[0]!.magnitude.rounding = 'floor';
        expect(describeGrowthAttribute(p, attribute)[0]).toContain('向下取整');
    });
    it('derives all twelve skill costs, cooldowns, actions, conditional effects and prerequisites', () => {
        const p = pack(), skills = p.definitions.filter((entry): entry is GrowthSkill => entry.kind === 'skill');
        expect(skills.filter(entry => entry.mode === 'active')).toHaveLength(6); expect(skills.filter(entry => entry.mode === 'passive')).toHaveLength(6);
        for (const skill of skills) {
            const before = structuredClone(skill), lines = describeGrowthSkill(p, skill);
            expect(lines[0]).toBe(`学习消耗：${skill.cost} 技能点`); expect(lines.join(' ')).not.toContain('可配置');
            expect(lines.some(line => line.startsWith('前置：'))).toBe(true); expect(skill).toEqual(before);
            if (skill.action) expect(lines[1]).toContain(`使用消耗：${skill.focusCost} 专注；冷却 ${skill.cooldown}`);
        }
        const brace = skills.find(skill => skill.action?.kind === 'wait')!, lines = describeGrowthSkill(p, brace);
        expect(lines.join(' ')).toContain('受到的物理伤害 -20%'); expect(lines.join(' ')).toContain('包含护盾全额吸收');
        brace.id = 'growth.skill.unseen'; brace.focusCost = 7; brace.cooldown = 14; brace.cost = 3;
        expect(describeGrowthSkill(p, brace).join(' ')).toContain('使用消耗：7 专注；冷却 14');
        expect(describeGrowthSkill(p, brace, 11).join(' ')).toContain('冷却 11');
    });
    it('keeps modifier bounds, shared budgets, final caps and cooldown ratio floors distinct under data changes', () => {
        const p = pack(), attribute = p.config.attributes.find(item => item.id.endsWith('.constitution'))!;
        p.config.rules.ports.maxHpBonus.globalClamp.max = 10;
        expect(describeGrowthAttribute(p, attribute)[0]).toContain('单项上限 +24');
        expect(describeGrowthAttribute(p, attribute)).toContain('最终最大生命加成范围：0 至 10');
        const budget = p.config.rules.budgets.find(item => item.id === p.config.rules.ports.maxHpBonus.budgetId)!;
        budget.max = 7;
        expect(describeGrowthAttribute(p, attribute)).toContain('共用加成额度（最大生命）：+0 至 +7');
        const physical = p.definitions.find((item): item is GrowthSkill => item.kind === 'skill' && item.action?.kind === 'attack')!;
        const lines = describeGrowthSkill(p, physical);
        expect(lines).toContain('共用加成额度（造成的物理伤害 / 受到的物理伤害）：-25% 至 +20%');
        expect(lines).toContain('造成的物理伤害原值大于 0 时最低为 1');
        p.config.rules.ports.cooldownDuration.minimumBaseRatio = 0.5;
        const will = p.config.attributes.find(item => item.effects.some(effect => effect.port === 'cooldownDuration'))!;
        expect(describeGrowthAttribute(p, will)).toContain('最终技能冷却时长不得低于基准值的 50%');
        expect(describeGrowthSkill(p, physical)).toContain('最终技能冷却时长不得低于基准值的 50%');
        p.config.focus.cap = 10;
        expect(describeGrowthAttribute(p, will)).toContain('最终专注上限范围：0 至 10');
        expect(describeGrowthAttribute(p, will)).not.toContain('最终专注上限范围：0 至 13');
    });
    it('has localized schema vocabulary for every rule port and supported multiplier/resource effect', () => {
        const p = pack(), effect = structuredClone(p.config.attributes[0]!.effects[0]!);
        for (const port of GROWTH_RULE_PORTS) {
            effect.port = port; expect(describeGrowthEffects(p, [effect]).join(' ')).not.toContain('ext.growth.');
        }
        effect.operation = 'multiply'; effect.magnitude = { source: { kind: 'constant' }, coefficient: 2, divisor: 1, rounding: 'floor', min: 2, max: 2 };
        expect(describeGrowthEffects(p, [effect]).join(' ')).toContain('×2');
        const resource = { kind: 'resource' as const, id: 'growth.effect.custom', resource: 'focus' as const, amount: 2,
            trigger: { kind: 'first-visit' as const, minDepth: 2, maxDepth: 10, receipt: 'depth' as const }, clamp: 'resource-bounds' as const };
        expect(describeGrowthEffects(p, [resource])[0]).toContain('首次到达深度 2–10：专注 +2');
    });
});
