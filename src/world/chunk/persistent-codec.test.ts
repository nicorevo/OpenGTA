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
