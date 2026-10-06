const LEGACY_KEY = 'brogue-web-replay-v1';
const DISMISSED_KEY = 'brogue-web-replay-v1-dismissed';
type LegacyStorage = Pick<Storage, 'getItem' | 'setItem'>;
/** Preserve the exact old JSON for recovery; never import or overwrite the current recording. */
export function legacyReplayState(storage: LegacyStorage): { raw: string | null; showNotice: boolean } {
  const raw = storage.getItem(LEGACY_KEY);
  return { raw, showNotice: !!raw && storage.getItem(DISMISSED_KEY) !== '1' };
}
export function dismissLegacyReplay(storage: LegacyStorage): void { storage.setItem(DISMISSED_KEY, '1'); }
