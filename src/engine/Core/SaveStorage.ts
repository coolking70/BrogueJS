/** Whole runs and their one authoritative recording prefix commit atomically. */
import { WHOLE_RUN_SCHEMA, type GameSnapshot, type GameMode } from './Game';
import { saveDatabaseTransaction } from './SaveDatabase';
import { RECORDING_STORES, writeRecording, eraseRecording } from './RecordingStorage';
import { originRecording } from './RecordingFormat';
export interface SaveSummary {
  schema: string;
  compatible: boolean;
  depth: number;
  seed: string;
  mode: GameMode;
  savedAt: number;
}
export async function saveSnapshot(snapshot: GameSnapshot, isCurrent: () => boolean = () => true, signal?: AbortSignal): Promise<SaveSummary> {
  const summary: SaveSummary = {
    schema: snapshot.schema,
    compatible: true,
    depth: snapshot.depth,
    seed: snapshot.seed,
    mode: snapshot.mode,
    savedAt: snapshot.savedAt
  };
  const json = JSON.stringify(snapshot),
    origin = JSON.parse(json).run.recordingOrigin;
  await saveDatabaseTransaction(
    ['checkpoint', ...RECORDING_STORES],
    'readwrite',
    async (stores) => {
      if (!isCurrent()) throw new Error('Save generation replaced');
      stores.checkpoint.put(json, 'world');
      stores.checkpoint.put(summary, 'summary');
      if (origin) await writeRecording(stores, originRecording(origin), 'save-origin');
      else await eraseRecording(stores, 'save-origin');
      if (!isCurrent()) throw new Error('Save generation replaced');
    }, signal
  );
  return summary;
}
export async function readSaveSummary(): Promise<SaveSummary | null> {
  const summary = await saveDatabaseTransaction(['checkpoint'], 'readonly', (stores) =>
    stores.checkpoint.get<SaveSummary>('summary')
  );
  return summary ? { ...summary, compatible: summary.schema === WHOLE_RUN_SCHEMA } : null;
}
export async function readSnapshot(): Promise<GameSnapshot | null> {
  const json = await saveDatabaseTransaction(['checkpoint'], 'readonly', (stores) =>
    stores.checkpoint.get<string>('world')
  );
  return json === undefined ? null : (JSON.parse(json) as GameSnapshot);
}
export async function deleteSnapshot(): Promise<void> {
  await saveDatabaseTransaction(['checkpoint', ...RECORDING_STORES], 'readwrite', async (stores) => {
    stores.checkpoint.clear(); await eraseRecording(stores, 'save-origin');
  });
}
