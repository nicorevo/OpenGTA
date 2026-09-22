import { describe, it, expect } from "vitest";
import { evidenceCacheKey, createEvidenceCache } from "./evidence-cache.ts";
import { profileCacheKey, createProfileCache } from "./profile-cache.ts";
import { cellForCoordinates } from "../cell/cell.ts";
import { createProfileCompiler, COMPILER_REVISION } from "../compiler/compiler.ts";
import { defaultCatalog } from "../catalog/catalog.ts";
import { EVIDENCE_FIXTURES } from "../evidence/fixtures/index.ts";
import { romeProfile } from "../../render/theme/profiles/rome.ts";

describe("cache keys (VPS-04, spec 55)", () => {
  it("profile key follows the documented cell|schema|compiler|catalog shape", () => {
    expect(
      profileCacheKey({ cellId: "h3:891e8052cb3ffff", schemaVersion: 1, compilerRevision: 4, catalogRevision: 7 }),
    ).toBe("cell:h3:891e8052cb3ffff|schema:1|compiler:4|catalog:7");
  });

  it("evidence key is cell|schema|evidence-revision (compiler/catalog must NOT matter)", () => {
    expect(evidenceCacheKey({ cellId: "h3:891e8052cb3ffff", schemaVersion: 1, evidenceRevision: "fixture-v1" })).toBe(
      "cell:h3:891e8052cb3ffff|schema:1|evidence:fixture-v1",
    );
  });
});

describe("profile cache (VPS-04, spec 54-56)", () => {
  it("stores and returns the exact generated profile", () => {
    const cache = createProfileCache();
    const compiler = createProfileCompiler();
    const evidence = { ...EVIDENCE_FIXTURES.rome, cell: cellForCoordinates(41.8992, 12.4769) };
    const profile = compiler.compile(evidence, { parentProfile: romeProfile, catalog: defaultCatalog, compilerRevision: COMPILER_REVISION });
    cache.set(profile);
    expect(cache.size).toBe(1);
    expect(cache.has(profile.generation.cellId, 1, COMPILER_REVISION, defaultCatalog.catalogRevision)).toBe(true);
    expect(cache.get(profile.generation.cellId, 1, COMPILER_REVISION, defaultCatalog.catalogRevision)).toBe(profile);
  });

  it("a new compiler or catalog revision is a miss (recompile, not reanalyze — spec 55/56)", () => {
    const cache = createProfileCache();
    const compiler = createProfileCompiler();
    const evidence = { ...EVIDENCE_FIXTURES.rome, cell: cellForCoordinates(41.8992, 12.4769) };
    const profile = compiler.compile(evidence, { parentProfile: romeProfile, catalog: defaultCatalog, compilerRevision: COMPILER_REVISION });
    cache.set(profile);
    expect(cache.get(profile.generation.cellId, 1, COMPILER_REVISION + 1, defaultCatalog.catalogRevision)).toBeUndefined();
    expect(cache.get(profile.generation.cellId, 1, COMPILER_REVISION, defaultCatalog.catalogRevision + 1)).toBeUndefined();
    // the original entry survives: evidence analysis is not invalidated
    expect(cache.get(profile.generation.cellId, 1, COMPILER_REVISION, defaultCatalog.catalogRevision)).toBe(profile);
  });

  it("tracks size and clears", () => {
    const cache = createProfileCache();
    const compiler = createProfileCompiler();
    for (const [lat, lon] of [
      [41.8992, 12.4769],
      [48.8566, 2.3522],
    ]) {
      const evidence = { ...EVIDENCE_FIXTURES.rome, cell: cellForCoordinates(lat, lon) };
      cache.set(compiler.compile(evidence, { parentProfile: romeProfile, catalog: defaultCatalog, compilerRevision: COMPILER_REVISION }));
    }
    expect(cache.size).toBe(2);
    cache.clear();
    expect(cache.size).toBe(0);
  });
});

describe("evidence cache (VPS-04, spec 56-57)", () => {
  it("stores and returns the exact evidence profile", () => {
    const cache = createEvidenceCache();
    const evidence = { ...EVIDENCE_FIXTURES.paris, cell: cellForCoordinates(48.8566, 2.3522) };
    cache.set(evidence);
    expect(cache.size).toBe(1);
    expect(cache.has(evidence.cell.id, evidence.schemaVersion, evidence.evidenceRevision)).toBe(true);
    expect(cache.get(evidence.cell.id, evidence.schemaVersion, evidence.evidenceRevision)).toBe(evidence);
  });

  it("a new evidence revision never shadows the previous one (spec 57)", () => {
    const cache = createEvidenceCache();
    const cell = cellForCoordinates(48.8566, 2.3522);
    const v1 = { ...EVIDENCE_FIXTURES.paris, cell, evidenceRevision: "run-1" };
    const v2 = { ...EVIDENCE_FIXTURES.paris, cell, evidenceRevision: "run-2" };
    cache.set(v1);
    cache.set(v2);
    expect(cache.size).toBe(2);
    expect(cache.get(cell.id, 1, "run-1")).toBe(v1);
    expect(cache.get(cell.id, 1, "run-2")).toBe(v2);
  });

  it("misses on unknown cell or revision", () => {
    const cache = createEvidenceCache();
    const cell = cellForCoordinates(48.8566, 2.3522);
    expect(cache.get(cell.id, 1, "run-1")).toBeUndefined();
    cache.set({ ...EVIDENCE_FIXTURES.paris, cell });
    expect(cache.get(cell.id, 1, "missing-revision")).toBeUndefined();
  });
});

describe("VPS-04 pipeline (spec 11: lat/lon -> cell id -> caches)", () => {
  it("second request for the same cell is served from the caches", () => {
    const lat = 41.8992;
    const lon = 12.4769;
    const evidenceCache = createEvidenceCache();
    const profileCache = createProfileCache();
    const compiler = createProfileCompiler();

    // Request 1: no cache -> collect (fixture stands in for the provider) + compile
    const cellA = cellForCoordinates(lat, lon);
    expect(evidenceCache.get(cellA.id, 1, EVIDENCE_FIXTURES.rome.evidenceRevision)).toBeUndefined();
    expect(profileCache.get(cellA.id, 1, COMPILER_REVISION, defaultCatalog.catalogRevision)).toBeUndefined();
    const evidence = { ...EVIDENCE_FIXTURES.rome, cell: cellA };
    evidenceCache.set(evidence);
    const profileA = compiler.compile(evidence, { parentProfile: romeProfile, catalog: defaultCatalog, compilerRevision: COMPILER_REVISION });
    profileCache.set(profileA);

    // Request 2: same coordinates -> same cell -> both cache hits, no recompile needed
    const cellB = cellForCoordinates(lat, lon);
    expect(cellB.id).toBe(cellA.id);
    const cachedEvidence = evidenceCache.get(cellB.id, 1, EVIDENCE_FIXTURES.rome.evidenceRevision);
    expect(cachedEvidence).toBe(evidence);
    const cachedProfile = profileCache.get(cellB.id, 1, COMPILER_REVISION, defaultCatalog.catalogRevision);
    expect(cachedProfile).toBe(profileA);
    expect(cachedProfile?.generation.cellId).toBe(cellA.id);
    expect(cachedProfile?.id).toBe(`vps:v1:${cellA.id}:c${COMPILER_REVISION}`);
  });
});
