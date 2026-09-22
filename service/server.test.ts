import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { createProfileHandler } from "./server.ts";
import type { VpsServiceConfig } from "./env.ts";
import { cellForCoordinates } from "../src/vps/index.ts";
import type { GeneratedVisualProfile } from "../src/vps/index.ts";
import { romeProfile, tokyoProfile } from "../src/render/theme/profiles/index.ts";

const CONFIG: VpsServiceConfig = {
  mapillary: { baseUrl: "https://graph.mapillary.com", clientId: "MLY|test|token" },
  overpass: { endpoint: "https://overpass-api.de/api/interpreter" },
  cacheDir: ".vps-cache",
  ttlMs: 3_600_000,
  rateLimitPerMin: 60,
  port: 8787,
};

/** Dispatching fake fetch: Overpass by endpoint, Mapillary by host. */
function makeFakeFetch(overrides: { overpassStatus?: number; mapillaryStatus?: number } = {}) {
  const calls = { overpass: 0, mapillary: 0 };
  const fetchImpl = (async (input: string | URL | Request): Promise<Response> => {
    const url = String(input);
    if (url.includes("overpass-api.de")) {
      calls.overpass += 1;
      if (overrides.overpassStatus) {
        return new Response("overpass error", { status: overrides.overpassStatus });
      }
      return new Response(
        JSON.stringify({
          version: 0.6,
          elements: [
            {
              type: "way",
              id: 1,
              nodes: [1, 2, 3],
              geometry: [
                { lat: 41.899, lon: 12.476 },
                { lat: 41.899, lon: 12.477 },
                { lat: 41.8991, lon: 12.477 },
              ],
              tags: { highway: "residential", surface: "sett" },
            },
            {
              type: "relation",
              id: 2,
              members: [
                {
                  type: "way",
                  ref: 10,
                  role: "outer",
                  geometry: [
                    { lat: 41.8985, lon: 12.4762 },
                    { lat: 41.8985, lon: 12.4768 },
                    { lat: 41.899, lon: 12.4768 },
                    { lat: 41.899, lon: 12.4762 },
                    { lat: 41.8985, lon: 12.4762 },
                  ],
                },
              ],
              tags: { building: "yes", "building:colour": "ochre", "roof:material": "roof_tiles" },
            },
            { type: "node", id: 3, lat: 41.899, lon: 12.477, tags: { natural: "tree" } },
          ],
        }),
        { status: 200 },
      );
    }
    if (url.includes("graph.mapillary.com")) {
      calls.mapillary += 1;
      if (overrides.mapillaryStatus) {
        return new Response(JSON.stringify({ error: { message: "denied", type: "MLYApiException", code: 190 } }), {
          status: overrides.mapillaryStatus,
        });
      }
      const item = (id: string, lon: number, lat: number) => ({
        id,
        geometry: { type: "Point", coordinates: [lon, lat] },
        compass_angle: 10,
        captured_at: 1_700_000_000_000,
        thumb_2048_url: `https://cdn.example/${id}.jpg`,
      });
      return new Response(
        JSON.stringify({ data: [item("img-a", 12.4765, 41.8988), item("img-b", 12.4775, 41.8996), item("img-c", 12.4768, 41.8993)] }),
        { status: 200 },
      );
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

function handlerFor(overrides: Parameters<typeof makeFakeFetch>[0] = {}, cacheDir: string = mkdtempSync(join(tmpdir(), "vps-srv-"))) {
  const { fetchImpl } = makeFakeFetch(overrides);
  return {
    handler: createProfileHandler({ config: CONFIG, fetchImpl, cacheDir }),
    cacheDir,
  };
}

const ROME = { lat: "41.8992", lon: "12.4769" };

/** Narrows the response body on success paths (errors carry only {error}). */
function profileBody(res: import("./server.ts").ProfileHandlerResponse): import("./server.ts").ProfileResponseBody {
  if (res.status >= 400) throw new Error(`expected a success response, got ${res.status}`);
  return res.body as import("./server.ts").ProfileResponseBody;
}

function generatedProfile(body: import("./server.ts").ProfileResponseBody): GeneratedVisualProfile {
  return body.profile as GeneratedVisualProfile;
}

describe("createProfileHandler (VPS-10, spec 106: GET /v1/profile, immediate LVP fallback)", () => {
  it("serves a generated profile for a Rome cell from both live sources", async () => {
    const { handler } = handlerFor();
    const res = await handler("/v1/profile", new URLSearchParams(ROME));
    expect(res.status).toBe(200);
    const body = profileBody(res);
    expect(body.source).toBe("generated");
    expect(generatedProfile(body).generation.source).toBe("generated");
    expect(body.diagnostics?.osm).toBe("ok");
    expect(body.diagnostics?.imagery).toBe("ok");
    expect(body.diagnostics?.analyzedSamples).toBeGreaterThan(0);
    // the Rome cell resolves the rome LVP parent
    expect(body.cell.id).toBe(cellForCoordinates(41.8992, 12.4769).id);
  });

  it("serves repeated requests from the service cache without re-fetching (spec 54 level 3)", async () => {
    const { handler } = handlerFor();
    const first = profileBody(await handler("/v1/profile", new URLSearchParams(ROME)));
    const second = profileBody(await handler("/v1/profile", new URLSearchParams(ROME)));
    expect(first.source).toBe("generated");
    expect(second.source).toBe("cache");
    expect(second.profile).toEqual(first.profile);
  });

  it("survives a restart: a fresh handler on the same cache dir serves from disk (spec 54 level 3)", async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), "vps-srv-"));
    const first = makeFakeFetch();
    const a = createProfileHandler({ config: CONFIG, fetchImpl: first.fetchImpl, cacheDir });
    expect(profileBody(await a("/v1/profile", new URLSearchParams(ROME))).source).toBe("generated");

    const second = makeFakeFetch();
    const b = createProfileHandler({ config: CONFIG, fetchImpl: second.fetchImpl, cacheDir });
    const res = await b("/v1/profile", new URLSearchParams(ROME));
    expect(profileBody(res).source).toBe("cache");
    expect(second.calls.overpass).toBe(0);
    expect(second.calls.mapillary).toBe(0);
  });

  it("degrades to OSM-only evidence when Mapillary fails (spec 80), still 200 generated", async () => {
    const { handler } = handlerFor({ mapillaryStatus: 500 });
    const res = await handler("/v1/profile", new URLSearchParams(ROME));
    expect(res.status).toBe(200);
    const body = profileBody(res);
    expect(body.source).toBe("generated");
    expect(body.diagnostics?.osm).toBe("ok");
    expect(body.diagnostics?.imagery).toBe("failed");
    expect(body.diagnostics?.analyzedSamples).toBe(0);
  });

  it("serves the LVP parent when both sources fail (spec 80/106: never an error, never a half profile)", async () => {
    const { handler } = handlerFor({ overpassStatus: 500, mapillaryStatus: 500 });
    const res = await handler("/v1/profile", new URLSearchParams(ROME));
    expect(res.status).toBe(200);
    const body = profileBody(res);
    expect(body.diagnostics?.osm).toBe("failed");
    expect(body.diagnostics?.imagery).toBe("failed");
    // parent-derived: every generated category equals the rome LVP values
    const profile = generatedProfile(body);
    expect(profile.buildings.facadePalette).toEqual(romeProfile.buildings.facadePalette);
    expect(profile.buildings.roofPalette).toEqual(romeProfile.buildings.roofPalette);
    expect(profile.ground).toEqual(romeProfile.ground);
    expect(profile.roads).toEqual(romeProfile.roads);
  });

  it("resolves the Tokyo cell to the tokyo LVP parent on total failure", async () => {
    const { handler } = handlerFor({ overpassStatus: 500, mapillaryStatus: 500 });
    const res = await handler("/v1/profile", new URLSearchParams({ lat: "35.6762", lon: "139.6503" }));
    expect(res.status).toBe(200);
    const profile = generatedProfile(profileBody(res));
    expect(profile.buildings.facadePalette).toEqual(tokyoProfile.buildings.facadePalette);
    expect(profile.buildings.roofPalette).toEqual(tokyoProfile.buildings.roofPalette);
  });

  it("falls back to the LVP profile at the handler level when the pipeline throws", async () => {
    const handler = createProfileHandler({
      config: CONFIG,
      cacheDir: mkdtempSync(join(tmpdir(), "vps-srv-")),
      pipelineFactory: () => ({ run: async () => { throw new Error("kaboom"); } }),
    });
    const res = await handler("/v1/profile", new URLSearchParams(ROME));
    expect(res.status).toBe(200);
    const body = profileBody(res);
    expect(body.source).toBe("lvp");
    expect(body.profile).toEqual(romeProfile);
  });

  it("rejects malformed coordinates with 400 and unknown paths with 404", async () => {
    const { handler } = handlerFor();
    expect((await handler("/v1/profile", new URLSearchParams({ lat: "abc", lon: "12.4" }))).status).toBe(400);
    expect((await handler("/v1/profile", new URLSearchParams({ lat: "91", lon: "12.4" }))).status).toBe(400);
    expect((await handler("/v1/profile", new URLSearchParams({}))).status).toBe(400);
    expect((await handler("/nope", new URLSearchParams(ROME))).status).toBe(404);
  });
});
