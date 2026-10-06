/** Minimal IDB event/transaction host, used through the production adapter.
 * Requests are asynchronous; a transaction automatically commits after its last
 * request task, and abort discards every queued write. No SaveDatabase injection. */
type Rows = Map<string, unknown>;
const keyOf = (key: IDBValidKey) => JSON.stringify(key);
export class MemoryIndexedDB {
  databases = new Map<string, { version: number; stores: Map<string, Rows> }>();
  closed = 0;
  failWrite?: (store: string, key: IDBValidKey, value: unknown) => void;
  failRequestWrite?: (store: string, key: IDBValidKey, value: unknown) => void;
  failRead?: (store: string, key: IDBValidKey) => void;
  open(name: string, version: number): IDBOpenDBRequest {
    const request: any = {};
    setTimeout(() => {
      const record = this.databases.get(name) ?? { version: 0, stores: new Map<string, Rows>() };
      this.databases.set(name, record);
      const db = {
        objectStoreNames: { contains: (name: string) => record.stores.has(name) },
        createObjectStore: (name: string) => { record.stores.set(name, new Map()); },
        transaction: (names: string[], mode: IDBTransactionMode) => {
          const candidate = new Map([...record.stores].map(([n, rows]) => [n, new Map(rows)]));
          let pending = 0, completed = false, finish: ReturnType<typeof setTimeout> | undefined;
          const tx: any = { error: null };
          const active = () => { if (completed) throw new DOMException('Inactive transaction', 'TransactionInactiveError'); };
          const schedule = () => {
            if (finish) clearTimeout(finish);
            finish = setTimeout(() => {
              if (completed || pending) return;
              completed = true;
              if (mode === 'readwrite') for (const n of names) record.stores.set(n, candidate.get(n)!);
              tx.oncomplete?.();
            }, 0);
          };
          tx.abort = () => {
            active(); completed = true; if (finish) clearTimeout(finish);
            setTimeout(() => tx.onabort?.(), 0);
          };
          tx.objectStore = (n: string) => {
            active(); if (!names.includes(n) || !candidate.has(n)) throw new DOMException('Unknown store', 'NotFoundError');
            const requestFor = (action: () => unknown) => {
              active(); pending++; if (finish) clearTimeout(finish);
              const req: any = {};
              setTimeout(() => {
                if (completed) return;
                try { req.result = action(); req.onsuccess?.(); }
                catch (error) {
                  req.error = error; tx.error = error; req.onerror?.(); tx.onerror?.();
                  if (!completed) tx.abort();
                }
                pending--; schedule();
              }, 0);
              return req;
            };
            return {
              get: (key: IDBValidKey) => requestFor(() => { this.failRead?.(n, key); return structuredClone(candidate.get(n)!.get(keyOf(key))); }),
              put: (value: unknown, key: IDBValidKey) => {
                active(); this.failWrite?.(n, key, value);
                const detached = structuredClone(value);
                return requestFor(() => { this.failRequestWrite?.(n, key, detached); return candidate.get(n)!.set(keyOf(key), detached); });
              },
              delete: (key: IDBValidKey) => requestFor(() => candidate.get(n)!.delete(keyOf(key))),
              clear: () => requestFor(() => candidate.get(n)!.clear()),
            };
          };
          schedule(); return tx;
        },
        close: () => { this.closed++; },
      };
      request.result = db;
      if (record.version < version) { record.version = version; request.onupgradeneeded?.(); }
      request.onsuccess?.();
    }, 0);
    return request;
  }
  seedV1(name: string, checkpoint: Record<string, unknown>): void {
    this.databases.set(name, { version: 1, stores: new Map([['checkpoint', new Map(Object.entries(checkpoint).map(([k,v]) => [keyOf(k), v]))]]) });
  }
}
