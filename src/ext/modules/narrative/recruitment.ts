import { validId } from '../../json';
import { NarrativeError, type NarrativeErrorCode } from './errors';
import { assertLoadedNarrativePack, assertNarrativeJson, freezeNarrative } from './schema';
import type { NarrativePack } from './types';

/** Content-author notes for a later 5D3 design. This is not a runtime capability,
 * resident contract, saved state, or promise that any NPC can currently join. */
export interface NarrativeRecruitmentMetadata {
    readonly schema: 1;
    readonly targetPhase: '5D3';
    readonly npcs: readonly {
        readonly npcId: string;
        readonly recruitable: boolean;
        readonly eligibility: { readonly flagId: string; readonly anyOf: readonly string[] } | null;
    }[];
}
const NPC_IDS = Object.freeze(['cord.mender', 'cistern.listener', 'bone.clerk', 'salt.warden', 'letter.carrier']);
const fail = (code: NarrativeErrorCode, path: string): never => { throw new NarrativeError(code, path); };
function record(raw: unknown, keys: readonly string[], path: string): Record<string, unknown> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('INVALID_TYPE', path);
    const value = raw as Record<string, unknown>;
    for (const key of Object.keys(value)) if (!keys.includes(key)) fail('UNKNOWN_KEY', `${path}.${key}`);
    for (const key of keys) if (!Object.prototype.hasOwnProperty.call(value, key)) fail('INVALID_TYPE', `${path}.${key}`);
    return value;
}
function id(value: unknown, path: string): string {
    if (!validId(value) || value.length > 128 || ['constructor', 'prototype', '__proto__'].includes(value)) return fail('INVALID_ID', path);
    return value;
}

/** Pure authoring validation only. Callers must supply a formally loaded pack.
 * JSON is checked before property reads, then cloned and deeply frozen. */
export function loadNarrativeRecruitment(raw: unknown, pack: NarrativePack): NarrativeRecruitmentMetadata {
    assertLoadedNarrativePack(pack);
    assertNarrativeJson(raw, '$recruitment');
    const root = record(raw, ['schema', 'targetPhase', 'npcs'], '$recruitment');
    if (root.schema !== 1) fail('INVALID_VERSION', '$recruitment.schema');
    if (root.targetPhase !== '5D3') fail('INVALID_VERSION', '$recruitment.targetPhase');
    if (!Array.isArray(root.npcs)) return fail('INVALID_TYPE', '$recruitment.npcs');
    if (root.npcs.length !== NPC_IDS.length) fail('INVALID_RANGE', '$recruitment.npcs');
    const seen = new Set<string>();
    for (const [index, entry] of root.npcs.entries()) {
        const path = `$recruitment.npcs[${index}]`;
        const npc = record(entry, ['npcId', 'recruitable', 'eligibility'], path);
        const npcId = id(npc.npcId, `${path}.npcId`);
        if (seen.has(npcId)) fail('DUPLICATE_ID', `${path}.npcId`);
        seen.add(npcId);
        if (!NPC_IDS.includes(npcId) || !pack.npcs.some(definition => definition.id === npcId)) fail('UNKNOWN_REFERENCE', `${path}.npcId`);
        if (typeof npc.recruitable !== 'boolean') fail('INVALID_TYPE', `${path}.recruitable`);
        if (!npc.recruitable) {
            if (npc.eligibility !== null) fail('INVALID_TYPE', `${path}.eligibility`);
            continue;
        }
        const eligibility = record(npc.eligibility, ['flagId', 'anyOf'], `${path}.eligibility`);
        const flagId = id(eligibility.flagId, `${path}.eligibility.flagId`);
        const flag = pack.flags.find(definition => definition.id === flagId);
        if (!flag) return fail('UNKNOWN_REFERENCE', `${path}.eligibility.flagId`);
        if (flag.type !== 'string') fail('INVALID_TYPE', `${path}.eligibility.flagId`);
        if (!Array.isArray(eligibility.anyOf)) return fail('INVALID_TYPE', `${path}.eligibility.anyOf`);
        if (!eligibility.anyOf.length) fail('INVALID_RANGE', `${path}.eligibility.anyOf`);
        const values = new Set<string>();
        for (const [valueIndex, value] of eligibility.anyOf.entries()) {
            const valuePath = `${path}.eligibility.anyOf[${valueIndex}]`;
            if (typeof value !== 'string') return fail('INVALID_TYPE', valuePath);
            if (values.has(value)) fail('DUPLICATE_ID', valuePath);
            if (value === 'unresolved' || !flag.values!.includes(value)) fail('FLAG_VALUE', valuePath);
            values.add(value);
        }
    }
    return freezeNarrative(structuredClone(raw) as NarrativeRecruitmentMetadata);
}
