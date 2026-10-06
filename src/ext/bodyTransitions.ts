import { isJson, validId } from './json';
import type { NativeFormDefinition } from './nativeForms';
import type { BodyDefinition } from '../engine/Movement/SpatialSchema';

/** Finite declarations only. No script, callback, random quantity or implicit
 * part matching. Regeneration and mirrors are deliberately not in this union. */
export interface BodyTransitionResult {
    readonly formId: string;
    readonly memberMap: readonly { from: string; to: string }[];
}
export interface BodyTransitionRequest {
    readonly sourceGroupId: number;
    readonly reason: 'phase' | 'split' | 'clone' | 'summon' | 'polymorph';
    readonly results: readonly BodyTransitionResult[];
    readonly hp: 'ratio' | 'injury' | 'conserve' | 'current' | 'polymorph';
    readonly statuses: 'preserve' | 'clear';
    readonly relationships: 'preserve' | 'clear' | 'native-polymorph';
    readonly placement: 'nearest' | 'random-nearest';
}
export interface ActiveBodyTransition {
    readonly id: string;
    readonly sourceFormId: string;
    readonly condition: { readonly kind: 'hp-at-most'; readonly numerator: number; readonly denominator: number };
    readonly ticks: number;
    /** Native HP fee, paid once even if the complete result has no landing. */
    readonly hpCost: number;
    readonly transition: Omit<BodyTransitionRequest, 'sourceGroupId' | 'reason' | 'hp' | 'relationships'> & {
        readonly reason: 'phase' | 'split' | 'clone' | 'summon';
        readonly hp: 'ratio' | 'injury' | 'conserve' | 'current';
        readonly relationships: 'preserve' | 'clear';
    };
}
export interface BodyTransitionFact {
    readonly sourceGroupId: number;
    readonly reason: BodyTransitionRequest['reason'];
    readonly moveId: string | null;
    readonly outcome: 'applied' | 'no-space' | 'budget';
    readonly resultGroupIds: readonly number[];
    readonly retiredIds: readonly number[];
}
const keys = (v: object, expected: string[]) => Object.keys(v).sort().join(',') === expected.sort().join(',');
const integer = (n: unknown, min: number, max: number) => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
export function validActiveBodyTransitions(value: unknown, owner: string,
    forms: readonly NativeFormDefinition[], bodies: readonly BodyDefinition[]): value is readonly ActiveBodyTransition[] {
    if (!isJson(value) || !Array.isArray(value) || !value.length || value.length > 16) return false;
    const ids = new Set<string>();
    for (const raw of value) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)
            || !keys(raw, ['id','sourceFormId','condition','ticks','hpCost','transition'])) return false;
        const d = raw as unknown as ActiveBodyTransition, c = d.condition, t = d.transition;
        if (!validId(d.id) || !d.id.startsWith(`${owner}.`) || ids.has(d.id) || !forms.some(f => f.id === d.sourceFormId)
            || bodies.some(b => b.parts.some(p => p.role !== 'core' && p.formId === d.sourceFormId))
            || !c || !keys(c, ['kind','numerator','denominator']) || c.kind !== 'hp-at-most'
            || !integer(c.numerator, 1, 10000) || !integer(c.denominator, c.numerator, 10000)
            || !integer(d.ticks, 1, 10000) || !integer(d.hpCost, 0, 9999)
            || !t || !keys(t, ['reason','results','hp','statuses','relationships','placement'])
            || !['phase','split','clone','summon'].includes(t.reason) || !['ratio','injury','conserve','current'].includes(t.hp)
            || !['preserve','clear'].includes(t.statuses) || !['preserve','clear'].includes(t.relationships)
            || !['nearest','random-nearest'].includes(t.placement) || !Array.isArray(t.results) || !t.results.length || t.results.length > 4
            || t.reason === 'phase' && t.results.length !== 1 || t.reason === 'split' && (t.results.length < 2 || t.hp !== 'conserve')
            || t.reason !== 'split' && t.hp === 'conserve' || ['clone','summon'].includes(t.reason) && t.hp !== 'current') return false;
        const mapped = new Set<string>();
        for (const result of t.results) {
            if (!result || !keys(result, ['formId','memberMap']) || !forms.some(f => f.id === result.formId)
                || t.reason === 'split' && result.formId === d.sourceFormId
                || bodies.some(b => b.parts.some(p => p.role !== 'core' && p.formId === result.formId))
                || !Array.isArray(result.memberMap) || result.memberMap.length > 16) return false;
            const source = bodies.find(b => b.parts.some(p => p.role === 'core' && p.formId === d.sourceFormId));
            const target = bodies.find(b => b.parts.some(p => p.role === 'core' && p.formId === result.formId));
            const destinations = new Set<string>();
            for (const m of result.memberMap) {
                if (!m || !keys(m, ['from','to']) || !source?.parts.some(p => p.role !== 'core' && p.partId === m.from)
                    || !target?.parts.some(p => p.role !== 'core' && p.partId === m.to) || mapped.has(m.from) || destinations.has(m.to)) return false;
                mapped.add(m.from); destinations.add(m.to);
            }
            if (['clone','summon'].includes(t.reason) && (result.formId !== d.sourceFormId || result.memberMap.length)) return false;
        }
        ids.add(d.id);
    }
    return true;
}
