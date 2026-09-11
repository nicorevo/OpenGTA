import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import { createOpenFreeMapProvider } from "./provider.ts";
const fixtureBytes = new Uint8Array(readFileSync(new URL("../../../fixtures/geo/lecce-z14-openfreemap.pbf", import.meta.url)));

afterEach(() => vi.unstubAllGlobals());

it("fetches and decodes the pinned Lecce tile", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    expect(url).toContain("/planet/20260830_080001_pt/14/9019/6181.pbf");
    return new Response(fixtureBytes, { status: 200 });
  }));
  const provider = createOpenFreeMapProvider();
  const tile = await provider.getTile({ z: 14, x: 9019, y: 6181 }, new AbortController().signal);
  expect(tile?.layerCount).toBe(11);
  expect(tile?.layers.some((layer) => layer.name === "transportation")).toBe(true);
  expect(provider.id).toBe("openfreemap:planet");
  expect(provider.datasetVersion).toBe("20260830_080001_pt");
});

it("returns null for 404 and 204 as deterministic empty tiles", async () => {
  for (const status of [404, 204]) {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status })));
    const provider = createOpenFreeMapProvider();
    await expect(provider.getTile({ z: 14, x: 0, y: 0 }, new AbortController().signal)).resolves.toBeNull();
  }
});

it("classifies network, timeout and oversized payloads distinctly", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
  await expect(createOpenFreeMapProvider().getTile({ z: 14, x: 0, y: 0 }, new AbortController().signal)).rejects.toMatchObject({ code: "network" });

  vi.stubGlobal("fetch", vi.fn(async () => new Response(fixtureBytes, { status: 200 })));
  await expect(createOpenFreeMapProvider({ maxTileBytes: 100 }).getTile({ z: 14, x: 9019, y: 6181 }, new AbortController().signal)).rejects.toMatchObject({ code: "response-too-large" });

  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 429, headers: { get: () => "2" } })));
  await expect(createOpenFreeMapProvider().getTile({ z: 14, x: 0, y: 0 }, new AbortController().signal)).rejects.toMatchObject({ code: "http", status: 429, retryAfterMs: 2000 });
});

it("propagates abort and never retries", async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  vi.stubGlobal("fetch", vi.fn(async () => { calls++; throw new TypeError("refused"); }));
  await expect(createOpenFreeMapProvider().getTile({ z: 14, x: 0, y: 0 }, controller.signal)).rejects.toMatchObject({ code: "aborted" });
  expect(calls).toBe(0);
});
