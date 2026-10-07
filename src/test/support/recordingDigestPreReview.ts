/** Frozen pre-review v4 projection oracle. Node crypto is independent of the production SHA hot loop. */
import { createHash } from 'node:crypto';
import { c5Canonical, compareCodePoints } from '../../engine/Core/WorldCanonical';
import {
  DIGEST_DOMAINS,
  type DigestDomain,
  type MechanicalDigest,
  type RecordingInputStateV2
} from '../../engine/Core/RecordingV4';
import type { GameSnapshot } from '../../engine/Core/WholeRunSnapshot';
import type { ExtensionManifest } from '../../ext/types';
const hashJson = (v: unknown) => createHash('sha256').update(c5Canonical(v, true)).digest('hex');
export function referenceMerkle(domain: DigestDomain, leaves: Readonly<Record<string, unknown>>) {
  return hashJson([
    'c5-domain-v1',
    domain,
    Object.keys(leaves)
      .sort(compareCodePoints)
      .map((k) => hashJson(['c5-leaf-v1', domain, k, leaves[k]]))
  ]);
}
const merkleDomain = referenceMerkle;
function digestRoot(
  domains: Readonly<Record<string, string>>,
  manifest: ExtensionManifest | null,
  order: readonly string[]
) {
  return hashJson([
    'c5-root-v1',
    ['brogue-web-whole-run-v6', 6, 10, 2],
    hashJson(manifest),
    order.map((d) => domains[d])
  ]);
}
const cellKnowledge = new Set([
  'isExplored',
  'hasMemory',
  'rememberedTerrain',
  'rememberedAppearance',
  'rememberedLayers',
  'rememberedItem',
  'rememberedItemCategory',
  'isMagicMapped',
  'rememberedTerrainFlags',
  'rememberedTMFlags',
  'knownTrapFree',
  'rememberedFlags',
  'isDiscovered',
  'autoSearched'
]);
const cellDerived = new Set([
  'char',
  'color',
  'light',
  'isVisible',
  'isClairvoyantVisible',
  'isPassable',
  'isOpaque',
  'terrain',
  'isBurning'
]);
const itemKnowledge = new Set([
  'identified',
  'canBeIdentified',
  'maxChargesKnown',
  'runicKnown',
  'magicDetected',
  'knownStaffUses',
  'inscription'
]);
const runKnowledge = new Set([
  'everSeenItemIds',
  'everSeenMonsterIds',
  'examinedEntityIds',
  'seenBodyCoreIds',
  'signTexts',
  'logger',
  'receivedLevitationWarning',
  'pendingDiscoveryMessages',
  'gameOverReason',
  'gameOverInventory'
]);
/** Independent full implementation: no dirty flags or last-root memoization. */
export function referenceDigest(
  snapshot: GameSnapshot,
  inputState: RecordingInputStateV2
): MechanicalDigest {
  const root = JSON.parse(JSON.stringify(snapshot)) as Record<string, any>;
  const knowledge: Record<string, unknown> = {};
  const split = (row: Record<string, unknown>, keys: Set<string>, label: string) => {
    const retained: Record<string, unknown> = {};
    for (const k of keys)
      if (k in row) {
        retained[k] = row[k];
        delete row[k];
      }
    if (Object.keys(retained).length) knowledge[label] = retained;
  };
  for (const level of [root, ...root.levels]) {
    for (const cell of level.grid) {
      if (cell.rememberedItem) delete cell.rememberedItem.name;
      split(cell, cellKnowledge, 'cell.' + level.depth + '.' + cell.x + '.' + cell.y);
      for (const k of cellDerived) delete cell[k];
    }
    delete level.visibleMonsterIds;
    delete level.visibleItemIds;
  }
  const items = [
    ...root.items,
    ...root.player.inventory,
    ...root.levels.flatMap((l: any) => l.items),
    ...root.pendingFallenItemsByDepth.flatMap((q: any) => q.items),
    ...root.entityGraph.items
  ];
  for (const item of items) split(item, itemKnowledge, 'item.' + item.id);
  for (const item of items) {
    item.name = item.consumableId ?? item.identityId ?? 'entity.' + item.id;
    delete item.description;
  }
  // Knowledge fields repeated in alias rows must be split from every physical row.
  for (const k of [
    'identifiedItems',
    'magicPolarityRevealed',
    'callTitles',
    'flavors',
    'wandFlavors',
    'staffFlavors'
  ])
    if (k in root) {
      knowledge[k] = root[k];
      delete root[k];
    }
  split(root.run, runKnowledge, 'run');
  const unorderedSets = [
    'everSeenItemIds',
    'everSeenMonsterIds',
    'examinedEntityIds',
    'seenBodyCoreIds'
  ];
  const knownRun = knowledge.run as Record<string, any>;
  // Archive grouping/id/repeat counts depend on rendered text. Keep the separate
  // bounded emission evidence, including its monotonic high water, instead.
  knownRun.logger = { turn: knownRun.logger.turn, mechanical: knownRun.logger.mechanical };
  if (knownRun.signTexts)
    knownRun.signTexts = knownRun.signTexts.map(([at]: [string, string]) => [at, true]);
  if (knownRun.pendingDiscoveryMessages)
    knownRun.pendingDiscoveryMessages = knownRun.pendingDiscoveryMessages.map((m: any) => ({
      color: m.color
    }));
  knownRun.gameOverReason = !!knownRun.gameOverReason;
  if (knownRun.gameOverInventory)
    knownRun.gameOverInventory = knownRun.gameOverInventory.map(
      ({ name: _name, ...row }: any) => row
    );
  root.run.lastDamageSource = !!root.run.lastDamageSource;
  for (const key of unorderedSets)
    if (knownRun[key]) knownRun[key].sort((a: number, b: number) => a - b);
  for (const key of ['signTexts'])
    if (knownRun[key]) knownRun[key].sort((a: any, b: any) => compareCodePoints(a[0], b[0]));
  for (const key of ['identifiedItems', 'magicPolarityRevealed'])
    if (knowledge[key]) (knowledge[key] as string[]).sort(compareCodePoints);
  const flavors = knowledge.flavors as Record<string, any>;
  const flavorIds = new Map<string, string>(flavors.identities.kinds);
  if (flavors) {
    flavors.potions = flavors.potions.map(([id, value]: [string, { color: number }]) => [
      id,
      { color: value.color }
    ]);
    flavors.arcana = flavors.arcana.map(([id]: [string, string]) => [id, flavorIds.get(id)]);
    flavors.scrolls = flavors.scrolls.map(([id]: [string, string]) => [id, flavorIds.get(id)]);
    flavors.staffSlots = flavors.identities.staffSlots;
    flavors.identities.kinds.sort((a: [string, string], b: [string, string]) =>
      compareCodePoints(a[0], b[0])
    );
  }
  if (flavors)
    for (const key of ['potions', 'scrolls', 'arcana'])
      flavors[key].sort((a: any, b: any) => compareCodePoints(a[0], b[0]));
  for (const key of ['callTitles', 'wandFlavors', 'staffFlavors'])
    if (Array.isArray(knowledge[key]))
      (knowledge[key] as [string, unknown][]).sort((a, b) => compareCodePoints(a[0], b[0]));
  for (const key of ['wandFlavors', 'staffFlavors'])
    if (knowledge[key])
      knowledge[key] = Object.keys(knowledge[key])
        .map((id) => [id, flavorIds.get(id)])
        .sort((a, b) => compareCodePoints(a[0] as string, b[0] as string));
  const extensions = root.extensions ?? null,
    world5 = root.run.world5 ?? null,
    workFacts = root.run.worldWorkFacts ?? null,
    workDetails = root.run.worldWorkDetails ?? null,
    actorActions = root.run.actorActions ?? null,
    random = root.rngState;
  delete root.extensions;
  delete root.run.world5;
  delete root.run.worldWorkFacts;
  delete root.run.worldWorkDetails;
  delete root.run.actorActions;
  delete root.rngState;
  delete root.savedAt;
  delete root.run.recordingOrigin;
  delete root.run.recordedInputEvents;
  delete root.run.recordedInputIndex;
  for (const k of ['monsterPathCache', 'safetyMap', 'loopMap', 'updatedSafetyMapThisTurn'])
    delete root.run[k];
  for (const actor of [
    ...root.monsters,
    ...root.dormantMonsters,
    ...root.purgatory,
    ...root.entityGraph.monsters,
    ...root.levels.flatMap((l: any) => [...l.monsters, ...l.dormantMonsters]),
    ...root.pendingFallenByDepth.flatMap((q: any) => q.monsters),
    root.player
  ]) {
    delete actor.mapToMe;
    actor.name = actor.typeId ?? 'entity.' + actor.id;
    delete actor.description;
    delete actor.targetCorpseName;
    if (actor.form) {
      actor.form.name = actor.form.id;
      delete actor.form.description;
    }
    if (actor.mutation) {
      actor.mutation.name = actor.mutation.id;
      delete actor.mutation.description;
    }
  }
  const domains = {
    native: merkleDomain('native', { world: root, inputState }),
    extensions: merkleDomain('extensions', { root: extensions }),
    world5: merkleDomain('world5', {
      root: world5,
      ...(workFacts ? { facts: workFacts } : {}),
      ...(workDetails ? { workDetails } : {})
    }),
    actorActions: merkleDomain('actorActions', { root: actorActions }),
    knowledge: merkleDomain('knowledge', knowledge),
    random: merkleDomain('random', { root: random })
  };
  return {
    domains,
    root: digestRoot(domains, snapshot.extensions?.manifest ?? null, DIGEST_DOMAINS)
  };
}
