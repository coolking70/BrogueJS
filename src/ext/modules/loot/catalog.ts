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
        combat: availability.combat === null ? null : { stats: sorted(availability.combat.stats) },
        growth: availability.growth === null ? null : {
            stats: sorted(availability.growth.stats), attributes: sorted(availability.growth.attributes),
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
    return freezeLootValue({ pack, availability: normalized, affixes, effectiveWeight, bossUniqueBias,
        fingerprint: extensionDataFingerprint({ pack, availability: normalized }) });
}
