import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { writeFileSync, readFileSync } from 'node:fs';
import {
  naturalGiants,
  naturalColossus,
  GIANTS_ACCEPTANCE_SEED,
  GIANTS_COLOSSUS_ACCEPTANCE_SEED
} from './naturalFixture';
import { canonical } from '../../../json';
const hash = (v: unknown) => createHash('sha256').update(canonical(v)).digest('hex');
export function captureGiantsNaturalTrace(colossus = false) {
  const { game, boss, state } = colossus ? naturalColossus() : naturalGiants(),
    s = game.toSnapshot(),
    recording = game.exportRecording();
  return {
    schema: 1,
    seed: colossus ? GIANTS_COLOSSUS_ACCEPTANCE_SEED : GIANTS_ACCEPTANCE_SEED,
    ...(colossus ? { mode: game.mode } : {}),
    depth: game.depth,
    commands: recording.events.length,
    commandsHash: hash(
      recording.events.map((e) => ({
        action: e.action,
        data: e.data,
        decisions: e.decisions ?? []
      }))
    ),
    nativeWorldHash: hash({
      player: s.player,
      levels: [s, ...s.levels].map((l) => ({
        depth: l.depth,
        grid: l.grid,
        monsters: l.monsters,
        items: l.items,
        dormantMonsters: l.dormantMonsters
      })),
      pending: s.pendingFallenByDepth,
      entityGraph: s.entityGraph,
      levelSeeds: s.levelSeeds,
      allocator: s.run.nextEntityId
    }),
    extensionsHash: hash(s.extensions),
    rng: s.rngState,
    region: s.extensions!.foundation.world.regions!.find(
      (r) => r.id === boss.spatial!.movementRegionId
    ),
    state,
    boss: {
      id: boss.id,
      typeId: boss.typeId,
      loc: boss.loc,
      hp: boss.hp,
      maxHp: boss.maxHp,
      spatial: boss.spatial
    }
  };
}
describe('giants fixed natural command trace', () => {
  it('naturally recreates seed 7328 D3 world, encounter, bindings and both RNG streams', () => {
    const actual = captureGiantsNaturalTrace(),
      path = new URL('../data/natural-trace.json', import.meta.url);
    if (process.env.BROGUE_CAPTURE_GIANTS_TRACE === '1')
      writeFileSync(path, JSON.stringify(actual, null, 2) + '\n');
    expect(actual).toEqual(JSON.parse(readFileSync(path, 'utf8')));
  }, 60000);
  it('naturally recreates the D7 colossus world, command route, bindings and both RNG streams', () => {
    const actual = captureGiantsNaturalTrace(true),
      path = new URL('../data/colossus-natural-trace.json', import.meta.url);
    if (process.env.BROGUE_CAPTURE_GIANTS_TRACE === '1')
      writeFileSync(path, JSON.stringify(actual, null, 2) + '\n');
    expect(actual).toEqual(JSON.parse(readFileSync(path, 'utf8')));
  }, 60000);
});
