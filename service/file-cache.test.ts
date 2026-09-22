import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileValueCache } from "./file-cache.ts";

describe("createFileValueCache (VPS-10, spec 54 levels 2-3: persisted, TTL'd)", () => {
  const make = (ttlMs: number, now = () => 1_000_000) =>
    createFileValueCache({ dir: mkdtempSync(join(tmpdir(), "vps-cache-")), ttlMs, now });

  it("round-trips structured values keyed by string keys", () => {
    const cache = make(60_000);
    const value = { profile: { id: 1 }, nested: [1, 2, 3] };
    cache.set("cell:h3:abc|schema:1|evidence:xyz", value);
    expect(cache.get("cell:h3:abc|schema:1|evidence:xyz")).toEqual(value);
    expect(cache.has("cell:h3:abc|schema:1|evidence:xyz")).toBe(true);
    expect(cache.get("missing")).toBeUndefined();
    expect(cache.has("missing")).toBe(false);
  });

  it("persists across instances on the same directory", () => {
    const dir = mkdtempSync(join(tmpdir(), "vps-cache-"));
    const first = createFileValueCache({ dir, ttlMs: 60_000, now: () => 1_000_000 });
    first.set("k", { a: 1 });
    const second = createFileValueCache({ dir, ttlMs: 60_000, now: () => 1_000_000 });
    expect(second.get("k")).toEqual({ a: 1 });
  });

  it("expires entries after the TTL (logical clock)", () => {
    let now = 1_000_000;
    const cache = createFileValueCache({ dir: mkdtempSync(join(tmpdir(), "vps-cache-")), ttlMs: 10_000, now: () => now });
    cache.set("k", { a: 1 });
    now += 9_999;
    expect(cache.get("k")).toEqual({ a: 1 });
    now += 2;
    expect(cache.get("k")).toBeUndefined();
    expect(cache.has("k")).toBe(false);
  });

  it("survives corrupt files by treating them as a miss", () => {
    const cache = make(60_000);
    writeFileSync(cache.fileFor("corrupt"), "this is not json{");
    expect(cache.get("corrupt")).toBeUndefined();
  });

  it("clear() removes all entries", () => {
    const cache = make(60_000);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.clear();
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBeUndefined();
    expect(cache.size).toBe(0);
  });
});
