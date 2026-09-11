import {
  assertPersistentChunkKey,
  PersistentStoreError,
  type PersistentChunkKey,
  type PersistentChunkStore,
  type PersistentQuota,
  type PersistentReadResult,
} from "./persistent.ts";

/**
 * IndexedDB backend for the persistent chunk cache (L3, CACHE-02).
 *
 * The module implements the storage-agnostic `PersistentChunkStore` contract
 * without widening it: values are already serialized bytes (put receives a
 * Uint8Array and the compiled-chunk deserializer belongs to CACHE-03), and
 * every failure mode is explicit. Storage that is missing, denied, blocked by
 * another connection, written by a newer client, or failing mid-transaction
 * degrades to a typed miss (`unavailable`) or to a `PersistentStoreError`,
 * never to an uncontrolled throw: the driving session keeps compiling.
 *
 * The global `indexedDB` is resolved lazily on first use, so importing this
 * module is side-effect free and safe in Node, workers without storage and
 * pages where the factory is denied.
 */

/** Versioned database holding the persistent entries. */
export const PERSISTENT_DATABASE_NAME = "opengta-persistent-chunks";
export const PERSISTENT_DATABASE_VERSION = 1;
/** Single object store: primary key is the persistent key id, no key path. */
export const PERSISTENT_ENTRY_STORE = "chunk-entries";
/** Declared entry budget used when the caller does not pass one (32 MiB). */
export const DEFAULT_PERSISTENT_BUDGET_BYTES = 32 * 1024 * 1024;

export interface IndexedDbChunkStoreOptions {
  /** Declared budget in bytes. Exceeding it evicts the least recently written entries. */
  readonly budgetBytes?: number;
}

/**
 * Additive extension of the contract: closes the connection so a long-lived
 * page can release it. Later operations reopen lazily.
 */
export interface IndexedDbChunkStore extends PersistentChunkStore {
  close(): Promise<void>;
}

/** One persisted entry. The id is denormalized into the record so a full scan needs one request. */
interface StoredEntry {
  readonly id: string;
  readonly value: Uint8Array;
  readonly bytes: number;
  readonly storedAt: number;
}

interface PersistedEntry {
  readonly id: string;
  readonly bytes: number;
  readonly storedAt: number;
}

type OpenResult =
  | { readonly status: "ready"; readonly database: IDBDatabase }
  | { readonly status: "unavailable" };

const MISS_ABSENT: PersistentReadResult = Object.freeze({ status: "miss", reason: "absent" });
const MISS_UNAVAILABLE: PersistentReadResult = Object.freeze({ status: "miss", reason: "unavailable" });
const UNAVAILABLE_OPEN: OpenResult = Object.freeze({ status: "unavailable" });
const UNAVAILABLE_QUOTA: PersistentQuota = Object.freeze({ budgetBytes: 0, usedBytes: 0, entries: 0 });

/** Same id as the in-memory backend (src/world/chunk/persistent.ts), so both agree byte for byte. */
function entryId(key: PersistentChunkKey): string {
  return JSON.stringify([key.namespace, key.chunkId, key.compilerVersion, key.schemaVersion]);
}

// Mirrors the in-memory backend: an entry is non-empty bytes, never a live object.
function assertValue(value: Uint8Array): void {
  if (!(value instanceof Uint8Array)) throw new PersistentStoreError("invalid-value", "persistent chunk payload must be a Uint8Array");
  if (value.byteLength === 0) throw new PersistentStoreError("invalid-value", "persistent chunk payload must not be empty");
}

function isQuotaFailure(error: unknown): boolean {
  const name = error && typeof error === "object" && "name" in error ? String((error as { name: unknown }).name) : "";
  return name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED";
}

function isStoredEntry(value: unknown): value is StoredEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<StoredEntry>;
  return entry.value instanceof Uint8Array && entry.value.byteLength > 0
    && typeof entry.id === "string" && typeof entry.bytes === "number" && typeof entry.storedAt === "number";
}

function indexedDbFactory(): IDBFactory | undefined {
  const candidate = (globalThis as { indexedDB?: IDBFactory }).indexedDB;
  return candidate && typeof candidate.open === "function" ? candidate : undefined;
}

/**
 * Opens the versioned database or reports it unavailable. The request never
 * rejects: denied factories, upgrade errors and blocked upgrades all resolve to
 * the unavailable result. A blocked upgrade is abandoned instead of hanging,
 * because another connection holds a lower version.
 */
function openDatabase(): Promise<OpenResult> {
  const factory = indexedDbFactory();
  if (!factory) return Promise.resolve(UNAVAILABLE_OPEN);
  let request: IDBOpenDBRequest;
  try {
    request = factory.open(PERSISTENT_DATABASE_NAME, PERSISTENT_DATABASE_VERSION);
  } catch {
    return Promise.resolve(UNAVAILABLE_OPEN);
  }
  return new Promise<OpenResult>((resolve) => {
    let settled = false;
    let abandoned = false;
    const settle = (result: OpenResult): void => { if (settled) return; settled = true; resolve(result); };
    request.onupgradeneeded = () => {
      try {
        const database = request.result;
        if (!database.objectStoreNames.contains(PERSISTENT_ENTRY_STORE)) database.createObjectStore(PERSISTENT_ENTRY_STORE);
      } catch { /* reported through request.onerror */ }
    };
    request.onblocked = () => { abandoned = true; settle(UNAVAILABLE_OPEN); };
    request.onerror = () => settle(UNAVAILABLE_OPEN);
    request.onsuccess = () => {
      const database = request.result;
      if (abandoned || !database.objectStoreNames.contains(PERSISTENT_ENTRY_STORE)) {
        try { database.close(); } catch { /* already closed */ }
        settle(UNAVAILABLE_OPEN);
        return;
      }
      settle({ status: "ready", database });
    };
  });
}

// Structural shape of an IDBRequest: IDBRequest<T> is invariant in T because of
// the `this` type of its handlers, so the helpers below accept this projection.
type IndexedDbRequest<T> = Pick<IDBRequest<T>, "result" | "error"> & {
  onsuccess: ((event: Event) => unknown) | null;
  onerror: ((event: Event) => unknown) | null;
};

function requestResult<T>(request: IndexedDbRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
  });
}

async function readEntry(database: IDBDatabase, id: string): Promise<StoredEntry | undefined> {
  const transaction = database.transaction(PERSISTENT_ENTRY_STORE, "readonly");
  const store = transaction.objectStore(PERSISTENT_ENTRY_STORE);
  const [record] = await Promise.all([requestResult<unknown>(store.get(id)), transactionDone(transaction)]);
  return isStoredEntry(record) ? record : undefined;
}

async function readEntries(database: IDBDatabase): Promise<readonly StoredEntry[]> {
  const transaction = database.transaction(PERSISTENT_ENTRY_STORE, "readonly");
  const store = transaction.objectStore(PERSISTENT_ENTRY_STORE);
  const [records] = await Promise.all([requestResult<unknown[]>(store.getAll()), transactionDone(transaction)]);
  return Array.isArray(records) ? records.filter(isStoredEntry) : [];
}

async function writeEntry(database: IDBDatabase, record: StoredEntry): Promise<void> {
  const transaction = database.transaction(PERSISTENT_ENTRY_STORE, "readwrite");
  const request = transaction.objectStore(PERSISTENT_ENTRY_STORE).put(record, record.id);
  await Promise.all([requestResult<unknown>(request), transactionDone(transaction)]);
}

/** Removes the given keys in one transaction and reports how many were present. */
async function removeEntries(database: IDBDatabase, ids: readonly string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const transaction = database.transaction(PERSISTENT_ENTRY_STORE, "readwrite");
  try {
    const store = transaction.objectStore(PERSISTENT_ENTRY_STORE);
    const presence = ids.map((id) => requestResult<unknown>(store.get(id)));
    const removals = ids.map((id) => requestResult<unknown>(store.delete(id)));
    const [found] = await Promise.all([Promise.all(presence), Promise.all(removals), transactionDone(transaction)]);
    return found.filter((record) => record !== undefined).length;
  } catch (error) {
    try { transaction.abort(); } catch { /* already finished */ }
    throw error;
  }
}

async function clearEntries(database: IDBDatabase): Promise<void> {
  const transaction = database.transaction(PERSISTENT_ENTRY_STORE, "readwrite");
  const request = transaction.objectStore(PERSISTENT_ENTRY_STORE).clear();
  await Promise.all([requestResult<unknown>(request), transactionDone(transaction)]);
}

/**
 * Bounded persistent store. The declared budget is enforced by evicting the
 * least recently *written* entries (a read never promotes an entry, so the hot
 * read path stays a single request). Accounting is exact after the first write
 * of a session, which reconciles with the persisted index once; evicting or
 * reporting quota always reconciles first, so the persisted state is the
 * authority and the in-memory map is only a fast path.
 */
export function createIndexedDbChunkStore(options: IndexedDbChunkStoreOptions = {}): IndexedDbChunkStore {
  const budgetBytes = options.budgetBytes ?? DEFAULT_PERSISTENT_BUDGET_BYTES;
  if (!Number.isInteger(budgetBytes) || budgetBytes <= 0) throw new Error("indexedDB chunk store budget must be a positive integer");

  let connection: Promise<OpenResult> | undefined;
  const accounted = new Map<string, PersistedEntry>();
  let accountedBytes = 0;
  let reconciled = false;
  let lastStoredAt = 0;

  const nextStoredAt = (): number => {
    lastStoredAt = Math.max(Date.now(), lastStoredAt + 1);
    return lastStoredAt;
  };

  const open = (): Promise<OpenResult> => {
    connection ??= openDatabase();
    return connection;
  };

  const reconcile = async (database: IDBDatabase): Promise<void> => {
    const records = await readEntries(database);
    accounted.clear();
    accountedBytes = 0;
    for (const record of records) {
      accounted.set(record.id, { id: record.id, bytes: record.bytes, storedAt: record.storedAt });
      accountedBytes += record.bytes;
    }
    reconciled = true;
  };

  const failure = (error: unknown, message: string): PersistentStoreError => isQuotaFailure(error)
    ? new PersistentStoreError("quota-exceeded", `${message}: browser storage quota exceeded`, error)
    : new PersistentStoreError("store-failure", message, error);

  const evictFor = async (database: IDBDatabase, incoming: PersistedEntry): Promise<void> => {
    const projectedStart = accountedBytes - (accounted.get(incoming.id)?.bytes ?? 0) + incoming.bytes;
    if (projectedStart <= budgetBytes) return;
    let projected = projectedStart;
    const doomed: string[] = [];
    const candidates = [...accounted.values()]
      .filter((entry) => entry.id !== incoming.id)
      .sort((a, b) => a.storedAt - b.storedAt || a.id.localeCompare(b.id));
    for (const candidate of candidates) {
      if (projected <= budgetBytes) break;
      projected -= candidate.bytes;
      doomed.push(candidate.id);
    }
    if (doomed.length === 0) return;
    await removeEntries(database, doomed);
    for (const id of doomed) {
      const entry = accounted.get(id);
      if (!entry) continue;
      accountedBytes -= entry.bytes;
      accounted.delete(id);
    }
  };

  return {
    async get(key) {
      const id = entryId(assertPersistentChunkKey(key));
      const opened = await open();
      if (opened.status !== "ready") return MISS_UNAVAILABLE;
      try {
        const record = await readEntry(opened.database, id);
        if (!record) return MISS_ABSENT;
        return { status: "hit", value: record.value.slice() };
      } catch {
        // A failing read is degraded storage, not a caller error: compile instead.
        return MISS_UNAVAILABLE;
      }
    },
    async put(key, value) {
      const id = entryId(assertPersistentChunkKey(key));
      assertValue(value);
      const opened = await open();
      if (opened.status !== "ready") throw new PersistentStoreError("storage-unavailable", "persistent chunk storage is not available");
      const bytes = value.byteLength;
      // Checked before any eviction: a rejected write must not lose stored data.
      if (bytes > budgetBytes) throw new PersistentStoreError("quota-exceeded", `persistent chunk budget of ${budgetBytes} bytes cannot hold a ${bytes} byte entry`);
      const record: StoredEntry = { id, value: value.slice(), bytes, storedAt: nextStoredAt() };
      try {
        // One full pass per session: entries written by a previous session must
        // count against the budget before the first eviction decision.
        if (!reconciled) await reconcile(opened.database);
        await evictFor(opened.database, record);
        await writeEntry(opened.database, record);
      } catch (error) {
        throw failure(error, "persistent chunk entry could not be stored");
      }
      const replaced = accounted.get(id)?.bytes ?? 0;
      accounted.set(id, { id, bytes, storedAt: record.storedAt });
      accountedBytes += bytes - replaced;
    },
    async delete(key) {
      const id = entryId(assertPersistentChunkKey(key));
      const opened = await open();
      if (opened.status !== "ready") return false;
      try {
        const removed = await removeEntries(opened.database, [id]);
        const known = accounted.get(id);
        if (known) { accountedBytes -= known.bytes; accounted.delete(id); }
        return removed > 0;
      } catch {
        return false;
      }
    },
    async clear() {
      const opened = await open();
      if (opened.status !== "ready") { accounted.clear(); accountedBytes = 0; reconciled = false; return; }
      try {
        await clearEntries(opened.database);
        accounted.clear();
        accountedBytes = 0;
        reconciled = true;
      } catch {
        // Best effort: the next write reconciles with whatever survived.
        accounted.clear();
        accountedBytes = 0;
        reconciled = false;
      }
    },
    async quota() {
      const opened = await open();
      if (opened.status !== "ready") return UNAVAILABLE_QUOTA;
      try {
        await reconcile(opened.database);
        return { budgetBytes, usedBytes: accountedBytes, entries: accounted.size };
      } catch {
        return UNAVAILABLE_QUOTA;
      }
    },
    async close() {
      const pending = connection;
      connection = undefined;
      accounted.clear();
      accountedBytes = 0;
      reconciled = false;
      if (!pending) return;
      const opened = await pending.catch(() => undefined);
      if (opened?.status !== "ready") return;
      try { opened.database.close(); } catch { /* already closed */ }
    },
  };
}
