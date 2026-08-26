import { describe, expect, it } from "vitest";
import { createChunkLifecycle, type ChunkState } from "./lifecycle.ts";

const key = { x: 2, y: -1 };

describe("chunk lifecycle", () => {
  it("deduplicates an in-flight load and activates the ready chunk", async () => {
    let calls = 0;
    const lifecycle = createChunkLifecycle(async () => {
      calls += 1;
      return "compiled";
    });

    const first = lifecycle.load(key);
    const second = lifecycle.load(key);
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
});
