import { effectScope, nextTick, ref } from 'vue';
import { observeDisplayFrame } from '../../../../ui/displayProjection';
import { useForagingUi } from '../ui/useForagingUi';
import { buildHarvestCommand } from '../ui/commands';
import { readForagingUiView } from '../ui/view';
import { placeNode, placementCandidates } from '../../../../engine/Core/WorldWorkWorld';
import { describe, expect, it } from 'vitest';
import locale from '../locales/zh_CN.json';
import { loadForagingPack } from '../definitions';
import {
  makeHarness,
  scene,
  game,
  moveNodeBeside,
  harvest,
  waitTurns,
  descend,
  eat,
  mechanics,
  rng,
  view,
  logger
} from './mechanicsHelpers';

const pack = loadForagingPack();
describe('foraging T-NODE natural placement, harvest and regeneration', () => {
  it.each([1, 51020001])(
    'seed %i samples every D1–D12 count, eligible-kind set, budget and receipt',
    (seed) => {
      const h = makeHarness(seed);
      for (let depth = 1; depth <= 12; depth++) {
        const g = game(h),
          nodes = g.world5!.nodes.filter(
            (n) =>
              n.owner === 'foraging' && n.levelRef.kind === 'dungeon' && n.levelRef.depth === depth
          );
        expect(g.depth).toBe(depth);
        expect(nodes.length).toBeGreaterThanOrEqual(depth <= 3 ? 1 : 2);
        expect(nodes.length).toBeLessThanOrEqual(depth <= 3 ? 2 : 3);
        const eligible = pack.kinds
          .filter((k) => k.minDepth <= depth)
          .map((k) => `foraging.${k.id}-patch`);
        for (const n of nodes) {
          expect(eligible).toContain(n.definitionId);
          const e = g.extensionRuntime!.worldWorkEntities().find((e) => e.id === n.interactableId)!;
          expect(e.glyph).toBe('菌');
          expect(e.color).toBe('#B8A4E0');
        }
        expect(g.world5!.nodes.filter((n) => n.owner === 'foraging').length).toBeLessThanOrEqual(
          120
        );
        expect(g.world5!.receipts).toContainEqual(
          expect.objectContaining({
            owner: 'foraging',
            kind: 'placement',
            identity: `foraging.patches@dungeon.${depth}`,
            result: 'completed',
            reason: null
          })
        );
        if (depth < 12) descend(h);
      }
    }
  );
  it('the actual 120-node whole-run cap records a skipped run-limit receipt and adds no further nodes', () => {
    const h = makeHarness(1),
      definition = pack.resourceNodes[0]!;
    // Populate valid owned nodes through the trusted scene constructor across real visited floors.
    for (let depth = 1; depth <= 4; depth++) {
      const g = game(h);
      while (
        g.world5!.nodes.filter((n) => n.owner === 'foraging').length < 120 &&
        g.world5!.nodes.filter((n) => n.levelRef.kind === 'dungeon' && n.levelRef.depth === depth)
          .length < 32
      ) {
        const at = placementCandidates(g)[0];
        if (!at) throw Error('Insufficient scene placement cells');
        placeNode(g, definition, at, `foraging.patches#cap-scene#${g.world5!.nodes.length}`);
      }
      if (depth < 4) descend(h);
    }
    expect(game(h).world5!.nodes.filter((n) => n.owner === 'foraging')).toHaveLength(120);
    descend(h);
    expect(game(h).world5!.nodes.filter((n) => n.owner === 'foraging')).toHaveLength(120);
    expect(game(h).world5!.receipts).toContainEqual(
      expect.objectContaining({
        owner: 'foraging',
        kind: 'placement',
        identity: 'foraging.patches@dungeon.5',
        result: 'skipped',
        reason: 'run-limit'
      })
    );
    expect(
      game(h).world5!.nodes.filter(
        (n) => n.levelRef.kind === 'dungeon' && n.levelRef.depth === 5 && n.owner === 'foraging'
      )
    ).toHaveLength(0);
  });
  it.each([1, 2])(
    'seed %i native terrain, actors, floor loot and both RNG states match without foraging',
    (seed) => {
      const sample = (modules: string[]) => {
        const h = makeHarness(seed, modules),
          result = [];
        for (let depth = 1; depth <= 3; depth++) {
          const g = game(h),
            s = g.toSnapshot();
          result.push({
            depth: g.depth,
            terrain: Array.from({ length: g.grid.height }, (_, y) =>
              Array.from({ length: g.grid.width }, (_, x) => [...g.grid.getCell(x, y)!.layers])
            ),
            at: { ...g.player.loc },
            monsters: g.monsters.map((m) => ({
              type: m.typeId,
              at: { ...m.loc },
              hp: m.hp,
              maxHp: m.maxHp,
              status: { ...m.statusDurations }
            })),
            items: g.items
              .filter((i) => !i.worldItem)
              .map((i) => ({
                name: i.name,
                at: { ...i.loc },
                quantity: i.quantity,
                category: i.category,
                enchantment: i.enchantment,
                flags: i.flags
              })),
            random: s.rngState
          });
          if (depth < 3) descend(h);
        }
        return result;
      };
      expect(sample(['foraging'])).toEqual(sample([]));
    }
  );
  it('one paid 100-tick harvest yields one unit, three empty the node, then 32000 ticks regrow one', async () => {
    const h = makeHarness(),
      g = scene(h),
      n = moveNodeBeside(h),
      id = n.definitionId.replace('-patch', '');
    const start = g.world5!.simulationTicks;
    for (let i = 0; i < 3; i++) {
      expect(harvest(h, n)).toEqual({ recorded: true, error: null });
      expect(n.remaining).toBe(2 - i);
      expect(g.world5!.simulationTicks - start).toBe((i + 1) * 100);
    }
    expect(
      g.player.inventory.items
        .filter((i) => i.worldItem?.definitionId === id)
        .reduce((q, i) => q + i.quantity, 0)
    ).toBe(3);
    const before = g.world5!.simulationTicks;
    expect(harvest(h, n)).toEqual({ recorded: true, error: 'C5_RESOURCE_EMPTY' });
    expect(g.world5!.simulationTicks).toBe(before);
    waitTurns(h, 316);
    expect(harvest(h, n).error).toBe('C5_RESOURCE_EMPTY');
    expect(g.world5!.simulationTicks).toBe(start + 31900);
    waitTurns(h, 1);
    expect(g.world5!.simulationTicks).toBe(start + 32000);
    const roots = mechanics(h),
      random = rng.getState(),
      storedRevision = n.revision;
    const projected = readForagingUiView(view(h))!;
    expect(projected.nodes.find((row) => row.interactableId === n.interactableId)).toMatchObject({
      remaining: 1,
      available: 1,
      canHarvest: true,
      nodeRevision: storedRevision
    });
    for (let read = 0; read < 20; read++) expect(readForagingUiView(view(h))).toEqual(projected);
    expect(mechanics(h)).toEqual(roots);
    expect(rng.getState()).toEqual(random);
    expect(n.revision).toBe(storedRevision);
    const command = buildHarvestCommand(projected, n.interactableId)!;
    expect(command).not.toBeNull();
    const request = JSON.parse(command);
    expect(request.payload.nodeRevision).toBe(storedRevision);
    const scope = effectScope();
    const ui = scope.run(() =>
      useForagingUi(
        {
          game: () => g,
          tick: ref(0),
          immersive: ref(false),
          readDisplayFrame: () => observeDisplayFrame(g, logger),
          canOpenPanel: () => true,
          canPresentInteraction: () => true,
          isPresentationBusy: () => false,
          beforeOpenPanel: () => {},
          afterClosePanel: () => {}
        },
        async () => ({ render: () => null })
      )
    )!;
    try {
      ui.commands.value[0]!.invoke();
      await nextTick();
      await nextTick();
      expect(ui.panelOpen.value).toBe(true);
      expect(ui.panel.value!.props.nodes).toContainEqual(
        expect.objectContaining({
          interactableId: n.interactableId,
          canHarvest: true,
          nodeRevision: storedRevision
        })
      );
      expect(mechanics(h)).toEqual(roots);
      expect(rng.getState()).toEqual(random);
      await (ui.panel.value!.props.onHarvest as (id: number) => Promise<void>)(n.interactableId);
      expect(g.recordedInputEvents[g.recordedInputEvents.length - 1]).toMatchObject({
        action: 'ext:command',
        data: command
      });
    } finally {
      scope.stop();
    }
    const after = mechanics(h);
    expect(h.ext(request.module, request.action, request.payload)).toEqual({
      recorded: true,
      error: 'C5_STALE'
    });
    expect(mechanics(h)).toEqual(after);
    expect(
      g.player.inventory.items
        .filter((i) => i.worldItem?.definitionId === id)
        .reduce((q, i) => q + i.quantity, 0)
    ).toBe(4);
    expect(n.remaining).toBe(0);
    expect(g.world5!.tickets).toHaveLength(0);
    expect(g.world5!.terminalTickets.filter((t) => t.owner === 'foraging')).toHaveLength(4);
  });
  it('full nodes discard excess regeneration and their visible names follow raw knowledge', () => {
    const h = makeHarness(),
      g = scene(h),
      n = moveNodeBeside(h);
    waitTurns(h, 321);
    expect(n.remaining).toBe(3);
    expect(n.regenRemainder).toBe(0);
    const unknown = g
      .readVisibleInteractables()
      .find((e) => e.id === n.interactableId)!.displayName!;
    expect(unknown.endsWith('菌丛')).toBe(true);
    expect(harvest(h, n).error).toBeNull();
    expect(n.remaining).toBe(2);
    waitTurns(h, 1);
    expect(n.remaining).toBe(2);
    const food = g.player.inventory.items.find(
      (i) => i.worldItem?.definitionId === n.definitionId.replace('-patch', '')
    )!;
    g.player.hp = 1;
    eat(h, food);
    const kind = n.definitionId.replace('foraging.', '').replace('-patch', '');
    expect(g.readVisibleInteractables().find((e) => e.id === n.interactableId)!.displayName).toBe(
      `${(locale as Record<string, string>)[`ext.foraging.kind.${kind}.name`]}丛`
    );
  });
});
