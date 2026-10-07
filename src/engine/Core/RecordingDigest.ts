import { FOUNDATION_PROTOCOL } from '../../ext/descriptor';
import { recordingRootRevision, markRecordingRoot } from '../../ext/recordingRevisions';
import { sha256 } from '../../ext/fingerprint';
import { c5Canonical, compareCodePoints } from './WorldCanonical';
import {
  DIGEST_DOMAINS,
  EVENT_DOMAINS,
  type DigestDomain,
  type MechanicalDigest,
  type EventDigest,
  type RecordingHeaderV4,
  type RecordingEventV4,
  type RecordingInputStateV2
} from './RecordingV4';
import type { GameSnapshot } from './WholeRunSnapshot';
import type { ExtensionManifest, ExtensionSnapshot } from '../../ext/types';
import type { World5Snapshot } from '../../ext/world5';
import type { Item } from '../Items/Item';
export const hashJson = (v: unknown) => sha256(c5Canonical(v, true));
const codecIdentity = ['brogue-web-whole-run-v6', 6, FOUNDATION_PROTOCOL, 2];
export const manifestFingerprint = (manifest: ExtensionManifest | null) => hashJson(manifest);
export function merkleDomain(
  domain: DigestDomain,
  leaves: Readonly<Record<string, unknown>>
): string {
  const keys = Object.keys(leaves).sort(compareCodePoints);
  return hashJson([
    'c5-domain-v1',
    domain,
    keys.map((k) => hashJson(['c5-leaf-v1', domain, k, leaves[k]]))
  ]);
}
export function digestRoot(
  domains: Readonly<Record<string, string>>,
  manifest: ExtensionManifest | null,
  order: readonly string[]
): string {
  return hashJson([
    'c5-root-v1',
    codecIdentity,
    manifestFingerprint(manifest),
    order.map((d) => domains[d])
  ]);
}
/** Foundation 9 world leaves. Full digests always project afresh; only event
 * leaves reuse canonical strings under explicit write-boundary revisions. */
const structureEpochs = new WeakMap<
  World5Snapshot,
  {
    serial: number;
    depths: Map<number, number>;
    groups?: { serial: number; array: unknown; length: number; leaves: Record<string, unknown> };
  }
>();
function structureEpoch(w: World5Snapshot) {
  let e = structureEpochs.get(w);
  if (!e) {
    e = { serial: 0, depths: new Map() };
    structureEpochs.set(w, e);
  }
  return e;
}
export function markStructureDigestDirty(w: World5Snapshot, depth: number): void {
  const e = structureEpoch(w);
  e.serial++;
  markRecordingRoot(w);
  e.depths.set(depth, (e.depths.get(depth) ?? 0) + 1);
}
export function world5LeafToken(w: World5Snapshot | null, key: string): readonly unknown[] {
  return key.startsWith('structures.')
    ? [w, w ? (structureEpoch(w).depths.get(Number(key.slice(11))) ?? 0) : 0]
    : [w, w?.revision, recordingRootRevision(w)];
}
export function world5DigestLeaves(
  w: World5Snapshot | null,
  facts: unknown = null,
  details: unknown = null,
  cached = false
): Record<string, unknown> {
  const leaves: Record<string, unknown> = {};
  if (!w) leaves.root = null;
  else {
    const { structures, restPoints, stations, nodes, containers, orders, tickets, ...root } = w;
    leaves.root = root;
    const group = (
      key: string,
      rows: readonly { levelRef: { kind: string; depth?: number } }[]
    ) => {
      if (!rows.length) {
        leaves[key] = [];
        return;
      }
      for (const row of rows) {
        const name = key + '.' + row.levelRef.depth;
        leaves[name] ??= [] as unknown[];
        (leaves[name] as unknown[]).push(row);
      }
    };
    if (cached) {
      const e = structureEpoch(w);
      if (
        !e.groups ||
        e.groups.serial !== e.serial ||
        e.groups.array !== structures ||
        e.groups.length !== structures.length
      ) {
        group('structures', structures);
        const grouped = Object.fromEntries(
          Object.entries(leaves).filter(([k]) => k.startsWith('structures'))
        );
        e.groups = {
          serial: e.serial,
          array: structures,
          length: structures.length,
          leaves: grouped
        };
      } else Object.assign(leaves, e.groups.leaves);
    } else group('structures', structures);
    for (const [key, rows] of [
      ['restPoints', restPoints],
      ['stations', stations],
      ['nodes', nodes],
      ['containers', containers],
      ['orders', orders],
      ['tickets', tickets]
    ] as const)
      group(key, rows);
  }
  if (facts !== null) leaves.facts = facts;
  if (details !== null) leaves.workDetails = details;
  return leaves;
}
const rowCanonicalCache = new WeakMap<object, { token: readonly unknown[]; canonical: string }>();
/** Reuse unchanged sparse rows when one component changes in a layer. The full
 * oracle uses c5Canonical on the complete independently projected arrays. */
export function world5CanonicalLeaf(key: string, value: unknown): string {
  if (!key.startsWith('structures.'))
    return c5Canonical(['c5-leaf-v1', 'world5', key, value], true);
  const rows = value as World5Snapshot['structures'];
  const parts = rows.map((row) => {
    const token = [
        row.owner,
        row.regionId,
        row.levelRef,
        row.at.x,
        row.at.y,
        ...(['floor', 'barrier', 'roof', 'fixture'] as const).flatMap((slot) => {
          const c = row[slot];
          return [c, c?.id, c?.definitionId, c?.hp, c?.doorOpen, c?.revision];
        })
      ],
      old = rowCanonicalCache.get(row);
    if (old && token.length === old.token.length && token.every((v, i) => v === old.token[i]))
      return old.canonical;
    const canonical = c5Canonical(row, true);
    rowCanonicalCache.set(row, { token, canonical });
    return canonical;
  });
  return JSON.stringify(['c5-leaf-v1', 'world5', key]).slice(0, -1) + ',[' + parts.join(',') + ']]';
}
export function eventDigest(
  extensions: ExtensionSnapshot | null,
  world5: World5Snapshot | null,
  manifest: ExtensionManifest | null,
  actorActions: import('./ActorActionsRoot').ActorActionsRoot | null = null,
  workFacts: readonly import('../../ext/worldSdk').CommittedWorkFact[] | null = null,
  workDetails: readonly import('./WorldWork').WorldWorkDetail[] | null = null
): EventDigest | null {
  if (!extensions && !world5) return null;
  const domains = {
    extensions: merkleDomain('extensions', { root: extensions }),
    world5: merkleDomain('world5', world5DigestLeaves(world5, workFacts, workDetails)),
    actorActions: merkleDomain('actorActions', { root: actorActions })
  };
  return { domains, root: digestRoot(domains, manifest, EVENT_DOMAINS) };
}
/** Event domains reuse only explicitly clean roots. The full implementation above
 * and mechanicalDigest remain independent oracles, including at chunk boundaries. */
const leafCaches = new WeakMap<
  object,
  Map<string, { token: readonly unknown[]; canonical: string; hash: string }>
>();
const eventCaches = new WeakMap<object, Map<string, { token: readonly unknown[]; hash: string }>>();
export function dirtyEventDigest(
  owner: object,
  manifest: ExtensionManifest | null,
  sources: Readonly<
    Record<
      (typeof EVENT_DOMAINS)[number],
      {
        token: readonly unknown[];
        leaves(): Readonly<Record<string, unknown>>;
        leafToken?(key: string): readonly unknown[];
        canonicalLeaf?(key: string, value: unknown): string;
      }
    >
  >
): EventDigest | null {
  if (!manifest) return null;
  let cache = eventCaches.get(owner);
  if (!cache) {
    cache = new Map();
    eventCaches.set(owner, cache);
  }
  const domains = {} as EventDigest['domains'];
  for (const domain of EVENT_DOMAINS) {
    const source = sources[domain],
      old = cache.get(domain);
    if (
      old &&
      old.token.length === source.token.length &&
      old.token.every((value, i) => value === source.token[i])
    )
      domains[domain] = old.hash;
    else {
      const leaves = source.leaves();
      let leafCache = leafCaches.get(owner);
      if (!leafCache) {
        leafCache = new Map();
        leafCaches.set(owner, leafCache);
      }
      const keys = Object.keys(leaves).sort(compareCodePoints),
        live = new Set(keys.map((k) => domain + '.' + k));
      const hashes = keys.map((key) => {
        const name = domain + '.' + key,
          token = source.leafToken?.(key) ?? source.token,
          prior = leafCache!.get(name);
        if (
          prior &&
          prior.token.length === token.length &&
          prior.token.every((v, i) => v === token[i])
        )
          return prior.hash;
        const canonical =
            source.canonicalLeaf?.(key, leaves[key]) ??
            c5Canonical(['c5-leaf-v1', domain, key, leaves[key]], true),
          hash = sha256(canonical);
        leafCache!.set(name, { token: [...token], canonical, hash });
        return hash;
      });
      for (const key of leafCache.keys())
        if (key.startsWith(domain + '.') && !live.has(key)) leafCache.delete(key);
      const hash = hashJson(['c5-domain-v1', domain, hashes]);
      cache.set(domain, { token: [...source.token], hash });
      domains[domain] = hash;
    }
  }
  return { domains, root: digestRoot(domains, manifest, EVENT_DOMAINS) };
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
/** JSON snapshot invariant without stringify/parse round trips. Undefined
 * object fields are omitted exactly as the former JSON projection omitted them. */
export function cloneDigestProjection(value: any): any {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value))
    return value.map((v) => (v === undefined ? null : cloneDigestProjection(v)));
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(value))
    if (value[k] !== undefined) out[k] = cloneDigestProjection(value[k]);
  return out;
}
/** Independent full implementation: no dirty flags or last-root memoization. */
export function mechanicalDigest(
  snapshot: GameSnapshot,
  inputState: RecordingInputStateV2
): MechanicalDigest {
  const root = cloneDigestProjection(snapshot) as Record<string, any>;
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
    world5: merkleDomain('world5', world5DigestLeaves(world5, workFacts, workDetails)),
    actorActions: merkleDomain('actorActions', { root: actorActions }),
    knowledge: merkleDomain('knowledge', knowledge),
    random: merkleDomain('random', { root: random })
  };
  return {
    domains,
    root: digestRoot(domains, snapshot.extensions?.manifest ?? null, DIGEST_DOMAINS)
  };
}
/** Real inventory, no revision counters and no new RNG stream. */
export function inventoryStamp(items: readonly Item[]): string {
  const rows = items
    .slice()
    .sort((a, b) =>
      (a.inventoryLetter ?? '') < (b.inventoryLetter ?? '')
        ? -1
        : (a.inventoryLetter ?? '') > (b.inventoryLetter ?? '')
          ? 1
          : a.id - b.id
    )
    .map((i) => {
      const world = (
        i as Item & { worldItem?: { definitionId: string; toolDurability: number | null } }
      ).worldItem;
      return [
        i.inventoryLetter ?? '',
        i.id,
        i.category,
        i.consumableId ?? i.identityId ?? 'entity.' + i.id,
        i.quantity,
        world?.definitionId ?? null,
        world?.toolDurability ?? null
      ];
    });
  return hashJson(['c5-inventory-v1', rows]).slice(0, 16);
}
export function recordingStart(header: RecordingHeaderV4): string {
  const { recordedAt: _time, initialDigest, ...identity } = header;
  return hashJson(['c5-recording-start-v1', identity, initialDigest]);
}
export function recordingChain(previous: string, event: RecordingEventV4): string {
  const { chainDigest: _chain, ...payload } = event;
  return hashJson(['c5-recording-event-v1', previous, payload]);
}
export const worldSnapshotHash = (snapshot: GameSnapshot) => hashJson(snapshot);
