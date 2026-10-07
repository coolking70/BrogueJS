/** Neutral executable examples only. No production foraging content. */
import type { ExtensionModule, Json } from '../../../types';
import { FOUNDATION_PROTOCOL, type ModuleDescriptor } from '../../../descriptor';
import { extensionDataFingerprint } from '../../../fingerprint';
import type { WorldDefinitionPack } from '../../../structureTypes';
import type { EffectIntent, EdibleItemDefinition } from '../../../edibleSdk';
import { registerEdibleFixture } from '../../../../engine/Core/EdibleFixturePort';
import { assembleEdibleItem } from '../../../../engine/Core/KindKnowledge';
import { triggerActorNeeds, settleActorNeeds } from '../../../../engine/Core/ActorNeeds';
import { beginDeparture, settleDepartures } from '../../../../engine/Core/ActorDeparture';
import { queueFireContact, drainFireContacts } from '../../../../engine/Core/FireContact';
import { Monster } from '../../../../entities/Monster';
import monsters from '../../../../data/monsters.json';
import { ItemLoader } from '../../../../engine/Items/ItemLoader';
import { settleTimedStats } from '../../../../engine/Core/EdibleEffects';
import { advanceWorldClock } from '../../../world5';
import { spawnDungeonFeature, catalogFeature } from '../../../../engine/Map/DungeonFeature';
import { placeNode } from '../../../../engine/Core/WorldWorkWorld';
import { TerrainType } from '../../../../engine/Map/Grid';
const owner = 'fgfixture';
const edible = (
  id: string,
  effect: EdibleItemDefinition['effect'] = { kind: 'none' },
  fire: EdibleItemDefinition['fire'] = { onContact: 'burn-up', messageKey: 'ext.fgfixture.burn' }
): EdibleItemDefinition => ({
  owner,
  id: `${owner}.${id}`,
  nameKey: `ext.${owner}.${id}.name`,
  descriptionKey: `ext.${owner}.${id}.description`,
  glyph: '*',
  color: '#B8A4E0',
  maxStack: 20,
  tags: ['food.ingredient.mushroom'],
  satiety: 20,
  effect,
  fire
});
const effects: EffectIntent[] = [
  { kind: 'heal-fraction', percent: 30, min: 5 },
  { kind: 'status', status: 'poisoned', turns: 8 },
  { kind: 'status', status: 'slumber', turns: 4 },
  { kind: 'status', status: 'haste', turns: 8 },
  { kind: 'status', status: 'telepathy', turns: 8 },
  { kind: 'status-and-satiety', status: 'nauseous', turns: 8, satietyLoss: 20, floor: 10 },
  {
    kind: 'temp-stat',
    turns: 4,
    player: { key: 'native.strength', value: 2 },
    other: { key: 'native.physical-damage-dealt', category: 'increased', valueBp: 2000 }
  },
  { kind: 'explosive' }
];
const items = [
  edible(
    'raw',
    { kind: 'none' },
    { onContact: 'transform', to: 'fgfixture.roasted', messageKey: 'ext.fgfixture.roast' }
  ),
  edible(
    'roasted',
    {
      kind: 'derived-choice',
      domainId: 'fgfixture.roast-policy',
      ordinal: 0,
      options: [{ kind: 'none' }, { kind: 'status', status: 'poisoned', turns: 2 }]
    },
    { onContact: 'transform', to: 'fgfixture.charred', messageKey: 'ext.fgfixture.char' }
  ),
  edible('charred'),
  ...effects.map((e, i) =>
    edible(
      'sample' + i,
      e,
      i === 7
        ? { onContact: 'explode', largeAtQuantity: 3, messageKey: 'ext.fgfixture.explode' }
        : undefined
    )
  )
];
const node = (id: string, raw: string) => ({
  owner,
  id: `fgfixture.${id}`,
  nameKey: `ext.fgfixture.${id}.name`,
  descriptionKey: `ext.fgfixture.${id}.description`,
  glyph: '*',
  color: '#B8A4E0',
  kind: 'fungus' as const,
  yield: [{ itemDefinitionId: `fgfixture.${raw}`, count: 1 }],
  capacity: 3,
  harvestTicks: 100,
  unitsPerHarvest: 1,
  requiredToolTag: null,
  regeneration: { kind: 'none' as const },
  placement: { dungeon: null, site: null }
});
export const definitions: WorldDefinitionPack = {
  schema: 1,
  worldSdk: 1,
  items: [],
  resourceNodes: [node('node-a', 'raw'), node('node-b', 'sample0')],
  stations: [],
  recipes: [],
  startupItems: null,
  edibleItems: items,
  knowledgeGroups: [
    {
      owner,
      id: 'fgfixture.kinds',
      kinds: [
        {
          id: 'a',
          raw: 'fgfixture.raw',
          roasted: 'fgfixture.roasted',
          node: 'fgfixture.node-a',
          knownNameKey: 'ext.fgfixture.known-a',
          knownDescriptionKey: 'ext.fgfixture.detail-a'
        },
        ...['0', '1', '7'].map((id, i) => ({
          id: 'k' + id,
          raw: 'fgfixture.sample' + id,
          roasted: null,
          node: i === 0 ? 'fgfixture.node-b' : null,
          knownNameKey: 'ext.fgfixture.known-' + id,
          knownDescriptionKey: 'ext.fgfixture.detail-' + id
        }))
      ],
      appearancePool: Array.from({ length: 6 }, (_, i) => ({
        id: 'a' + i,
        nameKey: 'ext.fgfixture.appearance-' + i,
        descriptionKey: 'ext.fgfixture.appearance-detail-' + i
      })),
      assignmentDomainId: 'fgfixture.kinds.appearance',
      templates: {
        roasted: 'ext.fgfixture.template.roasted',
        node: 'ext.fgfixture.template.node',
        tastedNote: 'ext.fgfixture.template.tasted',
        roastUnknownNote: 'ext.fgfixture.template.roast-unknown',
        called: 'ext.fgfixture.template.called',
        unknownDetail: 'ext.fgfixture.template.unknown'
      }
    }
  ],
  placementGroups: [
    {
      owner,
      id: 'fgfixture.group',
      members: [
        { resourceDefinitionId: 'fgfixture.node-a', minDepth: 1, weight: 3 },
        { resourceDefinitionId: 'fgfixture.node-b', minDepth: 3, weight: 1 }
      ],
      perDepth: [{ fromDepth: 1, toDepth: 40, min: 1, max: 2 }],
      maxPerRun: 40,
      preference: {
        tags: ['terrain.fungus-forest', 'terrain.luminescent-fungus'],
        radius: 3,
        preferredWeight: 4,
        otherWeight: 1
      }
    }
  ],
  actorNeeds: [
    {
      owner,
      id: 'fgfixture.satiety',
      role: 'satiety',
      max: 100,
      initial: 50,
      ticksPerPoint: 10,
      bands: [
        { id: 'full', atOrBelow: 100 },
        { id: 'low', atOrBelow: 20 },
        { id: 'empty', atOrBelow: 0 }
      ],
      zeroDeadlineTicks: 200,
      departure: { visibleGraceTicks: 300 }
    }
  ]
};
export const locales: Record<string, string> = {
  'ext.fgfixture.label': '采食底座样本',
  'ext.fgfixture.roast': '{{item}}变成了{{result}}。',
  'ext.fgfixture.char': '{{item}}变成了{{result}}。',
  'ext.fgfixture.burn': '{{item}}烧尽了。',
  'ext.fgfixture.explode': '{{item}}爆裂了。',
  'ext.fgfixture.template.roasted': '烤{{name}}',
  'ext.fgfixture.template.node': '{{name}}节点',
  'ext.fgfixture.template.tasted': '（尝过）',
  'ext.fgfixture.template.roast-unknown': '（烤制未知）',
  'ext.fgfixture.template.called': '{{name}}，称作“{{title}}”',
  'ext.fgfixture.template.unknown': ' 未知效果。'
};
for (const [i, d] of [...items, ...definitions.resourceNodes].entries()) {
  locales[d.nameKey] = `样本${i}`;
  locales[d.descriptionKey] = `底座测试样本${i}。`;
}
for (const k of definitions.knowledgeGroups![0]!.kinds) {
  locales[k.knownNameKey] = '已知样本' + k.id;
  locales[k.knownDescriptionKey] = '样本说明' + k.id;
}
for (const a of definitions.knowledgeGroups![0]!.appearancePool) {
  locales[a.nameKey] = '外观样本' + a.id;
  locales[a.descriptionKey] = '外观说明' + a.id;
}
const rules = { schema: 1, version: '1.0.0', fingerprint: extensionDataFingerprint(definitions) };
function history(tx: { state: any; replaceState(v: any): void }, fact: unknown): void {
  tx.replaceState({ history: [...tx.state.history, fact].slice(-128) });
}
export function createForageFixture(): ExtensionModule {
  const m: ExtensionModule = {
    id: owner,
    version: '1.0.0',
    rules,
    worldDefinitions: definitions,
    initialState: () => ({ history: [] }),
    validateState: (v: unknown): v is Json =>
      !!v &&
      typeof v === 'object' &&
      Array.isArray((v as any).history) &&
      (v as any).history.length <= 128,
    commands: { fixture: () => {} },
    edibleCommands: {
      feed: { prepare: (p, sdk) => sdk.planFeed(p as any) },
      roast: { prepare: (p, sdk) => sdk.planRoast(p as any) }
    },
    worldWorkCommands: {
      harvest: { prepare: (p, sdk) => sdk.planTimedWork({ kind: 'harvest', ...(p as any) }) }
    },
    edibleParticipant: {
      onConsumed(f, tx) {
        history(tx, f);
        if (f.definitionId) {
          tx.markKnowledge(f.definitionId, f.outcome.applied ? 'known' : 'tasted');
        }
      },
      onFireContact(f, tx) {
        history(tx, f);
        if (f.result === 'exploded' && f.visibleToPlayer) tx.markKnowledge(f.definitionId, 'known');
      }
    },
    actorNeedParticipant: {
      qualifies: (_id, f) => f.allied && !f.inanimate && !f.timedSummon && f.groupRole !== 'member',
      onNeedEvent(f, tx) {
        history(tx, f);
        if (f.kind === 'band') tx.setOwnComponent(f.actorId, 'need-band', { band: f.band });
        if (f.kind === 'deadline') tx.depart(f.actorId);
      }
    },
    componentValidators: {
      'need-band': (v) => !!v && typeof v === 'object' && typeof (v as any).band === 'string'
    },
    projectView: (c) =>
      c.edible
        ? ({
            context: c.edible.readEdibleContext(),
            knowledge: c.edible.knowledge('fgfixture.kinds')
          } as unknown as Json)
        : null
  };
  return registerEdibleFixture(m, (game, payload) => {
    const p = payload as any;
    if (!p || typeof p.kind !== 'string') throw new Error('C5_BAD_PAYLOAD');
    if (p.kind === 'grant') {
      const item = assembleEdibleItem(game, p.definitionId, p.quantity ?? 1);
      if (p.floor) {
        item.loc = { ...(p.at ?? game.player.loc) };
        game.items.push(item);
      } else if (!game.player.inventory.addItem(item)) throw new Error('C5_CAPACITY');
    } else if (p.kind === 'ally') {
      const d = monsters.find((d) => d.id === (p.monsterId ?? 'goblin'))!,
        a = new Monster(p.at?.x ?? game.player.x + 1, p.at?.y ?? game.player.y, d as any);
      a.ticksUntilTurn = p.ticksUntilTurn ?? 1000000;
      if (p.hp !== undefined) a.hp = a.maxHp = p.hp;
      game.monsters.push(a);
      game.extensionRuntime!.attachCreature(a);
      game.becomeAllyWith(a);
    } else if (p.kind === 'group') {
      const body = game.extensionRuntime!.edibleModule('giants')?.nativeBodies?.definitions[0];
      if (!body) throw new Error('C5_DISABLED');
      const core = game.createCompositeMonster(body.id, p.at ?? { x: 12, y: 10 });
      if (!core) throw new Error('C5_GATE');
      game.becomeAllyWith(core);
      for (const a of game.monsters) a.ticksUntilTurn = 1000000;
    } else if (p.kind === 'resurrect') {
      if (!game.resurrectAlly(p.at ?? { x: 11, y: 10 })) throw new Error('C5_GATE');
    } else if (p.kind === 'fall') {
      game.monsters.find((a) => a.id === p.actorId)!.falling = true;
      (game as any).monstersFall();
      settleDepartures(game);
    } else if (p.kind === 'stairs') {
      game.grid.setTerrain(
        game.player.x,
        game.player.y,
        p.up ? TerrainType.STAIRS_UP : TerrainType.STAIRS_DOWN
      );
    } else if (p.kind === 'departure-step') {
      const a = game.monsters.find((a) => a.id === p.actorId)!;
      game.departureTurn(a);
      settleDepartures(game);
    } else if (p.kind === 'departure-settle') settleDepartures(game, !!p.leaving);
    else if (p.kind === 'relocate') {
      const a = game.monsters.find((a) => a.id === p.actorId)!;
      a.loc = { ...p.at };
    } else if (p.kind === 'scroll') {
      const item = ItemLoader.spawnScroll('scroll_of_identify', p.at?.x ?? 11, p.at?.y ?? 10);
      if (!item) throw new Error('C5_BAD_DEFINITION');
      game.items.push(item);
    } else if (p.kind === 'potion') {
      const item = ItemLoader.spawnPotion(
        p.id ?? 'potion_of_detect_magic',
        game.player.x,
        game.player.y
      );
      if (!item || !game.player.inventory.addItem(item)) throw new Error('C5_INPUT');
    } else if (p.kind === 'advance') {
      advanceWorldClock(game.world5!, p.ticks);
      settleActorNeeds(game, !!p.deferred);
      settleTimedStats(game, !!p.deferred);
      settleDepartures(game);
    } else if (p.kind === 'status')
      game.applyEdibleStatus(
        p.actorId === game.player.id ? game.player : game.monsters.find((a) => a.id === p.actorId)!,
        p.status,
        p.turns
      );
    else if (p.kind === 'damage') {
      const actor =
        p.actorId === game.player.id ? game.player : game.monsters.find((a) => a.id === p.actorId)!;
      actor.takeDamage(p.amount);
    } else if (p.kind === 'df') {
      spawnDungeonFeature(game.grid, p.at.x, p.at.y, catalogFeature(p.df), false);
      game.requestEdibleRender();
    } else if (p.kind === 'station') {
      const d = game
        .extensionRuntime!.worldDefinitionPacks()
        .flatMap((p) => p.stations)
        .find((d) => d.id === p.definitionId)!;
      const e = game.extensionRuntime!.worldWorkPlace({
        owner: d.owner,
        depth: game.depth,
        x: p.at.x,
        y: p.at.y,
        instanceKey: 'fixture.station.' + game.world5!.nextWorldId,
        contentId: d.id,
        nameKey: d.nameKey,
        descriptionKey: d.descriptionKey,
        glyph: d.glyph,
        color: d.color,
        interactionDistance: d.interactionDistance,
        priority: 0
      });
      game.world5!.stations.push({
        owner: d.owner,
        definitionId: d.id,
        interactableId: e.id,
        levelRef: { kind: 'dungeon', depth: game.depth },
        boundComponentId: null,
        revision: 0
      });
    } else if (p.kind === 'trigger') {
      const a = game.monsters.find((a) => a.id === p.actorId);
      if (!a) throw new Error('C5_UNKNOWN_TARGET');
      if (p.allied !== undefined) a.isAlly = p.allied;
      triggerActorNeeds(game, [a], p.trigger ?? 'trusted');
    } else if (p.kind === 'resident') {
      const a = game.monsters.find((a) => a.id === p.actorId)!;
      triggerActorNeeds(game, [a], 'resident-changed');
    } else if (p.kind === 'departure')
      beginDeparture(game, p.actorId, {
        owner,
        reason: 'fixture',
        visibleGraceTicks: p.grace ?? 300
      });
    else if (p.kind === 'fire') {
      const item = [...game.items, ...game.player.inventory.items].find((i) => i.id === p.itemId)!;
      queueFireContact(game, item, p.cause ?? 'floor-burning');
      drainFireContacts(game);
    } else if (p.kind === 'food') {
      const item = ItemLoader.spawnFood(
        p.nativeFood ?? 'ration_of_food',
        game.player.x,
        game.player.y
      );
      game.player.inventory.addItem(item!);
    } else if (p.kind === 'node') {
      const d = definitions.resourceNodes.find((d) => d.id === p.definitionId)!;
      placeNode(game, d, p.at, 'fixture.node.' + game.world5!.nextWorldId);
    } else throw new Error('C5_BAD_PAYLOAD');
  });
}
export const descriptor: ModuleDescriptor = {
  id: owner,
  version: '1.0.0',
  foundation: FOUNDATION_PROTOCOL,
  worldSdk: 1,
  rules,
  create: createForageFixture,
  labelKey: 'ext.fgfixture.label',
  locales: { zh_CN: locales }
};
