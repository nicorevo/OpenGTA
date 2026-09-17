import { expect, it } from "vitest";
import { deserializeCompiledChunk, serializeCompiledChunk } from "./persistent-codec.ts";
import type { CompiledChunkV0 } from "../compiler/compiled.ts";

const chunk: CompiledChunkV0 = {
  schemaVersion: 0, id: "chunk:0:0", spatial: { regionId: "open-world:chunk:0:0", bounds: { minX: 0, minY: 0, maxX: 300, maxY: 300 }, originOffset: { x: 0, y: 0 } },
  ground: [], roads: [], buildings: [], labels: [], collisions: [], featureIndex: {},
  diagnostics: { inputFeatureCount: 0, compiledFeatureCount: 0, skippedFeatureCount: 0, warnings: [], stageDurationsMs: { compile: 1, total: 1 } },
};

it("roundtrips a compiled chunk byte-identically", () => {
  const bytes = serializeCompiledChunk(chunk);
  expect(deserializeCompiledChunk(bytes)).toEqual(chunk);
});

it("discards corrupt payloads instead of reusing them", () => {
  expect(deserializeCompiledChunk(new TextEncoder().encode("not json"))).toBeUndefined();
  expect(deserializeCompiledChunk(new TextEncoder().encode("[1,2,3]"))).toBeUndefined();
  expect(deserializeCompiledChunk(new Uint8Array([0xff, 0xfe, 0x00]))).toBeUndefined();
});

it("discards incompatible schema versions", () => {
  const future = { ...chunk, schemaVersion: 1 as never };
  expect(deserializeCompiledChunk(serializeCompiledChunk(future))).toBeUndefined();
});

it("discards structurally incomplete entries", () => {
  const broken = { ...chunk, roads: undefined as never };
  expect(deserializeCompiledChunk(serializeCompiledChunk(broken))).toBeUndefined();
  const noDiagnostics = { ...chunk, diagnostics: undefined as never };
  expect(deserializeCompiledChunk(serializeCompiledChunk(noDiagnostics))).toBeUndefined();
});

const square = { outer: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }], holes: [] };
const fullChunk = (): CompiledChunkV0 => ({
  ...chunk,
  ground: [{ featureId: "land:1", area: { ...square }, styleKey: "land:park" }],
  roads: [{ featureId: "road:1", surface: { ...square }, centerline: [{ x: 0, y: 5 }, { x: 10, y: 5 }], widthMeters: 6, styleKey: "road:residential" }],
  buildings: [{ featureId: "building:1", roof: { ...square }, visualHeightMeters: 12, styleKey: "building:residential", fakeDepth: { enabled: true, scale: 1 } }],
  labels: [
    { featureId: "road:1", text: "Via Minore", position: { x: 5, y: 5 }, angle: 0, kind: "road", priority: 60 },
    { featureId: "building:1", text: "Palazzo", position: { x: 5, y: 2 }, angle: 0, kind: "place", priority: 110 },
  ],
  collisions: [
    { kind: "polygon", featureId: "building:1", polygon: { ...square } },
    { kind: "segment", featureId: "barrier:1", a: { x: 0, y: 0 }, b: { x: 4, y: 0 } },
    { kind: "circle", featureId: "tree:1", center: { x: 1, y: 1 }, radiusMeters: 0.5 },
  ],
});

function deserializeCorrupted(mutate: (value: Record<string, unknown>) => void): CompiledChunkV0 | undefined {
  const parsed = JSON.parse(JSON.stringify(fullChunk())) as Record<string, unknown>;
  mutate(parsed);
  return deserializeCompiledChunk(new TextEncoder().encode(JSON.stringify(parsed)));
}

it("roundtrips a fully populated chunk", () => {
  const populated = fullChunk();
  expect(deserializeCompiledChunk(serializeCompiledChunk(populated))).toEqual(populated);
});

it("discards payloads with non-finite numeric fields", () => {
  // JSON.stringify encodes NaN/Infinity as null; the text-level literals
  // exercise the non-standard JSON.parse path as well.
  const parsed = JSON.parse(JSON.stringify(fullChunk())) as Record<string, unknown>;
  (parsed.roads as Record<string, unknown>)[0] = { ...((parsed.roads as Record<string, unknown>[])[0]) , widthMeters: Number.NaN };
  expect(deserializeCompiledChunk(new TextEncoder().encode(JSON.stringify(parsed)))).toBeUndefined();
  const text = serializeCompiledChunk(fullChunk()).toString();
  expect(deserializeCompiledChunk(new TextEncoder().encode(text.replace('"widthMeters":6', '"widthMeters":Infinity')))).toBeUndefined();
});

it("discards payloads with null elements in the feature arrays", () => {
  expect(deserializeCorrupted((value) => { (value.roads as unknown[])[0] = null; })).toBeUndefined();
  expect(deserializeCorrupted((value) => { (value.labels as unknown[])[1] = null; })).toBeUndefined();
});

it("discards coordinates outside the sanity bound", () => {
  expect(deserializeCorrupted((value) => {
    (value.spatial as Record<string, unknown>).bounds = { minX: 0, minY: 0, maxX: 3_000_000, maxY: 300 };
  })).toBeUndefined();
  expect(deserializeCorrupted((value) => {
    (value.ground as Record<string, unknown>)[0] = { featureId: "land:1", area: { ...square, outer: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 2_000_001 }, { x: 0, y: 10 }] }, styleKey: "land:park" };
  })).toBeUndefined();
});

it("discards malformed geometries", () => {
  expect(deserializeCorrupted((value) => {
    (value.ground as Record<string, unknown>)[0] = { featureId: "land:1", area: { outer: [], holes: [] }, styleKey: "land:park" };
  })).toBeUndefined();
  expect(deserializeCorrupted((value) => {
    (value.roads as Record<string, unknown>)[0] = { featureId: "road:1", surface: { ...square }, centerline: [{ x: 0, y: 5 }], widthMeters: 6, styleKey: "road:residential" };
  })).toBeUndefined();
  expect(deserializeCorrupted((value) => {
    (value.buildings as Record<string, unknown>)[0] = { featureId: "building:1", roof: { ...square }, visualHeightMeters: 12, styleKey: "building:residential", fakeDepth: { enabled: true, scale: Number.NaN } };
  })).toBeUndefined();
});

it("discards invalid collision shapes, labels and index entries", () => {
  expect(deserializeCorrupted((value) => {
    (value.collisions as Record<string, unknown>)[2] = { kind: "circle", featureId: "tree:1", center: { x: 1, y: 1 }, radiusMeters: -1 };
  })).toBeUndefined();
  expect(deserializeCorrupted((value) => {
    (value.collisions as Record<string, unknown>)[1] = { kind: "torus", featureId: "barrier:1" };
  })).toBeUndefined();
  expect(deserializeCorrupted((value) => {
    (value.labels as Record<string, unknown>)[0] = { featureId: "road:1", text: "Via Minore", position: { x: 5, y: 5 }, angle: 0, kind: "river", priority: 60 };
  })).toBeUndefined();
  expect(deserializeCorrupted((value) => {
    (value.featureIndex as Record<string, unknown>)["road:1"] = {};
  })).toBeUndefined();
});
