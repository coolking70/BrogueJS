import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  setSaveDatabaseAdapter,
  openSaveDatabase,
  SAVE_STORES,
  type SaveDatabaseAdapter,
  type SaveStore,
  type DatabaseStore
} from '../engine/Core/SaveDatabase';
import { saveDatabaseTransaction } from '../engine/Core/SaveDatabase';
import { MemoryIndexedDB } from './support/memoryIndexedDB';
import { saveSnapshot, readSnapshot, readSaveSummary } from '../engine/Core/SaveStorage';
import { saveRecording, readRecording, deleteRecording } from '../engine/Core/RecordingStorage';
import { createHeadlessGame } from './harness';
class MemoryDatabase implements SaveDatabaseAdapter {
  stores = new Map<SaveStore, Map<IDBValidKey, unknown>>(
    SAVE_STORES.map((name) => [name, new Map()])
  );
  transactions: SaveStore[][] = [];
  failAt = Infinity;
  async transaction<T>(
    names: readonly SaveStore[],
    mode: IDBTransactionMode,
    action: (stores: Record<SaveStore, DatabaseStore>) => T | Promise<T>
  ): Promise<T> {
    this.transactions.push([...names]);
    let writes = 0;
    const candidate = new Map([...this.stores].map(([name, rows]) => [name, new Map(rows)]));
    const stores = {} as Record<SaveStore, DatabaseStore>;
    for (const name of names)
      stores[name] = {
        get: async <V>(key: IDBValidKey) =>
          structuredClone(candidate.get(name)!.get(key)) as V | undefined,
        put: (v, key) => {
          if (++writes === this.failAt) throw new Error('injected write');
          candidate.get(name)!.set(key, structuredClone(v));
        },
        delete: (key) => {
          if (++writes === this.failAt) throw new Error('injected delete');
          candidate.get(name)!.delete(key);
        },
        clear: () => {
          if (++writes === this.failAt) throw new Error('injected clear');
          candidate.get(name)!.clear();
        }
      };
    const result = await action(stores);
    if (mode === 'readwrite') this.stores = candidate;
    return result;
  }
}
afterEach(() => {
  setSaveDatabaseAdapter();
  vi.unstubAllGlobals();
});
describe('C5 shared IDB v2 storage', () => {
  it('review H1: game saves after seek or in another run preserve the user recording and its snapshot cache', async () => {
    const db = new MemoryDatabase(); setSaveDatabaseAdapter(db);
    const g = createHeadlessGame(517);
    for (let i = 0; i < 2049; i++) g.executeCommand('escape');
    const full = g.exportRecording();
    expect(full.snapshots).toHaveLength(1);
    await saveRecording(full);
    expect(g.loadReplay(full)).toBe(true); g.replaySeek(10);
    await saveSnapshot(g.toSaveSnapshot());
    expect(await readRecording()).toEqual(full);
    const other = createHeadlessGame(999);
    for (let i = 0; i < 3; i++) other.executeCommand('escape');
    await saveSnapshot(other.toSaveSnapshot());
    expect(await readRecording()).toEqual(full);
    expect((await readSnapshot())!.seed).toBe('999');
  });
  it('upgrades additively from v1 and never deletes or overwrites checkpoint during upgrade', async () => {
    const host = new MemoryIndexedDB(); host.seedV1('brogue-web-saves', { world: 'old v1 save' });
    vi.stubGlobal('indexedDB', host);
    const db = await openSaveDatabase();
    expect(SAVE_STORES.every(n => db.objectStoreNames.contains(n))).toBe(true); db.close();
    // The assertion observes the very store that production upgrade can mutate.
    expect(await saveDatabaseTransaction(['checkpoint'], 'readonly', s => s.checkpoint.get('world'))).toBe('old v1 save');
  });
  it('review L6: production IDB adapter awaits async requests, aborts read/write failures and closes connections', async () => {
    const host = new MemoryIndexedDB(); vi.stubGlobal('indexedDB', host);
    await saveDatabaseTransaction(['checkpoint'], 'readwrite', s => { s.checkpoint.put('original', 'world'); });
    await expect(saveDatabaseTransaction(['checkpoint'], 'readwrite', async s => {
      expect(await s.checkpoint.get('world')).toBe('original');
      s.checkpoint.put('replacement', 'world'); throw new Error('async participant');
    })).rejects.toThrow('async participant');
    expect(await saveDatabaseTransaction(['checkpoint'], 'readonly', s => s.checkpoint.get('world'))).toBe('original');
    host.failRead = () => { throw new Error('request failure'); };
    await expect(saveDatabaseTransaction(['checkpoint'], 'readonly', s => s.checkpoint.get('world'))).rejects.toThrow('request failure');
    host.failRead = undefined;
    await expect(saveDatabaseTransaction(['checkpoint'], 'readwrite', () => { throw new Error('sync participant'); })).rejects.toThrow('sync participant');
    await expect(saveDatabaseTransaction(['checkpoint'], 'readwrite', async () => {
      await new Promise(resolve => setTimeout(resolve, 20)); throw new Error('late participant');
    })).rejects.toThrow('completed before its action');
    await new Promise(resolve => setTimeout(resolve, 25));
    expect(host.closed).toBe(6);
  });
  it('review L2: quota on optional cache retries the entire recording without snapshots and preserves the save mirror', async () => {
    const host = new MemoryIndexedDB(); vi.stubGlobal('indexedDB', host);
    const g = createHeadlessGame(517);
    for (let i = 0; i < 2049; i++) g.executeCommand('escape');
    const r = g.exportRecording(); await saveSnapshot(g.toSaveSnapshot());
    host.failRequestWrite = (store) => { if (store === 'snapshots') throw new DOMException('cache quota', 'QuotaExceededError'); };
    expect(await saveRecording(r)).toEqual({ discardedSnapshots: true });
    expect(await readRecording()).toEqual({ ...r, snapshots: [] });
    expect((await readRecording('save-origin'))!.events).toEqual(r.events);
    host.failRequestWrite = (store) => { if (store === 'eventChunks') throw new DOMException('event quota', 'QuotaExceededError'); };
    await expect(saveRecording({ ...r, snapshots: [] })).rejects.toHaveProperty('name', 'QuotaExceededError');
    expect((await readRecording())!.events).toEqual(r.events);
    expect((await readSnapshot())!.run.recordingOrigin!.events).toEqual(r.events);
  });
  it('review M3: old saves remain visible with incompatibility status and unmodified contents', async () => {
    const host = new MemoryIndexedDB();
    const old = { schema: 'brogue-web-whole-run-v3', depth: 3, seed: '9', mode: 'normal', savedAt: 1 };
    host.seedV1('brogue-web-saves', { world: JSON.stringify({ version: 3 }), summary: old });
    vi.stubGlobal('indexedDB', host);
    expect(await readSaveSummary()).toEqual({ ...old, compatible: false });
    expect(await readSnapshot()).toEqual({ version: 3 });
  });
  it('commits world, prefix manifest and all 256-event chunks together; overwrite failure preserves the original records', async () => {
    const db = new MemoryDatabase();
    setSaveDatabaseAdapter(db);
    const g = createHeadlessGame(517);
    for (let i = 0; i < 257; i++) g.executeCommand('escape');
    const save = g.toSaveSnapshot();
    expect(save.run.recordingOrigin?.events).toHaveLength(257);
    await saveSnapshot(save);
    expect(db.transactions[0]).toEqual(['checkpoint', 'recordings', 'eventChunks', 'snapshots']);
    expect(db.stores.get('eventChunks')!.get('save-origin.0') as unknown[]).toHaveLength(256);
    expect(db.stores.get('eventChunks')!.get('save-origin.1') as unknown[]).toHaveLength(1);
    expect((await readSnapshot())!.run.recordingOrigin!.events).toEqual(
      (await readRecording('save-origin'))!.events
    );
    expect(await readSaveSummary()).toMatchObject({ seed: '517' });
    const old = structuredClone(db.stores);
    g.executeCommand('escape');
    db.failAt = 6;
    await expect(saveSnapshot(g.toSaveSnapshot())).rejects.toThrow('injected');
    expect(db.stores).toEqual(old);
    db.failAt = Infinity;
    await saveRecording(g.exportRecording());
    expect((await readRecording())!.events).toHaveLength(258);
    db.stores.get('eventChunks')!.delete('current.1');
    await expect(readRecording()).rejects.toThrow('Missing recording chunk');
    await deleteRecording();
    expect(await readRecording()).toBeNull();
    expect(await readSnapshot()).not.toBeNull();
  });
});
