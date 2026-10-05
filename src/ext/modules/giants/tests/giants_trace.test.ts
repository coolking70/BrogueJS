import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { writeFileSync, readFileSync } from 'node:fs';
import { naturalGiants, GIANTS_ACCEPTANCE_SEED } from './naturalFixture';
import { canonical } from '../../../json';
const hash = (v: unknown) => createHash('sha256').update(canonical(v)).digest('hex');
export function captureGiantsNaturalTrace() {
  const { game, boss, state } = naturalGiants(),
    s = game.toSnapshot(),
    recording = game.exportRecording();
  return {
    schema: 1,
    seed: GIANTS_ACCEPTANCE_SEED,
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
    region: s.extensions!.foundation.world.regions![0],
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
  it('naturally recreates seed 7306 D3 world, encounter, bindings and both RNG streams', () => {
    const actual = captureGiantsNaturalTrace(),
      path = new URL('../data/natural-trace.json', import.meta.url);
    if (process.env.BROGUE_CAPTURE_GIANTS_TRACE === '1')
      writeFileSync(path, JSON.stringify(actual, null, 2) + '\n');
    expect(actual).toEqual(JSON.parse(readFileSync(path, 'utf8')));
  }, 60000);
});
