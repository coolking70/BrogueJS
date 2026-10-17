import { ITEM_RUNIC_TARGETS } from '../../itemSdk';
import { extensionDataFingerprint } from '../../fingerprint';
import { validId } from '../../json';
import type { AffixDefinition, EffectiveLootCatalog, ItemClass, LootAvailability, LootPack } from './types';

/** Catalogs are snapshots: neither caller arrays nor expanded rows retain mutable aliases. */
export function freezeLootValue<T>(value: T): T {
    if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
        for (const child of Object.values(value)) freezeLootValue(child);
        Object.freeze(value);
    }
    return value;
}

const sorted = (values: readonly string[]): string[] => [...new Set(values)].sort();
const CLASSES: ItemClass[] = ['weapon', 'armor', 'ring'];

export function buildEffectiveLootCatalog(pack: LootPack, availability: LootAvailability): EffectiveLootCatalog {
    const normalized: LootAvailability = {
        bodies:[...(availability.bodies??[])].map(b=>({id:b.id,partIds:sorted(b.partIds)})).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0),
        combat: availability.combat === null ? null : { stats: sorted(availability.combat.stats) },
        growth: availability.growth === null ? null : {
            stats: sorted(availability.growth.stats), attributes: sorted(availability.growth.attributes),
            ...(availability.growth.fingerprint ? {fingerprint:availability.growth.fingerprint}:{}),
        },
        giants: availability.giants === null ? null : { formIds: sorted(availability.giants.formIds) },
    };
    const affixes: AffixDefinition[] = [];
    const effectiveWeight: EffectiveLootCatalog['effectiveWeight'] = {};
    const replacements: { source: AffixDefinition; targetId: string }[] = [];
    const add = (affix: AffixDefinition) => {
        affixes.push(affix);
        effectiveWeight[affix.id] = Object.fromEntries(affix.itemClasses.map(itemClass => [itemClass, affix.weight]));
    };
    for (const original of pack.affixes.affixes) {
        if (original.rune !== null && !pack.affixes.runeFamilyEnabled) continue;
        const affix = structuredClone(original);
        const requirement = affix.requires;
        const module = requirement === null ? null : normalized[requirement.module];
        let available = requirement === null || (module !== null && module.stats.includes(requirement.key));
        if (affix.expand !== null) {
            const attributes = normalized.growth?.attributes;
            available &&= attributes !== undefined && attributes.length > 0 && attributes.every(validId);
        }
        if (!available) {
            if (affix.fallback?.kind === 'replace') replacements.push({ source: affix, targetId: affix.fallback.affixId });
            continue;
        }
        if (affix.expand !== null) {
            const attributes = normalized.growth!.attributes;
            for (const attribute of attributes) {
                add({ ...structuredClone(affix), id: `${affix.id}.${attribute}`,
                    weight: Math.max(1, Math.floor(affix.weight / attributes.length)),
                    modifiers: affix.modifiers.map(modifier => ({ ...structuredClone(modifier),
                        stat: modifier.stat.replace('{attribute}', attribute) })) });
            }
        } else add(affix);
    }
    for (const { source, targetId } of replacements) {
        const target = affixes.find(affix => affix.id === targetId)!;
        for (const itemClass of CLASSES) {
            if (source.itemClasses.includes(itemClass) && target.itemClasses.includes(itemClass)) {
                effectiveWeight[targetId]![itemClass] = (effectiveWeight[targetId]![itemClass] ?? 0) + source.weight;
            }
        }
    }
    const bossUniqueBias = pack.uniques.bossUniqueBias.filter(bias => normalized.giants?.formIds.includes(bias.formId))
        .map(bias => ({ ...bias }));
    const setsById = Object.fromEntries(pack.sets.sets.map(set => [set.id, set]));
    const members = pack.sets.sets.flatMap(set => set.pieces.map(piece => ({setId: set.id, piece})))
        .sort((a,b) => a.setId.localeCompare(b.setId) || a.piece.id.localeCompare(b.piece.id));
    const piecesById = Object.fromEntries(members.map(member => [member.piece.id, member]));
    const piecesByBase: Record<string, typeof members> = {};
    for (const member of members) (piecesByBase[member.piece.baseId] ??= []).push(member);
    const runesById = Object.fromEntries(pack.runes.runes.map(r => [r.id,r]));
    const socketRowsById = Object.fromEntries([...pack.runes.runes,...pack.runewords.words].flatMap(d=>d.rows.map(r=>[r.rowId,r])));
    const wordsByKey = Object.fromEntries(pack.runewords.words.flatMap(w => w.baseClasses.map(c => [JSON.stringify([c,w.sockets,w.sequence]),w])));
    const socketBands = Object.fromEntries(pack.sockets.bases.map(b => [b.baseId,b.bands]));
    const partTables=pack.dropTables.tables.filter(t=>t.match.source==='part'&&normalized.bodies!.some(b=>b.id===t.match.bodyDefinitionId&&t.match.partIds!.every(p=>b.partIds.includes(p))));
    return freezeLootValue({ partTables, socketRowsById, runesById, wordsByKey, socketBands, setsById, piecesById, piecesByBase, pieceIds: members.map(m => m.piece.id), pack, availability: normalized, affixes, effectiveWeight, bossUniqueBias,
        fingerprint: extensionDataFingerprint({ pack, targets:ITEM_RUNIC_TARGETS, availability: normalized }) });
}
