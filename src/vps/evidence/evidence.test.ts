import { describe, expect, it } from "vitest";
import type { Distribution, VisualEvidenceProfile } from "./types.ts";
import { EVIDENCE_FIXTURES } from "./fixtures/index.ts";

const TOLERANCE = 0.01;

function distributionInvariants(name: string, dist: Distribution<string>): void {
  const entries = (Object.entries(dist.scores) as [string, number | undefined][]).filter(
    (e): e is [string, number] => typeof e[1] === "number",
  );
  expect(entries.length, `${name}: at least one score`).toBeGreaterThan(0);
  let sum = 0;
  for (const [key, score] of entries) {
    expect(score, `${name}.${key} in 0..1`).toBeGreaterThanOrEqual(0);
    expect(score, `${name}.${key} in 0..1`).toBeLessThanOrEqual(1);
    sum += score;
  }
  expect(sum, `${name}: scores sum to ~1`).toBeCloseTo(1, TOLERANCE < 0.1 ? 1 : 2);
  expect(dist.confidence, `${name}.confidence in 0..1`).toBeGreaterThanOrEqual(0);
  expect(dist.confidence, `${name}.confidence in 0..1`).toBeLessThanOrEqual(1);
  const top = entries.reduce((best, e) => (e[1] > best[1] ? e : best), entries[0]);
  if (dist.dominant !== undefined) {
    expect(dist.dominant, `${name}.dominant must be the argmax`).toBe(top[0]);
  }
}

function fixtureInvariants(fixture: VisualEvidenceProfile): void {
  expect(fixture.schemaVersion).toBe(1);
  expect(fixture.cell.id.length).toBeGreaterThan(0);
  expect(fixture.evidenceRevision.length).toBeGreaterThan(0);

  distributionInvariants("facadeColors", fixture.facadeColors);
  distributionInvariants("facadeMaterials", fixture.facadeMaterials);
  distributionInvariants("roofTypes", fixture.roofTypes);
  distributionInvariants("sidewalkTypes", fixture.sidewalkTypes);
  distributionInvariants("roadSurfaces", fixture.roadSurfaces);
  distributionInvariants("vegetation", fixture.vegetation);
  distributionInvariants("urbanCharacter", fixture.urbanCharacter);
  distributionInvariants("streetFurniture", fixture.streetFurniture);

  const { coverage } = fixture;
  expect(coverage.usableSamples).toBeGreaterThanOrEqual(0);
  expect(coverage.usableSamples).toBeLessThanOrEqual(coverage.requestedSamples);
  for (const key of ["spatialCoverage", "directionalCoverage", "imageryConfidence", "osmConfidence", "overall"] as const) {
    expect(coverage[key], `coverage.${key} in 0..1`).toBeGreaterThanOrEqual(0);
    expect(coverage[key], `coverage.${key} in 0..1`).toBeLessThanOrEqual(1);
  }

  for (const [key, value] of Object.entries(fixture.observedDensities)) {
    expect(value, `densities.${key} in 0..1`).toBeGreaterThanOrEqual(0);
    expect(value, `densities.${key} in 0..1`).toBeLessThanOrEqual(1);
  }

  expect(fixture.provenanceSummary.sampleCount).toBeGreaterThanOrEqual(0);
  expect(fixture.provenanceSummary.retrievedAt.length).toBeGreaterThan(0);
}

describe("VPS evidence fixtures (VPS-01)", () => {
  it("exposes the three offline fixtures (spec 97/140)", () => {
    expect(Object.keys(EVIDENCE_FIXTURES).sort()).toEqual(["paris", "rome", "tokyo"]);
  });

  it.each(Object.entries(EVIDENCE_FIXTURES))("%s fixture satisfies the evidence contract", (_id, fixture) => {
    fixtureInvariants(fixture);
  });

  it("the three fixtures describe distinct visual characters", () => {
    const roofs = Object.values(EVIDENCE_FIXTURES).map((f) => f.roofTypes.dominant);
    const facades = Object.values(EVIDENCE_FIXTURES).map((f) => f.facadeColors.dominant);
    const vegetation = Object.values(EVIDENCE_FIXTURES).map((f) => f.vegetation.dominant);
    expect(new Set(roofs).size).toBe(3);
    expect(new Set(facades).size).toBe(3);
    expect(new Set(vegetation).size).toBeGreaterThanOrEqual(2);
  });

  it("rome-like matches the spec example distributions (spec 85)", () => {
    const rome = EVIDENCE_FIXTURES.rome;
    expect(rome.facadeColors.dominant).toBe("ochre");
    expect(rome.roofTypes.dominant).toBe("terracotta-tile");
    expect(rome.sidewalkTypes.dominant).toBe("warm-stone");
    expect(rome.vegetation.dominant).toBe("mediterranean-urban");
    expect(rome.roofTypes.scores["terracotta-tile"]).toBeCloseTo(0.63, 2);
  });
});
