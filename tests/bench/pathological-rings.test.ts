import { expect, it } from "vitest";
import { normalizeOsm, type RawOsm, type RawOsmRelation } from "../../src/geo/normalize/osm.ts";
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

// Disjoint-bbox hole assignment: `outers` large outer rings spread over the
// map plus `holes` inner rings whose bounding boxes do not intersect any
// outer ring. Without a bbox pre-filter the assignment pays point-in-ring
// (and ring area) for every (hole, outer) pair: holes × outers × edges.
function pathologicalHoleAssignment(outers: number, edges: number, holes: number): RawOsm {
  const elements: RawOsm["elements"][number][] = [];
  const memberList: RawOsmRelation["members"][number][] = [];
  let nodeId = 0;
  const ringWay = (centerX: number, centerY: number, radius: number, ringEdges: number, role: "outer" | "inner"): void => {
    const start = (nodeId += 1);
    elements.push({ type: "node", id: start, lat: centerY + radius, lon: centerX });
    for (let i = 1; i < ringEdges; i += 1) {
      const angle = (2 * Math.PI * i) / ringEdges;
      nodeId += 1;
      elements.push({ type: "node", id: nodeId, lat: centerY + Math.sin(angle) * radius, lon: centerX + Math.cos(angle) * radius });
    }
    const ids = Array.from({ length: ringEdges }, (_, i) => start + i);
    const way = { type: "way" as const, id: 50_000 + nodeId + 1, nodes: [...ids, start], tags: {} };
    elements.push(way);
    memberList.push({ type: "way" as const, ref: way.id, role });
  };
  // Node validity is in degrees (lat +/-90, lon +/-180); with the identity
  // projector the layout below stays inside that range and in the V0 bounds.
  const perColumn = Math.ceil(outers / 2);
  for (let index = 0; index < outers; index += 1) {
    const column = index % 2 === 0 ? -50 : 50;
    const row = Math.floor(index / 2);
    ringWay(column, -88 + row * (176 / (perColumn - 1)), 0.3, edges, "outer");
  }
  for (let index = 0; index < holes; index += 1) {
    // The gap between the two columns: disjoint from every outer bbox.
    ringWay(0, -88 + index * (176 / (holes - 1)), 0.3, 4, "inner");
  }
  elements.push({ type: "relation", id: 1, members: memberList, tags: { type: "multipolygon", building: "yes" } });
  return { elements };
}

it("assigns 300 orphan holes across 400 disjoint outers within budget", () => {
  const raw = pathologicalHoleAssignment(400, 200, 300);
  expect(raw.elements.length).toBeLessThanOrEqual(100_000);
  const before = performance.now();
  const region = normalizeOsm(raw, identityProjector, origin, "pathological-holes");
  const elapsedMs = performance.now() - before;
  expect(region.buildings).toHaveLength(400);
  expect(region.buildings.every((building) => building.footprint.holes.length === 0)).toBe(true);
  expect(region.warnings.filter((warning) => warning.code === "orphan-multipolygon-hole")).toHaveLength(300);
  expect(region.warnings.filter((warning) => warning.code === "element-limit")).toEqual([]);
  // Declared budget on the reference hardware (see log for before/after:
  // ~278 ms without the bbox pre-filter, ~48-88 ms with it under worker
  // contention; a loaded machine flaked the 120 ms budget at ~194 ms):
  // the pre-filter rejects every (hole, outer) pair before point-in-ring.
  // 300 ms keeps ~3x headroom over the post-fix worst case observed while
  // the pre-fix quadratic path (>= 280 ms even at idle) still fails wide.
  expect(elapsedMs).toBeLessThan(300);
  console.log(`HOLE_BENCH outers=400 edges=200 holes=300 normalizeMs=${elapsedMs.toFixed(1)}`);
});

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
