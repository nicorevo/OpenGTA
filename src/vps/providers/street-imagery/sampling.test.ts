import { describe, it, expect } from "vitest";
import { selectStreetSamples, MIN_POSITION_SPREAD_M, DEFAULT_HEADING_SPREAD_DEG } from "./sampling.ts";
import type { GeoArea, StreetSamplingOptions, StreetSample } from "./types.ts";

const AREA: GeoArea = {
  id: "test-area",
  center: { latitude: 41.8992, longitude: 12.4769 },
  bounds: { south: 41.89, west: 12.46, north: 41.91, east: 12.50 },
};

const OPTIONS: StreetSamplingOptions = { radiusMeters: 400, maxSamples: 10 };

let idCounter = 0;
function sample(partial: Partial<StreetSample>): StreetSample {
  idCounter += 1;
  return {
    provider: "test",
    sourceId: `img-${idCounter}`,
    latitude: AREA.center.latitude,
    longitude: AREA.center.longitude,
    capturedAt: "2026-01-01T00:00:00Z",
    heading: 0,
    provenance: { provider: "test", sourceId: `img-${idCounter}`, retrievedAt: "2026-09-21T00:00:00Z" },
    ...partial,
  };
}

const mLat = (m: number) => m / 111_320;
const mLon = (m: number) => m / (111_320 * Math.cos((AREA.center.latitude * Math.PI) / 180));

describe("selectStreetSamples (VPS-06, spec 13-14)", () => {
  it("keeps only candidates inside the sampling radius", () => {
    const candidates = [
      sample({ latitude: AREA.center.latitude + mLat(100), longitude: AREA.center.longitude, sourceId: "in-1" }),
      sample({ latitude: AREA.center.latitude - mLat(200), longitude: AREA.center.longitude, sourceId: "in-2" }),
      sample({ latitude: AREA.center.latitude + mLat(450), longitude: AREA.center.longitude, sourceId: "out-north" }),
      sample({ latitude: AREA.center.latitude, longitude: AREA.center.longitude + mLon(900), sourceId: "out-east" }),
    ];
    const picked = selectStreetSamples(candidates, OPTIONS, AREA);
    const ids = picked.map((s) => s.sourceId).sort();
    expect(ids).toEqual(["in-1", "in-2"]);
  });

  it("caps the number of samples at maxSamples", () => {
    const candidates = Array.from({ length: 30 }, (_, i) =>
      sample({
        sourceId: `many-${i}`,
        latitude: AREA.center.latitude + mLat((i % 6) * 80),
        longitude: AREA.center.longitude + mLon(Math.floor(i / 6) * 80),
        heading: (i * 36) % 360,
      }),
    );
    const picked = selectStreetSamples(candidates, { radiusMeters: 400, maxSamples: 10 }, AREA);
    expect(picked.length).toBeLessThanOrEqual(10);
  });

  it("avoids 20 consecutive images of the same sequence (spec 14): spatial spread + heading constraint", () => {
    // 25 shots at (0,0) sweeping headings, plus 5 well-spread singles
    const candidates: StreetSample[] = [];
    for (let i = 0; i < 25; i += 1) {
      candidates.push(sample({ sourceId: `seq-${i}`, heading: i * 14, latitude: AREA.center.latitude, longitude: AREA.center.longitude }));
    }
    for (let i = 0; i < 5; i += 1) {
      candidates.push(
        sample({
          sourceId: `solo-${i}`,
          latitude: AREA.center.latitude + mLat(60 + i * 70),
          longitude: AREA.center.longitude + mLon(i * 90),
          heading: 0,
        }),
      );
    }
    const picked = selectStreetSamples(candidates, OPTIONS, AREA);
    // the clustered sequence must not dominate: at most the per-position
    // heading cap (2-3 headings, spec 14) of its shots survive
    const seqPicked = picked.filter((s) => s.sourceId.startsWith("seq-"));
    expect(seqPicked.length).toBeLessThanOrEqual(3);
    // spread singles are preferred and present
    expect(picked.some((s) => s.sourceId.startsWith("solo-"))).toBe(true);
    expect(picked.length).toBeLessThanOrEqual(OPTIONS.maxSamples);
  });

  it("enforces the directional spread between close positions", () => {
    const close = (id: string, heading: number) => sample({ sourceId: id, heading });
    const candidates = [
      close("a", 0),
      close("b", 10), // within DEFAULT_HEADING_SPREAD_DEG of a, same spot
      close("c", 90), // far enough in heading: accepted
      close("d", 180),
      close("e", 270),
    ];
    const picked = selectStreetSamples(candidates, { radiusMeters: 400, maxSamples: 10 }, AREA);
    const headings = picked.map((s) => s.heading ?? 0);
    expect(headings).toContain(0);
    expect(headings).toContain(90);
    expect(picked.length).toBeGreaterThanOrEqual(3);
    for (const p of picked) {
      for (const q of picked) {
        if (p === q) continue;
        const dLat = Math.abs(p.latitude - q.latitude) * 111_320;
        const dLon = Math.abs(p.longitude - q.longitude) * 111_320 * Math.cos((p.latitude * Math.PI) / 180);
        const dist = Math.hypot(dLat, dLon);
        if (dist < MIN_POSITION_SPREAD_M) {
          let dh = Math.abs((p.heading ?? 0) - (q.heading ?? 0)) % 360;
          if (dh > 180) dh = 360 - dh;
          expect(dh).toBeGreaterThanOrEqual(DEFAULT_HEADING_SPREAD_DEG - 1e-9);
        }
      }
    }
  });

  it("deduplicates: same sourceId once, near-identical position+heading once", () => {
    const candidates = [
      sample({ sourceId: "dup", latitude: AREA.center.latitude, longitude: AREA.center.longitude, heading: 10 }),
      sample({ sourceId: "dup", latitude: AREA.center.latitude, longitude: AREA.center.longitude, heading: 12 }),
      sample({ sourceId: "near-1", latitude: AREA.center.latitude + mLat(35), longitude: AREA.center.longitude + mLon(35), heading: 10 }),
      sample({ sourceId: "near-2", latitude: AREA.center.latitude + mLat(36), longitude: AREA.center.longitude + mLon(34), heading: 12 }),
      sample({ sourceId: "other", latitude: AREA.center.latitude + mLat(200), longitude: AREA.center.longitude, heading: 0 }),
    ];
    const picked = selectStreetSamples(candidates, { radiusMeters: 400, maxSamples: 10 }, AREA);
    expect(picked.filter((s) => s.sourceId === "dup").length).toBe(1);
    const near = picked.filter((s) => s.sourceId.startsWith("near-"));
    expect(near.length).toBe(1);
  });

  it("prefers recent imagery within the preferred window", () => {
    const recent = sample({ sourceId: "recent", latitude: AREA.center.latitude + mLat(300), longitude: AREA.center.longitude, capturedAt: "2026-06-01T00:00:00Z" });
    const old = sample({ sourceId: "old", latitude: AREA.center.latitude + mLat(280), longitude: AREA.center.longitude, capturedAt: "2015-06-01T00:00:00Z" });
    const options: StreetSamplingOptions = { radiusMeters: 400, maxSamples: 2, preferredRecencyYears: 2 };
    const picked = selectStreetSamples([old, recent], options, AREA);
    expect(picked[0]?.sourceId).toBe("recent");
  });

  it("is deterministic and order-independent", () => {
    const candidates = Array.from({ length: 20 }, (_, i) =>
      sample({
        sourceId: `d-${String(i).padStart(2, "0")}`,
        latitude: AREA.center.latitude + mLat(((i * 97) % 700) - 350),
        longitude: AREA.center.longitude + mLon(((i * 211) % 700) - 350),
        heading: (i * 47) % 360,
        capturedAt: `202${(i % 4)}-0${(i % 9) + 1}-01T00:00:00Z`,
      }),
    );
    const a = selectStreetSamples(candidates, OPTIONS, AREA);
    const shuffled = [...candidates].reverse();
    const b = selectStreetSamples(shuffled, OPTIONS, AREA);
    expect(b.map((s) => s.sourceId).sort()).toEqual(a.map((s) => s.sourceId).sort());
  });

  it("returns an empty selection for an empty or fully-outside pool", () => {
    expect(selectStreetSamples([], OPTIONS, AREA)).toEqual([]);
    const far = [sample({ sourceId: "far", latitude: AREA.center.latitude + mLat(5000), longitude: AREA.center.longitude })];
    expect(selectStreetSamples(far, OPTIONS, AREA)).toEqual([]);
  });
});
