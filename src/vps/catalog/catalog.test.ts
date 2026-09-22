import { describe, expect, it } from "vitest";
import { defaultCatalog } from "./catalog.ts";
import type {
  FacadePaletteDefinition,
  RoofFamilyDefinition,
  RoadFamilyDefinition,
  SidewalkFamilyDefinition,
  VegetationFamilyDefinition,
  StreetFurnitureFamilyDefinition,
} from "./types.ts";
import { defaultProfile } from "../../render/theme/profiles/default.ts";
import { romeProfile } from "../../render/theme/profiles/rome.ts";
import { parisProfile } from "../../render/theme/profiles/paris.ts";
import { tokyoProfile } from "../../render/theme/profiles/tokyo.ts";
import { EVIDENCE_FIXTURES } from "../evidence/fixtures/index.ts";

describe("VPS visual catalog (VPS-02)", () => {
  it("meets the minimum viable catalog sizes (spec 138)", () => {
    expect(defaultCatalog.catalogRevision).toBeGreaterThanOrEqual(1);
    expect(defaultCatalog.facadePalettes.length).toBeGreaterThanOrEqual(4);
    expect(defaultCatalog.roofFamilies.length).toBeGreaterThanOrEqual(4);
    expect(defaultCatalog.roadFamilies.length).toBeGreaterThanOrEqual(3);
    expect(defaultCatalog.sidewalkFamilies.length).toBeGreaterThanOrEqual(4);
    expect(defaultCatalog.vegetationFamilies.length).toBeGreaterThanOrEqual(3);
    expect(defaultCatalog.streetFurnitureFamilies.length).toBeGreaterThanOrEqual(3);
  });

  it("has unique, non-empty ids and complete definitions", () => {
    const sections: Record<string, ReadonlyArray<{ id: string }>> = {
      facade: defaultCatalog.facadePalettes,
      roof: defaultCatalog.roofFamilies,
      road: defaultCatalog.roadFamilies,
      sidewalk: defaultCatalog.sidewalkFamilies,
      vegetation: defaultCatalog.vegetationFamilies,
      furniture: defaultCatalog.streetFurnitureFamilies,
    };
    const allIds: string[] = [];
    for (const [section, defs] of Object.entries(sections)) {
      for (const def of defs) {
        expect(def.id.length, `${section} id`).toBeGreaterThan(0);
        allIds.push(def.id);
      }
    }
    expect(new Set(allIds).size, "catalog ids unique").toBe(allIds.length);

    for (const p of defaultCatalog.facadePalettes) {
      expect(p.semanticTags.length, `${p.id} tags`).toBeGreaterThan(0);
      expect(p.colors.length, `${p.id} colors`).toBeGreaterThan(0);
    }
    for (const f of defaultCatalog.roofFamilies) {
      expect(f.semanticTags.length, `${f.id} tags`).toBeGreaterThan(0);
      expect(f.variants.length, `${f.id} variants`).toBeGreaterThan(0);
    }
    for (const r of defaultCatalog.roadFamilies) {
      expect(r.semanticTags.length, `${r.id} tags`).toBeGreaterThan(0);
      expect(r.base.fill, `${r.id} base.fill`).toBeGreaterThanOrEqual(0);
      expect(r.base.casing, `${r.id} base.casing`).toBeGreaterThanOrEqual(0);
    }
    for (const s of defaultCatalog.sidewalkFamilies) {
      expect(s.semanticTags.length, `${s.id} tags`).toBeGreaterThan(0);
      expect(s.fill, `${s.id} fill`).toBeGreaterThanOrEqual(0);
      expect(s.curb, `${s.id} curb`).toBeGreaterThanOrEqual(0);
    }
    for (const v of defaultCatalog.vegetationFamilies) {
      expect(v.semanticTags.length, `${v.id} tags`).toBeGreaterThan(0);
      expect(v.densityHint, `${v.id} densityHint`).toBeGreaterThanOrEqual(0);
      expect(v.densityHint, `${v.id} densityHint`).toBeLessThanOrEqual(1);
    }
    for (const f of defaultCatalog.streetFurnitureFamilies) {
      expect(f.semanticTags.length, `${f.id} tags`).toBeGreaterThan(0);
    }
  });

  it("is seeded from the validated LVP profiles (ADR-015)", () => {
    const facadeById = Object.fromEntries(defaultCatalog.facadePalettes.map((p) => [p.id, p])) as Record<string, FacadePaletteDefinition>;
    const roofById = Object.fromEntries(defaultCatalog.roofFamilies.map((f) => [f.id, f])) as Record<string, RoofFamilyDefinition>;
    const roadById = Object.fromEntries(defaultCatalog.roadFamilies.map((f) => [f.id, f])) as Record<string, RoadFamilyDefinition>;

    expect(facadeById["warm-stone"].colors).toEqual([...romeProfile.buildings.facadePalette]);
    expect(facadeById["cream-stone"].colors).toEqual([...parisProfile.buildings.facadePalette]);
    expect(facadeById["concrete-steel"].colors).toEqual([...tokyoProfile.buildings.facadePalette]);

    expect(roofById["terracotta-urban"].variants).toEqual([...romeProfile.buildings.roofPalette]);
    expect(roofById["zinc-city"].variants).toEqual([...parisProfile.buildings.roofPalette]);
    expect(roofById["charcoal-steel"].variants).toEqual([...tokyoProfile.buildings.roofPalette]);
    expect(roofById["flat-neutral"].variants).toEqual([...defaultProfile.buildings.roofPalette]);

    expect(roadById["warm-asphalt"].base).toEqual(romeProfile.roads.base);
    expect(roadById["cool-asphalt"].base).toEqual(tokyoProfile.roads.base);
    expect(roadById["neutral-asphalt"].base).toEqual(defaultProfile.roads.base);
  });

  it("every evidence fixture dominant is resolvable to a catalog family", () => {
    const tagOf = (defs: ReadonlyArray<{ semanticTags: readonly string[] }>, tag: string | undefined) =>
      tag !== undefined && defs.some((d) => d.semanticTags.includes(tag));

    for (const [id, evidence] of Object.entries(EVIDENCE_FIXTURES)) {
      expect(tagOf(defaultCatalog.facadePalettes, evidence.facadeColors.dominant), `${id} facade`).toBe(true);
      expect(tagOf(defaultCatalog.roofFamilies, evidence.roofTypes.dominant), `${id} roof`).toBe(true);
      expect(tagOf(defaultCatalog.roadFamilies, evidence.roadSurfaces.dominant), `${id} road`).toBe(true);
      expect(tagOf(defaultCatalog.sidewalkFamilies, evidence.sidewalkTypes.dominant), `${id} sidewalk`).toBe(true);
      expect(tagOf(defaultCatalog.vegetationFamilies, evidence.vegetation.dominant), `${id} vegetation`).toBe(true);
      expect(tagOf(defaultCatalog.streetFurnitureFamilies, evidence.streetFurniture.dominant), `${id} furniture`).toBe(true);
    }
  });
});

type CatalogShapeCheck = [
  VegetationFamilyDefinition,
  StreetFurnitureFamilyDefinition,
  SidewalkFamilyDefinition,
] extends [unknown, unknown, unknown] ? true : never;
const _shape: CatalogShapeCheck = true;
void _shape;
