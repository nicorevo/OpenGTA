import { describe, expect, it } from "vitest";
import { createMemoryChunkStore, persistentKeyFrom, PersistentStoreError, type PersistentChunkKey, type PersistentChunkStore } from "./persistent.ts";

const baseKey: PersistentChunkKey = { namespace: "tangent-wgs84-v1:41.9028:18.1556:500:osm-lecce:v0", chunkId: "chunk:0:0", compilerVersion: "v0-runtime", schemaVersion: 0 };
const key = (overrides: Partial<PersistentChunkKey> = {}): PersistentChunkKey => ({ ...baseKey, ...overrides });
const bytes = (...values: number[]): Uint8Array => new Uint8Array(values);

async function read(store: PersistentChunkStore, target: PersistentChunkKey): Promise<number[] | undefined> {
  const result = await store.get(target);
  return result.status === "hit" ? [...result.value] : undefined;
}

describe("persistent chunk store contract", () => {
  it("misses with a typed reason on an empty store", async () => {
    const store = createMemoryChunkStore({ budgetBytes: 64 });

    await expect(store.get(key())).resolves.toEqual({ status: "miss", reason: "absent" });
  });

  it("roundtrips a payload without sharing mutable buffers", async () => {
    const store = createMemoryChunkStore({ budgetBytes: 64 });
    const payload = bytes(1, 2, 3);
    await store.put(key(), payload);
    payload[0] = 9;
    expect(await read(store, key())).toEqual([1, 2, 3]);

    const hit = await store.get(key());
    if (hit.status !== "hit") throw new Error("expected a stored hit");
    hit.value[1] = 9;
    expect(await read(store, key())).toEqual([1, 2, 3]);
  });

  it("reports quota exhaustion explicitly without losing stored entries", async () => {
    const store = createMemoryChunkStore({ budgetBytes: 8 });
    await store.put(key({ chunkId: "chunk:0:0" }), bytes(1, 2, 3, 4));

    await expect(store.put(key({ chunkId: "chunk:0:1" }), bytes(1, 2, 3, 4, 5, 6, 7, 8, 9)))
      .rejects.toBeInstanceOf(PersistentStoreError);
    await expect(store.put(key({ chunkId: "chunk:0:1" }), bytes(1, 2, 3, 4, 5, 6, 7, 8, 9)))
      .rejects.toMatchObject({ code: "quota-exceeded" });

    expect(await read(store, key({ chunkId: "chunk:0:0" }))).toEqual([1, 2, 3, 4]);
    expect(await store.quota()).toEqual({ budgetBytes: 8, usedBytes: 4, entries: 1 });
  });

  it("evicts the least recently used entry when the declared budget is reached", async () => {
    const store = createMemoryChunkStore({ budgetBytes: 8 });
    await store.put(key({ chunkId: "chunk:0:0" }), bytes(1, 1, 1, 1));
    await store.put(key({ chunkId: "chunk:1:0" }), bytes(2, 2, 2, 2));
    await read(store, key({ chunkId: "chunk:0:0" }));
    await store.put(key({ chunkId: "chunk:2:0" }), bytes(3, 3, 3, 3));

    expect(await read(store, key({ chunkId: "chunk:1:0" }))).toBeUndefined();
    expect(await read(store, key({ chunkId: "chunk:0:0" }))).toEqual([1, 1, 1, 1]);
    expect(await read(store, key({ chunkId: "chunk:2:0" }))).toEqual([3, 3, 3, 3]);
    expect(await store.quota()).toEqual({ budgetBytes: 8, usedBytes: 8, entries: 2 });
  });

  it("keeps entries separate per namespace, compiler version and schema version", async () => {
    const store = createMemoryChunkStore({ budgetBytes: 64 });
    await store.put(baseKey, bytes(1));
    await store.put(key({ compilerVersion: "v1-runtime" }), bytes(2));
    await store.put(key({ schemaVersion: 1 }), bytes(3));
    await store.put(key({ namespace: `${baseKey.namespace}-other` }), bytes(4));

    expect(await read(store, baseKey)).toEqual([1]);
    expect(await read(store, key({ compilerVersion: "v1-runtime" }))).toEqual([2]);
    expect(await read(store, key({ schemaVersion: 1 }))).toEqual([3]);
    expect(await read(store, key({ namespace: `${baseKey.namespace}-other` }))).toEqual([4]);
    expect(await store.quota()).toEqual({ budgetBytes: 64, usedBytes: 4, entries: 4 });
  });

  it("derives the persistent key from the warm cache key reusing its namespace verbatim", () => {
    const namespace = JSON.stringify(["tangent-wgs84-v1", 0, 41.9028, 18.1556, 500, "osm-lecce", "v0"]);

    expect(persistentKeyFrom({ namespace, chunkId: "chunk:2:3", compilerVersion: "v0-runtime" }, 0))
      .toEqual({ namespace, chunkId: "chunk:2:3", compilerVersion: "v0-runtime", schemaVersion: 0 });
  });

  it("refuses keys carrying credentials or an unstable per-instance source identity", async () => {
    const store = createMemoryChunkStore({ budgetBytes: 64 });
    const unstable = JSON.stringify(["tangent-wgs84-v1", 0, 41.9028, 18.1556, 500, ["instance", 1], "v0"]);

    for (const namespace of ["https://osm.example/query?token=abc", "Bearer header-value", unstable]) {
      await expect(store.put(key({ namespace }), bytes(1))).rejects.toMatchObject({ code: "invalid-key" });
    }
    expect(await store.quota()).toEqual({ budgetBytes: 64, usedBytes: 0, entries: 0 });
  });

  it("requires chunk id, compiler version and a non-negative schema version", async () => {
    const store = createMemoryChunkStore({ budgetBytes: 64 });

    await expect(store.put(key({ chunkId: "" }), bytes(1))).rejects.toMatchObject({ code: "invalid-key" });
    await expect(store.put(key({ schemaVersion: -1 }), bytes(1))).rejects.toMatchObject({ code: "invalid-key" });
    await expect(store.get(key({ compilerVersion: "" }))).rejects.toMatchObject({ code: "invalid-key" });
    expect(() => persistentKeyFrom({ chunkId: "chunk:0:0", compilerVersion: "v0-runtime" }, 0)).toThrow(PersistentStoreError);
  });

  it("rejects payloads that are not non-empty byte entries", async () => {
    const store = createMemoryChunkStore({ budgetBytes: 64 });

    await expect(store.put(key(), new Uint8Array(0))).rejects.toMatchObject({ code: "invalid-value" });
    await expect(store.put(key(), "not-bytes" as unknown as Uint8Array)).rejects.toMatchObject({ code: "invalid-value" });
  });

  it("deletes single entries, clears everything and accounts released bytes", async () => {
    const store = createMemoryChunkStore({ budgetBytes: 64 });
    await store.put(key({ chunkId: "chunk:0:0" }), bytes(1, 2));
    await store.put(key({ chunkId: "chunk:1:0" }), bytes(1, 2, 3));

    await expect(store.delete(key({ chunkId: "chunk:0:0" }))).resolves.toBe(true);
    await expect(store.delete(key({ chunkId: "chunk:0:0" }))).resolves.toBe(false);
    expect(await store.quota()).toEqual({ budgetBytes: 64, usedBytes: 3, entries: 1 });

    await store.clear();
    expect(await store.quota()).toEqual({ budgetBytes: 64, usedBytes: 0, entries: 0 });
    expect(await read(store, key({ chunkId: "chunk:1:0" }))).toBeUndefined();
  });

  it("degrades gracefully when storage is absent: typed miss, explicit write failure, session keeps running", async () => {
    const store = createMemoryChunkStore({ budgetBytes: 64, available: false });

    await expect(store.get(key())).resolves.toEqual({ status: "miss", reason: "unavailable" });
    await expect(store.put(key(), bytes(1))).rejects.toBeInstanceOf(PersistentStoreError);
    await expect(store.put(key(), bytes(1))).rejects.toMatchObject({ code: "storage-unavailable" });
    await expect(store.delete(key())).resolves.toBe(false);
    await expect(store.clear()).resolves.toBeUndefined();
    expect(await store.quota()).toEqual({ budgetBytes: 0, usedBytes: 0, entries: 0 });
  });
});
