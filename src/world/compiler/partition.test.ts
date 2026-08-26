import { describe, expect, it } from "vitest";
import { createChunkGrid } from "../chunk/grid.ts";
import { partitionCompiledChunk, ownerKeyForFeature } from "./partition.ts";
import type { CompiledChunkV0 } from "./compiled.ts";

const chunk: CompiledChunkV0 = {
  schemaVersion: 0,
  id: "region:chunk:0",
  spatial: { regionId: "region", bounds: { minX: -100, minY: -100, maxX: 100, maxY: 100 }, originOffset: { x: 0, y: 0 } },
  ground: [{ featureId: "land:1", area: { outer: [{ x: -150, y: -50 }, { x: 150, y: -50 }, { x: 150, y: 50 }, { x: -150, y: 50 }], holes: [] }, styleKey: "land:grass" }],
  roads: [{ featureId: "road:1", surface: { outer: [{ x: -150, y: -5 }, { x: 150, y: -5 }, { x: 150, y: 5 }, { x: -150, y: 5 }], holes: [] }, centerline: [{ x: -150, y: 0 }, { x: 150, y: 0 }], widthMeters: 10, styleKey: "road:primary" }],
  buildings: [], labels: [], collisions: [], featureIndex: { "land:1": { kind: "land" }, "road:1": { kind: "road" } },
  diagnostics: { inputFeatureCount: 2, compiledFeatureCount: 2, skippedFeatureCount: 0, warnings: [], stageDurationsMs: { total: 0 } },
};

describe("compiled chunk partition", () => {
  it("keeps crossing feature IDs while clipping geometry into both cells", () => {
    const parts = partitionCompiledChunk(chunk, createChunkGrid(200), [{ x: -1, y: 0 }, { x: 0, y: 0 }]);

    expect(parts).toHaveLength(2);
    expect(parts[0]?.ground[0]?.featureId).toBe("land:1");
    expect(parts[1]?.ground[0]?.featureId).toBe("land:1");
    expect(parts[0]?.roads[0]?.featureId).toBe("road:1");
    expect(parts[1]?.roads[0]?.featureId).toBe("road:1");
    expect(parts[0]?.spatial.bounds).toEqual({ minX: -200, minY: 0, maxX: 0, maxY: 200 });
    expect(parts[1]?.spatial.bounds).toEqual({ minX: 0, minY: 0, maxX: 200, maxY: 200 });
  });

  it("assigns a stable owner from the feature anchor", () => {
    const grid = createChunkGrid(200);
    expect(ownerKeyForFeature(grid, { x: 25, y: 25 })).toEqual({ x: 0, y: 0 });
    expect(ownerKeyForFeature(grid, { x: 225, y: 25 })).toEqual({ x: 1, y: 0 });
  });
});
