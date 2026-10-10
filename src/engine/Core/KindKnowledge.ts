import type { Game } from './Game';
import type { KindKnowledgeState, KindKnowledgeView } from '../../ext/kindKnowledge';
import type { EdibleItemDefinition, EffectIntent } from '../../ext/worldEdible';
import type { ItemDefinitionContribution } from '../../ext/worldSdk';
import { edibleState, peekEdibleState } from './EdibleState';
import { derivedSeedKey, derivedRange } from './DerivedDraw';
import { worldText } from '../../ext/worldText';
import i18next from 'i18next';
import { bindWorldDefinitionPresentation } from '../Items/WorldItemPresentation';
import { assembleWorldItem, bindWorldItem } from '../Items/WorldItems';
import type { Item } from '../Items/Item';
import { deepFreeze } from '../Movement/SpatialSchema';
const presentationGames = new WeakMap<object, Game>();
const cache = new WeakMap<object, Map<string, unknown>>();
function memo<T>(game: Game, key: string, build: () => T): T {
  const runtime = game.extensionRuntime!;
  let c = cache.get(runtime);
  if (!c) {
    c = new Map();
    cache.set(runtime, c);
  }
  if (!c.has(key)) c.set(key, build());
  return c.get(key) as T;
}
export function edibleDefinitions(game: Game): readonly EdibleItemDefinition[] {
  return game.extensionRuntime?.worldDefinitionPacks().flatMap((p) => p.edibleItems ?? []) ?? [];
}
export function edibleDefinition(
  game: Game,
  item: Item | string
): EdibleItemDefinition | undefined {
  const id = typeof item === 'string' ? item : item.worldItem?.definitionId;
  return edibleDefinitions(game).find((d) => d.id === id);
}
export function ownerRange(
  game: Game,
  owner: string,
  domain: string,
  ordinal: number,
  n: number
): number {
  const runtime = game.extensionRuntime!;
  const key = memo(game, 'seed:' + owner, () =>
    derivedSeedKey(
      game.currentSeed,
      owner,
      runtime.worldDefinitionFingerprints()[owner]!.replace(/^sha256:/, '')
    )
  );
  return derivedRange(key, domain, ordinal, n);
}
export function knowledgeMember(game: Game, id: string) {
  for (const p of game.extensionRuntime?.worldDefinitionPacks() ?? [])
    for (const group of p.knowledgeGroups ?? [])
      for (const [index, kind] of group.kinds.entries())
        if ([kind.raw, kind.roasted, kind.node].includes(id)) return { group, kind, index };
  return null;
}
export function knowledgeState(game: Game, id: string): KindKnowledgeState | null {
  const m = knowledgeMember(game, id);
  if (!m) return edibleDefinition(game, id) ? 'known' : null;
  return (
    peekEdibleState(game.extensionRuntime!).kindKnowledge?.rows.find(
      (r) => r.groupId === m.group.id && r.definitionId === id
    )?.state ?? 'unknown'
  );
}
export function knowledgeView(game: Game, owner: string, groupId: string): KindKnowledgeView {
  const group = game
    .extensionRuntime!.worldDefinitionPacks()
    .flatMap((p) => p.knowledgeGroups ?? [])
    .find((g) => g.owner === owner && g.id === groupId);
  if (!group) return deepFreeze({ groupId, rows: [] });
  return deepFreeze({
    groupId,
    rows: group.kinds
      .flatMap((k) =>
        [k.raw, k.roasted, k.node]
          .filter((id): id is string => id !== null)
          .map((id) => ({
            definitionId: id,
            state: knowledgeState(game, id) ?? 'unknown',
            title:
              peekEdibleState(game.extensionRuntime!).kindKnowledge?.rows.find(
                (r) => r.definitionId === id
              )?.title ?? null
          }))
      )
      .sort((a, b) => (a.definitionId < b.definitionId ? -1 : 1))
  });
}
/** True only for a newly added row or a strict knowledge promotion. */
export function markKnowledge(
  game: Game,
  owner: string,
  id: string,
  state: 'tasted' | 'known'
): boolean {
  const m = knowledgeMember(game, id);
  if (!m || m.group.owner !== owner || !['tasted', 'known'].includes(state)) return false;
  const s = edibleState(game.extensionRuntime!),
    rows = (s.kindKnowledge ??= { schema: 1, rows: [] }).rows;
  let row = rows.find((r) => r.definitionId === id);
  if (
    row &&
    ['unknown', 'tasted', 'known'].indexOf(state) <=
      ['unknown', 'tasted', 'known'].indexOf(row.state)
  )
    return false;
  if (!row) {
    row = { groupId: m.group.id, definitionId: id, state, title: null };
    rows.push(row);
  } else row.state = state;
  rows.sort((a, b) =>
    a.groupId === b.groupId
      ? a.definitionId < b.definitionId
        ? -1
        : a.definitionId > b.definitionId
          ? 1
          : 0
      : a.groupId < b.groupId
        ? -1
        : 1
  );
  game.extensionRuntime!.edibleDirty();
  return true;
}
export function callEdible(game: Game, item: Item, title: string): boolean {
  const id = item.worldItem?.definitionId,
    m = id ? knowledgeMember(game, id) : null;
  if (!m || !game.player.inventory.items.includes(item)) return false;
  if (knowledgeState(game, id!) === 'known') return false;
  const text =
    Array.from(title.replace(/[\u0000-\u001f\u007f]/g, '').trim())
      .slice(0, 29)
      .join('') || null;
  const s = edibleState(game.extensionRuntime!),
    rows = (s.kindKnowledge ??= { schema: 1, rows: [] }).rows;
  let row = rows.find((r) => r.definitionId === id);
  if (row) row.title = text;
  else if (text)
    rows.push({ groupId: m.group.id, definitionId: id!, state: 'unknown', title: text });
  s.kindKnowledge!.rows = rows
    .filter((r) => r.state !== 'unknown' || r.title !== null)
    .sort((a, b) =>
      a.groupId === b.groupId
        ? a.definitionId < b.definitionId
          ? -1
          : 1
        : a.groupId < b.groupId
          ? -1
          : 1
    );
  game.extensionRuntime!.edibleDirty();
  return true;
}
function appearance(game: Game, m: NonNullable<ReturnType<typeof knowledgeMember>>) {
  const pool = memo(game, 'appearance:' + m.group.id, () => {
    const p = [...m.group.appearancePool];
    for (let i = p.length - 1; i > 0; i--) {
      const j = ownerRange(
        game,
        m.group.owner,
        m.group.assignmentDomainId,
        p.length - 1 - i,
        i + 1
      );
      [p[i], p[j]] = [p[j]!, p[i]!];
    }
    return p;
  });
  return pool[m.index]!;
}
export function knowledgeName(game: Game, id: string, fallbackKey: string): string {
  const m = knowledgeMember(game, id);
  if (!m) return worldText(fallbackKey);
  const state = knowledgeState(game, id),
    rawKnown = knowledgeState(game, m.kind.raw) === 'known';
  const name = worldText(
    (id === m.kind.node ? rawKnown : state === 'known' || (id === m.kind.roasted && rawKnown))
      ? m.kind.knownNameKey
      : appearance(game, m).nameKey
  );
  if (id === m.kind.node)
    return worldText(m.group.templates.node, {
      name, interpolation: { escapeValue: false },
      defaultValue: i18next.t('ext.foundation.edible.template.node', {
        defaultValue: '{{name}} patch', skipInterpolation: true
      })
    });
  let result =
    id === m.kind.roasted
      ? worldText(m.group.templates.roasted, {
          name, interpolation: { escapeValue: false },
          defaultValue: i18next.t('ext.foundation.edible.template.roasted', {
            defaultValue: 'roasted {{name}}', skipInterpolation: true
          })
        })
      : name;
  if (state === 'tasted') result += worldText(m.group.templates.tastedNote);
  else if (id === m.kind.roasted && rawKnown && state !== 'known')
    result += worldText(m.group.templates.roastUnknownNote);
  const title = peekEdibleState(game.extensionRuntime!).kindKnowledge?.rows.find(
    (r) => r.definitionId === id
  )?.title;
  if (state !== 'known' && title)
    result = worldText(m.group.templates.called, {
      name: result,
      title,
      interpolation: { escapeValue: false },
      defaultValue: i18next.t('ext.foundation.edible.template.called', {
        defaultValue: '{{name}} called "{{title}}"', skipInterpolation: true
      })
    });
  return result;
}
export function knowledgeDescription(game: Game, id: string, fallbackKey: string): string {
  const m = knowledgeMember(game, id),
    d = edibleDefinition(game, id);
  if (!m)
    return (
      worldText(fallbackKey) +
      (d ? i18next.t('ext.foundation.edible.satiety', { value: d.satiety, defaultValue: ' Satiety: {{value}}.' }) : '')
    );
  return knowledgeState(game, id) === 'known'
    ? worldText(m.kind.knownDescriptionKey) +
        (d ? i18next.t('ext.foundation.edible.satiety', { value: d.satiety, defaultValue: ' Satiety: {{value}}.' }) : '')
    : worldText(appearance(game, m).descriptionKey) + worldText(m.group.templates.unknownDetail);
}
export function edibleItemAdapter(game: Game, d: EdibleItemDefinition): ItemDefinitionContribution {
  const runtime = game.extensionRuntime!;
  if (typeof game.currentSeed === 'string') presentationGames.set(runtime, game);
  return memo(game, 'item:' + d.id, () => {
    const adapter: ItemDefinitionContribution = {
      owner: d.owner,
      id: d.id,
      nameKey: d.nameKey,
      descriptionKey: d.descriptionKey,
      glyph: d.glyph,
      color: d.color,
      maxStack: d.maxStack,
      tags: d.tags,
      category: 'material',
      nativeTemplate: null,
      tool: null
    };
    bindWorldDefinitionPresentation(adapter, {
      name: () => knowledgeName(presentationGames.get(runtime) ?? game, d.id, d.nameKey),
      description: () =>
        knowledgeDescription(presentationGames.get(runtime) ?? game, d.id, d.descriptionKey)
    });
    return adapter;
  });
}
export function assembleEdibleItem(game: Game, id: string, quantity = 1): Item {
  const d = edibleDefinition(game, id);
  if (!d) throw new Error('C5_BAD_DEFINITION');
  return assembleWorldItem(edibleItemAdapter(game, d), quantity);
}
export function bindEdibleItem(game: Game, item: Item): void {
  const d = edibleDefinition(game, item);
  if (d) bindWorldItem(item, edibleItemAdapter(game, d));
}
export function resolveEdibleEffect(game: Game, d: EdibleItemDefinition): EffectIntent {
  return memo(game, 'effect:' + d.id, () =>
    d.effect.kind === 'derived-choice'
      ? d.effect.options[
          ownerRange(game, d.owner, d.effect.domainId, d.effect.ordinal, d.effect.options.length)
        ]!
      : d.effect
  );
}
export function confirmationSatiety(game: Game, d: EdibleItemDefinition): number {
  const m = knowledgeMember(game, d.id);
  return m && knowledgeState(game, d.id) !== 'known'
    ? Math.max(
        ...m.group.kinds
          .flatMap((k) => [k.raw, k.roasted])
          .filter((id): id is string => id !== null)
          .map((id) => edibleDefinition(game, id)!.satiety)
      )
    : d.satiety;
}
