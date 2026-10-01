import type { Json } from './types';
import { isJson, validId } from './json';

export interface ProgressionComponent { level: number; experience: number }
export interface AttributesComponent { might: number; agility: number; insight: number }
export interface ProfessionComponent { professionId: string; skillIds: string[] }
interface DefinitionBase { id: string; nameKey: string }
export interface ProfessionDefinition extends DefinitionBase { kind: 'profession'; startingSkills: string[]; attributeBonus: AttributesComponent }
export interface SkillDefinition extends DefinitionBase { kind: 'skill'; cost: number; effects: EffectDefinition[] }
export type EffectDefinition = { kind: 'message'; textKey: string } | { kind: 'component'; component: string; value: Json };
export interface NpcDefinition extends DefinitionBase { kind: 'npc'; enemyTemplateId: string; dialogueId: string; portrait?: string }
export interface DialogueDefinition extends DefinitionBase {
    kind: 'dialogue'; entry: string;
    nodes: { id: string; textKey: string; choices: { textKey: string; next: string | null; effects: EffectDefinition[] }[] }[];
}
export interface EnemyDefinition extends DefinitionBase {
    kind: 'enemy'; body: 'humanoid' | 'beast' | 'construct'; locomotion: 'ground' | 'water' | 'flying';
    footprint: { width: number; height: number };
    attributes: AttributesComponent; progression: ProgressionComponent; professionId?: string;
    ai: { behavior: 'hostile' | 'neutral' | 'ally'; traits: string[] };
    attacks: { id: string; power: number; afterEffects: EffectDefinition[] }[];
    skillIds: string[];
}
export type Definition = ProfessionDefinition | SkillDefinition | NpcDefinition | DialogueDefinition | EnemyDefinition;
export interface DefinitionPack { schema: 1; definitions: Definition[] }
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const integer = (value: unknown, min = 0): value is number => Number.isSafeInteger(value) && (value as number) >= min;
const ids = (value: unknown): value is string[] => Array.isArray(value) && value.every(validId) && new Set(value).size === value.length;
export function isProgression(value: unknown): value is ProgressionComponent {
    return object(value) && integer(value.level, 1) && integer(value.experience) && Object.keys(value).every(key => ['level', 'experience'].includes(key));
}
export function isAttributes(value: unknown): value is AttributesComponent {
    return object(value) && ['might', 'agility', 'insight'].every(key => integer(value[key])) && Object.keys(value).length === 3;
}
export function isProfession(value: unknown): value is ProfessionComponent { return object(value) && validId(value.professionId) && ids(value.skillIds) && Object.keys(value).length === 2; }
/** Pure validation; no eval, RNG, engine mutation or borrowed commercial data. */
export function validateDefinitionPack(value: unknown, hasText: (key: string) => boolean): asserts value is DefinitionPack {
    const fail = (reason: string): never => { throw new Error(`Invalid extension definitions: ${reason}`); };
    if (!isJson(value) || !object(value) || value.schema !== 1 || !Array.isArray(value.definitions)
        || Object.keys(value).some(key => !['schema', 'definitions'].includes(key))) fail('envelope');
    const pack = value as unknown as DefinitionPack;
    const catalog = new Map<string, Definition>();
    const text = (key: unknown): boolean => typeof key === 'string' && key.length > 0 && hasText(key);
    const effects = (list: unknown): boolean => Array.isArray(list) && list.every(effect => object(effect)
        && (effect.kind === 'message' ? text(effect.textKey) && Object.keys(effect).length === 2
            : effect.kind === 'component' && validId(effect.component) && isJson(effect.value) && Object.keys(effect).length === 3));
    for (const definition of pack.definitions) {
        if (!object(definition) || !validId(definition.id) || !text(definition.nameKey) || catalog.has(definition.id)) fail('identity/text/duplicate');
        catalog.set(definition.id, definition);
        let valid = false;
        const allowed = ['kind', 'id', 'nameKey'];
        switch (definition.kind) {
            case 'profession':
                allowed.push('startingSkills', 'attributeBonus');
                valid = ids(definition.startingSkills) && isAttributes(definition.attributeBonus); break;
            case 'skill':
                allowed.push('cost', 'effects'); valid = integer(definition.cost) && effects(definition.effects); break;
            case 'npc':
                allowed.push('enemyTemplateId', 'dialogueId', 'portrait');
                valid = validId(definition.enemyTemplateId) && validId(definition.dialogueId)
                    && (definition.portrait === undefined || /^art\/[a-z0-9/_-]+\.(png|webp)$/.test(definition.portrait)); break;
            case 'dialogue': {
                allowed.push('entry', 'nodes');
                valid = validId(definition.entry) && Array.isArray(definition.nodes) && definition.nodes.length > 0
                    && definition.nodes.every(node => object(node) && validId(node.id) && text(node.textKey)
                        && Array.isArray(node.choices) && node.choices.every(choice => object(choice) && text(choice.textKey)
                            && (choice.next === null || validId(choice.next)) && effects(choice.effects)));
                if (valid) {
                    const nodes = new Set(definition.nodes.map(node => node.id));
                    valid = nodes.size === definition.nodes.length && nodes.has(definition.entry)
                        && definition.nodes.every(node => node.choices.every(choice => choice.next === null || nodes.has(choice.next)));
                }
                break;
            }
            case 'enemy':
                allowed.push('body', 'locomotion', 'footprint', 'attributes', 'progression', 'professionId', 'ai', 'attacks', 'skillIds');
                valid = ['humanoid', 'beast', 'construct'].includes(definition.body) && ['ground', 'water', 'flying'].includes(definition.locomotion)
                    && object(definition.footprint) && integer(definition.footprint.width, 1) && integer(definition.footprint.height, 1)
                    && definition.footprint.width <= 3 && definition.footprint.height <= 3 && Object.keys(definition.footprint).length === 2
                    && isAttributes(definition.attributes) && isProgression(definition.progression)
                    && (definition.professionId === undefined || validId(definition.professionId))
                    && object(definition.ai) && ['hostile', 'neutral', 'ally'].includes(definition.ai.behavior) && ids(definition.ai.traits)
                    && ids(definition.skillIds) && Array.isArray(definition.attacks) && definition.attacks.every(attack => object(attack)
                        && validId(attack.id) && integer(attack.power) && effects(attack.afterEffects)); break;
        }
        if (!valid || Object.keys(definition).some(key => !allowed.includes(key))) fail(`shape: ${definition.id}`);
    }
    const reference = (id: string, kind: Definition['kind']): void => { if (catalog.get(id)?.kind !== kind) fail(`reference: ${id}`); };
    for (const definition of pack.definitions) {
        if (definition.kind === 'profession') definition.startingSkills.forEach(id => reference(id, 'skill'));
        if (definition.kind === 'npc') { reference(definition.enemyTemplateId, 'enemy'); reference(definition.dialogueId, 'dialogue'); }
        if (definition.kind === 'enemy') { definition.skillIds.forEach(id => reference(id, 'skill')); if (definition.professionId) reference(definition.professionId, 'profession'); }
    }
}
