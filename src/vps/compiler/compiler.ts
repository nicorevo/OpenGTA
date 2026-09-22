import { stableStringHash } from "../../render/theme/hash.ts";
import type { ThemeColor, VisualProfile } from "../../render/theme/types.ts";
import type { VisualEvidenceProfile } from "../evidence/types.ts";
import type {
  RoofFamilyDefinition,
  RoadFamilyDefinition,
  SidewalkFamilyDefinition,
  VegetationFamilyDefinition,
} from "../catalog/types.ts";
import type { GeneratedVisualProfile, ProfileCompilationContext, ProfileCompiler } from "./types.ts";

export const COMPILER_REVISION = 1;

/**
 * Below this per-category confidence the compiler never generates: the field
 * keeps the parent (LVP) value instead (spec 68-69). The 0.35-0.60 blend
 * band is deliberately not implemented before the MVP (spec 70).
 */
export const MIN_GENERATED_CONFIDENCE = 0.35;

const ROOF_PALETTE_SLOTS = 8;

interface TaggedFamily {
  readonly id: string;
  readonly semanticTags: readonly string[];
}

type ScoreMap = Readonly<Partial<Record<string, number>>>;

function tagScore(def: TaggedFamily, scores: ScoreMap): number {
  let total = 0;
  for (const tag of def.semanticTags) total += scores[tag] ?? 0;
  return total;
}

/** Highest tag-overlap wins; catalog order breaks ties (deterministic). */
function bestFamily<T extends TaggedFamily>(defs: readonly T[], scores: ScoreMap): T | undefined {
  let best: T | undefined;
  let bestScore = 0;
  for (const def of defs) {
    const score = tagScore(def, scores);
    if (score > bestScore) {
      best = def;
      bestScore = score;
    }
  }
  return best;
}

/** Normalized, deterministic weight list for the families with evidence. */
function weightedFamilies(defs: readonly TaggedFamily[], scores: ScoreMap): ReadonlyArray<{ readonly id: string; readonly weight: number }> {
  const raw = defs
    .map((def) => ({ id: def.id, weight: tagScore(def, scores) }))
    .filter((entry) => entry.weight > 0);
  const total = raw.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) return [];
  return raw
    .map((entry) => ({ id: entry.id, weight: entry.weight / total }))
    .sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));
}

/**
 * Weighted families → concrete palette (spec 50-51): slot i belongs to the
 * family whose cumulative weight covers the slot center (i+0.5)/slots; the
 * variant inside a family is picked with stableStringHash, never Math.random().
 */
function buildRoofPalette(
  profileId: string,
  families: ReadonlyArray<{ readonly id: string; readonly weight: number }>,
  catalog: readonly RoofFamilyDefinition[],
): ThemeColor[] {
  const byId = new Map(catalog.map((f) => [f.id, f] as const));
  const palette: ThemeColor[] = [];
  for (let i = 0; i < ROOF_PALETTE_SLOTS; i += 1) {
    const target = (i + 0.5) / ROOF_PALETTE_SLOTS;
    let cumulative = 0;
    let family: RoofFamilyDefinition | undefined;
    for (const entry of families) {
      cumulative += entry.weight;
      if (target < cumulative) {
        family = byId.get(entry.id);
        break;
      }
    }
    family ??= catalog[0];
    const variants = family.variants;
    palette.push(variants[stableStringHash(`${profileId}:roof:${i}`) % variants.length]);
  }
  return palette;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/**
 * The ProfileCompiler (spec 43-44, ADR-015): a nearly pure function.
 *
 * - evidence says WHICH semantic class; the catalog says WHICH colors;
 * - low confidence per category → parent value (never invented, spec 68);
 * - v1 deliberately inherits roads (base + classes), ground base/water,
 *   typeStyles, outline and depth2d from the parent: street-surface material
 *   does not determine the OpenGTA tint, that is LVP art direction. The
 *   catalog roadFamilies are seeded and versioned for the next compiler
 *   revision that consumes a warm/cool road signal.
 * - determinism: no network, no providers, no timestamps, no Math.random();
 *   generatedAt is the evidence retrievedAt so the service can stamp its own
 *   wall-clock time at cache-write without changing the pure output (spec 116).
 */
export function createProfileCompiler(): ProfileCompiler {
  return {
    compile(evidence: VisualEvidenceProfile, context: ProfileCompilationContext): GeneratedVisualProfile {
      const { parentProfile: parent, catalog, compilerRevision } = context;
      const cellId = evidence.cell.id;
      const profileId = `vps:v1:${cellId}:c${compilerRevision}`;

      const facadeOk = evidence.facadeColors.confidence >= MIN_GENERATED_CONFIDENCE;
      const roofOk = evidence.roofTypes.confidence >= MIN_GENERATED_CONFIDENCE;
      const sidewalkOk = evidence.sidewalkTypes.confidence >= MIN_GENERATED_CONFIDENCE;
      const vegetationOk = evidence.vegetation.confidence >= MIN_GENERATED_CONFIDENCE;

      const facadeFamily = facadeOk ? bestFamily(catalog.facadePalettes, evidence.facadeColors.scores) : undefined;
      const facadePalette: readonly ThemeColor[] = facadeFamily ? facadeFamily.colors : parent.buildings.facadePalette;

      const roofFamilies = roofOk ? weightedFamilies(catalog.roofFamilies, evidence.roofTypes.scores) : [];
      const roofPalette: readonly ThemeColor[] =
        roofFamilies.length > 0 ? buildRoofPalette(profileId, roofFamilies, catalog.roofFamilies) : parent.buildings.roofPalette;

      const sidewalkFamily: SidewalkFamilyDefinition | undefined = sidewalkOk
        ? bestFamily(catalog.sidewalkFamilies, evidence.sidewalkTypes.scores)
        : undefined;

      const vegetationFamily: VegetationFamilyDefinition | undefined = vegetationOk
        ? bestFamily(catalog.vegetationFamilies, evidence.vegetation.scores)
        : undefined;

      const furnitureFamily = bestFamily(catalog.streetFurnitureFamilies, evidence.streetFurniture.scores);

      const land: Record<string, ThemeColor> = { ...parent.ground.land };
      if (vegetationFamily) {
        land["park"] = vegetationFamily.ground.park;
        land["grass"] = vegetationFamily.ground.grass;
        land["forest"] = vegetationFamily.ground.forest;
      }

      const confidences = [
        evidence.facadeColors.confidence,
        evidence.roofTypes.confidence,
        evidence.roadSurfaces.confidence,
        evidence.sidewalkTypes.confidence,
        evidence.vegetation.confidence,
      ];

      return {
        schemaVersion: 1,
        id: profileId,
        label: `Generated ${cellId}`,
        revision: 1,
        ground: {
          base: parent.ground.base,
          water: parent.ground.water,
          land,
        },
        roads: {
          base: { fill: parent.roads.base.fill, casing: parent.roads.base.casing },
          classes: { ...parent.roads.classes },
          sidewalk: sidewalkFamily
            ? { fill: sidewalkFamily.fill, curb: sidewalkFamily.curb }
            : { fill: parent.roads.sidewalk.fill, curb: parent.roads.sidewalk.curb },
          markings: { fill: parent.roads.markings.fill },
        },
        buildings: {
          roofPalette: [...roofPalette],
          facadePalette: [...facadePalette],
          typeStyles: parent.buildings.typeStyles,
          outline: parent.buildings.outline,
          depth2d: { ...parent.buildings.depth2d },
        },
        identity: {
          roofFamily: roofFamilies.length > 0 ? roofFamilies[0].id : parent.identity.roofFamily,
          sidewalkFamily: sidewalkFamily?.id ?? parent.identity.sidewalkFamily,
          vegetationFamily: vegetationFamily?.id ?? parent.identity.vegetationFamily,
          streetFurnitureFamily: furnitureFamily?.id ?? parent.identity.streetFurnitureFamily,
        },
        generation: {
          source: "generated",
          cellId,
          generatedAt: evidence.provenanceSummary.retrievedAt,
          evidenceRevision: evidence.evidenceRevision,
          compilerRevision,
          catalogRevision: catalog.catalogRevision,
          confidence: round4(confidences.reduce((sum, c) => sum + c, 0) / confidences.length),
        },
      };
    },
  };
}
