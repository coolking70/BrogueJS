import { describe, expect, it } from 'vitest';
import { Monster, type MonsterData } from '../../../../entities/Monster';
import monsters from '../../../../data/monsters.json';
import { threat } from '../../../../engine/Core/WorldWorkWorld';
import { add, amount, amounts, arena, cancel, craft, game, harness, harvest, nearNode, read, rejected, staged, descend } from './runtimeHelpers';

function enemy(h: ReturnType<typeof harness>, invisible = false) {
  const g = game(h), m = new Monster(g.player.x + 1, g.player.y, {
    ...monsters.find(m => m.id === 'rat')!, accuracy: 10000, damage: '1d1', moveSpeed: 10, attackSpeed: 10
  } as MonsterData);
  if (invisible) m.applyStatus('invisible', 1000);
  m.ticksUntilTurn = 1;
  g.monsters.push(m);
  const cell = g.grid.getCell(m.x, m.y)!;
  cell.isVisible = true; cell.hasMemory = true;
  return m;
}
function batchScene() {
  return staged(g => { arena(g); add(g, 'wood', 20); add(g, 'stone', 10); });
}
function expectedAfter(before: Record<string, number>, completed: number) {
  return { ...before, 'crafting.wood': before['crafting.wood']! - 4 * completed,
    'crafting.stone': before['crafting.stone']! - 2 * completed, 'crafting.kit-table': completed };
}

describe('crafting T11 multi-batch, interruption and exact refunds', () => {
  it('five batches complete one per recorded command, never retaining a bundle between commands', () => {
    const h = batchScene(), g = game(h), before = amounts(h), tick = g.world5!.simulationTicks;
    const events = g.recordedInputEvents.length;
    expect(craft(h, 'make-table-kit', 5)).toEqual({ recorded: true, error: null });
    for (let completed = 1; completed <= 5; completed++) {
      expect(amount(h, 'kit-table')).toBe(completed);
      expect(g.actorActions!.bundles).toEqual([]);
      expect(g.recordedInputEvents).toHaveLength(events + completed);
      expect(g.world5!.simulationTicks - tick).toBe(completed * 500);
      if (completed < 5) {
        const ticket = read(h).activeTicket!;
        expect(ticket).toMatchObject({ status: 'working', completedBatches: completed, totalBatches: 5, bundleActionId: null, remainingTicks: 500 });
        expect(g.toSnapshot().run.autoAction).toEqual({ kind: 'auto_work', ticketId: ticket.ticketId });
        h.command('auto_step');
      }
    }
    expect(g.toSnapshot().run.autoAction).toBeUndefined();
    expect(read(h).activeTicket).toBeNull();
    expect(amounts(h)).toEqual(expectedAfter(before, 5));
    expect(g.world5!.terminalTickets.slice(-1)[0]).toMatchObject({ status: 'completed', completedBatches: 5 });
    expect(g.worldWorkFacts!.filter(f => f.owner === 'crafting' && f.operation === 'craft-batch').map(f => f.result)).toEqual(['accepted', 'completed', 'completed', 'completed', 'completed', 'completed']);
    expect(g.recordedInputEvents.slice(events).map(e => e.action)).toEqual(['ext:command', 'auto_step', 'auto_step', 'auto_step', 'auto_step']);
    expect(g.world5!.containers.some(c => c.kind === 'escrow' || c.kind === 'refund')).toBe(false);
  });

  it('a visible enemy after batch two stops the next auto_step and refunds only the three unfinished batches once', () => {
    const h = batchScene(), g = game(h), before = amounts(h);
    expect(craft(h, 'make-table-kit', 5).error).toBeNull(); h.command('auto_step');
    enemy(h);
    expect(threat(g)).toBe(true);
    const tick = g.world5!.simulationTicks;
    h.command('auto_step');
    expect(g.world5!.simulationTicks).toBe(tick);
    expect(read(h).activeTicket).toBeNull();
    expect(g.world5!.terminalTickets.slice(-1)[0]).toMatchObject({ status: 'cancelled', completedBatches: 2, stopReason: 'threat' });
    expect(amounts(h)).toEqual(expectedAfter(before, 2));
    expect(g.worldWorkFacts!.filter(f => f.operation === 'cancel')).toHaveLength(1);
    h.command('auto_step'); h.command('escape');
    expect(amounts(h)).toEqual(expectedAfter(before, 2));
    expect(g.worldWorkFacts!.filter(f => f.operation === 'cancel')).toHaveLength(1);
    expect(g.world5!.containers.some(c => c.kind === 'escrow' || c.kind === 'refund')).toBe(false);
  });

  it('damage during a real batch prevents output and refunds every unfinished input', () => {
    const h = batchScene(), g = game(h), before = amounts(h);
    enemy(h, true);
    expect(threat(g)).toBe(false);
    const hp = g.player.hp;
    expect(craft(h, 'make-table-kit', 5)).toEqual({ recorded: true, error: null });
    expect(g.player.hp).toBeLessThan(hp);
    expect(g.world5!.terminalTickets.slice(-1)[0]).toMatchObject({ status: 'cancelled', completedBatches: 0, stopReason: 'damage' });
    expect(amounts(h)).toEqual(before);
    expect(amount(h, 'kit-table')).toBe(0);
    expect(g.actorActions!.bundles).toEqual([]);
    expect(g.world5!.containers.some(c => c.kind === 'escrow')).toBe(false);
  });

  it('damage during mining produces no metal and does not consume pick durability', () => {
    const h = harness(); descend(h); nearNode(h, 'metal-node');
    const g = game(h); add(g, 'pick', 1);
    const pick = g.player.inventory.items.find(i => i.worldItem?.definitionId === 'crafting.pick')!;
    enemy(h, true);
    expect(threat(g)).toBe(false);
    expect(harvest(h, 'metal-node').error).toBeNull();
    expect(g.world5!.terminalTickets.slice(-1)[0]).toMatchObject({ status: 'cancelled', completedBatches: 0, stopReason: 'damage' });
    expect(amount(h, 'metal')).toBe(0);
    expect(pick.worldItem!.toolDurability).toBe(40);
  });

  it('cancel-work between batches records cancel/interrupted/cancelled and exact one-time refund', () => {
    const h = batchScene(), g = game(h), before = amounts(h);
    expect(craft(h, 'make-table-kit', 5).error).toBeNull(); h.command('auto_step');
    const ticket = read(h).activeTicket!;
    expect(cancel(h)).toEqual({ recorded: true, error: null });
    expect(g.world5!.terminalTickets.slice(-1)[0]).toMatchObject({ ticketId: ticket.ticketId, completedBatches: 2, status: 'cancelled', stopReason: 'cancelled' });
    expect(g.worldWorkFacts!.slice(-1)[0]).toMatchObject({ operation: 'cancel', result: 'interrupted', reason: 'cancelled' });
    expect(amounts(h)).toEqual(expectedAfter(before, 2));
    rejected(h, 'cancel-work', { v: 1, ticketId: ticket.ticketId, ticketRevision: ticket.revision }, 'C5_UNKNOWN_TARGET');
    expect(amounts(h)).toEqual(expectedAfter(before, 2));
  });

  it('stale and nonexistent cancellation tickets cannot be consumed', () => {
    const h = batchScene();
    expect(craft(h, 'make-table-kit', 5).error).toBeNull();
    const ticket = read(h).activeTicket!;
    rejected(h, 'cancel-work', { v: 1, ticketId: ticket.ticketId, ticketRevision: ticket.revision + 1 }, 'C5_STALE');
    rejected(h, 'cancel-work', { v: 1, ticketId: 999999, ticketRevision: 0 }, 'C5_UNKNOWN_TARGET');
  });

  it('a genuine live ticket owned by another module cannot be cancelled by crafting', () => {
    const h = staged(arena, { fixtures: ['crafting-skeleton', 'world-work-basic'] });
    const r = read(h, 'craftskel'), station = r.stations.find(s => s.tags.includes('table') && s.workPositions.some(p => p.x === r.at.x && p.y === r.at.y))!;
    expect(h.ext('craftskel', 'craft', { v: 1, recipeId: 'craftskel.dagger-recipe', batchCount: 2, stationId: station.interactableId, stationRevision: station.revision, sourceContainerId: null, sourceRevision: null, inventoryStamp: r.inventoryStamp }, [true]).error).toBeNull();
    const ticket = read(h, 'craftskel').activeTicket!;
    rejected(h, 'cancel-work', { v: 1, ticketId: ticket.ticketId, ticketRevision: ticket.revision }, 'C5_UNKNOWN_TARGET');
  });

  it('the shared tool-consuming fixture stops continuation after break with crafting also enabled', () => {
    // Production crafting recipes deliberately have toolTag:null; mining is single-batch.
    // Exercise the SDK continuation contract with its official tool-using fixture.
    const h = staged(arena, { fixtures: ['crafting-skeleton', 'world-work-basic'] }), g = game(h);
    const r = read(h, 'craftskel'), station = r.stations.find(s => s.tags.includes('table') && s.workPositions.some(p => p.x === r.at.x && p.y === r.at.y))!;
    const before = amounts(h);
    expect(h.ext('craftskel', 'craft', { v: 1, recipeId: 'craftskel.dagger-recipe', batchCount: 3, stationId: station.interactableId, stationRevision: station.revision, sourceContainerId: null, sourceRevision: null, inventoryStamp: r.inventoryStamp }, [true]).error).toBeNull();
    h.command('auto_step');
    const tool = read(h, 'craftskel').inventory.find(i => i.definitionId === 'craftskel.knife')!;
    expect(tool.toolDurability).toBe(0);
    h.command('auto_step');
    expect(g.world5!.terminalTickets.slice(-1)[0]).toMatchObject({ owner: 'craftskel', status: 'cancelled', completedBatches: 2, stopReason: 'tool' });
    expect(read(h, 'craftskel').inventory.find(i => i.definitionId === 'craftskel.fiber')!.quantity).toBe(18);
    expect(amounts(h)).toEqual(before);
    expect(g.world5!.containers.some(c => c.kind === 'escrow')).toBe(false);
  });
});
