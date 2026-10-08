/** Explicit controlled performance origins, never natural gameplay evidence. */
import { expect } from 'vitest';
import { installRecordingScene } from '../../../../test/support/recordingV4';
import { scene } from './helpers';
import { Game } from '../../../../engine/Core/Game';
import { inventoryStamp } from '../../../../engine/Core/RecordingDigest';
import { ItemCategory } from '../../../../engine/Items/Item';
import { Monster, type MonsterData } from '../../../../entities/Monster';
import monsters from '../../../../data/monsters.json';
import { loadSettlementPack } from '../definitions';
import { residentBedIds, residentComponent } from '../../../../engine/Core/ResidentWorld';
import {
  containerItems,
  updateWorldReasons,
  itemDefinition
} from '../../../../engine/Core/WorldWorkWorld';
import { TerrainType } from '../../../../engine/Map/Grid';
import { assembleWorldItem } from '../../../../engine/Items/WorldItems';
import { worldWorkLastError } from '../../../../engine/Core/WorldWork';
import { freezeResidentCamps, settleResidentNeeds } from '../../../../engine/Core/ResidentNeeds';
import { createWorldHarness, worldHarnessGame } from '../../../testing/worldHarness';

const pack = loadSettlementPack();
const workerPlaces = [
  { x: 18, y: 10 },
  { x: 20, y: 10 },
  { x: 22, y: 10 },
  { x: 18, y: 12 },
  ...Array.from({ length: 4 }, (_, k) => ({ x: 18 + k, y: 11 })),
  ...Array.from({ length: 4 }, (_, k) => ({ x: 24, y: 10 + k })),
  { x: 25, y: 10 },
  { x: 25, y: 11 },
  { x: 25, y: 12 },
  { x: 25, y: 14 }
];
export function prepareResidentPerformance(registered: boolean, camps: 1 | 4 = 1) {
  installRecordingScene((g: Game) => {
    if (!g.extensionRuntime?.residentOwners().includes('settlement')) return;
    // These are paid setup commands before the initial controlled header, not
    // a synthesized save prefix. The production header captures the whole
    // resulting legal scene. This fixture explicitly includes native clock,
    // inventory, positions and map preparation; none is a natural-route claim.
    const recorder = g as unknown as { recordingFromNewGame: boolean };
    recorder.recordingFromNewGame = false;
    try {
      scene(g);
      for (const i of g.player.inventory.items)
        if (i.category === ItemCategory.MATERIAL) i.quantity = 99;
      for (let n = 0; n < (camps === 4 ? 6 : 2); n++)
        expect(
          g.player.inventory.addItem(assembleWorldItem(itemDefinition(g, 'settlement.wood'), 99))
        ).toBeTruthy();
      if (camps === 4)
        for (let n = 0; n < 3; n++)
          expect(
            g.player.inventory.addItem(assembleWorldItem(itemDefinition(g, 'settlement.fiber'), 99))
          ).toBeTruthy();
      const food = g.player.inventory.items.find((i) => i.category === ItemCategory.FOOD)!;
      food.quantity = 10;
      const base = () => ({
        v: 1,
        stateRevision: g.extensionRuntime!.worldCampState('settlement').revision,
        inventoryStamp: inventoryStamp(g.player.inventory.items)
      });
      const send = (action: string, payload: Record<string, unknown>) => {
        for (const [n, a] of g.monsters.entries())
          if (!a.isAlly) {
            a.loc = { x: 60 + (n % 10), y: 20 };
            a.ticksUntilTurn = 1000000;
          }
        if ('campId' in payload)
          payload.campRevision = g
            .extensionRuntime!.worldCampState('settlement')
            .camps.find((c) => c.regionId === payload.campId)!.revision;
        g.onConfirmRequest = () => true;
        g.executeCommand('ext:command', JSON.stringify({ module: 'settlement', action, payload }));
        while (g.pendingCommandConfirmation)
          g.resolveCommandDecision(g.pendingCommandConfirmation.token, true);
        expect(
          worldWorkLastError(g),
          JSON.stringify({
            depth: g.depth,
            action,
            payload,
            at: g.player.loc,
            stock: g.player.inventory.items.map((i) => ({
              id: i.id,
              q: i.quantity,
              d: i.worldItem?.definitionId
            }))
          })
        ).toBeNull();
      };
      for (let depth = 1; depth <= camps; depth++) {
        if (depth > 1) {
          g.player.loc = { x: 29, y: 25 };
          g.executeCommand('move', { x: 1, y: 0 });
          expect(g.depth).toBe(depth);
          scene(g, false);
        }
        // Long paid preparation must not awaken the staged native enemies.
        for (const a of g.monsters) if (!a.isAlly) a.ticksUntilTurn = 1000000;
        g.grid.setTerrain(19, 16, TerrainType.WATER_SHALLOW);
        const marker = { x: 24, y: 9 };
        g.player.loc = { x: 25, y: 9 };
        g.refreshStructureDerivedState();
        const ration = g.player.inventory.items.find((i) => i.category === ItemCategory.FOOD)!;
        send('establish', {
          ...base(),
          ...marker,
          bounds: { x: 17, y: 8, width: 9, height: 9 },
          sourceContainerId: null,
          sourceRevision: null,
          food: [{ itemId: ration.id, quantity: 2 }],
          materials: pack.camp.createCost
        });
        const camp = g
          .extensionRuntime!.worldCampState('settlement')
          .camps.find((c) => c.depth === depth)!;
        expect(camp).toBeDefined();
        const region = () =>
          g.extensionRuntime!.worldStructureRegions().find((r) => r.id === camp.regionId)!;
        const build = (name: string, at: { x: number; y: number }) => {
          const d = pack.world.structures!.find((d) => d.id === 'settlement.' + name)!;
          // Paid production inputs; only the initial controlled work position
          // is staged. Native visibility/protection/CAS/budget remain active.
          const positions = [
            { x: at.x - 1, y: at.y },
            { x: at.x + 1, y: at.y },
            { x: at.x, y: at.y - 1 },
            { x: at.x, y: at.y + 1 }
          ];
          g.player.loc = positions.find(
            (p) =>
              g.grid.getCell(p.x, p.y)?.isPassable &&
              !g.monsters.some((a) => a.x === p.x && a.y === p.y) &&
              !(p.x === marker.x && p.y === marker.y)
          )!;
          expect(g.player.loc).toBeDefined();
          g.refreshStructureDerivedState();
          send('build', {
            ...base(),
            regionId: camp.regionId,
            regionRevision: region().revision,
            definitionId: d.id,
            ...at,
            sourceContainerId: null,
            sourceRevision: null,
            materials: d.constructionCost
          });
          expect(
            g.world5!.structures.some(
              (s) =>
                s.regionId === camp.regionId &&
                s.at.x === at.x &&
                s.at.y === at.y &&
                [s.fixture, s.roof, s.barrier].some((c) => c?.definitionId === d.id)
            )
          ).toBe(true);
        };
        for (let y = 9; y <= 15; y++)
          for (let x = 17; x <= 23; x++) {
            const edge = x === 17 || x === 23 || y === 9 || y === 15;
            if (edge && (x === 17 || x === 23) && (y === 9 || y === 15)) continue;
            build(edge ? (x === 20 && y === 9 ? 'door' : 'wood-wall') : 'roof', { x, y });
          }
        const door = g.world5!.structures.find(
          (s) => s.regionId === camp.regionId && s.barrier?.definitionId === 'settlement.door'
        )!.barrier!;
        g.player.loc = { x: 20, y: 10 };
        g.refreshStructureDerivedState();
        send('door', {
          ...base(),
          componentId: door.id,
          componentRevision: door.revision,
          open: true
        });
        const beds = [];
        for (let n = 0; n < 16; n++) {
          build('bed', { x: 18 + (n % 4), y: 10 + Math.floor(n / 4) });
          beds.push(
            g.world5!.structures.find(
              (s) =>
                s.regionId === camp.regionId &&
                s.at.x === 18 + (n % 4) &&
                s.at.y === 10 + Math.floor(n / 4)
            )!.fixture!.id
          );
        }
        expect(residentBedIds(g, camp)).toHaveLength(16);
        // One genuine FOOD root with legal per-unit storage, no phantom numeric stock.
        containerItems(g, camp.supplyId)[0]!.quantity = camps === 4 ? 62 : 18;
        if (depth === camps) {
          for (let n = 0; n < 4; n++) build('plot', { x: 18 + n, y: 14 });
          build('chest', { x: 22, y: 14 });
          build('chest', { x: 25, y: 13 });
          const box = g.world5!.containers.find((b) => b.id === camp.supplyId)!;
          for (const [name, quantity] of [
            ['seed', 6],
            ['wood', 32]
          ] as const) {
            const targetBox =
              name === 'seed'
                ? g.world5!.containers.find(
                    (b) =>
                      b.kind === 'chest' &&
                      b.id !== camp.supplyId &&
                      b.position?.kind === 'interactable' &&
                      g
                        .extensionRuntime!.worldWorkEntities()
                        .some(
                          (e) =>
                            e.id === (b.position as { interactableId: number }).interactableId &&
                            e.x === 22 &&
                            e.y === 14
                        )
                  )!
                : box;
            g.player.loc = name === 'seed' ? { x: 22, y: 13 } : { x: 25, y: 9 };
            g.refreshStructureDerivedState();
            const item = g.player.inventory.items.find(
              (i) => i.worldItem?.definitionId === 'settlement.' + name
            )!;
            send('transfer', {
              ...base(),
              containerId: targetBox.id,
              containerRevision: targetBox.revision,
              direction: 'deposit',
              items: [{ itemId: item.id, quantity }]
            });
          }
        }
        for (let n = 0; n < 16; n++) {
          const at = [
            { x: 25, y: 15 },
            { x: 24, y: 15 },
            { x: 25, y: 16 },
            { x: 24, y: 16 }
          ].find((p) => !g.monsters.some((m) => m.x === p.x && m.y === p.y))!;
          expect(at).toBeDefined();
          const a = new Monster(
            at.x,
            at.y,
            (monsters as MonsterData[]).find((m) => m.id === 'goblin')!
          );
          a.isCaged = true;
          g.monsters.push(a);
          g.extensionRuntime!.attachCreature(a);
          g.executeCommand('wait', undefined, () => g.freeCaptive(a));
          g.player.loc = { x: at.x + 1, y: at.y };
          g.refreshStructureDerivedState();
          const source = g.extensionRuntime!.residentComponent<any>('settlement', a.id, 'source')!;
          send('recruit', {
            v: 1,
            stateRevision: g.extensionRuntime!.worldCampState('settlement').revision,
            campId: camp.regionId,
            campRevision: camp.revision,
            targetId: a.id,
            targetRevision: source.revision
          });
          expect(residentComponent(g, a.id)).toBeDefined();
          // No relocation after the captured controlled origin.
          a.loc = { ...workerPlaces[n]! };
          a.ticksUntilTurn = 100;
        }
        settleResidentNeeds(g, true);
        freezeResidentCamps(g, depth);
      }
      const w = g.world5!;
      const start = (Math.floor(w.simulationTicks / 32000) + 1) * 32000 + 30000;
      w.simulationTicks = start;
      for (const l of w.offline) {
        l.lastSettledTick = start;
        l.epochRemainder = 0;
        l.frozen.capturedTick = start;
      }
      g.player.loc = { x: 29, y: 9 };
      g.refreshStructureDerivedState();
      expect(w.residents.length).toBe(16 * camps);
      {
        const c = g
          .extensionRuntime!.worldCampState('settlement')
          .camps.find((c) => c.depth === g.depth)!;
        const actors = w.residents
          .filter((r) => r.campSlotId === c.slot)
          .map((r) => g.monsters.find((a) => a.id === r.actorId)!);
        // Later paid recruitment lets earlier workers walk to their beds.
        // Stage the matched active cohort only once all preparation is over.
        actors.forEach((a, n) => {
          a.loc = { ...workerPlaces[n]! };
          a.ticksUntilTurn = 100;
        });
        const chests = w.containers.filter(
          (b) =>
            b.kind === 'chest' &&
            b.id !== c.supplyId &&
            b.levelRef.kind === 'dungeon' &&
            b.levelRef.depth === g.depth
        );
        const plots = w.structures
          .filter((s) => s.regionId === c.regionId && s.fixture?.definitionId === 'settlement.plot')
          .map((s) => s.fixture!);
        const wood = containerItems(g, c.supplyId).find(
          (i) => i.worldItem?.definitionId === 'settlement.wood'
        )!;
        for (let n = 0; n < 16; n++) {
          const a = actors[n]!,
            r = residentComponent(g, a.id)!;
          const post = { ...a.loc };
          // Configure in a free camp-edge cell, then restore the controlled
          // initial post. No elapsed action is interleaved with configuration.
          a.loc = { x: 25, y: 16 };
          g.player.loc = { x: 26, y: 16 };
          g.refreshStructureDerivedState();
          const job =
            n < 4
              ? {
                  kind: 'plant',
                  plotIds: [plots[n]!.id],
                  sourceId: chests[0]!.id,
                  destinationId: chests[0]!.id
                }
              : n < 8
                ? {
                    kind: 'haul',
                    sourceId: c.supplyId,
                    destinationId: chests[1]!.id,
                    itemId: wood.id,
                    quantity: 8
                  }
                : { kind: 'guard', at: post };
          send('assign-job', {
            v: 1,
            stateRevision: g.extensionRuntime!.worldCampState('settlement').revision,
            campId: c.regionId,
            campRevision: c.revision,
            targetId: a.id,
            targetRevision: r.revision,
            job,
            inventoryStamp: inventoryStamp(g.player.inventory.items),
            sourceRevision:
              n < 4
                ? chests[0]!.revision
                : n < 8
                  ? w.containers.find((b) => b.id === c.supplyId)!.revision
                  : null,
            destinationRevision: n < 8 ? chests[n < 4 ? 0 : 1]!.revision : null,
            componentRevisions: n < 4 ? [plots[n]!.revision] : []
          });
          expect(residentComponent(g, a.id)!.job.kind).toBe(
            n < 4 ? 'plant' : n < 8 ? 'haul' : 'guard'
          );
          a.loc = post;
        }
      }
      if (!registered) {
        // Paid preparation and all shared native inputs are identical. Only
        // after preparation does this controlled origin remove economic membership.
        const rt = g.extensionRuntime!;
        for (const row of [...w.residents]) {
          const a = g.monsters.find((a) => a.id === row.actorId)!;
          rt.replaceResidentComponent('settlement', a.id, 'resident', null);
          a.doesNotTrackLeader = false;
          a.leader = null;
          a.boundToLeader = false;
        }
        w.residents = [];
        for (const l of w.offline) {
          l.residentStates = [];
          l.frozen.residents = [];
        }
      }
      expect(w.residents.length).toBe(registered ? 16 * camps : 0);
      g.player.loc = { x: 29, y: 9 };
      g.refreshStructureDerivedState();
      updateWorldReasons(g);
      // Validate all codec/ownership/budgets before an origin or measurements.
      const snapshot = g.toSnapshot();
      expect(
        (g as any).withReplayCandidate((candidate: Game) => candidate.loadSnapshot(snapshot))
      ).toBe(true);
    } finally {
      recorder.recordingFromNewGame = true;
      g.onConfirmRequest = null;
    }
  });
  const h = createWorldHarness({ seed: 51020001, mode: 'normal', modules: ['settlement'] }),
    g = worldHarnessGame(h);
  return { h, g };
}
