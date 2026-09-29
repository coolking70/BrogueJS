import { CE_SKIP_REASON, hasCeSource } from './ceSource';

export default function setup(): void {
    if (hasCeSource()) return;
    if (process.env.BROGUE_REQUIRE_CE === '1') throw new Error(CE_SKIP_REASON);
    console.warn(`\n*** ${CE_SKIP_REASON} ***\nCE-dependent tests will be explicitly skipped.\n`);
}
