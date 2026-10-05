import { describe, it, expect } from 'vitest';
import { naturalGiants } from './naturalFixture';
import { observeDisplayFrame, freezeDisplay } from '../../../../ui/displayProjection';
import { logger } from '../../../../engine/Systems/Logger';
import { rng } from '../../../../engine/Random';
import { commitCreatureAnchor } from '../../../../engine/Movement/CreatureSpatial';
import { selectBossHud } from '../ui/view';
import { readFileSync } from 'node:fs';
describe('giants public historical boss HUD', () => {
  it('hides unseen or lost identity, uses frame HP, and never changes RNG', () => {
    const { game, boss } = naturalGiants();
    for (let x = 0; x < game.grid.width; x++)
      for (let y = 0; y < game.grid.height; y++) {
        const cell = game.grid.getCell(x, y)!;
        cell.isVisible = false;
        cell.isClairvoyantVisible = false;
      }
    expect(selectBossHud(observeDisplayFrame(game, logger))).toBeNull();
    commitCreatureAnchor(game.player, { x: boss.x - 2, y: boss.y });
    (game as any).updateVision();
    const before = rng.getState(),
      old = observeDisplayFrame(game, logger),
      hud = selectBossHud(old);
    expect(hud).toMatchObject({ id: boss.id, name: '岩脊兽', hp: 120, maxHp: 120 });
    boss.hp = 37;
    const now = observeDisplayFrame(game, logger);
    expect(selectBossHud(now)?.hp).toBe(37);
    expect(selectBossHud(old)?.hp).toBe(120);
    const hidden = freezeDisplay({ ...old, rows: old.rows.filter((r) => r.id !== boss.id) });
    expect(selectBossHud(hidden)).toBeNull();
    const hallucinated = freezeDisplay({
      ...old,
      player: { ...old.player, statuses: { ...old.player.statuses, hallucinating: 10 } }
    });
    expect(selectBossHud(hallucinated)).toBeNull();
    expect(rng.getState()).toEqual(before);
  }, 60000);
  it('target focus wins over distance; only a single public row is selected', () => {
    const { game, boss } = naturalGiants();
    commitCreatureAnchor(game.player, { x: boss.x - 2, y: boss.y });
    (game as any).updateVision();
    const frame = observeDisplayFrame(game, logger),
      row = frame.rows.find((r) => r.kind === 'monster' && r.id === boss.id)!;
    if (row.kind !== 'monster') throw new Error('Missing public boss');
    const far = {
      ...row,
      id: row.id + 100,
      loc: { x: row.loc.x + 10, y: row.loc.y },
      distanceSquared: 10000,
      focused: true,
      name: 'public-fixture',
      hp: 60
    };
    const many = freezeDisplay({
      ...frame,
      rows: [row, far],
      actorTags: { [row.id]: ['giants.boss'], [far.id]: ['giants.boss'] }
    });
    expect(selectBossHud(many)?.id).toBe(far.id);
    expect(selectBossHud({ ...many, rows: [row, { ...far, focused: false }] })?.id).toBe(row.id);
    const aimed = freezeDisplay({
      ...many,
      rows: [row, { ...far, focused: false, bodyCells: [{ ...far.loc }] }],
      throwAim: far.loc
    });
    expect(selectBossHud(aimed)?.id).toBe(far.id);
  }, 60000);
  it('component keeps a fluid width, single-line name, compact HP and historical presentation hiding', () => {
    const s = readFileSync(new URL('../ui/BossHud.vue', import.meta.url), 'utf8');
    expect(s).toMatch(/width:\s*min\(100%,\s*26rem\)/);
    expect(s).toMatch(/min-width:\s*0/);
    expect(s).toMatch(/text-overflow:\s*ellipsis/);
    expect(s).toMatch(/flex:\s*none/);
    expect(s).toContain('presentationHidden');
    expect(s).not.toMatch(/game\.|Math\.random|rng\./);
  });
});
