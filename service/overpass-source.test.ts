import { describe, it, expect } from "vitest";
import { createOsmSource } from "./overpass-source.ts";
import { cellForCoordinates } from "../src/vps/index.ts";
import type { OsmCellFeatures } from "../src/vps/index.ts";

const CELL = cellForCoordinates(41.8992, 12.4769);
const ENDPOINT = "https://overpass-api.de/api/interpreter";

/** A tiny synthetic Overpass response with the exact shapes the live API returns. */
function overpassElements(): unknown[] {
  const ring = (lat0: number, lon0: number, dLat: number, dLon: number) => [
    { lat: lat0, lon: lon0 },
    { lat: lat0, lon: lon0 + dLon },
    { lat: lat0 + dLat, lon: lon0 + dLon },
    { lat: lat0 + dLat, lon: lon0 },
  ];
  return [
    { type: "node", id: 1, lat: 41.899, lon: 12.477, tags: { natural: "tree" } },
    { type: "node", id: 2, lat: 41.8991, lon: 12.4771, tags: { amenity: "bench" } },
    { type: "node", id: 3, lat: 41.8992, lon: 12.4772, tags: { barrier: "bollard" } },
    {
      type: "way",
      id: 10,
      nodes: [100, 101, 102],
      geometry: [
        { lat: 41.899, lon: 12.476 },
        { lat: 41.899, lon: 12.477 },
        { lat: 41.8991, lon: 12.477 },
      ],
      tags: { highway: "residential", surface: "sett", lit: "yes" },
    },
    {
      // single-way closed building (first point repeated at the end) -> must become an area
      type: "way",
      id: 11,
      nodes: [200, 201, 202, 203, 200],
      geometry: [...ring(41.8985, 12.4762, 0.0004, 0.0006), { lat: 41.8985, lon: 12.4762 }],
      tags: { building: "yes", "building:colour": "ochre" },
    },
    {
      // multipolygon building with an inner ring (courtyard) -> outer ring only
      type: "relation",
      id: 20,
      members: [
        { type: "way", ref: 300, role: "outer", geometry: ring(41.8990, 12.4770, 0.0005, 0.0005) },
        { type: "way", ref: 301, role: "inner", geometry: ring(41.89925, 12.47725, 0.0001, 0.0001) },
      ],
      tags: { building: "yes", "roof:material": "roof_tiles", type: "multipolygon" },
    },
    {
      type: "relation",
      id: 21,
      members: [{ type: "way", ref: 400, role: "outer", geometry: ring(41.8988, 12.4765, 0.0003, 0.0003) }],
      tags: { landuse: "grass" },
    },
    // untagged elements: must be dropped
    { type: "node", id: 30, lat: 41.899, lon: 12.477 },
    { type: "way", id: 31, nodes: [1, 2], geometry: [{ lat: 41.899, lon: 12.477 }, { lat: 41.899, lon: 12.478 }] },
  ];
}

function jsonResponse(elements: unknown[]) {
  return new Response(JSON.stringify({ version: 0.6, elements }), { status: 200, headers: { "content-type": "application/json" } });
}

describe("createOsmSource (VPS-10, spec 7/101: service-side Overpass client)", () => {
  it("queries the cell bounds with the collector's tag vocabulary and POSTs urlencoded", async () => {
    let captured: { url?: string; init?: RequestInit } | undefined;
    const source = createOsmSource({
      endpoint: ENDPOINT,
      fetchImpl: (async (url: string | URL, init?: RequestInit) => {
        captured = { url: String(url), init };
        return jsonResponse(overpassElements());
      }) as typeof fetch,
    });
    await source(CELL);
    expect(captured?.url).toBe(ENDPOINT);
    const body = new URLSearchParams(String(captured?.init?.body));
    const data = body.get("data") ?? "";
    expect(data).toContain("[out:json]");
    expect(data).toContain("node[\"natural\"=\"tree\"]");
    expect(data).toContain("node[\"amenity\"=\"bench\"]");
    expect(data).toContain("node[\"barrier\"=\"bollard\"]");
    expect(data).toContain('way["highway"~');
    expect(data).toContain('relation["landuse"~"grass|forest|cemetery"]');
    // the actual cell bounds (6 dp, the implementation's rounding) are in the query
    const f6 = (v: number) => Math.round(v * 1e6) / 1e6;
    expect(data).toContain(`(${f6(CELL.bounds.south)},${f6(CELL.bounds.west)},${f6(CELL.bounds.north)},${f6(CELL.bounds.east)})`);
    expect(new Headers(captured?.init?.headers as HeadersInit).get("content-type")).toBe("application/x-www-form-urlencoded");
  });

  it("maps nodes/ways/areas into OsmCellFeatures with geometry-derived sizes", async () => {
    const source = createOsmSource({
      endpoint: ENDPOINT,
      fetchImpl: (async () => jsonResponse(overpassElements())) as typeof fetch,
    });
    const features: OsmCellFeatures = await source(CELL);

    expect(features.nodes).toHaveLength(3);
    expect(features.nodes.map((n) => n.tags.natural ?? n.tags.amenity ?? n.tags.barrier)).toEqual(["tree", "bench", "bollard"]);

    // one road way (the closed building way is routed to areas, not ways)
    expect(features.ways).toHaveLength(1);
    const road = features.ways[0];
    expect(road.tags.highway).toBe("residential");
    expect(road.tags.surface).toBe("sett");
    // (41.899,12.476) -> (41.899,12.477) ~ 82.9 m, plus ~11 m N: total ~94 m
    expect(road.lengthM).toBeGreaterThan(80);
    expect(road.lengthM).toBeLessThan(110);

    expect(features.areas).toHaveLength(3);
    const byTags = (pred: (t: Record<string, string>) => boolean) => features.areas.find((a) => pred(a.tags as Record<string, string>));
    const singleWayBuilding = byTags((t) => t.building === "yes" && t["building:colour"] === "ochre");
    expect(singleWayBuilding).toBeDefined();
    // 0.0004 deg lat (~44.5 m) x 0.0006 deg lon (~49.7 m at 42°N) ~ 2213 m2
    expect(singleWayBuilding!.areaM2).toBeGreaterThan(1900);
    expect(singleWayBuilding!.areaM2).toBeLessThan(2600);

    const multi = byTags((t) => t["roof:material"] === "roof_tiles");
    expect(multi).toBeDefined();
    // outer ring 0.0005 x 0.0005 deg (~55.7 m x ~41.5 m at 42°N) ~ 2307 m2; inner ring excluded
    expect(multi!.areaM2).toBeGreaterThan(2000);
    expect(multi!.areaM2).toBeLessThan(2600);

    const grass = byTags((t) => t.landuse === "grass");
    expect(grass).toBeDefined();
    // 0.0003 x 0.0003 deg (~33.4 m x ~24.9 m) ~ 831 m2
    expect(grass!.areaM2).toBeGreaterThan(700);
    expect(grass!.areaM2).toBeLessThan(1000);
  });

  it("maps HTTP errors to thrown errors so the pipeline degrades to vision-only (spec 80)", async () => {
    for (const status of [429, 500]) {
      const source = createOsmSource({
        endpoint: ENDPOINT,
        fetchImpl: (async () => new Response("err", { status })) as typeof fetch,
      });
      await expect(source(CELL)).rejects.toThrow(/overpass/i);
    }
  });

  it("rejects non-JSON bodies as invalid responses", async () => {
    const source = createOsmSource({
      endpoint: ENDPOINT,
      fetchImpl: (async () => new Response("<html>busy</html>", { status: 200 })) as typeof fetch,
    });
    await expect(source(CELL)).rejects.toThrow(/overpass/i);
  });

  it("honors the injected rate limiter", async () => {
    let acquires = 0;
    const source = createOsmSource({
      endpoint: ENDPOINT,
      fetchImpl: (async () => jsonResponse(overpassElements())) as typeof fetch,
      rateLimiter: { acquire: async () => { acquires += 1; } },
    });
    await source(CELL);
    expect(acquires).toBe(1);
  });
});
