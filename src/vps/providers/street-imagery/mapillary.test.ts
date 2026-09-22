import { describe, it, expect } from "vitest";
import { createMapillaryProvider, MAPILLARY_PROVIDER_NAME } from "./mapillary.ts";
import { StreetImageryProviderError } from "./types.ts";
import type { MapillaryClient, MapillaryDetectionRef, MapillaryImageRef } from "./mapillary.ts";
import type { GeoArea } from "./types.ts";

const AREA: GeoArea = {
  id: "h3:891e8050527ffff",
  center: { latitude: 41.8992, longitude: 12.4769 },
  bounds: { south: 41.89, west: 12.46, north: 41.91, east: 12.50 },
};
const OPTIONS = { radiusMeters: 400, maxSamples: 5 };
const RETRIEVED = "2026-09-21T00:00:00Z";

function ref(partial: Partial<MapillaryImageRef> & { imageId: string }): MapillaryImageRef {
  return {
    latitude: AREA.center.latitude,
    longitude: AREA.center.longitude,
    ...partial,
  };
}

function fakeClient(overrides: Partial<MapillaryClient> = {}): MapillaryClient & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async searchImages() {
      calls.push("search");
      return [];
    },
    async fetchDetections(imageId: string) {
      calls.push(`detections:${imageId}`);
      return [];
    },
    ...overrides,
  };
}

describe("createMapillaryProvider (VPS-06, spec 5, 31-32, 80, 102)", () => {
  it("maps provider references into StreetSamples with full provenance", async () => {
    const client = fakeClient({
      searchImages: async () => [
        ref({
          imageId: "img-1",
          latitude: AREA.center.latitude + 0.002,
          longitude: AREA.center.longitude,
          capturedAt: "2025-05-01T10:00:00Z",
          compassAngle: 370,
          thumbnailUrl: "https://example.test/thumb-1.jpg",
        }),
      ],
    });
    const batch = await createMapillaryProvider(client).sample(AREA, OPTIONS, RETRIEVED);
    expect(batch.provider).toBe(MAPILLARY_PROVIDER_NAME);
    expect(batch.requested).toBe(OPTIONS.maxSamples);
    expect(batch.samples).toHaveLength(1);
    const s = batch.samples[0]!;
    expect(s.sourceId).toBe("img-1");
    expect(s.heading).toBeCloseTo(10, 6); // 370 normalized to 0-360
    expect(s.capturedAt).toBe("2025-05-01T10:00:00Z");
    expect(s.imageUrl).toBe("https://example.test/thumb-1.jpg");
    expect(s.provenance).toEqual({
      provider: MAPILLARY_PROVIDER_NAME,
      sourceId: "img-1",
      sourceUrl: "https://example.test/thumb-1.jpg",
      capturedAt: "2025-05-01T10:00:00Z",
      attribution: "Mapillary contributors",
      retrievedAt: RETRIEVED,
    });
    expect(s.provenance.license).toBeUndefined(); // spec 17: no unverified legal assumption
  });

  it("maps known detection classes and passes unknown ones through (spec 31-32)", async () => {
    const client = fakeClient({
      searchImages: async () => [ref({ imageId: "img-1", latitude: AREA.center.latitude, longitude: AREA.center.longitude })],
      fetchDetections: async (_id: string): Promise<MapillaryDetectionRef[]> => [
        { tag: "tree", score: 0.9 },
        { tag: "street_light", score: 0.4 },
        { tag: "totally_unknown_class" },
        { tag: "bad-score", score: 7 },
      ],
    });
    const batch = await createMapillaryProvider(client).sample(AREA, OPTIONS, RETRIEVED);
    const detections = batch.samples[0]!.detections ?? [];
    expect(detections.map((d) => [d.canonicalClass, d.providerClass])).toEqual([
      ["tree", "tree"],
      ["street-light", "street_light"],
      ["totally_unknown_class", "totally_unknown_class"],
      ["bad-score", "bad-score"],
    ]);
    expect(detections[0]!.confidence).toBe(0.9);
    expect(detections[3]!.confidence).toBeUndefined(); // out-of-range score dropped
    expect(detections[0]!.provenance).toEqual({ provider: MAPILLARY_PROVIDER_NAME, sourceId: "img-1", retrievedAt: RETRIEVED });
  });

  it("fetches detections only for selected samples, never for the rejected pool (spec 8)", async () => {
    const pool = Array.from({ length: 25 }, (_, i) =>
      ref({
        imageId: `seq-${i}`,
        latitude: AREA.center.latitude,
        longitude: AREA.center.longitude,
        compassAngle: i * 14,
      }),
    );
    for (let i = 0; i < 8; i += 1) {
      pool.push(ref({ imageId: `solo-${i}`, latitude: AREA.center.latitude + (60 + i * 70) / 111_320, longitude: AREA.center.longitude }));
    }
    const client = fakeClient({ searchImages: async () => pool });
    const batch = await createMapillaryProvider(client).sample(AREA, OPTIONS, RETRIEVED);
    const detectionCalls = client.calls.filter((c) => c.startsWith("detections:"));
    expect(detectionCalls.length).toBe(batch.samples.length);
    expect(detectionCalls.length).toBeLessThanOrEqual(OPTIONS.maxSamples);
    const selectedIds = new Set(batch.samples.map((s) => s.sourceId));
    for (const call of detectionCalls) {
      expect(selectedIds.has(call.slice("detections:".length))).toBe(true);
    }
  });

  it("a per-image detection failure degrades to no detections, not an error (spec 80)", async () => {
    const client = fakeClient({
      searchImages: async () => [
        ref({ imageId: "ok", latitude: AREA.center.latitude, longitude: AREA.center.longitude }),
        ref({ imageId: "boom", latitude: AREA.center.latitude + 0.0025, longitude: AREA.center.longitude }),
      ],
      fetchDetections: async (id: string): Promise<MapillaryDetectionRef[]> => {
        if (id === "boom") throw new Error("detection endpoint down");
        return [{ tag: "bench", score: 0.8 }];
      },
    });
    const batch = await createMapillaryProvider(client).sample(AREA, OPTIONS, RETRIEVED);
    expect(batch.samples).toHaveLength(2);
    const boom = batch.samples.find((s) => s.sourceId === "boom")!;
    expect(boom.detections).toBeUndefined();
    const ok = batch.samples.find((s) => s.sourceId === "ok")!;
    expect(ok.detections?.[0]?.canonicalClass).toBe("bench");
  });

  it("propagates typed provider errors unchanged (rate limits, auth) and wraps unknown ones (spec 80)", async () => {
    const limited = fakeClient({
      searchImages: async () => {
        throw new StreetImageryProviderError("rate-limited", "429 from mapillary");
      },
    });
    await expect(createMapillaryProvider(limited).sample(AREA, OPTIONS, RETRIEVED)).rejects.toMatchObject({
      kind: "rate-limited",
      name: "StreetImageryProviderError",
    });

    const broken = fakeClient({
      searchImages: async () => {
        throw new Error("socket hang up");
      },
    });
    await expect(createMapillaryProvider(broken).sample(AREA, OPTIONS, RETRIEVED)).rejects.toMatchObject({
      kind: "unavailable",
    });
  });

  it("rejects non-array responses and all-invalid references as invalid-response", async () => {
    const garbage = fakeClient({
      searchImages: (async () => "not-an-array") as unknown as MapillaryClient["searchImages"],
    });
    await expect(createMapillaryProvider(garbage).sample(AREA, OPTIONS, RETRIEVED)).rejects.toMatchObject({
      kind: "invalid-response",
    });

    const invalidRefs = fakeClient({
      searchImages: async () => [
        ref({ imageId: "nan", latitude: Number.NaN, longitude: 12.47 }),
        ref({ imageId: "", latitude: 41.9, longitude: 12.47 }),
      ],
    });
    await expect(createMapillaryProvider(invalidRefs).sample(AREA, OPTIONS, RETRIEVED)).rejects.toMatchObject({
      kind: "invalid-response",
    });
  });

  it("filters invalid references but keeps valid ones; empty search yields an empty batch", async () => {
    const client = fakeClient({
      searchImages: async () => [
        ref({ imageId: "good", latitude: AREA.center.latitude, longitude: AREA.center.longitude, capturedAt: "2026-02-01T00:00:00Z" }),
        ref({ imageId: "nan", latitude: Number.NaN, longitude: 12.47 }),
        ref({ imageId: "bad-date", latitude: AREA.center.latitude + 0.003, longitude: AREA.center.longitude, capturedAt: "not-a-date" }),
      ],
    });
    const batch = await createMapillaryProvider(client).sample(AREA, OPTIONS, RETRIEVED);
    expect(batch.samples.map((s) => s.sourceId).sort()).toEqual(["bad-date", "good"]);
    expect(batch.samples.find((s) => s.sourceId === "bad-date")!.capturedAt).toBeUndefined();

    const empty = await createMapillaryProvider(fakeClient()).sample(AREA, OPTIONS, RETRIEVED);
    expect(empty.samples).toEqual([]);
    expect(empty.requested).toBe(OPTIONS.maxSamples);
  });

  it("respects maxSamples over a dense provider pool", async () => {
    const pool = Array.from({ length: 30 }, (_, i) =>
      ref({
        imageId: `grid-${i}`,
        latitude: AREA.center.latitude + ((i % 6) * 80) / 111_320,
        longitude: AREA.center.longitude + (Math.floor(i / 6) * 80) / (111_320 * Math.cos((AREA.center.latitude * Math.PI) / 180)),
      }),
    );
    const client = fakeClient({ searchImages: async () => pool });
    const batch = await createMapillaryProvider(client).sample(AREA, OPTIONS, RETRIEVED);
    expect(batch.samples.length).toBeLessThanOrEqual(OPTIONS.maxSamples);
    expect(new Set(batch.samples.map((s) => s.sourceId)).size).toBe(batch.samples.length); // no duplicates
  });

  it("works through the neutral StreetImageryProvider contract (spec 5)", async () => {
    const provider = createMapillaryProvider(
      fakeClient({ searchImages: async () => [ref({ imageId: "x", latitude: AREA.center.latitude, longitude: AREA.center.longitude })] }),
    );
    const batch = await provider.sample(AREA, OPTIONS, RETRIEVED);
    expect(batch.provider).toBe(MAPILLARY_PROVIDER_NAME);
    expect(batch.samples[0]?.sourceId).toBe("x");
  });
});
