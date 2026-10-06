/** One database and one atomic boundary for saves and their recording prefix. */
export const SAVE_DATABASE = 'brogue-web-saves';
export const SAVE_DATABASE_VERSION = 2;
export const SAVE_STORES = ['checkpoint', 'recordings', 'eventChunks', 'snapshots'] as const;
export type SaveStore = (typeof SAVE_STORES)[number];
export interface DatabaseStore {
  get<T>(key: IDBValidKey): Promise<T | undefined>;
  put(value: unknown, key: IDBValidKey): void;
  delete(key: IDBValidKey): void;
  clear(): void;
}
export interface SaveDatabaseAdapter {
  transaction<T>(
    names: readonly SaveStore[],
    mode: IDBTransactionMode,
    action: (stores: Record<SaveStore, DatabaseStore>) => T | Promise<T>
  ): Promise<T>;
}
let injected: SaveDatabaseAdapter | undefined;
/** Test-only injection; the production adapter below still exercises native atomic transactions. */
export function setSaveDatabaseAdapter(adapter?: SaveDatabaseAdapter): void {
  injected = adapter;
}
export async function openSaveDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SAVE_DATABASE, SAVE_DATABASE_VERSION);
    request.onupgradeneeded = () => {
      for (const name of SAVE_STORES)
        if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Save database upgrade is blocked'));
  });
}
export async function saveDatabaseTransaction<T>(
  names: readonly SaveStore[],
  mode: IDBTransactionMode,
  action: (stores: Record<SaveStore, DatabaseStore>) => T | Promise<T>
): Promise<T> {
  if (injected) return injected.transaction(names, mode, action);
  const db = await openSaveDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction([...names], mode);
      const stores = {} as Record<SaveStore, DatabaseStore>;
      for (const name of names) {
        const store = tx.objectStore(name);
        stores[name] = {
          get: <V>(key: IDBValidKey) =>
            new Promise<V | undefined>((done, fail) => {
              const request = store.get(key);
              request.onsuccess = () => done(request.result);
              request.onerror = () => fail(request.error);
            }),
          put: (value, key) => {
            store.put(value, key);
          },
          delete: (key) => { store.delete(key); },
          clear: () => {
            store.clear();
          }
        };
      }
      let result: T, failure: unknown, settled = false, completed = false;
      tx.oncomplete = () => {
        completed = true;
        if (settled) resolve(result);
        else reject(new Error('Save transaction completed before its action'));
      };
      tx.onabort = () => { completed = true; reject(failure ?? tx.error ?? new Error('Save transaction aborted')); };
      tx.onerror = () => {
        failure ??= tx.error;
      };
      const abort = (error: unknown) => {
        failure = error;
        if (completed) return;
        try { tx.abort(); } catch { completed = true; reject(error); }
      };
      try {
        Promise.resolve(action(stores)).then(
          (value) => {
            result = value;
            settled = true;
          },
          (error) => {
            abort(error);
          }
        );
      } catch (error) {
        abort(error);
      }
    });
  } finally {
    db.close();
  }
}
