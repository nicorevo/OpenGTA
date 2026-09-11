import { expect, it } from "vitest";
import { normalizeOsm, type RawOsm } from "../../src/geo/normalize/osm.ts";
import type { GeoProjector } from "../../src/geo/coordinates/projector.ts";

// Deterministic pathological multipolygon: one closed ring of `members` ways
// with the member list REVERSED, so the current linear findIndex scan walks
// the whole pending array for every join (worst case for the O(n^2) path).
// Run explicitly: `npm run test:run -- tests/bench/pathological-rings.test.ts`.
const identityProjector: GeoProjector = {
  project: ({ latitude, longitude }) => ({ x: longitude, y: latitude }),
  unproject: ({ x, y }) => ({ latitude: y, longitude: x }),
};
const origin = { latitude: 40, longitude: 18 };

function pathologicalRing(members: number): RawOsm {
  const elements: RawOsm["elements"][number][] = [];
  const nodeCount = members * 2;
  // Ring nodes on a circle: a simple polygon that normalizedRing accepts.
  for (let i = 1; i <= nodeCount; i += 1) {
    const angle = (2 * Math.PI * i) / nodeCount;
    elements.push({ type: "node", id: i, lat: 40 + Math.sin(angle) * 0.005, lon: 18 + Math.cos(angle) * 0.005 });
  }
  const ways = Array.from({ length: members }, (_, index) => {
    const a = (index % members) + 1;
    const b = ((index + 1) % members) + 1;
    return { type: "way" as const, id: 10_000 + index, nodes: [a, b], tags: {} };
  });
  elements.push(...ways);
  elements.push({ type: "relation", id: 1, members: [...ways].reverse().map((way) => ({ type: "way" as const, ref: way.id, role: "outer" as const })), tags: { type: "multipolygon", building: "yes" } });
  return { elements };
}

for (const members of [100, 500, 1_000, 5_000, 20_000]) {
  it(`normalizes a ${members}-member reversed multipolygon ring within budget`, () => {
    const raw = pathologicalRing(members);
    const before = performance.now();
    const region = normalizeOsm(raw, identityProjector, origin, `pathological-${members}`);
    const elapsedMs = performance.now() - before;
    expect(region.buildings).toHaveLength(1);
    expect(region.warnings.filter((warning) => warning.code === "invalid-multipolygon")).toEqual([]);
    // Declared budget on the reference hardware (see log for before/after):
    // the indexed assembly stays linear; 20k members measured ~63 ms.
    expect(elapsedMs).toBeLessThan(500);
    console.log(`RING_BENCH members=${members} normalizeMs=${elapsedMs.toFixed(1)}`);
  });
}

it("stops the pathological assembly promptly when aborted", async () => {
  const raw = pathologicalRing(20_000);
  const controller = new AbortController();
  const started = performance.now();
  const work = new Promise<void>((resolve) => {
    setTimeout(() => {
      controller.abort();
      try { normalizeOsm(raw, identityProjector, origin, "pathological-abort", { signal: controller.signal }); resolve(); }
      catch { resolve(); }
    }, 0);
  });
  await work;
  const elapsedMs = performance.now() - started;
  // Abort responsiveness budget: measured ~1 ms on the reference hardware.
  expect(elapsedMs).toBeLessThan(2_000);
  console.log(`RING_BENCH abort-stopMs=${elapsedMs.toFixed(1)}`);
});
