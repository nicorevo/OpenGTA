import { describe, expect, it } from "vitest";
import { createProfileCompiler, COMPILER_REVISION } from "./compiler.ts";
import { vpsFixtureFromSearch } from "./override.ts";
import { defaultCatalog } from "../catalog/catalog.ts";
import { EVIDENCE_FIXTURES } from "../evidence/fixtures/index.ts";
import { defaultProfile } from "../../render/theme/profiles/default.ts";
import { romeProfile } from "../../render/theme/profiles/rome.ts";
import { parisProfile } from "../../render/theme/profiles/paris.ts";
import { tokyoProfile } from "../../render/theme/profiles/tokyo.ts";
import type { ProfileCompilationContext } from "./types.ts";
import type { VisualProfile } from "../../render/theme/types.ts";

function context(parent: VisualProfile): ProfileCompilationContext {
  return { parentProfile: parent, catalog: defaultCatalog, compilerRevision: COMPILER_REVISION };
}

const compiler = createProfileCompiler();

function inPalette(slot: number, palette: readonly number[]): boolean {
  return palette.includes(slot);
}

describe("VPS profile compiler (VPS-03)", () => {
  it("compiles rome-like evidence into a warm terracotta profile", () => {
    const generated = compiler.compile(EVIDENCE_FIXTURES.rome, context(defaultProfile));

    expect(generated.buildings.facadePalette).toEqual([...romeProfile.buildings.facadePalette]);
    // v1 decision: roads inherit the parent (evidence gives the material,
    // the tint is LVP art direction — see compiler docs).
    expect(generated.roads.base).toEqual(defaultProfile.roads.base);
    expect(generated.roads.sidewalk.fill).toBe(romeProfile.roads.sidewalk.fill);
    expect(generated.ground.land["park"]).toBe(romeProfile.ground.land["park"]);
    expect(generated.identity.roofFamily).toBe("terracotta-urban");
    expect(generated.identity.sidewalkFamily).toBe("warm-stone-v1");
    expect(generated.identity.vegetationFamily).toBe("mediterranean");

    // weighted families (spec 50): dominant terracotta (weight 0.525) owns
    // exactly the first 4 of the 8 deterministic slots
    const terracotta = generated.buildings.roofPalette.filter((c) => inPalette(c, romeProfile.buildings.roofPalette)).length;
    expect(terracotta).toBe(4);
  });

  it("compiles paris-like evidence into a zinc/cream profile", () => {
    const generated = compiler.compile(EVIDENCE_FIXTURES.paris, context(defaultProfile));

    expect(generated.buildings.facadePalette).toEqual([...parisProfile.buildings.facadePalette]);
    expect(generated.identity.roofFamily).toBe("zinc-city");
    expect(generated.identity.sidewalkFamily).toBe("light-stone-v1");

    const zinc = generated.buildings.roofPalette.filter((c) => inPalette(c, parisProfile.buildings.roofPalette)).length;
    expect(zinc).toBeGreaterThanOrEqual(6);
  });

  it("compiles tokyo-like evidence into a charcoal/concrete profile", () => {
    const generated = compiler.compile(EVIDENCE_FIXTURES.tokyo, context(defaultProfile));

    expect(generated.buildings.facadePalette).toEqual([...tokyoProfile.buildings.facadePalette]);
    expect(generated.identity.roofFamily).toBe("charcoal-steel");
    expect(generated.identity.sidewalkFamily).toBe("concrete-v1");

    const charcoal = generated.buildings.roofPalette.filter((c) => inPalette(c, tokyoProfile.buildings.roofPalette)).length;
    expect(charcoal).toBeGreaterThanOrEqual(3);
  });

  it("the three generated profiles stay mutually distinct", () => {
    const rome = compiler.compile(EVIDENCE_FIXTURES.rome, context(defaultProfile));
    const paris = compiler.compile(EVIDENCE_FIXTURES.paris, context(defaultProfile));
    const tokyo = compiler.compile(EVIDENCE_FIXTURES.tokyo, context(defaultProfile));
    expect(rome.buildings.facadePalette).not.toEqual([...paris.buildings.facadePalette]);
    expect(rome.buildings.facadePalette).not.toEqual([...tokyo.buildings.facadePalette]);
    expect(paris.buildings.facadePalette).not.toEqual([...tokyo.buildings.facadePalette]);
    expect(rome.identity.roofFamily).not.toBe(paris.identity.roofFamily);
    expect(rome.identity.roofFamily).not.toBe(tokyo.identity.roofFamily);
    expect(rome.roads.sidewalk.fill).not.toBe(tokyo.roads.sidewalk.fill);
  });

  it("is deterministic: same evidence + revisions → identical profile (spec 116)", () => {
    const a = compiler.compile(EVIDENCE_FIXTURES.rome, context(defaultProfile));
    const b = compiler.compile(EVIDENCE_FIXTURES.rome, context(defaultProfile));
    expect(b).toEqual(a);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("keeps parent values where confidence is below the threshold (spec 68)", () => {
    const weakRoof = {
      ...EVIDENCE_FIXTURES.rome,
      roofTypes: { ...EVIDENCE_FIXTURES.rome.roofTypes, confidence: 0.2 },
      facadeColors: { ...EVIDENCE_FIXTURES.rome.facadeColors, confidence: 0.1 },
    };
    const parent = defaultProfile;
    const generated = compiler.compile(weakRoof, context(parent));
    expect(generated.buildings.roofPalette).toEqual([...parent.buildings.roofPalette]);
    expect(generated.buildings.facadePalette).toEqual([...parent.buildings.facadePalette]);
    expect(generated.identity.roofFamily).toBe(parent.identity.roofFamily);
  });

  it("produces a complete, versioned GeneratedVisualProfile (spec 52-53)", () => {
    const generated = compiler.compile(EVIDENCE_FIXTURES.paris, context(defaultProfile));
    expect(generated.schemaVersion).toBe(1);
    expect(generated.generation.source).toBe("generated");
    expect(generated.generation.cellId).toBe(EVIDENCE_FIXTURES.paris.cell.id);
    expect(generated.generation.evidenceRevision).toBe(EVIDENCE_FIXTURES.paris.evidenceRevision);
    expect(generated.generation.compilerRevision).toBe(COMPILER_REVISION);
    expect(generated.generation.catalogRevision).toBe(defaultCatalog.catalogRevision);
    expect(generated.generation.confidence).toBeGreaterThanOrEqual(0);
    expect(generated.generation.confidence).toBeLessThanOrEqual(1);
    expect(generated.id).toMatch(/^vps:v1:.+:c1$/);
    expect(generated.id).toContain(EVIDENCE_FIXTURES.paris.cell.id);

    // completeness: no undefined anywhere in the visual contract
    expect(generated.buildings.roofPalette.length).toBeGreaterThan(0);
    expect(generated.buildings.facadePalette.length).toBeGreaterThan(0);
    for (const color of [...generated.buildings.roofPalette, ...generated.buildings.facadePalette]) {
      expect(color).toBeGreaterThanOrEqual(0);
    }
    expect(generated.ground.base).toBeGreaterThanOrEqual(0);
    expect(generated.ground.water).toBeGreaterThanOrEqual(0);
    expect(generated.roads.markings.fill).toBeGreaterThanOrEqual(0);
    expect(generated.buildings.outline).toBeGreaterThanOrEqual(0);
    expect(Object.keys(generated.ground.land).length).toBeGreaterThan(0);
    expect(Object.keys(generated.roads.classes).length).toBeGreaterThan(0);
    expect(Object.keys(generated.buildings.typeStyles).length).toBeGreaterThan(0);
  });

  it("inherits uncovered fields from the parent (ground base, typeStyles, outline, depth2d)", () => {
    const generated = compiler.compile(EVIDENCE_FIXTURES.rome, context(romeProfile));
    expect(generated.ground.base).toBe(romeProfile.ground.base);
    expect(generated.ground.water).toBe(romeProfile.ground.water);
    expect(generated.buildings.typeStyles).toEqual(romeProfile.buildings.typeStyles);
    expect(generated.buildings.outline).toBe(romeProfile.buildings.outline);
    expect(generated.buildings.depth2d).toEqual(romeProfile.buildings.depth2d);
    expect(generated.roads.markings).toEqual(romeProfile.roads.markings);
  });
});

describe("VPS dev override ?vps= (VPS-03)", () => {
  it("accepts only closed fixture ids", () => {
    const ids = new Set(["rome", "paris", "tokyo"]);
    expect(vpsFixtureFromSearch("?vps=rome", ids)).toBe("rome");
    expect(vpsFixtureFromSearch("?vps=TOKYO", ids)).toBe("tokyo");
    expect(vpsFixtureFromSearch("?vps=auto", ids)).toBeUndefined();
    expect(vpsFixtureFromSearch("?vps=bogus", ids)).toBeUndefined();
    expect(vpsFixtureFromSearch("?theme=rome", ids)).toBeUndefined();
    expect(vpsFixtureFromSearch("", ids)).toBeUndefined();
  });
});
