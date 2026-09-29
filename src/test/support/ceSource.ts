import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
export const CE_ROOT = process.env.BROGUE_CE_DIR
    ? resolve(process.env.BROGUE_CE_DIR)
    : resolve(repoRoot, '.ce-reference/BrogueCE-master');
export const CE_SKIP_REASON = 'CE reference source not found; run npm run ce:fetch';

/** rel is relative to the CE checkout root, e.g. src/brogue/Globals.c. */
export function ceFile(rel: string): string {
    return resolve(CE_ROOT, rel);
}

export function hasCeSource(): boolean {
    return ['src/brogue/Rogue.h', 'src/brogue/Globals.c', 'src/variants/GlobalsBrogue.c']
        .every(rel => existsSync(ceFile(rel)));
}

export function readCe(rel: string): string {
    return readFileSync(ceFile(rel), 'utf8');
}
