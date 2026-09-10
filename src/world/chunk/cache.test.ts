import { describe, expect, it } from "vitest";
import { createChunkCache } from "./cache.ts";

describe("in-memory chunk cache", () => {
  it("isolates namespace and eviction while keeping a global capacity", () => {
    const cache = createChunkCache<string>(2);
    const key = { chunkId: "chunk:0:0", compilerVersion: "v1", namespace: "world-a" };
    cache.set(key, "a"); cache.set({ ...key, namespace: "world-b" }, "b");
    expect(cache.get(key)).toBe("a");
    cache.evict(key);
    expect(cache.get({ ...key, namespace: "world-b" })).toBe("b");
  });
  it("hits only the exact chunk and compiler version", () => {
    const cache = createChunkCache<string>(2);
    const key = { chunkId: "chunk:0:0", compilerVersion: "compiler-v1" };
    cache.set(key, "compiled");

    expect(cache.get(key)).toBe("compiled");
    expect(cache.get({ chunkId: "chunk:0:0", compilerVersion: "compiler-v2" })).toBeUndefined();
    expect(cache.get({ chunkId: "chunk:1:0", compilerVersion: "compiler-v1" })).toBeUndefined();
  });

  it("evicts the least recently used entry at the bounded limit", () => {
    const cache = createChunkCache<string>(2);
    const a = { chunkId: "chunk:0:0", compilerVersion: "v1" };
    const b = { chunkId: "chunk:1:0", compilerVersion: "v1" };
    const c = { chunkId: "chunk:2:0", compilerVersion: "v1" };
    cache.set(a, "a");
    cache.set(b, "b");
    expect(cache.get(a)).toBe("a");
    cache.set(c, "c");

    expect(cache.get(a)).toBe("a");
    expect(cache.get(b)).toBeUndefined();
    expect(cache.get(c)).toBe("c");
    expect(cache.size).toBe(2);
  });

  it("supports explicit eviction and clearing", () => {
    const cache = createChunkCache<string>(2);
    const key = { chunkId: "chunk:0:0", compilerVersion: "v1" };
    cache.set(key, "compiled");

    expect(cache.evict(key)).toBe(true);
    expect(cache.evict(key)).toBe(false);
    cache.set(key, "compiled");
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it("rejects an invalid capacity", () => {
    expect(() => createChunkCache(0)).toThrow("capacity");
    expect(() => createChunkCache(1.5)).toThrow("capacity");
  });
});
