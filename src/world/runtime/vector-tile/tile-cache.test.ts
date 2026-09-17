import { describe, expect, it } from "vitest";
import { TileCache } from "./tile-cache.ts";

describe("TileCache in-flight dedup and LRU", () => {
  it("shares one produce between concurrent consumers of the same key", async () => {
    const cache = new TileCache<string>(8);
    let produces = 0;
    let release!: (value: string) => void;
    const work = () => { produces += 1; return new Promise<string>((resolve) => { release = resolve; }); };
    const first = cache.get("14/1/1", new AbortController().signal, work);
    const second = cache.get("14/1/1", new AbortController().signal, work);
    expect(produces).toBe(1);
    release("tile");
    await expect(Promise.all([first, second])).resolves.toEqual(["tile", "tile"]);
    expect(produces).toBe(1);
  });

  it("serves completed values without producing again, including null", async () => {
    const cache = new TileCache<string | null>(8);
    const signal = new AbortController().signal;
    let produces = 0;
    await cache.get("a", signal, () => { produces += 1; return Promise.resolve("value"); });
    await cache.get("b", signal, () => { produces += 1; return Promise.resolve(null); });
    expect(await cache.get("a", signal, () => { produces += 1; return Promise.resolve("again"); })).toBe("value");
    expect(await cache.get("b", signal, () => { produces += 1; return Promise.resolve("again"); })).toBeNull();
    expect(produces).toBe(2);
  });

  it("removes failed entries so the next demand retries the produce", async () => {
    const cache = new TileCache<string>(8);
    const signal = new AbortController().signal;
    let attempts = 0;
    await expect(cache.get("a", signal, () => { attempts += 1; return Promise.reject(new Error("boom")); })).rejects.toThrow("boom");
    expect(cache.size).toBe(0);
    await expect(cache.get("a", signal, () => { attempts += 1; return Promise.resolve("recovered"); })).resolves.toBe("recovered");
    expect(attempts).toBe(2);
  });

  it("evicts the least recently completed entry when the capacity is reached", async () => {
    const cache = new TileCache<string>(3);
    const signal = new AbortController().signal;
    await cache.get("a", signal, () => Promise.resolve("a"));
    await cache.get("b", signal, () => Promise.resolve("b"));
    let cProduces = 0;
    const c = cache.get("c", signal, () => { cProduces += 1; return Promise.resolve("c"); });
    await c;
    expect(cProduces).toBe(1);
    // "a" was the eviction victim; "b" and "c" are still cached.
    expect(cache.size).toBe(2);
    let bProduces = 0;
    await cache.get("b", signal, () => { bProduces += 1; return Promise.resolve("b"); });
    expect(bProduces).toBe(0);
    let cServed = 0;
    await cache.get("c", signal, () => { cServed += 1; return Promise.resolve("c"); });
    expect(cServed).toBe(0);
    let aProduces = 0;
    await cache.get("a", signal, () => { aProduces += 1; return Promise.resolve("a"); });
    expect(aProduces).toBe(1);
  });

  it("moves completed entries to the most-recent position on hit", async () => {
    const cache = new TileCache<string>(2);
    const signal = new AbortController().signal;
    await cache.get("a", signal, () => Promise.resolve("a"));
    await cache.get("b", signal, () => Promise.resolve("b"));
    // Touch "a" so it becomes most recent; "b" must be the eviction victim.
    await cache.get("a", signal, () => Promise.resolve("a"));
    const produces: string[] = [];
    await cache.get("c", signal, () => { produces.push("c"); return Promise.resolve("c"); });
    await cache.get("b", signal, () => { produces.push("b"); return Promise.resolve("b"); });
    expect(produces).toEqual(["c", "b"]);
  });

  it("never evicts in-flight entries even when the cache is full", async () => {
    const cache = new TileCache<string>(1);
    const signal = new AbortController().signal;
    let release!: (value: string) => void;
    const pending = cache.get("p", signal, () => new Promise<string>((resolve) => { release = resolve; }));
    // Completing another demand while "p" is in flight cannot evict "p".
    await cache.get("a", signal, () => Promise.resolve("a"));
    release("p");
    await expect(pending).resolves.toBe("p");
    let pProduces = 0;
    await cache.get("p", signal, () => { pProduces += 1; return Promise.resolve("p-again"); });
    expect(pProduces).toBe(0);
  });

  it("rejects an aborting consumer without cancelling the shared work", async () => {
    const cache = new TileCache<string>(8);
    let release!: (value: string) => void;
    const work = () => new Promise<string>((resolve) => { release = resolve; });
    const other = cache.get("a", new AbortController().signal, work);
    const controller = new AbortController();
    const mine = cache.get("a", controller.signal, work);
    controller.abort();
    await expect(mine).rejects.toMatchObject({ code: "aborted" });
    release("tile");
    await expect(other).resolves.toBe("tile");
  });

  it("rejects an already-aborted signal before producing", async () => {
    const cache = new TileCache<string>(8);
    let produces = 0;
    const controller = new AbortController();
    controller.abort();
    await expect(cache.get("a", controller.signal, () => { produces += 1; return Promise.resolve("x"); })).rejects.toMatchObject({ code: "aborted" });
    expect(produces).toBe(0);
  });

  it("rejects an invalid capacity", () => {
    expect(() => new TileCache(0)).toThrow(RangeError);
    expect(() => new TileCache(1.5)).toThrow(RangeError);
  });
});
