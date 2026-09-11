import { beforeEach, describe, expect, it } from "vitest";
import { PersistentStoreError, type PersistentChunkKey } from "./persistent.ts";
import type { IndexedDbChunkStore, IndexedDbChunkStoreOptions } from "./persistent-indexeddb.ts";

/**
 * IndexedDB backend tests (CACHE-02). The module resolves the global
 * `indexedDB` lazily, so every test installs a minimal in-memory fake in
 * `globalThis` *before* importing the module. The fake keeps IndexedDB event
 * semantics (asynchronous delivery, transactions that abort on a readwrite
 * request failure) and exposes knobs to simulate denied, blocked, missing or
 * failing storage. No new dependency is used.
 */

const DB_NAME = "opengta-persistent-chunks";
const DB_VERSION = 1;
const STORE_NAME = "chunk-entries";

type FakeHandler = (() => void) | null;
type Operation<T> = { readonly ok: T } | { readonly error: unknown };
const ok = <T,>(value: T): Operation<T> => ({ ok: value });
const namedError = (name: string, message: string): Error => Object.assign(new Error(message), { name });

class FakeRequest<T> {
  result!: T;
  error: unknown = null;
  onsuccess: FakeHandler = null;
  onerror: FakeHandler = null;
  onupgradeneeded: FakeHandler = null;
  onblocked: FakeHandler = null;
  succeed(result: T): void { this.result = result; queueMicrotask(() => this.onsuccess?.()); }
  fail(error: unknown): void { this.error = error; queueMicrotask(() => this.onerror?.()); }
  upgrade(result: T): void { this.result = result; queueMicrotask(() => this.onupgradeneeded?.()); }
  block(): void { queueMicrotask(() => this.onblocked?.()); }
}

interface FailurePlan {
  blockUpgrade: boolean;
  denyOpen: boolean;
  throwOnOpen: unknown;
  readError: unknown;
  getAllError: unknown;
  writeError: unknown;
  deleteError: unknown;
  clearError: unknown;
}

class FakeTransaction {
  error: unknown = null;
  oncomplete: FakeHandler = null;
  onerror: FakeHandler = null;
  onabort: FakeHandler = null;
  private pending = 0;
  private committed = false;
  private aborted = false;

  constructor(
    private readonly database: FakeDatabase,
    readonly mode: "readonly" | "readwrite",
    private readonly plan: FailurePlan,
  ) {}

  objectStore(name: string): FakeObjectStore {
    const entries = this.database.storeFor(name);
    if (!entries) throw namedError("NotFoundError", `object store ${name} does not exist`);
    return new FakeObjectStore(this, entries, this.plan);
  }

  execute<T>(operation: () => Operation<T>): FakeRequest<T> {
    const request = new FakeRequest<T>();
    this.pending += 1;
    queueMicrotask(() => {
      if (this.aborted) request.fail(this.error ?? namedError("AbortError", "transaction aborted"));
      else {
        const outcome = operation();
        if ("error" in outcome) {
          request.fail(outcome.error);
          if (this.mode === "readwrite") this.abort(outcome.error);
        } else request.succeed(outcome.ok);
      }
      this.pending -= 1;
      if (this.pending === 0 && !this.aborted) this.commit();
    });
    return request;
  }

  abort(error: unknown): void {
    if (this.aborted) return;
    this.aborted = true;
    this.error = error;
    queueMicrotask(() => { this.onerror?.(); this.onabort?.(); });
  }

  private commit(): void {
    if (this.committed) return;
    this.committed = true;
    queueMicrotask(() => this.oncomplete?.());
  }
}

class FakeObjectStore {
  constructor(
    private readonly transaction: FakeTransaction,
    private readonly entries: Map<string, unknown>,
    private readonly plan: FailurePlan,
  ) {}

  get(key: string): FakeRequest<unknown> {
    return this.transaction.execute((): Operation<unknown> => (this.plan.readError ? { error: this.plan.readError } : ok(this.entries.get(key))));
  }

  getAll(): FakeRequest<unknown[]> {
    return this.transaction.execute((): Operation<unknown[]> => (this.plan.getAllError ? { error: this.plan.getAllError } : ok([...this.entries.values()])));
  }

  put(value: unknown, key: string): FakeRequest<undefined> {
    return this.transaction.execute((): Operation<undefined> => {
      if (this.plan.writeError) return { error: this.plan.writeError };
      this.entries.set(key, value);
      return ok(undefined);
    });
  }

  delete(key: string): FakeRequest<undefined> {
    return this.transaction.execute((): Operation<undefined> => {
      if (this.plan.deleteError) return { error: this.plan.deleteError };
      this.entries.delete(key);
      return ok(undefined);
    });
  }

  clear(): FakeRequest<undefined> {
    return this.transaction.execute((): Operation<undefined> => {
      if (this.plan.clearError) return { error: this.plan.clearError };
      this.entries.clear();
      return ok(undefined);
    });
  }
}

class FakeDatabase {
  closed = false;
  constructor(
    private readonly stores: Map<string, Map<string, unknown>>,
    private readonly plan: FailurePlan,
  ) {}
  get objectStoreNames(): { contains(name: string): boolean } {
    return { contains: (name: string): boolean => this.stores.has(name) };
  }
  storeFor(name: string): Map<string, unknown> | undefined {
    return this.stores.get(name);
  }
  createObjectStore(name: string): unknown {
    if (!this.stores.has(name)) this.stores.set(name, new Map());
    return { name };
  }
  transaction(name: string, mode: "readonly" | "readwrite"): FakeTransaction {
    if (this.closed) throw namedError("InvalidStateError", "the database connection is closed");
    if (!this.stores.has(name)) throw namedError("NotFoundError", `object store ${name} does not exist`);
    return new FakeTransaction(this, mode, this.plan);
  }
  close(): void { this.closed = true; }
}

class FakeIndexedDb {
  readonly plan: FailurePlan = { blockUpgrade: false, denyOpen: false, throwOnOpen: null, readError: null, getAllError: null, writeError: null, deleteError: null, clearError: null };
  readonly openCalls: Array<{ name: string; version: number }> = [];
  private readonly storage = new Map<string, Map<string, Map<string, unknown>>>();
  private readonly versions = new Map<string, number>();
  private readonly connections: FakeDatabase[] = [];
  readonly factory = { open: (name: string, version: number): FakeRequest<FakeDatabase> => this.open(name, version) };

  /** Raw record injection: unknown writer, corrupt entry or previous session. */
  seed(key: string, value: unknown, storeName = STORE_NAME, databaseName = DB_NAME): void {
    let stores = this.storage.get(databaseName);
    if (!stores) { stores = new Map(); this.storage.set(databaseName, stores); }
    let entries = stores.get(storeName);
    if (!entries) { entries = new Map(); stores.set(storeName, entries); }
    entries.set(key, value);
    this.versions.set(databaseName, Math.max(this.versions.get(databaseName) ?? 0, DB_VERSION));
  }

  record(key: string, storeName = STORE_NAME, databaseName = DB_NAME): unknown {
    return this.storage.get(databaseName)?.get(storeName)?.get(key);
  }

  keys(storeName = STORE_NAME, databaseName = DB_NAME): string[] {
    return [...(this.storage.get(databaseName)?.get(storeName)?.keys() ?? [])];
  }

  /** Models a database written by a newer client version. */
  setVersion(databaseName: string, version: number): void {
    this.versions.set(databaseName, version);
  }

  /** Models the browser invalidating open connections (versionchange). */
  closeConnections(): void {
    for (const connection of this.connections) connection.close();
  }

  private open(name: string, version: number): FakeRequest<FakeDatabase> {
    this.openCalls.push({ name, version });
    const request = new FakeRequest<FakeDatabase>();
    const current = this.versions.get(name) ?? 0;
    if (this.plan.throwOnOpen) throw this.plan.throwOnOpen;
    if (version < current) { request.fail(namedError("VersionError", "the requested version is lower than the existing one")); return request; }
    if (this.plan.denyOpen) { request.fail(namedError("SecurityError", "storage is denied")); return request; }
    if (this.plan.blockUpgrade && version > current) { request.block(); return request; }
    let stores = this.storage.get(name);
    if (!stores) { stores = new Map(); this.storage.set(name, stores); }
    const database = new FakeDatabase(stores, this.plan);
    this.connections.push(database);
    if (version > current) {
      this.versions.set(name, version);
      request.upgrade(database);
      queueMicrotask(() => request.succeed(database));
    } else queueMicrotask(() => request.succeed(database));
    return request;
  }
}

const baseKey: PersistentChunkKey = { namespace: "tangent-wgs84-v1:41.9028:18.1556:500:osm-lecce:v0", chunkId: "chunk:0:0", compilerVersion: "v0-runtime", schemaVersion: 0 };
const key = (overrides: Partial<PersistentChunkKey> = {}): PersistentChunkKey => ({ ...baseKey, ...overrides });
const bytes = (...values: number[]): Uint8Array => new Uint8Array(values);
const entryId = (target: PersistentChunkKey): string => JSON.stringify([target.namespace, target.chunkId, target.compilerVersion, target.schemaVersion]);

async function read(store: IndexedDbChunkStore, target: PersistentChunkKey): Promise<number[] | undefined> {
  const result = await store.get(target);
  return result.status === "hit" ? [...result.value] : undefined;
}

let fake: FakeIndexedDb;
let moduleRef: typeof import("./persistent-indexeddb.ts") | undefined;

function install(factory: unknown): void {
  Object.defineProperty(globalThis, "indexedDB", { value: factory, configurable: true, writable: true });
}

/**
 * Imports the module once, after a fake factory has been installed. The module
 * resolves the global lazily, so the same instance keeps working when a later
 * test removes it or swaps the fake.
 */
async function loadModule(): Promise<typeof import("./persistent-indexeddb.ts")> {
  moduleRef ??= await import("./persistent-indexeddb.ts");
  return moduleRef;
}

async function mount(options: IndexedDbChunkStoreOptions = {}): Promise<IndexedDbChunkStore> {
  install(fake.factory);
  return (await loadModule()).createIndexedDbChunkStore(options);
}

beforeEach(() => {
  fake = new FakeIndexedDb();
});

describe("indexedDB chunk store", () => {
  it("opens the versioned database, creates the entry store and reuses one connection", async () => {
    const store = await mount();

    await store.put(key(), bytes(1, 2, 3));
    await read(store, key());
    await store.quota();

    const mod = await loadModule();
    expect(fake.openCalls).toEqual([{ name: DB_NAME, version: DB_VERSION }]);
    expect(mod.PERSISTENT_DATABASE_NAME).toBe(DB_NAME);
    expect(mod.PERSISTENT_DATABASE_VERSION).toBe(DB_VERSION);
    expect(mod.PERSISTENT_ENTRY_STORE).toBe(STORE_NAME);
    expect(fake.keys()).toEqual([entryId(key())]);
  });

  it("stores the payload as Uint8Array bytes keyed by the persistent key id", async () => {
    const store = await mount();

    await store.put(key(), bytes(7, 8));

    const record = fake.record(entryId(key())) as { value: unknown; bytes: unknown } | undefined;
    expect(record?.value).toBeInstanceOf(Uint8Array);
    expect([...(record?.value as Uint8Array)]).toEqual([7, 8]);
    expect(record?.bytes).toBe(2);
  });

  it("roundtrips a payload without sharing mutable buffers", async () => {
    const store = await mount();
    const payload = bytes(1, 2, 3);
    await store.put(key(), payload);
    payload[0] = 9;
    expect(await read(store, key())).toEqual([1, 2, 3]);

    const hit = await store.get(key());
    if (hit.status !== "hit") throw new Error("expected a stored hit");
    hit.value[1] = 9;
    expect(await read(store, key())).toEqual([1, 2, 3]);
  });

  it("misses with a typed reason on an empty store", async () => {
    const store = await mount();

    await expect(store.get(key())).resolves.toEqual({ status: "miss", reason: "absent" });
  });

  it("treats a corrupt record as an absent miss instead of a hit", async () => {
    const store = await mount();
    fake.seed(entryId(key()), { nonsense: true });
    const emptyPayload = entryId(key({ chunkId: "chunk:0:1" }));
    fake.seed(emptyPayload, { id: emptyPayload, value: new Uint8Array(0), bytes: 0, storedAt: 1 });

    await expect(store.get(key())).resolves.toEqual({ status: "miss", reason: "absent" });
    await expect(store.get(key({ chunkId: "chunk:0:1" }))).resolves.toEqual({ status: "miss", reason: "absent" });
  });

  it("never throws on read failures: a failing read is an unavailable miss", async () => {
    const store = await mount();
    await store.put(key(), bytes(1, 2));
    fake.plan.readError = namedError("UnknownError", "read failed");

    await expect(store.get(key())).resolves.toEqual({ status: "miss", reason: "unavailable" });

    fake.plan.getAllError = namedError("UnknownError", "scan failed");
    await expect(store.quota()).resolves.toEqual({ budgetBytes: 0, usedBytes: 0, entries: 0 });
  });

  it("keeps entries separate per namespace, compiler version and schema version", async () => {
    const store = await mount();
    await store.put(baseKey, bytes(1));
    await store.put(key({ compilerVersion: "v1-runtime" }), bytes(2));
    await store.put(key({ schemaVersion: 1 }), bytes(3));
    await store.put(key({ namespace: `${baseKey.namespace}-other` }), bytes(4));

    expect(await read(store, baseKey)).toEqual([1]);
    expect(await read(store, key({ compilerVersion: "v1-runtime" }))).toEqual([2]);
    expect(await read(store, key({ schemaVersion: 1 }))).toEqual([3]);
    expect(await read(store, key({ namespace: `${baseKey.namespace}-other` }))).toEqual([4]);
    expect(await store.quota()).toEqual({ budgetBytes: (await loadModule()).DEFAULT_PERSISTENT_BUDGET_BYTES, usedBytes: 4, entries: 4 });
  });

  it("degrades when the browser exposes no indexedDB", async () => {
    const mod = await loadModule();
    delete (globalThis as { indexedDB?: unknown }).indexedDB;
    const store = mod.createIndexedDbChunkStore();

    await expect(store.get(key())).resolves.toEqual({ status: "miss", reason: "unavailable" });
    await expect(store.put(key(), bytes(1))).rejects.toBeInstanceOf(PersistentStoreError);
    await expect(store.put(key(), bytes(1))).rejects.toMatchObject({ code: "storage-unavailable" });
    await expect(store.delete(key())).resolves.toBe(false);
    await expect(store.clear()).resolves.toBeUndefined();
    expect(await store.quota()).toEqual({ budgetBytes: 0, usedBytes: 0, entries: 0 });
    await expect(store.close()).resolves.toBeUndefined();
  });

  const openFailures: Array<[string, (instance: FakeIndexedDb) => void]> = [
    ["denied", (instance: FakeIndexedDb) => { instance.plan.denyOpen = true; }],
    ["blocked by another connection", (instance: FakeIndexedDb) => { instance.plan.blockUpgrade = true; }],
    ["throwing on open", (instance: FakeIndexedDb) => { instance.plan.throwOnOpen = namedError("SecurityError", "denied by policy"); }],
  ];
  it.each(openFailures)("degrades when the database open is %s", async (_label, configure) => {
    configure(fake);
    const store = await mount();

    await expect(store.get(key())).resolves.toEqual({ status: "miss", reason: "unavailable" });
    await expect(store.put(key(), bytes(1))).rejects.toMatchObject({ code: "storage-unavailable" });
    await expect(store.delete(key())).resolves.toBe(false);
    await expect(store.clear()).resolves.toBeUndefined();
    expect(await store.quota()).toEqual({ budgetBytes: 0, usedBytes: 0, entries: 0 });
    expect(fake.openCalls).toHaveLength(1);

    await store.get(key());
    await store.put(key(), bytes(1)).catch(() => undefined);
    expect(fake.openCalls).toHaveLength(1);
  });

  it("maps a browser quota failure on write to quota-exceeded and keeps stored entries", async () => {
    const store = await mount();
    await store.put(key({ chunkId: "chunk:0:0" }), bytes(1, 2, 3));
    fake.plan.writeError = namedError("QuotaExceededError", "the quota has been exceeded");

    await expect(store.put(key({ chunkId: "chunk:0:1" }), bytes(4))).rejects.toMatchObject({ code: "quota-exceeded" });
    expect(await read(store, key({ chunkId: "chunk:0:0" }))).toEqual([1, 2, 3]);
  });

  it("maps any other backend write failure to store-failure", async () => {
    const store = await mount();
    fake.plan.writeError = namedError("UnknownError", "disk failure");

    await expect(store.put(key(), bytes(1))).rejects.toBeInstanceOf(PersistentStoreError);
    await expect(store.put(key(), bytes(1))).rejects.toMatchObject({ code: "store-failure" });
  });

  it("rejects invalid keys and payloads without touching storage", async () => {
    const store = await mount();

    await expect(store.put(key({ chunkId: "" }), bytes(1))).rejects.toMatchObject({ code: "invalid-key" });
    await expect(store.put(key({ namespace: "Bearer header-value" }), bytes(1))).rejects.toMatchObject({ code: "invalid-key" });
    await expect(store.get(key({ schemaVersion: -1 }))).rejects.toMatchObject({ code: "invalid-key" });
    await expect(store.put(key(), new Uint8Array(0))).rejects.toMatchObject({ code: "invalid-value" });
    await expect(store.put(key(), "not-bytes" as unknown as Uint8Array)).rejects.toMatchObject({ code: "invalid-value" });
    expect(fake.openCalls).toEqual([]);
  });

  it("requires a positive integer budget", async () => {
    const mod = await loadModule();

    expect(() => mod.createIndexedDbChunkStore({ budgetBytes: 0 })).toThrow(Error);
    expect(() => mod.createIndexedDbChunkStore({ budgetBytes: 1.5 })).toThrow(/budget/);
  });

  it("evicts the least recently written entry when the declared budget is reached", async () => {
    const store = await mount({ budgetBytes: 8 });
    await store.put(key({ chunkId: "chunk:0:0" }), bytes(1, 1, 1, 1));
    await store.put(key({ chunkId: "chunk:1:0" }), bytes(2, 2, 2, 2));
    await store.put(key({ chunkId: "chunk:2:0" }), bytes(3, 3, 3, 3));

    expect(await read(store, key({ chunkId: "chunk:0:0" }))).toBeUndefined();
    expect(await read(store, key({ chunkId: "chunk:2:0" }))).toEqual([3, 3, 3, 3]);
    expect(await store.quota()).toEqual({ budgetBytes: 8, usedBytes: 8, entries: 2 });
  });

  it("reports quota exhaustion explicitly without losing stored entries", async () => {
    const store = await mount({ budgetBytes: 8 });
    await store.put(key({ chunkId: "chunk:0:0" }), bytes(1, 2, 3, 4));

    await expect(store.put(key({ chunkId: "chunk:0:1" }), bytes(1, 2, 3, 4, 5, 6, 7, 8, 9))).rejects.toMatchObject({ code: "quota-exceeded" });

    expect(await read(store, key({ chunkId: "chunk:0:0" }))).toEqual([1, 2, 3, 4]);
    expect(await store.quota()).toEqual({ budgetBytes: 8, usedBytes: 4, entries: 1 });
  });

  it("deletes single entries, clears everything and accounts released bytes", async () => {
    const store = await mount({ budgetBytes: 64 });
    await store.put(key({ chunkId: "chunk:0:0" }), bytes(1, 2));
    await store.put(key({ chunkId: "chunk:1:0" }), bytes(1, 2, 3));

    await expect(store.delete(key({ chunkId: "chunk:0:0" }))).resolves.toBe(true);
    await expect(store.delete(key({ chunkId: "chunk:0:0" }))).resolves.toBe(false);
    expect(await store.quota()).toEqual({ budgetBytes: 64, usedBytes: 3, entries: 1 });

    await store.clear();
    expect(await store.quota()).toEqual({ budgetBytes: 64, usedBytes: 0, entries: 0 });
    expect(await read(store, key({ chunkId: "chunk:1:0" }))).toBeUndefined();
  });

  it("accounts for entries written by a previous session before evicting", async () => {
    const first = await mount({ budgetBytes: 16 });
    await first.put(key({ chunkId: "chunk:0:0" }), bytes(1, 1, 1, 1, 1, 1, 1, 1));
    await first.put(key({ chunkId: "chunk:1:0" }), bytes(2, 2, 2, 2, 2, 2, 2, 2));
    await first.close();

    const second = await mount({ budgetBytes: 16 });
    await second.put(key({ chunkId: "chunk:2:0" }), bytes(3, 3, 3, 3, 3, 3, 3, 3));

    expect(await read(second, key({ chunkId: "chunk:0:0" }))).toBeUndefined();
    expect(await read(second, key({ chunkId: "chunk:1:0" }))).toEqual([2, 2, 2, 2, 2, 2, 2, 2]);
    expect(await read(second, key({ chunkId: "chunk:2:0" }))).toEqual([3, 3, 3, 3, 3, 3, 3, 3]);
    expect(await second.quota()).toEqual({ budgetBytes: 16, usedBytes: 16, entries: 2 });
  });

  it("reopens the database after close and keeps its entries", async () => {
    const store = await mount();
    await store.put(key(), bytes(1, 2, 3));
    await store.close();

    expect(await read(store, key())).toEqual([1, 2, 3]);
    expect(fake.openCalls).toHaveLength(2);
  });

  it("treats a connection invalidated under it as degraded storage", async () => {
    const store = await mount();
    await store.put(key(), bytes(1, 2));
    fake.closeConnections();

    await expect(store.get(key())).resolves.toEqual({ status: "miss", reason: "unavailable" });
    await expect(store.put(key(), bytes(3))).rejects.toMatchObject({ code: "store-failure" });
    await expect(store.delete(key())).resolves.toBe(false);
    expect(await store.quota()).toEqual({ budgetBytes: 0, usedBytes: 0, entries: 0 });
  });

  it("degrades when the database version is newer than this client", async () => {
    fake.seed(entryId(key()), { id: entryId(key()), value: bytes(1), bytes: 1, storedAt: 1 });
    fake.setVersion(DB_NAME, DB_VERSION + 1);
    const store = await mount();

    await expect(store.get(key())).resolves.toEqual({ status: "miss", reason: "unavailable" });
  });
});
