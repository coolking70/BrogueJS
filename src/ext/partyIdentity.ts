/** Effective run identity: installed packages alone never upgrade classic runs. */
import type { ExtensionManifest } from './types';
export function hasPartyIdentity(manifest: Pick<ExtensionManifest, 'modules'> | null | undefined): boolean {
  return manifest?.modules.some(m => m.id === 'party') === true;
}
export function effectivePartyCodec(manifest: Pick<ExtensionManifest, 'modules'> | null | undefined) {
  return hasPartyIdentity(manifest)
    ? {foundation:22 as const,wholeRun:9 as const,recording:6 as const,origin:4 as const,schema:'brogue-web-whole-run-v9' as const}
    : {foundation:20 as const,wholeRun:7 as const,recording:4 as const,origin:2 as const,schema:'brogue-web-whole-run-v7' as const};
}
