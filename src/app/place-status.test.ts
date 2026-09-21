import { describe, expect, it } from "vitest";
import type { GeocodeCandidate, ReverseGeocodeResult } from "./geocode.ts";
import { createPlaceTracker, PLACE_ZONE_METERS, zoneKeyForPose } from "./place-status.ts";

const NAME = "Lecce, Puglia, Italia";
const candidate: GeocodeCandidate = { name: NAME, latitude: 40.3531, longitude: 18.1726, placeId: "1" };
const romeCandidate: ReverseGeocodeResult = {
  name: "Roma, Lazio, Italia", latitude: 41.9028, longitude: 12.4964, placeId: "3177",
  countryCode: "IT", country: "Italy", region: "Lazio", locality: "Roma",
};
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

interface Call { readonly latitude: number; readonly longitude: number; readonly signal?: AbortSignal }

function makeReverse(impl: (latitude: number, longitude: number, signal?: AbortSignal) => Promise<GeocodeCandidate | undefined>) {
  const calls: Call[] = [];
  const reverse = (latitude: number, longitude: number, signal?: AbortSignal) => {
    calls.push({ latitude, longitude, signal });
    return impl(latitude, longitude, signal);
  };
  return { reverse, calls };
}

describe("zoneKeyForPose", () => {
  it("is stable for the same point and splits adjacent cells", () => {
    expect(zoneKeyForPose(0, 0)).toBe(zoneKeyForPose(0.5, 0.5));
    expect(zoneKeyForPose(999, 0)).toBe(zoneKeyForPose(0, 0));
    expect(zoneKeyForPose(1000, 0)).not.toBe(zoneKeyForPose(0, 0));
    expect(zoneKeyForPose(0, 1000)).not.toBe(zoneKeyForPose(0, 0));
  });

  it("handles negative coordinates on cell boundaries", () => {
    expect(zoneKeyForPose(-1000, 0)).toBe(zoneKeyForPose(-999.999, 0));
    expect(zoneKeyForPose(-1001, 0)).not.toBe(zoneKeyForPose(-1000, 0));
    expect(PLACE_ZONE_METERS).toBe(1000);
  });

  it("respects a custom cell size", () => {
    expect(zoneKeyForPose(100, 0, 50)).toBe(zoneKeyForPose(149, 0, 50));
    expect(zoneKeyForPose(150, 0, 50)).not.toBe(zoneKeyForPose(100, 0, 50));
  });
});

describe("createPlaceTracker", () => {
  it("fires one reverse per zone and none for the same zone", async () => {
    const { reverse, calls } = makeReverse(async () => candidate);
    let now = 0;
    const tracker = createPlaceTracker({ reverse, toLonLat: () => ({ latitude: 40.3531, longitude: 18.1726 }), clock: () => now });
    expect(tracker.place()).toBeUndefined();
    tracker.track(0, 0);
    tracker.track(10, 10);
    tracker.track(999, 999);
    await flush();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ latitude: 40.3531, longitude: 18.1726 });
    expect(tracker.place()).toBe(NAME);
    tracker.dispose();
  });

  it("requests a new zone after the previous one completes (never two in flight)", async () => {
    const { reverse, calls } = makeReverse(async () => candidate);
    let now = 0;
    const tracker = createPlaceTracker({ reverse, toLonLat: () => ({ latitude: 40, longitude: 18 }), clock: () => now });
    tracker.track(0, 0);
    await flush();
    now += 10_000;
    tracker.track(2000, 0);
    await flush();
    expect(calls).toHaveLength(2);
    expect(calls[1]?.signal?.aborted).toBe(false);
    tracker.dispose();
  });

  it("respects the minimum interval and retries the pending zone afterwards", async () => {
    const { reverse, calls } = makeReverse(async () => candidate);
    let now = 0;
    const tracker = createPlaceTracker({ reverse, toLonLat: () => ({ latitude: 40, longitude: 18 }), clock: () => now, minIntervalMs: 5000 });
    tracker.track(0, 0);
    await flush();
    now += 1000;
    tracker.track(2000, 0);
    await flush();
    expect(calls).toHaveLength(1);
    now += 4000;
    tracker.track(2000, 0);
    await flush();
    expect(calls).toHaveLength(2);
    tracker.dispose();
  });

  it("keeps a single in-flight request and queues the pending zone", async () => {
    let resolveFirst: ((value: GeocodeCandidate | undefined) => void) | undefined;
    const first = new Promise<GeocodeCandidate | undefined>((resolve) => { resolveFirst = resolve; });
    const { reverse, calls } = makeReverse(async () => calls.length === 1 ? first : candidate);
    let now = 0;
    const tracker = createPlaceTracker({ reverse, toLonLat: () => ({ latitude: 40, longitude: 18 }), clock: () => now, minIntervalMs: 0 });
    tracker.track(0, 0);
    tracker.track(2000, 0);
    await flush();
    expect(calls).toHaveLength(1);
    resolveFirst?.(candidate);
    await flush();
    await flush();
    expect(calls).toHaveLength(2);
    tracker.dispose();
  });

  it("keeps the last good name when a reverse fails and retries the zone", async () => {
    let fail = false;
    const { reverse, calls } = makeReverse(async () => {
      if (fail) throw new Error("network down");
      return calls.length === 1 ? { ...candidate, name: "Zona Vecchia" } : candidate;
    });
    let now = 0;
    const tracker = createPlaceTracker({ reverse, toLonLat: () => ({ latitude: 40, longitude: 18 }), clock: () => now, minIntervalMs: 0 });
    tracker.track(0, 0);
    await flush();
    expect(tracker.place()).toBe("Zona Vecchia");
    now += 1000;
    fail = true;
    tracker.track(2000, 0);
    await flush();
    expect(tracker.place()).toBe("Zona Vecchia");
    expect(calls).toHaveLength(2);
    now += 1000;
    tracker.track(2000, 0);
    await flush();
    expect(tracker.place()).toBe("Zona Vecchia");
    expect(calls).toHaveLength(3);
    now += 1000;
    fail = false;
    tracker.track(2000, 0);
    await flush();
    expect(tracker.place()).toBe(NAME);
    expect(calls).toHaveLength(4);
    tracker.dispose();
  });

  it("marks a no-data zone as served (no repeated empty lookups)", async () => {
    const { reverse, calls } = makeReverse(async () => undefined);
    let now = 0;
    const tracker = createPlaceTracker({ reverse, toLonLat: () => ({ latitude: 40, longitude: 18 }), clock: () => now, minIntervalMs: 0 });
    tracker.track(0, 0);
    await flush();
    now += 1000;
    tracker.track(0, 0);
    await flush();
    expect(calls).toHaveLength(1);
    expect(tracker.place()).toBeUndefined();
    tracker.dispose();
  });

  describe("location() (structured context for LVP)", () => {
    it("is undefined until the first successful lookup", async () => {
      const { reverse } = makeReverse(async () => romeCandidate);
      const tracker = createPlaceTracker({ reverse, toLonLat: () => ({ latitude: 41.9028, longitude: 12.4964 }), clock: () => 0, minIntervalMs: 0 });
      expect(tracker.location()).toBeUndefined();
      tracker.track(0, 0);
      await flush();
      expect(tracker.location()).toMatchObject({
        latitude: 41.9028, longitude: 12.4964, source: "nominatim",
        countryCode: "IT", locality: "Roma", displayName: "Roma, Lazio, Italia",
      });
      tracker.dispose();
    });

    it("keeps the last valid context when a later lookup fails or finds no data", async () => {
      let mode: "ok" | "fail" | "nodata" = "ok";
      const { reverse } = makeReverse(async () => {
        if (mode === "fail") throw new Error("network down");
        return mode === "nodata" ? undefined : romeCandidate;
      });
      let now = 0;
      const tracker = createPlaceTracker({ reverse, toLonLat: () => ({ latitude: 41.9028, longitude: 12.4964 }), clock: () => now, minIntervalMs: 0 });
      tracker.track(0, 0);
      await flush();
      expect(tracker.location()?.locality).toBe("Roma");
      now += 1000; mode = "fail";
      tracker.track(2000, 0);
      await flush();
      expect(tracker.location()?.locality).toBe("Roma"); // failure must not clear it
      now += 1000; mode = "nodata";
      tracker.track(4000, 0);
      await flush();
      expect(tracker.location()?.locality).toBe("Roma"); // no data must not clear it
      tracker.dispose();
    });

    it("exposes a context without address fields when the reverse result has none", async () => {
      const { reverse } = makeReverse(async () => candidate);
      const tracker = createPlaceTracker({ reverse, toLonLat: () => ({ latitude: 40.3531, longitude: 18.1726 }), clock: () => 0, minIntervalMs: 0 });
      tracker.track(0, 0);
      await flush();
      expect(tracker.location()).toEqual({
        latitude: 40.3531, longitude: 18.1726, source: "nominatim",
        placeId: "1", displayName: NAME,
      });
      expect(tracker.place()).toBe(NAME);
      tracker.dispose();
    });
  });

  it("stops tracking after dispose and aborts the in-flight request", async () => {
    let resolvePending: ((value: GeocodeCandidate | undefined) => void) | undefined;
    const pending = new Promise<GeocodeCandidate | undefined>((resolve) => { resolvePending = resolve; });
    const { reverse, calls } = makeReverse(async () => pending);
    let now = 0;
    const tracker = createPlaceTracker({ reverse, toLonLat: () => ({ latitude: 40, longitude: 18 }), clock: () => now, minIntervalMs: 0 });
    tracker.track(0, 0);
    await flush();
    expect(calls).toHaveLength(1);
    tracker.dispose();
    expect(calls[0]?.signal?.aborted).toBe(true);
    now += 1000;
    tracker.track(2000, 0);
    await flush();
    expect(calls).toHaveLength(1);
    resolvePending?.(candidate);
    await flush();
  });
});
