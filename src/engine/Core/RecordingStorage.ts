import { boundedSnapshots, recordingHeader } from './RecordingFormat';
import type {
  RecordingV4,
  RecordingHeaderV4,
  RecordingEventV4,
  ReplaySnapshotV4
} from './RecordingV4';
import { saveDatabaseTransaction, type SaveStore, type DatabaseStore } from './SaveDatabase';
export const RECORDING_STORES = ['recordings', 'eventChunks', 'snapshots'] as const;
export type RecordingSlot = 'current' | 'save-origin';
interface RecordingIndex {
  header: RecordingHeaderV4;
  eventCount: number;
  snapshotKeys: number[];
  namespaced?: true;
}
const rowKey = (slot: RecordingSlot, number: number) => slot + '.' + number;
/** Erase only this slot, preserving the independently owned user recording/save mirror. */
export async function eraseRecording(stores: Record<SaveStore, DatabaseStore>, slot: RecordingSlot): Promise<void> {
  const old = await stores.recordings.get<RecordingIndex>(slot);
  if (old) {
    for (let i = 0; i < Math.ceil(old.eventCount / 256); i++)
      stores.eventChunks.delete(old.namespaced ? rowKey(slot, i) : i);
    for (const key of old.snapshotKeys) stores.snapshots.delete(old.namespaced ? rowKey(slot, key) : key);
    stores.recordings.delete(slot);
  }
}
/** All requests remain in the caller's transaction, never a second transaction. */
export async function writeRecording(
  stores: Record<SaveStore, DatabaseStore>,
  recording: RecordingV4,
  slot: RecordingSlot = 'current'
): Promise<void> {
  await eraseRecording(stores, slot);
  const snapshots = boundedSnapshots(recording.snapshots);
  stores.recordings.put(
    {
      header: recordingHeader(recording),
      eventCount: recording.events.length,
      snapshotKeys: snapshots.map((s) => s.afterCommand), namespaced: true
    } satisfies RecordingIndex,
    slot
  );
  for (let start = 0; start < recording.events.length; start += 256)
    stores.eventChunks.put(recording.events.slice(start, start + 256), rowKey(slot, start / 256));
  for (const snapshot of snapshots) stores.snapshots.put(snapshot, rowKey(slot, snapshot.afterCommand));
}
export async function saveRecording(recording: RecordingV4): Promise<{ discardedSnapshots: boolean }> {
  // Detach before await, including Vue proxies. The simulation may advance while opening IDB.
  const detached = JSON.parse(JSON.stringify(recording)) as RecordingV4;
  const write = () => saveDatabaseTransaction(RECORDING_STORES, 'readwrite', (stores) => writeRecording(stores, detached));
  try { await write(); return { discardedSnapshots: false }; }
  catch (error) {
    if ((error as { name?: string })?.name !== 'QuotaExceededError' || !detached.snapshots.length) throw error;
    detached.snapshots = [];
    await write(); return { discardedSnapshots: true };
  }
}
export async function readRecording(slot: RecordingSlot = 'current'): Promise<RecordingV4 | null> {
  return saveDatabaseTransaction(RECORDING_STORES, 'readonly', async (stores) => {
    const index = await stores.recordings.get<RecordingIndex>(slot);
    if (!index) return null;
    if (
      !Number.isSafeInteger(index.eventCount) ||
      index.eventCount < 0 ||
      !Array.isArray(index.snapshotKeys)
    )
      throw new Error('Invalid recording index');
    const chunks = await Promise.all(
      Array.from({ length: Math.ceil(index.eventCount / 256) }, (_, i) =>
        stores.eventChunks.get<RecordingEventV4[]>(index.namespaced ? rowKey(slot, i) : i)
      )
    );
    if (
      chunks.some(
        (chunk, i) =>
          !Array.isArray(chunk) || chunk.length !== Math.min(256, index.eventCount - i * 256)
      )
    )
      throw new Error('Missing recording chunk');
    const snapshots = await Promise.all(
      index.snapshotKeys.map((key) => stores.snapshots.get<ReplaySnapshotV4>(index.namespaced ? rowKey(slot, key) : key))
    );
    return {
      ...index.header,
      events: chunks.flat() as RecordingEventV4[],
      snapshots: boundedSnapshots(snapshots.filter((s): s is ReplaySnapshotV4 => !!s))
    };
  });
}
export async function hasStoredRecording(): Promise<boolean> {
  return saveDatabaseTransaction(
    ['recordings'],
    'readonly',
    async (stores) => !!(await stores.recordings.get('current'))
  );
}
export async function deleteRecording(): Promise<void> {
  await saveDatabaseTransaction(RECORDING_STORES, 'readwrite', (stores) => eraseRecording(stores, 'current'));
}
