import type { ChunkCacheKey } from "./cache.ts";

/**
 * Persistent client cache (L3 in docs/architecture/chunk-streaming-cache.md).
 *
 * The contract is storage agnostic and free of browser dependencies so it runs
 * in Node; CACHE-02 implements IndexedDB behind it and CACHE-03 validates the
 * payload. Values are already serialized bytes: persistence never hands out a
 * live object graph.
 */

export type PersistentStoreErrorCode =
  | "invalid-key"
  | "invalid-value"
  | "quota-exceeded"
  | "storage-unavailable"
  | "store-failure";

export class PersistentStoreError extends Error {
  readonly code: PersistentStoreErrorCode;
  constructor(code: PersistentStoreErrorCode, message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "PersistentStoreError";
    this.code = code;
  }
}

/**
 * Persistent identity of a compiled chunk: the warm cache namespace reused
 * verbatim (origin, cell size, provider, query profile, projection/world
 * version) plus the compiler and compiled schema versions.
 */
export interface PersistentChunkKey {
  readonly namespace: string;
  readonly chunkId: string;
  readonly compilerVersion: string;
  readonly schemaVersion: number;
}

const MAX_KEY_FIELD_LENGTH = 512;

// Key material must be reconstructible identity, never a credential carrier
// (NEXT-03: no tokens in storage).
const CREDENTIAL_MARKERS = ["token", "secret", "password", "passwd", "authorization", "bearer", "api_key", "apikey", "access_key", "credential", "signature"];

// An opaque per-instance source identity is not a persistent key: the warm
// cache falls back to ["instance", n] when no stable sourceIdentity is given.
const INSTANCE_IDENTITY_MARKER = "[\"instance\",";

function assertKeyField(name: string, value: string): void {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_KEY_FIELD_LENGTH) {
    throw new PersistentStoreError("invalid-key", `persistent chunk key ${name} must be a non-empty string of at most ${MAX_KEY_FIELD_LENGTH} characters`);
  }
  const lowered = value.toLowerCase();
  const credential = CREDENTIAL_MARKERS.find((marker) => lowered.includes(marker));
  if (credential) throw new PersistentStoreError("invalid-key", `persistent chunk key ${name} must not carry credentials ("${credential}")`);
  if (name === "namespace" && lowered.includes(INSTANCE_IDENTITY_MARKER)) {
    throw new PersistentStoreError("invalid-key", "persistent chunk key namespace must not use an unstable per-instance source identity");
  }
}

export function assertPersistentChunkKey(key: PersistentChunkKey): PersistentChunkKey {
  if (!key || typeof key !== "object") throw new PersistentStoreError("invalid-key", "persistent chunk key must be an object");
  assertKeyField("namespace", key.namespace);
  assertKeyField("chunkId", key.chunkId);
  assertKeyField("compilerVersion", key.compilerVersion);
  if (!Number.isInteger(key.schemaVersion) || key.schemaVersion < 0) {
    throw new PersistentStoreError("invalid-key", "persistent chunk key schemaVersion must be a non-negative integer");
  }
  return key;
}

/**
 * Bridges the warm cache key to its persistent form. The namespace is passed
 * through verbatim: this module never recomputes it.
 */
export function persistentKeyFrom(cacheKey: ChunkCacheKey, schemaVersion: number): PersistentChunkKey {
  const key: PersistentChunkKey = { namespace: cacheKey.namespace ?? "", chunkId: cacheKey.chunkId, compilerVersion: cacheKey.compilerVersion, schemaVersion };
  assertPersistentChunkKey(key);
  return Object.freeze(key);
}

/**
 * A hit carries the stored bytes; a miss is typed, because the session must
 * keep running with absent, denied or unavailable storage.
 */
export type PersistentReadResult =
  | { readonly status: "hit"; readonly value: Uint8Array }
  | { readonly status: "miss"; readonly reason: "absent" | "unavailable" };

export interface PersistentQuota {
  readonly budgetBytes: number;
  readonly usedBytes: number;
  readonly entries: number;
}

/**
 * get never throws for absent entries, denied storage or corrupt payloads: it
 * reports a typed miss so the runtime falls back to compiling. put throws a
 * typed error when the entry could not be persisted, and leaves previously
 * stored entries untouched. delete/clear are best effort. usedBytes accounts
 * the stored payload bytes; key overhead is bounded by key validation.
 */
export interface PersistentChunkStore {
  get(key: PersistentChunkKey): Promise<PersistentReadResult>;
  put(key: PersistentChunkKey, value: Uint8Array): Promise<void>;
  delete(key: PersistentChunkKey): Promise<boolean>;
  clear(): Promise<void>;
  quota(): Promise<PersistentQuota>;
}

export interface MemoryChunkStoreOptions {
  /** Declared budget in bytes. put cannot exceed it: it evicts or fails. */
  readonly budgetBytes: number;
  /** Models absent/denied storage so tests keep the same code path. */
  readonly available?: boolean;
}

const MISS_ABSENT: PersistentReadResult = Object.freeze({ status: "miss", reason: "absent" });
const MISS_UNAVAILABLE: PersistentReadResult = Object.freeze({ status: "miss", reason: "unavailable" });

function keyId(key: PersistentChunkKey): string {
  return JSON.stringify([key.namespace, key.chunkId, key.compilerVersion, key.schemaVersion]);
}

function assertValue(value: Uint8Array): void {
  if (!(value instanceof Uint8Array)) throw new PersistentStoreError("invalid-value", "persistent chunk payload must be a Uint8Array");
  if (value.byteLength === 0) throw new PersistentStoreError("invalid-value", "persistent chunk payload must not be empty");
}

export function createMemoryChunkStore(options: MemoryChunkStoreOptions): PersistentChunkStore {
  if (!Number.isInteger(options?.budgetBytes) || options.budgetBytes <= 0) throw new Error("memory chunk store budget must be a positive integer");
  const budgetBytes = options.budgetBytes;
  const available = options.available ?? true;
  // Insertion order is recency: the first key is the least recently used.
  const entries = new Map<string, Uint8Array>();
  let usedBytes = 0;

  const touch = (id: string): void => {
    const value = entries.get(id);
    if (value) { entries.delete(id); entries.set(id, value); }
  };
  const evictLeastRecent = (except: string): void => {
    for (const id of entries.keys()) {
      if (id === except) continue;
      usedBytes -= entries.get(id)!.byteLength;
      entries.delete(id);
      return;
    }
  };

  return {
    async get(key) {
      assertPersistentChunkKey(key);
      if (!available) return MISS_UNAVAILABLE;
      const id = keyId(key);
      const value = entries.get(id);
      if (!value) return MISS_ABSENT;
      touch(id);
      return { status: "hit", value: value.slice() };
    },
    async put(key, value) {
      assertPersistentChunkKey(key);
      assertValue(value);
      if (!available) throw new PersistentStoreError("storage-unavailable", "persistent chunk storage is not available");
      const id = keyId(key);
      const bytes = value.byteLength;
      // Checked before any eviction: a rejected write must not lose stored data.
      if (bytes > budgetBytes) throw new PersistentStoreError("quota-exceeded", `persistent chunk budget of ${budgetBytes} bytes cannot hold a ${bytes} byte entry`);
      const replaced = entries.get(id)?.byteLength ?? 0;
      while (usedBytes - replaced + bytes > budgetBytes) {
        const size = entries.size;
        evictLeastRecent(id);
        if (entries.size === size) break;
      }
      entries.delete(id);
      usedBytes += bytes - replaced;
      entries.set(id, value.slice());
    },
    async delete(key) {
      assertPersistentChunkKey(key);
      if (!available) return false;
      const id = keyId(key);
      const value = entries.get(id);
      if (!value) return false;
      entries.delete(id);
      usedBytes -= value.byteLength;
      return true;
    },
    async clear() {
      entries.clear();
      usedBytes = 0;
    },
    async quota() {
      return available ? { budgetBytes, usedBytes, entries: entries.size } : { budgetBytes: 0, usedBytes: 0, entries: 0 };
    },
  };
}
