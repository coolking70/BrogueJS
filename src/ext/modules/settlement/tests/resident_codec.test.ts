import { scene as jobScene, assign, waitUntil } from './residentJobHelpers';
import { walk } from './helpers';
import { it, expect, vi } from 'vitest';
import { residentScene } from './residentHelpers';
import { auditFullObjectGraph } from '../../../../test/support/fullGenerationCheckpointOracle';
import { logger } from '../../../../engine/Systems/Logger';
import { rng } from '../../../../engine/Random';
import { getNextEntityId } from '../../../../entities/Creature';

it('strict resident save references reject malformed copies before retiring any live identity or settling needs', () => {
  const { h, g, a } = residentScene(),
    original = g.toSnapshot();
  const component = (s: any) => s.extensions.components[a.id]['settlement:resident'];
  const mutations: Record<string, (s: any) => void> = {
    'resident schema': (s) => (component(s).schema = 2),
    'resident unknown': (s) => (component(s).unapproved = true),
    'home ordinal': (s) => component(s).campOrdinal++,
    'missing bed': (s) => (component(s).bedId = 999999),
    'unconsumed source': (s) =>
      (s.extensions.components[a.id]['settlement:source'].consumed = false),
    'missing source': (s) => delete s.extensions.components[a.id]['settlement:source'],
    'orphan component': (s) => (s.run.world5.residents = []),
    'missing needs': (s) => (s.run.world5.offline[0].residentStates = []),
    'negative remainder': (s) => (s.run.world5.offline[0].epochRemainder = -1),
    'unsafe high water': (s) =>
      (s.run.world5.offline[0].lastSettledTick = Number.MAX_SAFE_INTEGER + 1),
    'duplicate resident': (s) =>
      s.run.world5.residents.push(structuredClone(s.run.world5.residents[0])),
    'missing actor': (s) => {
      s.monsters = s.monsters.filter((m: any) => m.id !== a.id);
      s.entityGraph.monsters = s.entityGraph.monsters.filter((m: any) => m.id !== a.id);
    },
    'foreign granary': (s) => s.extensions.modules.settlement.camps[0].granaryIds.push(999999),
    'forged lock': (s) => (s.extensions.modules.settlement.camps[0].locked[0].quantity = 3),
    'duplicate FOOD owner': (s) => {
      const b = s.run.world5.containers.find((b: any) => b.kind === 'chest');
      s.player.inventory.push(
        structuredClone(s.entityGraph.items.find((i: any) => i.id === b.itemIds[0]))
      );
    }
  };
  // The shape helper is explicit: all mutations operate only on detached data.
  expect(component(original)).toBeDefined();
  for (const [name, mutate] of Object.entries(mutations)) {
    const copy = structuredClone(original);
    mutate(copy);
    const audit = auditFullObjectGraph({ g, logger }),
      random = rng.getState(),
      id = getNextEntityId();
    expect(g.loadSnapshot(copy), name).toBe(false);
    expect(audit.differences(), name).toEqual([]);
    expect(rng.getState(), name).toEqual(random);
    expect(getNextEntityId(), name).toBe(id);
  }
  const digest = h.digest();
  h.load(h.save());
  expect(h.digest()).toBe(digest);
});

it('FR2: rejects incoherent plant/haul phase, plan, credit and reservation combinations before live retirement', () => {
  const { h, g, a, src, dst, plot } = jobScene();
  expect(
    assign(h, g, a.id, { kind: 'plant', plotIds: [plot], sourceId: src, destinationId: dst }).error
  ).toBeNull();
  h.command('move', { x: 0, y: -1 });
  h.command('move', { x: 0, y: -1 });
  walk(h, g, { x: 29, y: 9 });
  waitUntil(h, () => g.world5!.residentJobs[0]?.phase === 'planting');
  const original = g.toSnapshot();
  const mutations: Record<string, (s: any) => void> = {
    'plant delivery': (s) => {
      const j = s.run.world5.residentJobs[0];
      s.run.actorActions.bundles = s.run.actorActions.bundles.filter(
        (b: any) => b.actionId !== j.actionId
      );
      Object.assign(j, {
        phase: 'delivery',
        creditTicks: 0,
        creditRemainder: 0,
        pendingCompletion: true,
        actionId: null,
        status: 'working'
      });
    },
    'carrying clock': (s) => (s.run.world5.residentJobs[0].phase = 'carrying'),
    'pickup credit': (s) => {
      const j = s.run.world5.residentJobs[0];
      j.phase = 'pickup';
      j.creditTicks = 1;
    },
    'haul planting': (s) => (s.run.world5.residentJobs[0].kind = 'haul'),
    'plan mismatch': (s) =>
      (s.extensions.components[a.id]['settlement:resident'].job = { kind: 'idle' }),
    'plot outside plan': (s) =>
      (s.extensions.components[a.id]['settlement:resident'].job.plotIds = []),
    'reservation mismatch': (s) => (s.run.world5.residentJobs[0].reservedSlots = 2),
    'future accepted day': (s) =>
      (s.run.world5.residentJobs[0].day = Math.floor(s.run.world5.simulationTicks / 32000) + 1),
    'complete remainder': (s) => {
      s.run.world5.residentJobs[0].creditTicks = 1000;
      s.run.world5.residentJobs[0].creditRemainder = 1;
    }
  };
  for (const [name, mutate] of Object.entries(mutations)) {
    const copy = structuredClone(original);
    mutate(copy);
    const audit = auditFullObjectGraph({ g, logger }),
      random = rng.getState(),
      id = getNextEntityId();
    expect(g.loadSnapshot(copy), name).toBe(false);
    expect(audit.differences(), name).toEqual([]);
    expect(rng.getState(), name).toEqual(random);
    expect(getNextEntityId(), name).toBe(id);
  }
  const digest = h.digest();
  h.load(h.save());
  expect(h.digest()).toBe(digest);
});

it('FR2: a real completed planting publication fault preserves a legal pending save and completes once on public retry', () => {
  const { h, g, a, src, dst, plot } = jobScene();
  expect(
    assign(h, g, a.id, { kind: 'plant', plotIds: [plot], sourceId: src, destinationId: dst }).error
  ).toBeNull();
  h.command('move', { x: 0, y: -1 });
  h.command('move', { x: 0, y: -1 });
  walk(h, g, { x: 29, y: 9 });
  waitUntil(h, () => g.world5!.residentJobs[0]?.phase === 'planting');
  const ticket = g.world5!.residentJobs[0]!;
  const replace = g.extensionRuntime!.worldCampReplace.bind(g.extensionRuntime!);
  const fault = vi
    .spyOn(g.extensionRuntime!, 'worldCampReplace')
    .mockImplementation((owner, state) => {
      const result = replace(owner, state);
      if (state.plotDays.length) throw Error('plant publication');
      return result;
    });
  expect(() => {
    for (let n = 0; n < 30; n++) h.command('wait');
  }).toThrow('plant publication');
  expect(g.world5!.residentJobs[0]).toMatchObject({
    id: ticket.id,
    phase: 'planting',
    status: 'working',
    actionId: null,
    pendingCompletion: true,
    creditTicks: 1000,
    creditRemainder: 0
  });
  expect(g.world5!.residentJobs[0]).toBe(ticket);
  expect(
    [...g.worldContainerItems!.values()].some(
      (i) => i.worldItem?.definitionId === 'settlement.crop'
    )
  ).toBe(false);
  fault.mockRestore();
  const digest = h.digest();
  h.load(h.save());
  expect(h.digest()).toBe(digest);
  h.command('wait');
  expect(
    [...g.worldContainerItems!.values()]
      .filter((i) => i.worldItem?.definitionId === 'settlement.crop')
      .map((i) => i.quantity)
  ).toEqual([1]);
  expect(g.world5!.residentJobs).toHaveLength(0);
  expect(
    g.world5!.receipts.filter(
      (r) => r.identity === 'resident.' + ticket.id && r.result === 'completed'
    )
  ).toHaveLength(1);
  h.command('wait');
  expect(
    [...g.worldContainerItems!.values()]
      .filter((i) => i.worldItem?.definitionId === 'settlement.crop')
      .map((i) => i.quantity)
  ).toEqual([1]);
});
