/** Effective run identity: installed packages alone never upgrade classic runs. */
import type { ExtensionManifest } from './types';
export function hasPartyIdentity(manifest: Pick<ExtensionManifest, 'modules'> | null | undefined): boolean {
  return manifest?.modules.some(m => m.id === 'party') === true;
}
export function effectivePartyCodec(manifest: Pick<ExtensionManifest, 'modules'> | null | undefined) {
  return hasPartyIdentity(manifest)
    ? {foundation:24 as const,wholeRun:11 as const,recording:8 as const,origin:6 as const,schema:'brogue-web-whole-run-v11' as const}
    : {foundation:20 as const,wholeRun:7 as const,recording:4 as const,origin:2 as const,schema:'brogue-web-whole-run-v7' as const};
}
