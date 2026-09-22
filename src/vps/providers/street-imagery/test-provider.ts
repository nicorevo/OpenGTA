import { selectStreetSamples } from "./sampling.ts";
import type { GeoArea, StreetImageryProvider, StreetSample, StreetSampleBatch } from "./types.ts";

/**
 * Deterministic offline provider (spec 5 names TestImageryProvider). With no
 * pool it synthesizes a small ring of samples around the area from the area
 * id alone: no network, no images, no clock. Used by tests and by the VPS-10
 * service to run the full pipeline offline (spec 17, 82).
 */
export const TEST_PROVIDER_NAME = "test-imagery";

function defaultPool(area: GeoArea, retrievedAt: string): StreetSample[] {
  const seed = Math.abs(hashArea(area.id)) % 360;
  return Array.from({ length: 12 }, (_, i) => {
    const angleDeg = (seed + i * 30) % 360;
    const rad = (angleDeg * Math.PI) / 180;
    const sourceId = `test-${area.id}-${i}`;
    return {
      provider: TEST_PROVIDER_NAME,
      sourceId,
      latitude: area.center.latitude + (120 * Math.cos(rad)) / 111_320,
      longitude: area.center.longitude + (120 * Math.sin(rad)) / (111_320 * Math.cos((area.center.latitude * Math.PI) / 180)),
      capturedAt: new Date(Date.UTC(2026, 0, 1) + i * 30 * 86_400_000).toISOString(),
      heading: (angleDeg + 90) % 360,
      provenance: { provider: TEST_PROVIDER_NAME, sourceId, retrievedAt },
    };
  });
}

function hashArea(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * `pool` undefined -> deterministic synthetic ring for the area;
 * `pool` given (even empty) -> sample exactly that pool.
 */
export function createTestImageryProvider(pool?: readonly StreetSample[]): StreetImageryProvider {
  return {
    async sample(area, options, retrievedAt): Promise<StreetSampleBatch> {
      const candidates = pool === undefined ? defaultPool(area, retrievedAt) : pool;
      const samples = selectStreetSamples(candidates, options, area);
      return {
        provider: TEST_PROVIDER_NAME,
        area,
        options,
        requested: options.maxSamples,
        samples,
        retrievedAt,
      };
    },
  };
}
