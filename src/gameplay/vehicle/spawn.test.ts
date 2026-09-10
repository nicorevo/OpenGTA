import { expect, it } from "vitest";
import { chooseSpawn } from "./spawn.ts";
import { createChunkGrid } from "../../world/chunk/grid.ts";
import { createPhysicsAdapter } from "../../physics/rapier/adapter.ts";
import type { CompiledChunkV0 } from "../../world/compiler/compiled.ts";

const area = { outer: [{ x: 10, y: 10 }, { x: 50, y: 10 }, { x: 50, y: 50 }, { x: 10, y: 50 }], holes: [] };
const chunk: CompiledChunkV0 = { id: "chunk:0:0", schemaVersion: 0, spatial: { regionId: "test", bounds: { minX: 0, minY: 0, maxX: 300, maxY: 300 }, originOffset: { x: 0, y: 0 } }, ground: [], buildings: [], labels: [], collisions: [], featureIndex: {}, diagnostics: { inputFeatureCount: 1, compiledFeatureCount: 1, skippedFeatureCount: 0, warnings: [], stageDurationsMs: {} }, roads: [{ featureId: "road", widthMeters: 6, styleKey: "road:residential", surface: area, centerline: [{ x: 0, y: 30 }, { x: 100, y: 30 }] }] };
const grid = createChunkGrid(300);

it("chooses a deterministic available road pose with real collision checks", async () => {
  const physics = await createPhysicsAdapter([{ kind: "polygon", featureId: "building", polygon: area }]);
  const blocked = { ...chunk, collisions: [{ kind: "polygon" as const, featureId: "building", polygon: area }] };
  const options = { chunks: [blocked], grid, available: [{ x: 0, y: 0 }], target: { x: 30, y: 30 }, isPoseFree: physics.isPoseFree };
  const result = chooseSpawn(options);
  expect(result.kind).toBe("pose");
  if (result.kind === "pose") expect(result.pose.position.x < 10 || result.pose.position.x > 50).toBe(true);
  expect(chooseSpawn(options)).toEqual(result);
  physics.dispose();
});

it("returns explicit no-spawn for missing, narrow or unavailable roads", () => {
  const options = { chunks: [chunk], grid, available: [] as { x: number; y: number }[], target: { x: 0, y: 0 }, isPoseFree: () => true };
  expect(chooseSpawn(options)).toMatchObject({ kind: "no-spawn", reason: "blocked" });
  expect(chooseSpawn({ ...options, chunks: [{ ...chunk, roads: [] }] })).toMatchObject({ kind: "no-spawn", reason: "no-roads" });
  expect(chooseSpawn({ ...options, available: [{ x: 0, y: 0 }], chunks: [{ ...chunk, roads: [{ ...chunk.roads[0], widthMeters: 1 }] }] })).toMatchObject({ kind: "no-spawn" });
});
