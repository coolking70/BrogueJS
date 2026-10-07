/** Strict optional 5A4 package extension; absent keys never change old packs. */
import type { WorldDefinitionPack } from '../../ext/structureTypes';
import type { ExtensionModule } from '../../ext/types';
import { validId } from '../../ext/json';
import { World5Error } from '../../ext/world5';
import { NATIVE_STAT_KEYS } from '../Stats/NativeStatKeys';
import { c5Canonical } from './WorldCanonical';
export const EDIBLE_PACKAGE_KEYS = [
  'edibleItems',
  'knowledgeGroups',
  'placementGroups',
  'actorNeeds'
] as const;
export const FOUNDATION_EDIBLE_RULES = Object.freeze({
  draw: 'c5-derive-v1',
  seed: 'c5-derive-seed-v1',
  placement: 'c5-group-place-v1',
  fireCooldownBlocks: 10
});
export const hasEdibleDeclarations = (p: WorldDefinitionPack | undefined) =>
  !!p && EDIBLE_PACKAGE_KEYS.some((k) => p[k] !== undefined);
export function validateEdibleDefinitions(
  p: WorldDefinitionPack,
  owner: string,
  locale?: ReadonlySet<string>
): void {
  const fail = (f: string): never => {
    throw new World5Error('C5_BAD_DEFINITION', f);
  };
  const record = (v: any, keys: string) => {
    if (
      !v ||
      Array.isArray(v) ||
      Object.keys(v).sort().join(',') !== keys.split(',').sort().join(',')
    )
      fail(keys);
  };
  const int = (v: any, min: number, max: number) => {
    if (!Number.isSafeInteger(v) || v < min || v > max) fail('integer');
  };
  const list = (v: any, min: number, max: number) => {
    if (!Array.isArray(v) || v.length < min || v.length > max) fail('list');
  };
  const text = (v: any) => {
    if (
      typeof v !== 'string' ||
      v.length > 256 ||
      !v.startsWith(`ext.${owner}.`) ||
      (locale && !locale.has(v))
    )
      fail('locale');
  };
  const id = (v: any) => {
    if (!validId(v) || !v.startsWith(owner + '.')) fail('id');
  };
  const unique = new Set(
    [
      ...p.items,
      ...p.resourceNodes,
      ...p.stations,
      ...p.recipes,
      ...(p.structures ?? []),
      ...(p.restPoints ?? [])
    ].map((d) => d.id)
  );
  const define = (d: any) => {
    id(d.id);
    if (d.owner !== owner || unique.has(d.id)) fail('owner/id');
    unique.add(d.id);
  };
  const tags = (v: any, max = 16) => {
    list(v, 0, max);
    if (v.some((x: any, i: number) => !validId(x) || (i && v[i - 1] >= x))) fail('tags');
  };
  for (const k of EDIBLE_PACKAGE_KEYS)
    if (p[k] !== undefined) list(p[k], 0, k === 'edibleItems' ? 128 : k === 'actorNeeds' ? 4 : 8);
  const effect = (v: any) => {
    if (!v || typeof v !== 'object') fail('effect');
    switch (v.kind) {
      case 'none':
      case 'explosive':
        record(v, 'kind');
        break;
      case 'heal-fraction':
        record(v, 'kind,percent,min');
        int(v.percent, 1, 100);
        int(v.min, 0, 1000);
        break;
      case 'status':
        record(v, 'kind,status,turns');
        if (
          ![
            'poisoned',
            'hallucinating',
            'confused',
            'nauseous',
            'telepathy',
            'darkness',
            'haste',
            'paralyzed',
            'slumber'
          ].includes(v.status)
        )
          fail('status');
        int(v.turns, 1, 1000);
        break;
      case 'status-and-satiety':
        record(v, 'kind,status,turns,satietyLoss,floor');
        if (v.status !== 'nauseous') fail('status');
        int(v.turns, 1, 1000);
        int(v.satietyLoss, 1, 2150);
        int(v.floor, 0, 2150);
        break;
      case 'temp-stat': {
        record(v, 'kind,turns,player,other');
        record(v.player, 'key,value');
        record(v.other, 'key,category,valueBp');
        int(v.turns, 1, 2000);
        const player = NATIVE_STAT_KEYS.find((k) => k.id === v.player.key),
          other = NATIVE_STAT_KEYS.find((k) => k.id === v.other.key);
        if (
          !player ||
          player.kind !== 'materialized' ||
          !other ||
          other.kind !== 'query' ||
          !['increased', 'more'].includes(v.other.category)
        )
          fail('temp-stat.key');
        int(v.player.value, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
        const budget =
          v.other.category === 'increased'
            ? other!.increased
            : other!.moreSlots.find((s) => s.id === 'temporary')!;
        int(v.other.valueBp, budget.minimum, budget.maximum);
        break;
      }
      default:
        fail('effect.kind');
    }
  };
  for (const d of p.edibleItems ?? []) {
    record(d, 'owner,id,nameKey,descriptionKey,glyph,color,maxStack,tags,satiety,effect,fire');
    define(d);
    text(d.nameKey);
    text(d.descriptionKey);
    tags(d.tags);
    int(d.maxStack, 1, 20);
    int(d.satiety, 0, 2150);
    if (
      typeof d.glyph !== 'string' ||
      [...d.glyph].length !== 1 ||
      !/^#[a-fA-F0-9]{6}$/.test(d.color)
    )
      fail('appearance');
    if (d.effect?.kind === 'derived-choice') {
      record(d.effect, 'kind,domainId,ordinal,options');
      if (!validId(d.effect.domainId)) fail('domain');
      int(d.effect.ordinal, 0, Number.MAX_SAFE_INTEGER);
      list(d.effect.options, 2, 8);
      d.effect.options.forEach(effect);
    } else effect(d.effect);
    if (!d.fire || typeof d.fire !== 'object') fail('fire');
    text(d.fire.messageKey);
    switch (d.fire.onContact) {
      case 'transform':
        record(d.fire, 'onContact,to,messageKey');
        if (!p.edibleItems?.some((x) => x.id === (d.fire as { to: string }).to)) fail('transform');
        break;
      case 'burn-up':
        record(d.fire, 'onContact,messageKey');
        break;
      case 'explode':
        record(d.fire, 'onContact,largeAtQuantity,messageKey');
        int(d.fire.largeAtQuantity, 1, 20);
        break;
      default:
        fail('fire');
    }
  }
  for (const d of p.edibleItems ?? []) {
    const seen = new Set<string>();
    let next = d;
    while (next.fire.onContact === 'transform') {
      if (seen.has(next.id)) fail('transform.cycle');
      seen.add(next.id);
      const target = p.edibleItems!.find((x) => x.id === (next.fire as { to: string }).to)!;
      if (target.maxStack < next.maxStack) fail('transform.maxStack');
      next = target;
    }
  }
  const members = new Set<string>();
  for (const g of p.knowledgeGroups ?? []) {
    record(g, 'owner,id,kinds,appearancePool,assignmentDomainId,templates');
    define(g);
    if (!validId(g.assignmentDomainId)) fail('domain');
    list(g.kinds, 1, 32);
    list(g.appearancePool, g.kinds.length, 64);
    const local = new Set<string>();
    for (const k of g.kinds) {
      record(k, 'id,raw,roasted,node,knownNameKey,knownDescriptionKey');
      if (!validId(k.id) || local.has(k.id)) fail('kind.id');
      local.add(k.id);
      text(k.knownNameKey);
      text(k.knownDescriptionKey);
      if (!p.edibleItems?.some((d) => d.id === k.raw)) fail('kind.raw');
      for (const def of [k.raw, k.roasted, k.node])
        if (def !== null) {
          if (
            members.has(def) ||
            (def === k.node
              ? !p.resourceNodes.some((d) => d.id === def)
              : !p.edibleItems?.some((d) => d.id === def))
          )
            fail('knowledge.member');
          members.add(def);
        }
    }
    // Unknown identity must not be inferable from raw/roasted item metadata.
    const appearances = g.kinds
      .flatMap((k) => [k.raw, k.roasted].filter((id): id is string => id !== null))
      .map((id) => p.edibleItems!.find((d) => d.id === id)!);
    const first = appearances[0]!;
    for (const d of appearances)
      for (const key of ['glyph', 'color', 'maxStack', 'tags'] as const)
        if (c5Canonical(d[key]) !== c5Canonical(first[key])) fail('knowledge.' + key);
    for (const k of g.kinds)
      if (k.node !== null) {
        const node = p.resourceNodes.find((d) => d.id === k.node)!;
        for (const key of ['glyph', 'color'] as const)
          if (node[key] !== first[key]) fail('knowledge.node.' + key);
      }
    local.clear();
    for (const a of g.appearancePool) {
      record(a, 'id,nameKey,descriptionKey');
      if (!validId(a.id) || local.has(a.id)) fail('appearance.id');
      local.add(a.id);
      text(a.nameKey);
      text(a.descriptionKey);
    }
    record(g.templates, 'roasted,node,tastedNote,roastUnknownNote,called,unknownDetail');
    Object.values(g.templates).forEach(text);
  }
  const grouped = new Set<string>();
  for (const g of p.placementGroups ?? []) {
    record(g, 'owner,id,members,perDepth,maxPerRun,preference');
    define(g);
    list(g.members, 1, 64);
    list(g.perDepth, 0, 40);
    int(g.maxPerRun, 0, 512);
    const local = new Set<string>();
    for (const m of g.members) {
      record(m, 'resourceDefinitionId,minDepth,weight');
      const d = p.resourceNodes.find((d) => d.id === m.resourceDefinitionId);
      if (
        !d ||
        d.placement.dungeon !== null ||
        d.placement.site !== null ||
        local.has(m.resourceDefinitionId)
      )
        fail('group.member');
      local.add(m.resourceDefinitionId);
      grouped.add(m.resourceDefinitionId);
      int(m.minDepth, 1, 40);
      int(m.weight, 1, 100);
    }
    const covered = new Set<number>();
    for (const r of g.perDepth) {
      record(r, 'fromDepth,toDepth,min,max');
      int(r.fromDepth, 1, 40);
      int(r.toDepth, r.fromDepth, 40);
      int(r.min, 0, 32);
      int(r.max, r.min, 32);
      for (let d = r.fromDepth; d <= r.toDepth; d++) {
        if (covered.has(d)) fail('group.range');
        covered.add(d);
      }
    }
    if (g.preference !== null) {
      record(g.preference, 'tags,radius,preferredWeight,otherWeight');
      tags(g.preference.tags, 2);
      if (
        g.preference.tags.some(
          (t) => !['terrain.luminescent-fungus', 'terrain.fungus-forest'].includes(t)
        )
      )
        fail('terrain.tag');
      int(g.preference.radius, 0, 8);
      int(g.preference.preferredWeight, 1, 16);
      int(g.preference.otherWeight, 1, 16);
    }
    for (const d of [1, 40])
      for (const kind of ['count', 'kind', 'cell'])
        if (!validId(`${g.id}.${kind}.dungeon.${d}`)) fail('group.domain');
  }
  for (const d of p.actorNeeds ?? []) {
    record(d, 'owner,id,role,max,initial,ticksPerPoint,bands,zeroDeadlineTicks,departure');
    define(d);
    if (d.role !== 'satiety') fail('role');
    int(d.max, 1, 1000000);
    int(d.initial, 0, d.max);
    int(d.ticksPerPoint, 1, 1000000);
    list(d.bands, 1, 8);
    const ids = new Set<string>();
    d.bands.forEach((b, i) => {
      record(b, 'id,atOrBelow');
      if (!validId(b.id) || ids.has(b.id)) fail('band');
      ids.add(b.id);
      int(b.atOrBelow, 0, d.max);
      if (i === 0 ? b.atOrBelow !== d.max : b.atOrBelow >= d.bands[i - 1]!.atOrBelow)
        fail('band.order');
    });
    if (d.zeroDeadlineTicks !== null) int(d.zeroDeadlineTicks, 1, 10000000);
    if (d.departure !== null) {
      record(d.departure, 'visibleGraceTicks');
      int(d.departure.visibleGraceTicks, 0, 100000);
      if (d.departure.visibleGraceTicks % 100) fail('departure');
    }
  }
  c5Canonical(p);
}
export function validateEdibleModule(m: ExtensionModule, worldSdk: number | undefined): void {
  const fail = (code: 'C5_BAD_VERSION' | 'C5_BAD_DEFINITION', field: string): never => {
    throw new World5Error(code, field);
  };
  if (
    (hasEdibleDeclarations(m.worldDefinitions) ||
      m.edibleCommands ||
      m.edibleParticipant ||
      m.actorNeedParticipant) &&
    (!m.worldDefinitions || worldSdk !== 1)
  )
    fail('C5_BAD_VERSION', 'edible');
  for (const [action, c] of Object.entries(m.edibleCommands ?? {}))
    if (
      !['feed', 'roast'].includes(action) ||
      !c ||
      Object.keys(c).join(',') !== 'prepare' ||
      typeof c.prepare !== 'function' ||
      m.commands?.[action] ||
      (m.worldWorkCommands as any)?.[action]
    )
      fail('C5_BAD_DEFINITION', 'edibleCommands');
  for (const [k, v] of Object.entries(m.edibleParticipant ?? {}))
    if (!['onConsumed', 'onFireContact'].includes(k) || typeof v !== 'function')
      fail('C5_BAD_DEFINITION', 'edibleParticipant');
  for (const [k, v] of Object.entries(m.actorNeedParticipant ?? {}))
    if (!['qualifies', 'onNeedEvent'].includes(k) || typeof v !== 'function')
      fail('C5_BAD_DEFINITION', 'actorNeedParticipant');
  if (
    m.worldDefinitions?.actorNeeds !== undefined &&
    typeof m.actorNeedParticipant?.qualifies !== 'function'
  )
    fail('C5_BAD_DEFINITION', 'qualifies');
}
export function validateEdibleTemplates(
  p: WorldDefinitionPack | undefined,
  locales: Readonly<Record<string, Readonly<Record<string, string>>>> | undefined
): void {
  for (const g of p?.knowledgeGroups ?? [])
    for (const resource of Object.values(locales ?? {}))
      for (const [k, key] of Object.entries(g.templates)) {
        const actual = (resource[key]?.match(/{{\s*([^{}]+?)\s*}}/g) ?? []).sort().join(',');
        const expected =
          k === 'roasted' || k === 'node' ? '{{name}}' : k === 'called' ? '{{name}},{{title}}' : '';
        if (!resource[key] || actual !== expected)
          throw new World5Error('C5_BAD_DEFINITION', 'templates.' + k);
      }
  if (p?.knowledgeGroups?.length && !locales)
    throw new World5Error('C5_BAD_DEFINITION', 'templates.locale');
}
