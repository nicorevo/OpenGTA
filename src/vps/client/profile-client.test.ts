import { describe, expect, it } from "vitest";
import { createVpsProfileClient, type VpsProfileClientDeps } from "./profile-client.ts";
import type { VisualProfile } from "../../render/theme/types.ts";
import { romeProfile } from "../../render/theme/profiles/rome.ts";

/** A minimal valid generated profile: the rome palette with a distinct id. */
const generatedProfile = (id: string): VisualProfile => ({ ...romeProfile, id, label: `gen ${id}` });
const ROME = { latitude: 41.8902, longitude: 12.4922 };
/** Adjacent h3 res-9 cell, still Rome (same city theme). */
const ROME_NEIGHBOR = { latitude: 41.9, longitude: 12.5 };
const PARIS = { latitude: 48.8566, longitude: 2.3522 };

/** Records fetches and resolves them with a queued behavior per call. */
function fakeFetch(behavior: (url: string, signal: AbortSignal) => Promise<Pick<Response, "ok" | "status" | "json">>) {
  const calls: { url: string }[] = [];
  const fetchImpl: VpsProfileClientDeps["fetch"] = async (url, init) => {
    calls.push({ url });
    return behavior(url, init?.signal ?? new AbortSignal());
  };
  return { calls, fetchImpl };
}

const body = (source: "generated" | "cache" | "lvp", profile: VisualProfile) => ({
  source,
  cell: { id: "h3:test", center: { latitude: 0, longitude: 0 } },
  servedAt: "2026-09-22T00:00:00Z",
  profile,
});

function makeClient(deps: Partial<VpsProfileClientDeps> & { fetch: VpsProfileClientDeps["fetch"] }) {
  return createVpsProfileClient({
    baseUrl: "http://127.0.0.1:8787",
    timeoutMs: 30_000,
    cacheTtlMs: 10 * 60_000,
    cooldownMs: 60_000,
    stickyMaxMs: 120_000,
    ...deps,
  });
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createVpsProfileClient", () => {
  it("does not fetch without a location and reports idle", () => {
    const { calls, fetchImpl } = fakeFetch(async () => ({ ok: true, status: 200, json: async () => body("generated", generatedProfile("vps:v1:a:c1")) }));
    const client = makeClient({ fetch: fetchImpl });
    expect(client.sync(undefined, "default")).toBeUndefined();
    expect(client.diagnostics().state).toBe("idle");
    expect(calls).toEqual([]);
  });

  it("applies a generated profile after the background fetch resolves", async () => {
    const { fetchImpl } = fakeFetch(async () => ({ ok: true, status: 200, json: async () => body("generated", generatedProfile("vps:v1:a:c1")) }));
    const client = makeClient({ fetch: fetchImpl });
    expect(client.sync(ROME, "rome")).toBeUndefined(); // not resolved yet: LVP stays
    await flush();
    const applied = client.sync(ROME, "rome");
    expect(applied?.id).toBe("vps:v1:a:c1");
    expect(client.diagnostics()).toMatchObject({ state: "applied", source: "generated", profileId: "vps:v1:a:c1" });
  });

  it("dedupes in-flight requests for the same cell", async () => {
    const { calls, fetchImpl } = fakeFetch(async () => ({ ok: true, status: 200, json: async () => body("cache", generatedProfile("vps:v1:a:c1")) }));
    const client = makeClient({ fetch: fetchImpl });
    client.sync(ROME, "rome");
    client.sync(ROME, "rome");
    client.sync(ROME, "rome");
    await flush();
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("http://127.0.0.1:8787/v1/profile?lat=41.8902&lon=12.4922");
  });

  it("serves the cached profile without refetching while fresh", async () => {
    const { calls, fetchImpl } = fakeFetch(async () => ({ ok: true, status: 200, json: async () => body("cache", generatedProfile("vps:v1:a:c1")) }));
    let now = 1_000_000;
    const client = makeClient({ fetch: fetchImpl, now: () => now });
    client.sync(ROME, "rome");
    await flush();
    now += 60_000; // 1 minute, well inside the 10 minute client TTL
    expect(client.sync(ROME, "rome")?.id).toBe("vps:v1:a:c1");
    expect(calls).toHaveLength(1);
  });

  it("refetches the same cell after the client cache expires", async () => {
    const { calls, fetchImpl } = fakeFetch(async () => ({ ok: true, status: 200, json: async () => body("cache", generatedProfile("vps:v1:a:c1")) }));
    let now = 1_000_000;
    const client = makeClient({ fetch: fetchImpl, now: () => now });
    client.sync(ROME, "rome");
    await flush();
    now += 11 * 60_000;
    client.sync(ROME, "rome");
    await flush();
    expect(calls).toHaveLength(2);
  });

  it("keeps the applied profile across cells inside the same city (sticky)", async () => {
    const { fetchImpl } = fakeFetch(async () => ({ ok: true, status: 200, json: async () => body("generated", generatedProfile("vps:v1:a:c1")) }));
    const client = makeClient({ fetch: fetchImpl });
    client.sync(ROME, "rome");
    await flush();
    expect(client.sync(ROME, "rome")?.id).toBe("vps:v1:a:c1");
    // Adjacent cell, same city theme: the profile survives while driving
    // (no LVP flicker between cells).
    expect(client.sync(ROME_NEIGHBOR, "rome")?.id).toBe("vps:v1:a:c1");
  });

  it("reverts to LVP when the city changes (no cross-city bleed)", async () => {
    const { fetchImpl } = fakeFetch(async () => ({ ok: true, status: 200, json: async () => body("generated", generatedProfile("vps:v1:a:c1")) }));
    const client = makeClient({ fetch: fetchImpl });
    client.sync(ROME, "rome");
    await flush();
    expect(client.sync(ROME, "rome")?.id).toBe("vps:v1:a:c1");
    expect(client.sync(PARIS, "paris")).toBeUndefined();
  });

  it("never applies a late response from a different city", async () => {
    // The rome request resolves; the paris request hangs (never settles).
    const { fetchImpl } = fakeFetch((url) => /lat=41\.8902/.test(url)
      ? Promise.resolve({ ok: true, status: 200, json: async () => body("generated", generatedProfile("vps:v1:a:c1")) })
      : new Promise(() => {}));
    const client = makeClient({ fetch: fetchImpl });
    client.sync(ROME, "rome");
    // The player moves to another city while the request is in flight.
    expect(client.sync(PARIS, "paris")).toBeUndefined();
    await flush(); // the rome response lands, stamped with "rome"
    expect(client.sync(PARIS, "paris")).toBeUndefined();
    expect(client.diagnostics()).not.toMatchObject({ profileId: "vps:v1:a:c1" });
  });

  it("reverts after the sticky window and refetches after the cooldown, not the TTL", async () => {
    const { calls, fetchImpl } = fakeFetch(async () => ({ ok: true, status: 200, json: async () => body("cache", generatedProfile("vps:v1:a:c1")) }));
    let now = 1_000_000;
    const client = makeClient({ fetch: fetchImpl, now: () => now });
    client.sync(ROME, "rome");
    await flush();
    now += 60_000; // inside the sticky window: still applied, no refetch
    expect(client.sync(ROME, "rome")?.id).toBe("vps:v1:a:c1");
    expect(calls).toHaveLength(1);
    now += 70_000; // 130 s > 120 s sticky window: back to LVP
    expect(client.sync(ROME, "rome")).toBeUndefined();
    await flush(); // stale cell is refetchable after the 60 s cooldown (130 s elapsed)
    expect(calls).toHaveLength(2);
  });

  it("ignores the service lvp path (the client keeps its own LVP resolution)", async () => {
    const { fetchImpl } = fakeFetch(async () => ({ ok: true, status: 200, json: async () => body("lvp", romeProfile) }));
    const client = makeClient({ fetch: fetchImpl });
    client.sync(ROME, "rome");
    await flush();
    expect(client.sync(ROME, "rome")).toBeUndefined();
    expect(client.diagnostics()).toMatchObject({ state: "idle", source: "lvp" });
  });

  it("treats HTTP errors as failures with a cooldown (no hammering)", async () => {
    const { calls, fetchImpl } = fakeFetch(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    let now = 1_000_000;
    const client = makeClient({ fetch: fetchImpl, now: () => now });
    client.sync(ROME, "rome");
    await flush();
    client.sync(ROME, "rome"); // inside the 60 s cooldown: no fetch
    await flush();
    expect(calls).toHaveLength(1);
    expect(client.diagnostics().state).toBe("failed");
    now += 61_000;
    client.sync(ROME, "rome"); // cooldown elapsed: retry
    await flush();
    expect(calls).toHaveLength(2);
  });

  it("treats malformed bodies as failures (untrusted input at the boundary)", async () => {
    const { fetchImpl } = fakeFetch(async () => ({ ok: true, status: 200, json: async () => ({ source: "generated", profile: { id: 42 } }) }));
    const client = makeClient({ fetch: fetchImpl });
    client.sync(ROME, "rome");
    await flush();
    expect(client.sync(ROME, "rome")).toBeUndefined();
    expect(client.diagnostics().state).toBe("failed");
  });

  it("treats non-JSON bodies as failures", async () => {
    const { fetchImpl } = fakeFetch(async () => ({ ok: true, status: 200, json: async () => { throw new Error("not json"); } }));
    const client = makeClient({ fetch: fetchImpl });
    client.sync(ROME, "rome");
    await flush();
    expect(client.diagnostics().state).toBe("failed");
  });

  it("aborts a hung request after the timeout", async () => {
    const { fetchImpl } = fakeFetch((_url, signal) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("aborted")));
    }));
    const client = makeClient({ fetch: fetchImpl, timeoutMs: 20 });
    client.sync(ROME, "rome");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(client.diagnostics().state).toBe("failed");
    expect(client.sync(ROME, "rome")).toBeUndefined();
  });
});
