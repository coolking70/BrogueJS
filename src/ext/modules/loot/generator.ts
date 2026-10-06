import { freezeLootValue } from './catalog';
import { LootContractError } from './errors';
import { deriveNativeFacts } from './item';
import { CountedLootRandom, weightedPick } from './random';
import { computeRarityWeights, ROLLED_RARITIES } from './rarity';
import type { AffixDefinition, DropTable, EffectiveLootCatalog, ItemClass, LootAffixRoll, LootItemDataV1,
    LootPreset, LootRandom, LootRollRequest, LootRollResult, MonsterClassId, RarityId, UniqueDefinition } from './types';

const CLASSES: ItemClass[] = ['weapon', 'armor', 'ring'];
const COMMON_KEYS = ['v', 'source', 'depth', 'presetId', 'rarityFindBp', 'claimedUniqueIds'];
/** Reject symbols, accessors, sparse arrays and hidden fields without invoking user code. */
function plainJson(value: unknown, seen = new Set<object>()): boolean {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
    if (typeof value === 'number') return Number.isFinite(value);
    if (typeof value !== 'object' || seen.has(value)) return false;
    const array = Array.isArray(value);
    const prototype = Object.getPrototypeOf(value);
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) return false;
    const ownKeys = Reflect.ownKeys(value);
    if (array && ownKeys.length !== value.length + 1) return false;
    seen.add(value);
    for (const key of ownKeys) {
        if (array && key === 'length') continue;
        if (typeof key !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(key)) return false;
        if (array && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length)) return false;
        const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
        if (!descriptor.enumerable || descriptor.get !== undefined || descriptor.set !== undefined || !plainJson(descriptor.value, seen)) return false;
    }
    seen.delete(value);
    return true;
}
function invalid(path: string, detail: string): never { throw new LootContractError('INVALID_REQUEST', path, detail); }
function record(value: unknown, path: string): Record<string, unknown> {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) invalid(path, 'Expected a plain object');
    return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: readonly string[], path: string): void {
    for (const key of Object.keys(value)) if (!allowed.includes(key)) invalid(`${path}.${key}`, 'Unknown field');
    for (const key of allowed) if (!Object.prototype.hasOwnProperty.call(value, key)) invalid(`${path}.${key}`, 'Missing field');
}
function text(value: unknown, path: string): asserts value is string {
    if (typeof value !== 'string' || value.length === 0) invalid(path, 'Expected a nonempty string');
}
function bool(value: unknown, path: string): void { if (typeof value !== 'boolean') invalid(path, 'Expected a boolean'); }
function integer(value: unknown, min: number, max: number, path: string): void {
    if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) invalid(path, 'Integer outside range');
}
function classForBase(catalog: EffectiveLootCatalog, baseId: string): ItemClass | undefined {
    const bases = catalog.pack.bases;
    return bases.weapons.some(base => base.baseId === baseId) ? 'weapon'
        : bases.armors.some(base => base.baseId === baseId) ? 'armor'
        : bases.rings.some(base => base.baseId === baseId) ? 'ring' : undefined;
}

/** Validate the entire discriminated request before constructing a random counter. */
function validateRequest(catalog: EffectiveLootCatalog, value: unknown): LootPreset {
    if (!plainJson(value)) invalid('request', 'Expected finite acyclic plain JSON');
    const request = record(value, 'request');
    const extra = request.source === 'kill' ? ['monster'] : request.source === 'floor' ? ['itemClass']
        : request.source === 'vault' ? ['itemClass', 'baseId', 'highValue']
        : request.source === 'encounter' ? ['formId'] : null;
    if (extra === null) invalid('request.source', 'Unknown loot source');
    keys(request, [...COMMON_KEYS, ...extra], 'request');
    if (request.v !== 1) invalid('request.v', 'Unsupported request version');
    integer(request.depth, 1, 99, 'request.depth');
    integer(request.rarityFindBp, 0, Number.MAX_SAFE_INTEGER, 'request.rarityFindBp');
    text(request.presetId, 'request.presetId');
    const preset = catalog.pack.presets.presets.find(candidate => candidate.id === request.presetId);
    if (!preset) throw new LootContractError('UNKNOWN_PRESET', 'request.presetId', 'Unknown preset');
    if (!Array.isArray(request.claimedUniqueIds)) invalid('request.claimedUniqueIds', 'Expected unique ID array');
    const claimed = new Set<string>();
    for (const [index, id] of request.claimedUniqueIds.entries()) {
        text(id, `request.claimedUniqueIds[${index}]`);
        if (claimed.has(id) || !catalog.pack.uniques.uniques.some(unique => unique.id === id)) {
            invalid(`request.claimedUniqueIds[${index}]`, 'Unknown or duplicate unique receipt');
        }
        claimed.add(id);
    }
    if (request.source === 'kill') {
        const monster = record(request.monster, 'request.monster');
        keys(monster, ['typeId', 'leader', 'champion', 'encounterSubject'], 'request.monster');
        text(monster.typeId, 'request.monster.typeId');
        for (const key of ['leader', 'champion', 'encounterSubject']) bool(monster[key], `request.monster.${key}`);
    } else if (request.source === 'floor' || request.source === 'vault') {
        if (!CLASSES.includes(request.itemClass as ItemClass)) invalid('request.itemClass', 'Unknown item class');
        if (request.source === 'vault') {
            bool(request.highValue, 'request.highValue');
            if (request.baseId !== null) {
                text(request.baseId, 'request.baseId');
                if (classForBase(catalog, request.baseId) !== request.itemClass) {
                    throw new LootContractError('UNKNOWN_BASE', 'request.baseId', 'Unknown base or class mismatch');
                }
            }
        }
    } else if (request.formId !== null) text(request.formId, 'request.formId');
    return preset;
}

function selectTable(catalog: EffectiveLootCatalog, request: LootRollRequest, monsterClass: MonsterClassId): DropTable | undefined {
    return catalog.pack.dropTables.tables.map((table, index) => ({ table, index }))
        .sort((a, b) => b.table.priority - a.table.priority || a.index - b.index)
        .find(({ table: { match } }) => match.source === request.source
            && (match.monsterClass === undefined || (request.source === 'kill' && match.monsterClass === monsterClass))
            && (match.monsterId === undefined || (request.source === 'kill' && match.monsterId === request.monster.typeId))
            && (match.formId === undefined || (request.source === 'encounter' && match.formId === request.formId))
            && (match.depth === undefined || (request.depth >= match.depth[0] && request.depth <= match.depth[1])))?.table;
}
function minimumRarity(a: RarityId | null, b: RarityId | null): RarityId | null {
    if (a === null) return b;
    if (b === null) return a;
    return ROLLED_RARITIES.indexOf(a as 'normal') >= ROLLED_RARITIES.indexOf(b as 'normal') ? a : b;
}
function unlockedTiers(catalog: EffectiveLootCatalog, affix: AffixDefinition, ilvl: number): number[] {
    return catalog.pack.tiers.tiers.filter(tier => tier.enabled && tier.minIlvl <= ilvl && tier.tier <= affix.maxTier)
        .map(tier => tier.tier);
}
function rollAffix(catalog: EffectiveLootCatalog, affix: AffixDefinition, ilvl: number, random: CountedLootRandom): LootAffixRoll {
    const weights = catalog.pack.tiers.window.weightsHighToLow;
    const window = unlockedTiers(catalog, affix, ilvl).slice(-catalog.pack.tiers.window.size);
    const tier = weightedPick(window, candidate => weights[window.length - 1 - window.indexOf(candidate)]!, random)!;
    return { id: affix.id, tier, values: affix.tiers.find(row => row.tier === tier)!.ranges
        .map(([lo, hi]) => random.randomInt(lo, hi)), known: false };
}

export interface LootRollTrace { uniqueOpportunities: number; itemDraws: number[] }
export interface LootTracedResult { result: LootRollResult; trace: LootRollTrace }

/** Diagnostic entry point uses the identical implementation without adding rule draws or result fields. */
export function rollLootWithTrace(catalog: EffectiveLootCatalog, request: LootRollRequest, source: LootRandom): LootTracedResult {
    const preset = validateRequest(catalog, request);
    if (!source || typeof source.randomInt !== 'function') invalid('random', 'Expected randomInt callback');
    const random = new CountedLootRandom(source);
    const result: LootRollResult = { v: 1, converted: true, items: [], gold: 0, newUniqueIds: [], draws: 0 };
    const trace: LootRollTrace = { uniqueOpportunities: 0, itemDraws: [] };
    const finish = (): LootTracedResult => { result.draws = random.draws; return freezeLootValue({ result, trace }); };
    const { pack } = catalog;
    const monsterClass = request.source === 'kill'
        ? pack.monsterClasses.members.find(member => member.typeId === request.monster.typeId)?.class ?? pack.monsterClasses.defaultClass
        : 'none';
    if (request.source === 'kill' && (request.monster.encounterSubject || monsterClass === 'none')) return finish();
    const table = request.source === 'kill' || request.source === 'encounter' ? selectTable(catalog, request, monsterClass) : undefined;
    let count = 1;
    if (request.source === 'kill') {
        count = 0;
        if (table !== undefined) {
            const modifiers = pack.monsterClasses.modifiers;
            const chanceBp = Math.min(10000, Math.floor(table.chanceBp * preset.killDropMultiplierBp / 10000)
                + (request.monster.leader ? modifiers.leader.chanceBonusBp : 0)
                + (request.monster.champion ? modifiers.champion.chanceBonusBp : 0));
            if (random.chance(chanceBp)) {
                const range = table.count === 'preset-encounter' ? [preset.encounter.count, preset.encounter.count] : table.count;
                count = random.randomInt(range[0]!, Math.min(range[1]!, preset.maxPerKill));
            }
        }
    } else if (request.source === 'floor') {
        if (!random.chance(preset.floorConversionBp)) { result.converted = false; return finish(); }
    } else if (request.source === 'encounter') count = table === undefined ? 0 : preset.encounter.count;
    const occupied = new Set(request.claimedUniqueIds);
    for (let index = 0; index < count; index++) {
        random.beginItem();
        const ilvl = Math.max(pack.ilvl.min, Math.min(pack.ilvl.max,
            Math.floor(request.depth * pack.ilvl.ilvlPerDepthBp / 10000) + pack.ilvl.sourceBonus[request.source]
            + (request.source === 'kill' ? pack.ilvl.classBonus[monsterClass] + (request.monster.champion ? pack.ilvl.championBonus : 0) : 0)
            + (table?.ilvlBonus ?? 0)));
        const itemClass = request.source === 'floor' || request.source === 'vault' ? request.itemClass
            : weightedPick(CLASSES, candidate => table!.classWeights[candidate], random)!;
        const band = pack.bases.ilvlBands.findIndex(candidate => candidate.minIlvl <= ilvl && ilvl <= candidate.maxIlvl);
        const baseCandidates = itemClass === 'weapon'
            ? pack.bases.weapons.map(base => ({ baseId: base.baseId, weight: pack.bases.weaponTierWeights[base.tier][band]! }))
            : itemClass === 'armor' ? pack.bases.armors.map(base => ({ baseId: base.baseId, weight: base.weights[band]! }))
                : pack.bases.rings;
        const baseId = request.source === 'vault' && request.baseId !== null ? request.baseId
            : weightedPick(baseCandidates, candidate => candidate.weight, random)!.baseId;
        const guaranteed = request.source === 'vault' ? (request.highValue ? preset.vault.highValueMinRarity : preset.vault.minRarity)
            : request.source === 'encounter' ? (index === 0 ? preset.encounter.firstMinRarity : preset.encounter.restMinRarity) : null;
        const weights = computeRarityWeights(preset, ilvl, (table?.rarityBonusBp ?? 0)
            + (request.source === 'kill' && request.monster.champion ? pack.monsterClasses.modifiers.champion.rarityBonusBp : 0),
        request.source === 'encounter' ? preset.encounter.uniqueWeightBp : 10000, request.rarityFindBp,
        minimumRarity(guaranteed, table?.minRarity ?? null));
        let rarity: RarityId = weightedPick(ROLLED_RARITIES, candidate => weights[candidate], random)!;
        let unique: UniqueDefinition | undefined;
        if (rarity === 'unique') {
            trace.uniqueOpportunities++;
            const candidates = pack.uniques.uniques.filter(candidate => candidate.baseId === baseId && candidate.minIlvl <= ilvl && !occupied.has(candidate.id));
            unique = weightedPick(candidates, candidate => {
                const bias = request.source === 'encounter' ? catalog.bossUniqueBias.find(entry => entry.formId === request.formId && entry.uniqueId === candidate.id) : undefined;
                return bias === undefined ? candidate.weight : Math.floor(candidate.weight * bias.multiplierBp / 10000);
            }, random);
            if (unique === undefined) rarity = 'rare';
            else { occupied.add(unique.id); result.newUniqueIds.push(unique.id); }
        }
        const data: LootItemDataV1 = { v: 1, baseId, ilvl, rarity, uniqueId: unique?.id ?? null, setId: null,
            affixes: [], corrupted: false, enhancement: 0, sockets: 0, socketed: [], nameParts: null,
            origin: { source: request.source, depth: request.depth } };
        if (rarity === 'magic' || rarity === 'rare') {
            const counts = rarity === 'magic' ? preset.affixCount.magic : ilvl >= preset.affixCount.rareHighIlvl.minIlvl
                ? preset.affixCount.rareHighIlvl.table : preset.affixCount.rare;
            const n = weightedPick(counts, candidate => candidate.w, random)!.n;
            const limits = pack.rarities.rarities.find(candidate => candidate.id === rarity)!.affixes!;
            const usedGroups = new Set<string>();
            const usedPositions = { prefix: 0, suffix: 0 };
            const eligible = (affix: AffixDefinition): boolean => affix.itemClasses.includes(itemClass)
                && (catalog.effectiveWeight[affix.id]?.[itemClass] ?? 0) > 0 && !usedGroups.has(affix.group)
                && (affix.rune === null || pack.affixes.runeFamilyEnabled) && unlockedTiers(catalog, affix, ilvl).length > 0;
            for (let slot = 0; slot < n; slot++) {
                const positive = catalog.affixes.filter(affix => affix.polarity === 1 && eligible(affix));
                const prefixes = usedPositions.prefix < limits.prefixMax ? positive.filter(affix => affix.position === 'prefix') : [];
                const suffixes = usedPositions.suffix < limits.suffixMax ? positive.filter(affix => affix.position === 'suffix') : [];
                if (prefixes.length === 0 && suffixes.length === 0) break;
                const candidates = prefixes.length === 0 ? suffixes : suffixes.length === 0 ? prefixes : random.randomInt(0, 1) === 0 ? prefixes : suffixes;
                const affix = weightedPick(candidates, candidate => catalog.effectiveWeight[candidate.id]![itemClass]!, random)!;
                data.affixes.push(rollAffix(catalog, affix, ilvl, random));
                usedGroups.add(affix.group);
                usedPositions[affix.position]++;
            }
            if (pack.corruption.eligibleRarities.includes(rarity) && random.chance(preset.corruptChanceBp)
                && data.affixes.length < pack.corruption.maxTotalAffixes) {
                let negative = catalog.affixes.filter(affix => affix.polarity === -1 && affix.rune === null && eligible(affix));
                if (negative.length === 0 && pack.corruption.negativeRuneFallback && pack.affixes.runeFamilyEnabled && !usedGroups.has('rune')) {
                    negative = catalog.affixes.filter(affix => affix.polarity === -1 && affix.rune !== null && eligible(affix));
                }
                const affix = weightedPick(negative, candidate => catalog.effectiveWeight[candidate.id]![itemClass]!, random);
                if (affix !== undefined) {
                    data.affixes.push(rollAffix(catalog, affix, ilvl, random));
                    const compensation = data.affixes.filter(roll => {
                        const definition = catalog.affixes.find(candidate => candidate.id === roll.id)!;
                        return definition.polarity === 1 && roll.tier < Math.min(definition.maxTier, pack.corruption.compensation.maxTier);
                    });
                    if (compensation.length > 0) {
                        const roll = compensation[random.randomInt(0, compensation.length - 1)]!;
                        roll.tier += pack.corruption.compensation.tierStep;
                        roll.values = catalog.affixes.find(candidate => candidate.id === roll.id)!.tiers.find(row => row.tier === roll.tier)!.ranges
                            .map(([lo, hi]) => random.randomInt(lo, hi));
                    }
                    data.corrupted = true;
                }
            }
        }
        if (unique !== undefined) data.affixes = unique.rows.map(row => ({ id: row.rowId, tier: 0,
            values: row.ranges.map(([lo, hi]) => random.randomInt(lo, hi)), known: false }));
        if (rarity === 'rare') data.nameParts = [random.randomInt(0, pack.rareNames.first.length - 1), random.randomInt(0, pack.rareNames.second.length - 1)];
        result.items.push({ data, native: deriveNativeFacts(data, catalog) });
        trace.itemDraws.push(random.endItem());
    }
    if (request.source === 'kill' || request.source === 'encounter') {
        const gold = request.source === 'encounter' ? pack.gold.encounter : pack.gold.byClass[monsterClass as Exclude<MonsterClassId, 'none'>];
        if (random.chance(gold.chanceBp)) {
            const { amount } = pack.gold;
            result.gold = Math.max(1, Math.floor(random.randomInt(amount.minBase + amount.minPerDepth * request.depth,
                amount.maxBase + amount.maxPerDepth * request.depth) * gold.multiplier * preset.goldMultiplierBp / 10000));
        }
    }
    return finish();
}

export function rollLoot(catalog: EffectiveLootCatalog, request: LootRollRequest, random: LootRandom): LootRollResult {
    return rollLootWithTrace(catalog, request, random).result;
}
