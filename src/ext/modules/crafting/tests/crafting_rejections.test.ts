import { describe, expect, it } from 'vitest';
import { assembleWorldItem } from '../../../../engine/Items/WorldItems';
import { itemDefinition } from '../../../../engine/Core/WorldWorkWorld';
import { add, adjacent, arena, craftPayload, descend, fillBag, game, harness, harvestPayload, mechanics, nearNode, node, place, read, rejected, staged } from './runtimeHelpers';

describe('crafting T10 public rejection is recorded and mechanically free', () => {
  it.each([
    ['stale-node', 'C5_STALE'], ['stale-inventory', 'C5_STALE'], ['forged-actor', 'C5_BAD_PAYLOAD'],
    ['wrong-level', 'C5_WRONG_LEVEL'], ['unseen', 'C5_UNKNOWN_TARGET'], ['distance', 'C5_DISTANCE'],
    ['empty', 'C5_RESOURCE_EMPTY'], ['reserved', 'C5_RESERVED'], ['full-pack', 'C5_CAPACITY'],
    ['bad-time', 'C5_BAD_TIME'], ['overflow', 'C5_OVERFLOW'], ['busy', 'C5_BUSY'],
    ['terminal', 'C5_TERMINAL'], ['dead', 'C5_DEAD'], ['provider', 'C5_PROVIDER']
  ] as const)('%s rejects with %s, 0 tick/material/RNG/ID and exactly one event', (kind, code) => {
    const h = harness(), n = nearNode(h), g = game(h);
    let payload: Record<string, unknown> = harvestPayload(h, n);
    if (kind === 'stale-node') payload.nodeRevision = n.revision + 1;
    if (kind === 'stale-inventory') payload.inventoryStamp = 'stale';
    if (kind === 'forged-actor') payload.actorId = g.player.id;
    if (kind === 'wrong-level') n.levelRef = { kind: 'dungeon', depth: 2 };
    if (kind === 'unseen') g.grid.getCell(n.at.x, n.at.y)!.hasMemory = false;
    if (kind === 'distance') g.player.loc = { x: g.player.x + 5, y: g.player.y };
    if (kind === 'empty') { n.remaining = 0; n.lastSettledTick = g.world5!.simulationTicks; }
    if (kind === 'reserved') n.reservedUnits = n.remaining;
    if (kind === 'full-pack') { fillBag(g); payload.inventoryStamp = read(h).inventoryStamp; }
    if (kind === 'bad-time') n.lastSettledTick = g.world5!.simulationTicks + 1;
    if (kind === 'overflow') { n.remaining = 1; n.regenRemainder = Number.MAX_SAFE_INTEGER; g.world5!.simulationTicks = 100; }
    if (kind === 'busy') g.player.ticksUntilTurn = 100;
    if (kind === 'terminal') g.isGameOver = true;
    if (kind === 'dead') g.player.hp = 0;
    if (kind === 'provider') n.definitionId = 'crafting.missing-definition';
    rejected(h, 'harvest', payload, code);
  });

  it.each([0, 17, 1.5, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1])('batchCount %s cannot exceed bounds or cause unsafe multiplication', count => {
    const h = staged();
    rejected(h, 'craft', craftPayload(h, 'make-table-kit', count), 'C5_BAD_PAYLOAD');
  });

  it('unknown recipe, missing inputs and no output/refund slots reject without reservations', () => {
    const h = staged(), g = game(h);
    rejected(h, 'craft', { ...craftPayload(h), recipeId: 'crafting.missing' }, 'C5_BAD_DEFINITION');
    rejected(h, 'craft', craftPayload(h, 'make-hearth-kit'), 'C5_INPUT');
    fillBag(g);
    rejected(h, 'craft', craftPayload(h, 'make-pick'), 'C5_CAPACITY');
    expect(h.world5()!.containers.some(c => c.kind === 'escrow')).toBe(false);
  });

  it('stale stationRevision and wrong fixture table tags reject', () => {
    const h = staged(arena, { fixtures: ['world-work-basic'] }), g = game(h);
    expect(place(h).error).toBeNull();
    add(g, 'metal', 4);
    const payload = craftPayload(h, 'make-dagger');
    rejected(h, 'craft', { ...payload, stationRevision: payload.stationRevision! + 1 }, 'C5_STALE');
    const fixture = read(h).stations.find(s => s.definitionId === 'c5fixture.table')!;
    expect(fixture.tags).toEqual(['table']);
    const position = fixture.workPositions[0]!;
    g.player.loc = { ...position };
    rejected(h, 'craft', { ...craftPayload(h, 'make-dagger'), stationId: fixture.interactableId, stationRevision: fixture.revision }, 'C5_INPUT');
  });

  it('station placement is blocked at occupied cells and capped at 16 per level', () => {
    const h = staged(), g = game(h);
    rejected(h, 'place-station', { v: 1, definitionId: 'crafting.table', x: g.player.x, y: g.player.y, inventoryStamp: read(h).inventoryStamp }, 'C5_BLOCKED');
    expect(place(h).error).toBeNull();
    const first = g.world5!.stations[0]!;
    // Stage the accounting boundary; no extra station is created through a private action.
    while (g.world5!.stations.length < 16) g.world5!.stations.push({ ...first });
    rejected(h, 'place-station', { v: 1, definitionId: 'crafting.table', ...adjacent(g), inventoryStamp: read(h).inventoryStamp }, 'C5_BUDGET');
  });

  it.each([false, true])('durability-one tool-break confirmation answer %s is recorded once', answer => {
    const h = harness(); descend(h); nearNode(h, 'metal-node');
    const g = game(h);
    add(g, 'pick', 1);
    const pick = g.player.inventory.items.find(i => i.worldItem?.definitionId === 'crafting.pick')!;
    pick.worldItem!.toolDurability = 1;
    const payload = harvestPayload(h, node(h, 'metal-node')), before = mechanics(h), events = g.recordedInputEvents.length;
    g.onConfirmRequest = null;
    g.executeCommand('ext:command', JSON.stringify({ module: 'crafting', action: 'harvest', payload }));
    expect(g.pendingCommandConfirmation).not.toBeNull();
    expect(JSON.stringify(g.pendingCommandConfirmation)).toContain('tool-break');
    expect(mechanics(h)).toEqual(before);
    g.resolveCommandDecision(g.pendingCommandConfirmation!.token, answer);
    expect(g.pendingCommandConfirmation).toBeNull();
    expect(g.recordedInputEvents).toHaveLength(events + 1);
    if (!answer) expect(mechanics(h)).toEqual(before);
    else {
      expect(pick.worldItem!.toolDurability).toBe(0);
      expect(read(h).inventory.find(i => i.definitionId === 'crafting.metal')!.quantity).toBe(1);
      expect(g.world5!.simulationTicks - before.simulationTicks).toBe(100);
      rejected(h, 'harvest', harvestPayload(h, node(h, 'metal-node')), 'C5_TOOL');
    }
  });

  it.each(['destination-stale', 'destination-missing', 'destination-level', 'destination-unseen', 'destination-distance', 'destination-full', 'source-stale', 'source-empty'] as const)('%s container is validated atomically', kind => {
    const h = staged(arena, { fixtures: ['world-work-basic'] }), g = game(h);
    const chest = g.world5!.containers.find(c => c.kind === 'chest')!;
    const entity = g.extensionRuntime!.worldWorkEntities().find(e => chest.position?.kind === 'interactable' && e.id === chest.position.interactableId)!;
    const n = node(h), p = adjacent(g);
    n.at = p;
    Object.assign(g.extensionRuntime!.worldWorkEntities().find(e => e.id === n.interactableId)!, p);
    let payload: Record<string, unknown> = { ...harvestPayload(h, n), destinationId: chest.id, destinationRevision: chest.revision };
    let action = 'harvest', code = 'C5_STALE';
    if (kind === 'destination-stale') payload.destinationRevision = chest.revision + 1;
    if (kind === 'destination-missing') { payload.destinationId = 999999; code = 'C5_UNKNOWN_TARGET'; }
    if (kind === 'destination-level') { chest.levelRef = { kind: 'dungeon', depth: 2 }; code = 'C5_WRONG_LEVEL'; }
    if (kind === 'destination-unseen') { g.grid.getCell(entity.x, entity.y)!.hasMemory = false; code = 'C5_UNKNOWN_TARGET'; }
    if (kind === 'destination-distance') { Object.assign(entity, { x: entity.x + 5 }); code = 'C5_DISTANCE'; }
    if (kind === 'destination-full') {
      for (let i = 0; i < 16; i++) {
        const item = assembleWorldItem(itemDefinition(g, 'crafting.pick'));
        g.worldContainerItems!.set(item.id, item); chest.itemIds.push(item.id);
      }
      code = 'C5_CAPACITY';
    }
    if (kind.startsWith('source-')) {
      action = 'craft';
      payload = { ...craftPayload(h), sourceContainerId: chest.id, sourceRevision: chest.revision + (kind === 'source-stale' ? 1 : 0) };
      code = kind === 'source-stale' ? 'C5_STALE' : 'C5_INPUT';
    }
    rejected(h, action, payload, code);
  });
});

describe('crafting provider transaction rollback', () => {
  it('an accepted-fact participant fault restores the complete transaction before recording one C5_PROVIDER rejection', async () => {
    const { Game } = await import('../../../../engine/Core/Game');
    const { getInstalledModuleDescriptors } = await import('../../../catalog');
    const { registryFromDescriptors } = await import('../../../descriptor');
    const { installWorldFixtureRegistry } = await import('../../../world5Fixture');
    const { readWorkContext } = await import('../../../../engine/Core/WorldWorkWorld');
    const { worldWorkLastError } = await import('../../../../engine/Core/WorldWork');
    const { getNextEntityId } = await import('../../../../entities/Creature');
    const { rng } = await import('../../../../engine/Random');
    const { timeSystem } = await import('../../../../engine/Systems/Time');
    const { logger } = await import('../../../../engine/Systems/Logger');
    let faults = 0;
    const descriptors = getInstalledModuleDescriptors().map(descriptor => descriptor.id !== 'crafting' ? descriptor : {
      ...descriptor,
      create() {
        const module = descriptor.create(), participant = module.worldWorkParticipant!;
        return { ...module, worldWorkParticipant: { onCommitted(fact: Parameters<typeof participant.onCommitted>[0], tx: Parameters<typeof participant.onCommitted>[1]) {
          participant.onCommitted(fact, tx);
          // Fault-inject the module participant, not the SDK or Game command path.
          if (fact.result === 'accepted') { faults++; throw new Error('crafting accepted-fact fault'); }
        } } };
      }
    });
    const g = new Game();
    installWorldFixtureRegistry(g, registryFromDescriptors(descriptors));
    g.startNewGame({ seed: 51020001, mode: 'normal', ruleSet: 'extended', extensions: ['crafting'] });
    g.animationEnabled = false;
    try {
      const r = readWorkContext(g, 'crafting', { kind: 'inventory' });
      expect(r.ok).toBe(true);
      if (!r.ok) throw new Error(r.code);
      const capture = () => structuredClone({ world: g.world5, actions: g.actorActions, state: g.extensionRuntime!.snapshot(), items: g.player.inventory.items,
        containerItems: [...g.worldContainerItems!], ids: getNextEntityId(), rng: rng.getState(), tick: timeSystem.currentTick,
        facts: g.worldWorkFacts, details: g.worldWorkDetails, messages: logger.getState() });
      const before = capture(), recorded = g.recordedInputEvents.length;
      g.executeCommand('ext:command', JSON.stringify({ module: 'crafting', action: 'craft', payload: {
        v: 1, recipeId: 'crafting.make-pick', batchCount: 1, stationId: null, stationRevision: null,
        sourceContainerId: null, sourceRevision: null, inventoryStamp: r.value.inventoryStamp
      } }));
      expect(faults).toBe(1);
      expect(worldWorkLastError(g)).toBe('C5_PROVIDER');
      expect(g.recordedInputEvents).toHaveLength(recorded + 1);
      expect(capture()).toEqual(before);
    } finally { g.extensionRuntime!.unload(); }
  });
});
