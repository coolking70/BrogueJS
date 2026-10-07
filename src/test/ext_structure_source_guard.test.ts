import { it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
// @ts-expect-error Node-only source guard has no declaration file.
import { checkStructureReaders } from '../../scripts/check-structure-readers.mjs';
it('rejects new raw mechanical flags, including an aliased catalog, and accepts composition', () => {
  const root = mkdtempSync(join(tmpdir(), 'structure-reader-'));
  try {
    mkdirSync(join(root, 'scripts'));
    mkdirSync(join(root, 'src/engine/Map'), { recursive: true });
    writeFileSync(join(root, 'scripts/structure-readers.json'), JSON.stringify({ raw: [] }));
    writeFileSync(
      join(root, 'src/engine/Map/Grid.ts'),
      'function refresh(){ flags = composedCellFlags(this, flags); }'
    );
    writeFileSync(
      join(root, 'src/engine/Map/DungeonFeature.ts'),
      'function flags(){return composedCellFlags(cell, f);}'
    );
    const file = join(root, 'src/probe.ts');
    writeFileSync(
      file,
      'function blocks(cell){return TERRAIN_FLAGS[cell.layers[0]].flags & T_OBSTRUCTS_PASSABILITY;}'
    );
    expect(checkStructureReaders(root).length).toBeGreaterThan(0);
    for (const code of [
      'function blocks(type){const {flags} = TERRAIN_FLAGS[type];return flags;}',
      "import {TERRAIN_FLAGS as catalog} from './TerrainCatalog';const alias=catalog;function blocks(type){const entry=alias[type];return entry.flags;}",
      "import * as terrain from './TerrainCatalog';function blocks(type){return terrain.TERRAIN_FLAGS[type]['flags'];}",
      "function blocks(cell){return cell['layers'][0];}",
      'function blocks(cell){const {layers: tiles} = cell;return tiles[0];}'
    ]) {
      writeFileSync(file, code);
      expect(checkStructureReaders(root).length).toBeGreaterThan(0);
    }
    writeFileSync(
      file,
      "import {TERRAIN_FLAGS as catalog} from './TerrainCatalog';function blocks(cell){return catalog[cell.layers[0]].flags;}"
    );
    expect(checkStructureReaders(root).length).toBeGreaterThan(0);
    writeFileSync(
      file,
      'function blocks(cell){return composedCellFlags(cell) & T_OBSTRUCTS_PASSABILITY;}'
    );
    expect(checkStructureReaders(root)).toEqual([]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
