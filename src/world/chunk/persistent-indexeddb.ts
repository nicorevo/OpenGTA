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
export const PERSISTENT_DATABASE_VERSION = 2;
/** Blob store: primary key is the persistent key id, no key path. */
export const PERSISTENT_ENTRY_STORE = "chunk-entries";
/** Metadata index next to the blobs: `{ id, bytes, storedAt }`, keyed by the same id. */
export const PERSISTENT_METADATA_STORE = "chunk-metadata";
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

function isPersistedEntry(value: unknown): value is PersistedEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<PersistedEntry>;
  return typeof entry.id === "string"
    && typeof entry.bytes === "number" && Number.isSafeInteger(entry.bytes) && entry.bytes >= 0
    && typeof entry.storedAt === "number" && Number.isFinite(entry.storedAt);
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
        if (database.objectStoreNames.contains(PERSISTENT_ENTRY_STORE)) {
          // A v1 database holds blobs with no metadata index. The data is a pure
          // cache: drop it on upgrade instead of reading the blobs back in.
          database.deleteObjectStore(PERSISTENT_ENTRY_STORE);
        }
        if (!database.objectStoreNames.contains(PERSISTENT_ENTRY_STORE)) database.createObjectStore(PERSISTENT_ENTRY_STORE);
        if (!database.objectStoreNames.contains(PERSISTENT_METADATA_STORE)) database.createObjectStore(PERSISTENT_METADATA_STORE);
      } catch { /* reported through request.onerror */ }
    };
    request.onblocked = () => { abandoned = true; settle(UNAVAILABLE_OPEN); };
    request.onerror = () => settle(UNAVAILABLE_OPEN);
    request.onsuccess = () => {
      const database = request.result;
      if (abandoned || !database.objectStoreNames.contains(PERSISTENT_ENTRY_STORE) || !database.objectStoreNames.contains(PERSISTENT_METADATA_STORE)) {
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

/** Reads the metadata index only: a bounded scan, never the blobs. */
async function readMetadata(database: IDBDatabase): Promise<readonly PersistedEntry[]> {
  const transaction = database.transaction(PERSISTENT_METADATA_STORE, "readonly");
  const store = transaction.objectStore(PERSISTENT_METADATA_STORE);
  const [records] = await Promise.all([requestResult<unknown[]>(store.getAll()), transactionDone(transaction)]);
  return Array.isArray(records) ? records.filter(isPersistedEntry) : [];
}

/** Writes blob and metadata atomically: one record in each store, one transaction. */
async function writeEntry(database: IDBDatabase, record: StoredEntry): Promise<void> {
  const transaction = database.transaction([PERSISTENT_ENTRY_STORE, PERSISTENT_METADATA_STORE], "readwrite");
  const entriesStore = transaction.objectStore(PERSISTENT_ENTRY_STORE);
  const metadataStore = transaction.objectStore(PERSISTENT_METADATA_STORE);
  const metadata: PersistedEntry = { id: record.id, bytes: record.bytes, storedAt: record.storedAt };
  await Promise.all([
    requestResult<unknown>(entriesStore.put(record, record.id)),
    requestResult<unknown>(metadataStore.put(metadata, record.id)),
    transactionDone(transaction),
  ]);
}

/** Removes blob and metadata for the given keys in one transaction and reports how many were present. */
async function removeEntries(database: IDBDatabase, ids: readonly string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const transaction = database.transaction([PERSISTENT_ENTRY_STORE, PERSISTENT_METADATA_STORE], "readwrite");
  try {
    const entriesStore = transaction.objectStore(PERSISTENT_ENTRY_STORE);
    const metadataStore = transaction.objectStore(PERSISTENT_METADATA_STORE);
    const presence = ids.map((id) => requestResult<unknown>(entriesStore.get(id)));
    const removals = [
      ...ids.map((id) => requestResult<unknown>(entriesStore.delete(id))),
      ...ids.map((id) => requestResult<unknown>(metadataStore.delete(id))),
    ];
    const [found] = await Promise.all([Promise.all(presence), Promise.all(removals), transactionDone(transaction)]);
    return found.filter((record) => record !== undefined).length;
  } catch (error) {
    try { transaction.abort(); } catch { /* already finished */ }
    throw error;
  }
}

async function clearEntries(database: IDBDatabase): Promise<void> {
  const transaction = database.transaction([PERSISTENT_ENTRY_STORE, PERSISTENT_METADATA_STORE], "readwrite");
  const entriesRequest = transaction.objectStore(PERSISTENT_ENTRY_STORE).clear();
  const metadataRequest = transaction.objectStore(PERSISTENT_METADATA_STORE).clear();
  await Promise.all([requestResult<unknown>(entriesRequest), requestResult<unknown>(metadataRequest), transactionDone(transaction)]);
}

/**
 * Bounded persistent store. The declared budget is enforced by evicting the
 * least recently *written* entries (a read never promotes an entry, so the hot
 * read path stays a single request). Accounting is exact after the first write
 * of a session, which reconciles with the persisted metadata index once;
 * evicting or reporting quota always reconciles first, so the persisted state
 * is the authority and the in-memory map is only a fast path.
 *
 * Every mutation (put, delete, clear, quota) runs on a single write chain:
 * each operation reconciles, evicts and commits before the next one starts, so
 * concurrent callers can never push the persisted state past the budget and a
 * failing operation leaves the chain ready for the next one.
 */
export function createIndexedDbChunkStore(options: IndexedDbChunkStoreOptions = {}): IndexedDbChunkStore {
  const budgetBytes = options.budgetBytes ?? DEFAULT_PERSISTENT_BUDGET_BYTES;
  if (!Number.isInteger(budgetBytes) || budgetBytes <= 0) throw new Error("indexedDB chunk store budget must be a positive integer");

  let connection: Promise<OpenResult> | undefined;
  const accounted = new Map<string, PersistedEntry>();
  let accountedBytes = 0;
  let reconciled = false;
  let lastStoredAt = 0;

  let writeChain: Promise<void> = Promise.resolve();
  const enqueue = (operation: () => Promise<void>): Promise<void> => {
    const run = writeChain.then(operation);
    writeChain = run.then(() => undefined, () => undefined);
    return run;
  };

  const nextStoredAt = (): number => {
    lastStoredAt = Math.max(Date.now(), lastStoredAt + 1);
    return lastStoredAt;
  };

  const open = (): Promise<OpenResult> => {
    connection ??= openDatabase();
    return connection;
  };

  const reconcile = async (database: IDBDatabase): Promise<void> => {
    const records = await readMetadata(database);
    accounted.clear();
    accountedBytes = 0;
    for (const record of records) {
      accounted.set(record.id, record);
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
      try {
        await enqueue(async () => {
          const record: StoredEntry = { id, value: value.slice(), bytes, storedAt: nextStoredAt() };
          // One full pass per session: entries written by a previous session must
          // count against the budget before the first eviction decision.
          if (!reconciled) await reconcile(opened.database);
          await evictFor(opened.database, record);
          await writeEntry(opened.database, record);
          const replaced = accounted.get(id)?.bytes ?? 0;
          accounted.set(id, { id, bytes, storedAt: record.storedAt });
          accountedBytes += bytes - replaced;
        });
      } catch (error) {
        throw failure(error, "persistent chunk entry could not be stored");
      }
    },
    async delete(key) {
      const id = entryId(assertPersistentChunkKey(key));
      const opened = await open();
      if (opened.status !== "ready") return false;
      let removed = 0;
      try {
        await enqueue(async () => {
          removed = await removeEntries(opened.database, [id]);
          const known = accounted.get(id);
          if (known) { accountedBytes -= known.bytes; accounted.delete(id); }
        });
      } catch {
        return false;
      }
      return removed > 0;
    },
    async clear() {
      const opened = await open();
      if (opened.status !== "ready") { accounted.clear(); accountedBytes = 0; reconciled = false; return; }
      try {
        await enqueue(async () => {
          await clearEntries(opened.database);
          accounted.clear();
          accountedBytes = 0;
          reconciled = true;
        });
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
        await enqueue(() => reconcile(opened.database));
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
