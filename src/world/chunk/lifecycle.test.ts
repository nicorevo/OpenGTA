import { describe, expect, it } from "vitest";
import { createChunkLifecycle, type ChunkState } from "./lifecycle.ts";

const key = { x: 2, y: -1 };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("chunk lifecycle", () => {
  it("deduplicates an in-flight load and activates the ready chunk", async () => {
    let calls = 0;
    const lifecycle = createChunkLifecycle(async () => {
      calls += 1;
      return "compiled";
    });

    const first = lifecycle.load(key);
    const second = lifecycle.load(key);
    expect(lifecycle.get(key)?.state).toBe("REQUESTED" satisfies ChunkState);
    await Promise.resolve();
    expect(lifecycle.get(key)?.state).toBe("COMPILING" satisfies ChunkState);
    expect(await first).toMatchObject({ state: "READY", value: "compiled" });
    expect(await second).toMatchObject({ state: "READY", value: "compiled" });
    expect(calls).toBe(1);

    lifecycle.activate(key);
    expect(lifecycle.get(key)?.state).toBe("ACTIVE");
  });

  it("supports deactivation and reuses an inactive value", async () => {
    const lifecycle = createChunkLifecycle(async () => "compiled");
    await lifecycle.load(key);
    lifecycle.activate(key);
    lifecycle.deactivate(key);

    expect(lifecycle.get(key)).toMatchObject({ state: "INACTIVE", value: "compiled" });
    expect(await lifecycle.load(key)).toMatchObject({ state: "INACTIVE", value: "compiled" });
  });

  it("does not let a stale reload overwrite a newer result", async () => {
    const resolvers: Array<(value: string) => void> = [];
    const lifecycle = createChunkLifecycle(() => new Promise<string>((resolve) => resolvers.push(resolve)));

    const stale = lifecycle.load(key);
    const current = lifecycle.reload(key);
    await Promise.resolve();
    resolvers[1]("current");
    await expect(current).resolves.toMatchObject({ state: "READY", value: "current" });
    resolvers[0]("stale");
    await expect(stale).resolves.toMatchObject({ state: "READY", value: "current" });
    expect(lifecycle.get(key)).toMatchObject({ state: "READY", value: "current" });
  });

  it("restores an active chunk after a failed reload", async () => {
    let shouldFail = false;
    const lifecycle = createChunkLifecycle(async () => {
      if (shouldFail) throw new Error("loader failed");
      return "stable";
    });

    await lifecycle.load(key);
    lifecycle.activate(key);
    shouldFail = true;
    await expect(lifecycle.reload(key)).rejects.toThrow("loader failed");
    expect(lifecycle.get(key)).toMatchObject({ state: "ACTIVE", value: "stable" });
  });

  it("rejects activation of a chunk that is not ready", () => {
    const lifecycle = createChunkLifecycle(async () => "compiled");
    expect(() => lifecycle.activate(key)).toThrow("not ready");
  });

  it("releases an inactive value without releasing another chunk", async () => {
    const otherKey = { x: 3, y: -1 };
    const lifecycle = createChunkLifecycle(async (loadedKey) => ({ x: loadedKey.x }));
    await lifecycle.load(key);
    await lifecycle.load(otherKey);
    lifecycle.activate(key);
    lifecycle.deactivate(key);

    lifecycle.release(key);
    lifecycle.release(key);

    expect(lifecycle.get(key)).toBeUndefined();
    expect(lifecycle.records()).toEqual([expect.objectContaining({ key: otherKey, value: { x: 3 } })]);
    lifecycle.dispose();
    lifecycle.dispose();
    expect(lifecycle.records()).toEqual([]);
    expect(lifecycle.get(otherKey)).toBeUndefined();
  });

  it("cancels all deduplicated waiters even when their loader ignores abort", async () => {
    const pending = deferred<string>();
    const contexts: Array<{ signal: AbortSignal; priority?: 0 | 1 | 2 }> = [];
    const lifecycle = createChunkLifecycle((_key, context: { signal: AbortSignal; priority?: 0 | 1 | 2 }) => {
      contexts.push(context);
      return pending.promise;
    });
    const first = lifecycle.load(key, { priority: 0 });
    const second = lifecycle.load(key, { priority: 0 });
    const firstResult = first.catch((error: unknown) => error);
    const secondResult = second.catch((error: unknown) => error);
    await Promise.resolve();

    expect(contexts).toHaveLength(1);
    expect(contexts[0].priority).toBe(0);
    lifecycle.cancel(key);

    expect(contexts[0].signal.aborted).toBe(true);
    expect(await firstResult).toBeInstanceOf(Error);
    expect(await secondResult).toBeInstanceOf(Error);
    expect(lifecycle.get(key)?.value).toBeUndefined();
    pending.resolve("obsolete");
    await pending.promise;
    await Promise.resolve();
    expect(lifecycle.get(key)?.value).toBeUndefined();
  });

  it("does not resurrect a released load after a newer load of the same key", async () => {
    const oldWork = deferred<string>();
    const newWork = deferred<string>();
    let calls = 0;
    const lifecycle = createChunkLifecycle(() => (++calls === 1 ? oldWork.promise : newWork.promise));
    const oldLoad = lifecycle.load(key);
    const oldResult = oldLoad.catch((error: unknown) => error);
    await Promise.resolve();

    lifecycle.release(key);
    expect(lifecycle.get(key)).toBeUndefined();
    const newLoad = lifecycle.load(key);
    await Promise.resolve();
    newWork.resolve("current");
    await expect(newLoad).resolves.toMatchObject({ state: "READY", value: "current" });
    expect(await oldResult).toBeInstanceOf(Error);

    oldWork.resolve("obsolete");
    await oldWork.promise;
    await Promise.resolve();
    expect(calls).toBe(2);
    expect(lifecycle.get(key)).toMatchObject({ state: "READY", value: "current" });
    expect(lifecycle.records()).toEqual([expect.objectContaining({ key, value: "current" })]);
  });

  it("ignores rejection from a released loader after the replacement became active", async () => {
    const oldWork = deferred<string>();
    let calls = 0;
    const lifecycle = createChunkLifecycle(() => (++calls === 1 ? oldWork.promise : Promise.resolve("current")));
    const oldLoad = lifecycle.load(key);
    const oldResult = oldLoad.catch((error: unknown) => error);
    await Promise.resolve();
    lifecycle.release(key);
    await lifecycle.load(key);
    lifecycle.activate(key);
    expect(await oldResult).toBeInstanceOf(Error);

    oldWork.reject(new Error("obsolete failure"));
    await oldWork.promise.catch(() => undefined);
    await Promise.resolve();
    expect(lifecycle.get(key)).toMatchObject({ state: "ACTIVE", value: "current", error: undefined });
  });

  it("disposes pending waiters and records without waiting for non-cooperative loaders", async () => {
    const work = deferred<string>();
    const otherKey = { x: 3, y: -1 };
    const contexts: Array<{ signal: AbortSignal }> = [];
    const lifecycle = createChunkLifecycle((_key, context: { signal: AbortSignal }) => {
      contexts.push(context);
      return work.promise;
    });
    const firstResult = lifecycle.load(key).catch((error: unknown) => error);
    const secondResult = lifecycle.load(otherKey).catch((error: unknown) => error);
    await Promise.resolve();

    lifecycle.dispose();
    lifecycle.dispose();
    expect(await firstResult).toBeInstanceOf(Error);
    expect(await secondResult).toBeInstanceOf(Error);
    expect(contexts.every((context) => context.signal.aborted)).toBe(true);
    expect(lifecycle.records()).toEqual([]);

    work.resolve("obsolete");
    await work.promise;
    await Promise.resolve();
    expect(lifecycle.records()).toEqual([]);
    await expect(lifecycle.load(key)).rejects.toBeInstanceOf(Error);
  });

  it("preserves the previous active value when a refresh is cancelled", async () => {
    const refresh = deferred<string>();
    let calls = 0;
    const lifecycle = createChunkLifecycle(() => (++calls === 1 ? Promise.resolve("stable") : refresh.promise));
    await lifecycle.load(key);
    lifecycle.activate(key);
    const refreshed = lifecycle.reload(key, { priority: 1 });
    const result = refreshed.catch((error: unknown) => error);
    await Promise.resolve();

    lifecycle.cancel(key);
    expect(await result).toBeInstanceOf(Error);
    expect(lifecycle.get(key)).toMatchObject({ state: "ACTIVE", value: "stable" });
    refresh.resolve("obsolete");
    await refresh.promise;
    await Promise.resolve();
    expect(lifecycle.get(key)).toMatchObject({ state: "ACTIVE", value: "stable" });
  });
});
