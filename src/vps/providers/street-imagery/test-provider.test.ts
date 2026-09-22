import { describe, it, expect } from "vitest";
import { createTestImageryProvider, TEST_PROVIDER_NAME } from "./test-provider.ts";
import type { GeoArea, StreetImageryProvider, StreetSample } from "./types.ts";

const AREA: GeoArea = {
  id: "h3:891e8050527ffff",
  center: { latitude: 41.8992, longitude: 12.4769 },
  bounds: { south: 41.89, west: 12.46, north: 41.91, east: 12.50 },
};
const OPTIONS = { radiusMeters: 400, maxSamples: 8 };
const RETRIEVED = "2026-09-21T00:00:00Z";

function sample(id: string, latOffsetM: number, lonOffsetM: number): StreetSample {
  return {
    provider: "custom",
    sourceId: id,
    latitude: AREA.center.latitude + latOffsetM / 111_320,
    longitude: AREA.center.longitude + lonOffsetM / (111_320 * Math.cos((AREA.center.latitude * Math.PI) / 180)),
    capturedAt: "2026-03-01T00:00:00Z",
    heading: 0,
    provenance: { provider: "custom", sourceId: id, retrievedAt: RETRIEVED },
  };
}

describe("createTestImageryProvider (VPS-06, spec 5, 8, 17)", () => {
  it("synthesizes a deterministic ring and samples it: two runs, same batch", async () => {
    const provider: StreetImageryProvider = createTestImageryProvider();
    const a = await provider.sample(AREA, OPTIONS, RETRIEVED);
    const b = await provider.sample(AREA, OPTIONS, RETRIEVED);
    expect(b).toEqual(a);
    expect(a.provider).toBe(TEST_PROVIDER_NAME);
    expect(a.requested).toBe(OPTIONS.maxSamples);
    expect(a.samples.length).toBeGreaterThan(0);
    expect(a.samples.length).toBeLessThanOrEqual(OPTIONS.maxSamples);
    expect(a.retrievedAt).toBe(RETRIEVED);
    expect(a.options).toEqual(OPTIONS);
  });

  it("keeps every sample inside the radius with full provenance", async () => {
    const a = await createTestImageryProvider().sample(AREA, OPTIONS, RETRIEVED);
    for (const s of a.samples) {
      expect(s.latitude).toBeGreaterThanOrEqual(AREA.bounds.south);
      expect(s.latitude).toBeLessThanOrEqual(AREA.bounds.north);
      expect(s.longitude).toBeGreaterThanOrEqual(AREA.bounds.west);
      expect(s.longitude).toBeLessThanOrEqual(AREA.bounds.east);
      expect(s.provenance.provider).toBe(TEST_PROVIDER_NAME);
      expect(s.provenance.retrievedAt).toBe(RETRIEVED);
      expect(s.provenance.sourceId).toBe(s.sourceId);
    }
  });

  it("different areas produce different selections (seeded by area id)", async () => {
    const provider = createTestImageryProvider();
    const a = await provider.sample(AREA, OPTIONS, RETRIEVED);
    const other: GeoArea = { ...AREA, id: "h3:othercell", center: { latitude: 45.4642, longitude: 9.19 }, bounds: { south: 45.45, west: 9.15, north: 45.48, east: 9.25 } };
    const b = await provider.sample(other, OPTIONS, RETRIEVED);
    expect(b.samples.map((s) => s.sourceId)).not.toEqual(a.samples.map((s) => s.sourceId));
  });

  it("honors an injected pool: radius filter + maxSamples", async () => {
    const pool = [
      sample("near-1", 50, 0),
      sample("near-2", -50, 0),
      sample("near-3", 0, 60),
      sample("far-1", 5000, 0),
      sample("far-2", 0, 5000),
    ];
    const a = await createTestImageryProvider(pool).sample(AREA, { radiusMeters: 400, maxSamples: 2 }, RETRIEVED);
    const ids = a.samples.map((s) => s.sourceId).sort();
    expect(ids.length).toBeLessThanOrEqual(2);
    for (const id of ids) expect(id.startsWith("near-")).toBe(true);
  });

  it("empty pool and empty area yield an empty but well-formed batch", async () => {
    const a = await createTestImageryProvider([]).sample(AREA, OPTIONS, RETRIEVED);
    expect(a.samples).toEqual([]);
    expect(a.requested).toBe(OPTIONS.maxSamples);
  });

  it("never returns more samples than maxSamples even with a dense custom pool", async () => {
    const pool = Array.from({ length: 50 }, (_, i) => sample(`dense-${i}`, (i % 10) * 40, Math.floor(i / 10) * 40));
    const a = await createTestImageryProvider(pool).sample(AREA, OPTIONS, RETRIEVED);
    expect(a.samples.length).toBeLessThanOrEqual(OPTIONS.maxSamples);
  });
});
