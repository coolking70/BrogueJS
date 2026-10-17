import { c5Canonical } from '../../worldJson';
import type { WorkItemInput, WorkItemProvider } from '../../worldSdk';
import { ITEM_RUNIC_TARGETS } from '../../itemSdk';
import { deriveNativeFacts, lootItemClass, validateLootItemData } from './item';
import { rollAffix, unlockedTiers } from './generator';
import { CountedLootRandom, weightedPick } from './random';
import { computeRarityWeights } from './rarity';
import type { EffectiveLootCatalog, LootItemDataV1 } from './types';

export function reforgeCandidates(data: LootItemDataV1, index: number, c: EffectiveLootCatalog) {
  const row = data.affixes[index],
    old = c.affixes.find((a) => a.id === row?.id),
    cls = lootItemClass(data.baseId, c)!;
  if (
    !data.identityKnown ||
    !['magic', 'rare'].includes(data.rarity) ||
    !Number.isInteger(index) ||
    !old ||
    old.polarity !== 1 ||
    old.rune !== null
  )
    return [];
  const groups = new Set(
    data.affixes
      .filter((_, i) => i !== index)
      .map((a) => c.affixes.find((d) => d.id === a.id)!.group)
  );
  return c.affixes.filter(
    (a) =>
      a.polarity === 1 &&
      a.rune === null &&
      a.position === old.position &&
      a.itemClasses.includes(cls) &&
      !groups.has(a.group) &&
      (c.effectiveWeight[a.id]?.[cls] ?? 0) > 0 &&
      unlockedTiers(c, a, data.ilvl).length > 0
  );
}
export function lootWorkProvider(
  getCatalog: () => EffectiveLootCatalog,
  presetId: string
): WorkItemProvider {
  const describe: WorkItemProvider['prepare'] = (input) => {
    const c = getCatalog();
    if (input.kind === 'craft') {
      if (
        !['dagger', 'leather_armor'].includes(input.baseId) ||
        !['normal', 'magic'].includes(input.maxRarity)
      )
        throw new Error('Unsupported craft output');
      return { inputs: [], outputs: [], workTicks: 0 };
    }
    const data = input.data as unknown as LootItemDataV1,
      op = c.pack.stationOperations.operations.find((o) => o.id === input.operationId);
    if (!op || !validateLootItemData(data, c)) throw new Error('Invalid work target');
    if (op.kind === 'reforge') {
      if (
        !reforgeCandidates(
          data,
          data.affixes.findIndex((row) => row.id === input.rowId),
          c
        ).length
      )
        throw new Error('Invalid reforge row');
    } else if (
      input.rowId !== undefined ||
      !['normal', 'runeword'].includes(data.rarity) ||
      !data.socketed.length
    )
      throw new Error('Invalid unsocket target');
    const runes =
      op.kind === 'unsocket' ? (op.mode === 'last' ? data.socketed.slice(-1) : data.socketed) : [];
    const count = op.mode === 'all' ? runes.length : 1;
    return {
      inputs: [{ itemDefinitionId: 'loot.shard', count: op.shardCost * count }],
      outputs: [...new Set(runes)]
        .sort()
        .map((id) => ({ itemDefinitionId: id, count: runes.filter((r) => r === id).length })),
      workTicks: op.workTicks * count
    };
  };
  return {
    operationIds: getCatalog().pack.stationOperations.operations.map((o) => o.id),
    prepare: describe,
    validateProposal(input, proposal) {
      if (!validateLootItemData(proposal.data, getCatalog())) return false;
      const data = proposal.data;
      if (input.kind === 'operation') {
        if (proposal.kind !== 'update') return false;
        const original = input.data as unknown as LootItemDataV1;
        if (!validateLootItemData(original, getCatalog())) return false;
        const expected = structuredClone(original);
        if (input.operationId === 'loot.work.reforge') {
          const index = original.affixes.findIndex((row) => row.id === input.rowId),
            row = data.affixes[index];
          const candidate = reforgeCandidates(original, index, getCatalog()).find(
            (a) => a.id === row?.id
          );
          if (
            !candidate ||
            !row?.known ||
            !unlockedTiers(getCatalog(), candidate, original.ilvl)
              .slice(-getCatalog().pack.tiers.window.size)
              .includes(row.tier)
          )
            return false;
          expected.affixes[index] = row;
        } else if (
          input.operationId === 'loot.work.unsocket-last' ||
          input.operationId === 'loot.work.unsocket-all'
        ) {
          expected.socketed =
            input.operationId === 'loot.work.unsocket-last' ? original.socketed.slice(0, -1) : [];
          expected.rarity = 'normal';
        } else return false;
        return c5Canonical(data) === c5Canonical(expected);
      }
      return (
        proposal.kind === 'create' &&
        data.baseId === input.baseId &&
        ['normal', ...(input.maxRarity === 'magic' ? ['magic'] : [])].includes(data.rarity) &&
        validCraftDomain(input, data, getCatalog(), presetId) &&
        data.identityKnown &&
        !data.corrupted &&
        data.enhancement === 0 &&
        data.socketed.length === 0 &&
        c5Canonical(data.origin) ===
          c5Canonical({ source: 'craft', depth: input.depth, recipeId: input.recipeId })
      );
    },
    validateStored: (input, stored) =>
      input.kind === 'operation' && c5Canonical(describe(input)) === c5Canonical(stored),
    commit(input, source) {
      describe(input);
      const c = getCatalog(),
        random = new CountedLootRandom(source);
      random.beginItem(0);
      if (input.kind === 'operation') {
        const data = structuredClone(input.data) as unknown as LootItemDataV1;
        if (input.operationId === 'loot.work.reforge') {
          const cls = lootItemClass(data.baseId, c)!,
            affix = weightedPick(
              reforgeCandidates(
                data,
                data.affixes.findIndex((row) => row.id === input.rowId),
                c
              ),
              (a) => c.effectiveWeight[a.id]![cls]!,
              random
            )!;
          data.affixes[data.affixes.findIndex((row) => row.id === input.rowId)] = {
            ...rollAffix(c, affix, data.ilvl, random),
            known: true
          };
        } else {
          data.socketed =
            input.operationId === 'loot.work.unsocket-last' ? data.socketed.slice(0, -1) : [];
          data.rarity = 'normal';
        }
        return { kind: 'update', data: data as unknown as import('../../worldSdk').JsonValue };
      }
      return craft(input, c, presetId, random);
    }
  };
}
type CraftInput = Extract<WorkItemInput, { kind: 'craft' }>;
function craftIlvl(input: CraftInput, c: EffectiveLootCatalog): number {
  const p = c.pack;
  return Math.max(
    p.ilvl.min,
    Math.min(
      p.ilvl.max,
      Math.floor((input.depth * p.ilvl.ilvlPerDepthBp) / 10000) + p.ilvl.sourceBonus.craft
    )
  );
}
/** Persisted items may have been reforged/socketed. Completion must instead admit
 * only outcomes in this bound craft source's generation domain, without draws. */
function validCraftDomain(
  input: CraftInput,
  data: LootItemDataV1,
  c: EffectiveLootCatalog,
  presetId: string
): boolean {
  if (data.ilvl !== craftIlvl(input, c) || (data.rarity !== 'normal' && data.rarity !== 'magic'))
    return false;
  const preset = c.pack.presets.presets.find((p) => p.id === presetId)!;
  if (
    input.maxRarity === 'magic' &&
    computeRarityWeights(preset, data.ilvl, 0, 10000, input.rarityFindBp, null)[data.rarity] <= 0
  )
    return false;
  if (data.rarity === 'normal') {
    const band = c.socketBands[input.baseId]?.find(
      (b) => b.minIlvl <= data.ilvl && data.ilvl <= b.maxIlvl
    );
    return !!band && (band.weights[data.sockets] ?? 0) > 0;
  }
  if (data.rarity !== 'magic') return false;
  const cls = lootItemClass(input.baseId, c)!,
    limits = c.pack.rarities.rarities.find((r) => r.id === 'magic')!.affixes!;
  const eligible = c.affixes.filter(
    (a) =>
      a.polarity === 1 &&
      a.itemClasses.includes(cls) &&
      (c.effectiveWeight[a.id]?.[cls] ?? 0) > 0 &&
      unlockedTiers(c, a, data.ilvl).length > 0
  );
  const groups = new Set<string>(),
    positions = { prefix: 0, suffix: 0 };
  for (const row of data.affixes) {
    const affix = eligible.find((a) => a.id === row.id);
    if (!affix) return false;
    const window = unlockedTiers(c, affix, data.ilvl).slice(-c.pack.tiers.window.size),
      index = window.indexOf(row.tier);
    if (index < 0 || c.pack.tiers.window.weightsHighToLow[window.length - 1 - index]! <= 0)
      return false;
    groups.add(affix.group);
    positions[affix.position]++;
  }
  const exhausted = !eligible.some(
    (a) =>
      !groups.has(a.group) &&
      positions[a.position] < limits[a.position === 'prefix' ? 'prefixMax' : 'suffixMax']
  );
  if (
    !preset.affixCount.magic.some(
      (entry) =>
        entry.w > 0 &&
        (entry.n === data.affixes.length || (exhausted && entry.n > data.affixes.length))
    )
  )
    return false;
  if (
    data.targetClass !== undefined &&
    !ITEM_RUNIC_TARGETS.some(
      (t) =>
        t.name === data.targetClass &&
        t.frequency > 0 &&
        (t.maxDepth <= 0 || input.depth <= t.maxDepth)
    )
  )
    return false;
  return true;
}
function craft(
  input: Extract<WorkItemInput, { kind: 'craft' }>,
  c: EffectiveLootCatalog,
  presetId: string,
  random: CountedLootRandom
) {
  const p = c.pack,
    preset = p.presets.presets.find((p) => p.id === presetId)!,
    cls = lootItemClass(input.baseId, c)!;
  const ilvl = craftIlvl(input, c);
  const weights = computeRarityWeights(preset, ilvl, 0, 10000, input.rarityFindBp, null);
  const rarity =
    input.maxRarity === 'normal'
      ? 'normal'
      : weightedPick(['normal', 'magic'] as const, (r) => weights[r], random)!;
  const data: LootItemDataV1 = {
    v: 6,
    baseId: input.baseId,
    ilvl,
    rarity,
    uniqueId: null,
    setId: null,
    pieceId: null,
    identityKnown: true,
    affixes: [],
    corrupted: false,
    enhancement: 0,
    sockets: 0,
    socketed: [],
    nameParts: null,
    origin: { source: 'craft', depth: input.depth, recipeId: input.recipeId }
  };
  if (rarity === 'magic') {
    const count = weightedPick(preset.affixCount.magic, (a) => a.w, random)!.n,
      limits = p.rarities.rarities.find((r) => r.id === 'magic')!.affixes!;
    const groups = new Set<string>(),
      positions = { prefix: 0, suffix: 0 };
    for (let n = 0; n < count; n++) {
      const eligible = c.affixes.filter(
        (a) =>
          a.polarity === 1 &&
          a.itemClasses.includes(cls) &&
          (c.effectiveWeight[a.id]?.[cls] ?? 0) > 0 &&
          !groups.has(a.group) &&
          unlockedTiers(c, a, ilvl).length > 0
      );
      const pre =
          positions.prefix < limits.prefixMax
            ? eligible.filter((a) => a.position === 'prefix')
            : [],
        post =
          positions.suffix < limits.suffixMax
            ? eligible.filter((a) => a.position === 'suffix')
            : [];
      if (!pre.length && !post.length) break;
      const candidates = !pre.length
        ? post
        : !post.length
          ? pre
          : random.randomInt(0, 1) === 0
            ? pre
            : post;
      const affix = weightedPick(candidates, (a) => c.effectiveWeight[a.id]![cls]!, random)!;
      data.affixes.push({ ...rollAffix(c, affix, ilvl, random), known: true });
      groups.add(affix.group);
      positions[affix.position]++;
    }
  } else {
    const band = c.socketBands[input.baseId]!.find((b) => b.minIlvl <= ilvl && ilvl <= b.maxIlvl)!;
    data.sockets = weightedPick(
      band.weights.map((weight, count) => ({ weight, count })),
      (r) => r.weight,
      random
    )!.count;
  }
  const native = deriveNativeFacts(data, c);
  if (['slaying', 'immunity'].includes(native.runicType ?? '')) {
    const targets = ITEM_RUNIC_TARGETS.filter((t) => t.maxDepth <= 0 || input.depth <= t.maxDepth);
    data.targetClass = weightedPick(targets, (t) => t.frequency, random)!.name;
  }
  const n = deriveNativeFacts(data, c);
  return {
    kind: 'create' as const,
    data: data as unknown as import('../../worldSdk').JsonValue,
    native: {
      kind: n.kind,
      category: cls,
      enchantment: 0,
      runicType: n.runicType,
      isCursed: false,
      identified: true,
      familiarityRemaining: 0,
      ...(data.targetClass ? { targetClass: data.targetClass } : {})
    }
  };
}
