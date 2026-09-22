import { stableStringHash } from "../../render/theme/hash.ts";
import type {
  Distribution,
  FacadeColorClass,
  FacadeMaterialClass,
  RoadSurfaceClass,
  RoofTypeClass,
  SidewalkTypeClass,
  SpatialCell,
  StreetFurnitureClass,
  UrbanCharacterClass,
  VegetationClass,
  VisualEvidenceProfile,
} from "../evidence/types.ts";
import type { OsmArea, OsmCellFeatures, OsmEvidenceCollector, OsmNode, OsmWay } from "./types.ts";

export const OSM_COLLECTOR_VERSION = 1;
/** Saturating count curve for observedDensities: 10 items -> ~0.63, 30 -> ~0.95. */
export const DENSITY_SATURATION = 10;
/** Assumed paved width of an OSM highway way, for spatial coverage only. */
const ROAD_WIDTH_M = 4;
/** Below this green-area fraction (and with some OSM data at all) the cell is observed as sparsely vegetated. */
const SPARSE_GREEN_FRACTION = 0.02;
const M_PER_DEG = 111_320;

/**
 * Closed-vocabulary order (mirrors evidence/types.ts): used for the
 * deterministic argmax — ties resolve to the earliest class, never to input
 * order, so the output is independent of feature ordering.
 */
const FACADE_COLOR_ORDER: readonly FacadeColorClass[] = ["white", "cream", "sand", "ochre", "terracotta", "red", "brown", "warm-grey", "cool-grey", "dark", "mixed", "unknown"];
const FACADE_MATERIAL_ORDER: readonly FacadeMaterialClass[] = ["plaster", "stone", "brick", "concrete", "glass", "metal", "wood", "mixed", "unknown"];
const ROOF_TYPE_ORDER: readonly RoofTypeClass[] = ["terracotta-tile", "red-tile", "dark-tile", "slate", "zinc", "metal", "flat-concrete", "green-roof", "mixed", "unknown"];
const SIDEWALK_TYPE_ORDER: readonly SidewalkTypeClass[] = ["light-stone", "warm-stone", "dark-stone", "concrete", "pavers", "brick", "asphalt", "mixed", "unknown"];
const ROAD_SURFACE_ORDER: readonly RoadSurfaceClass[] = ["asphalt", "concrete", "cobblestone", "pavers", "gravel", "dirt", "mixed", "unknown"];
const VEGETATION_ORDER: readonly VegetationClass[] = ["mediterranean-urban", "temperate-urban", "continental-urban", "tropical-urban", "arid-urban", "sparse", "mixed", "unknown"];
const URBAN_CHARACTER_ORDER: readonly UrbanCharacterClass[] = ["historic-dense", "historic-medium", "modern-dense", "modern-medium", "residential-lowrise", "suburban", "industrial", "commercial", "mixed", "unknown"];
const STREET_FURNITURE_ORDER: readonly StreetFurnitureClass[] = ["classic-europe", "modern-europe", "north-american", "east-asian", "minimal", "mixed", "unknown"];

/**
 * Explicit tag -> class maps (spec 7/40). OSM gets high priority ONLY for
 * explicit, known values: anything unrecognized is not scored, so an
 * untagged cell can never push a style (it compiles back to the parent).
 */
const FACADE_MATERIAL_TAGS: Readonly<Record<string, FacadeMaterialClass>> = { brick: "brick", stone: "stone", concrete: "concrete", wood: "wood", glass: "glass", metal: "metal" };
const FACADE_COLOR_TAGS: Readonly<Record<string, FacadeColorClass>> = {
  white: "white", cream: "cream", ivory: "cream", yellow: "sand", sand: "sand", beige: "sand",
  ochre: "ochre", orange: "ochre", terracotta: "terracotta", red: "red", brown: "brown",
  grey: "cool-grey", gray: "cool-grey", black: "dark",
};
const ROOF_MATERIAL_TAGS: Readonly<Record<string, RoofTypeClass>> = {
  roof_tiles: "terracotta-tile", tiles: "terracotta-tile", metal: "metal", concrete: "flat-concrete",
};
const ROAD_SURFACE_TAGS: Readonly<Record<string, RoadSurfaceClass>> = {
  asphalt: "asphalt", concrete: "concrete", cobblestone: "cobblestone", paving_stones: "pavers",
  gravel: "gravel", dirt: "dirt", earth: "dirt", ground: "dirt",
  // Verified against live Overpass data in central Rome (VPS-10): the historic
  // sampietrini streets are mapped surface=sett, not surface=cobblestone.
  sett: "cobblestone",
};
const SIDEWALK_SURFACE_TAGS: Readonly<Record<string, SidewalkTypeClass>> = {
  asphalt: "asphalt", concrete: "concrete", paving_stones: "pavers",
};
const GREEN_AREA_TAGS: Readonly<Record<string, true>> = {
  "landuse=grass": true, "landuse=forest": true, "landuse=cemetery": true,
  "natural=wood": true, "natural=grass": true, "natural=scrub": true,
  "leisure=park": true, "leisure=garden": true, "leisure=recreation_ground": true, "leisure=common": true,
};

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function assertSize(value: number, what: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`Invalid ${what}: ${value}`);
  }
}

function sortedTags(tags: Readonly<Record<string, string>>): string {
  return Object.keys(tags)
    .sort()
    .map((key) => `${key}=${tags[key]}`)
    .join(";");
}

type Weights<T extends string> = Partial<Record<T, number>>;

function buildDistribution<T extends string>(order: readonly T[], weights: Weights<T>, confidence: number): Distribution<T> {
  const entries = Object.entries(weights) as Array<[T, number | undefined]>;
  const total = entries.reduce<number>((sum, [, w]) => sum + (w ?? 0), 0);
  if (total <= 0 || confidence <= 0) {
    const empty: Weights<T> = {};
    return { scores: empty, confidence: 0 };
  }
  const scores: Weights<T> = {};
  let dominant: T | undefined;
  let best = 0;
  for (const cls of order) {
    const w = weights[cls] ?? 0;
    if (w <= 0) continue;
    scores[cls] = round4(w / total);
    if (w > best) {
      best = w;
      dominant = cls;
    }
  }
  // keep the scores summing to exactly 1 after per-class rounding
  const drift = round4(1 - (Object.entries(scores) as Array<[T, number | undefined]>).reduce<number>((sum, [, s]) => sum + (s ?? 0), 0));
  if (drift !== 0 && dominant) scores[dominant] = round4((scores[dominant] ?? 0) + drift);
  return { scores, dominant, confidence: round4(confidence) };
}

function emptyDistribution<T extends string>(): Distribution<T> {
  const empty: Weights<T> = {};
  return { scores: empty, confidence: 0 };
}

/** Equirectangular cell area; good enough for coverage fractions at ~400 m cells. */
function cellAreaM2(cell: SpatialCell): number {
  const latM = (cell.bounds.north - cell.bounds.south) * M_PER_DEG;
  const lonM = (cell.bounds.east - cell.bounds.west) * M_PER_DEG * Math.cos((cell.center.latitude * Math.PI) / 180);
  return Math.max(1, latM * lonM);
}

const saturated = (count: number) => round4(1 - Math.exp(-count / DENSITY_SATURATION));

/**
 * OSM evidence collector (VPS-05, spec 7/40/41/101): turns the explicit OSM
 * tags found in a cell into a VisualEvidenceProfile.
 *
 * Documented decisions:
 * - explicit-only priority (spec 40): unknown or missing tag values are not
 *   scored; per-category confidence = classified/observed, so sparse OSM
 *   stays below the compiler threshold and the LVP parent wins;
 * - OSM never asserts climate vegetation character, historic/modern urban
 *   character or furniture style: those distributions stay empty (that is
 *   imagery/vision evidence, spec 130). Presence/absence of green IS
 *   asserted: a cell with some OSM data but < 2% green area is "sparse";
 * - weights are geometric (building area, way length) so a large tagged
 *   building out-votes many tiny untagged ones;
 * - urbanCharacter and streetFurniture stay at confidence 0 by design;
 * - pure and deterministic: the evidence revision is a hash of the input
 *   (spec 57/116/117), retrievedAt is injected (spec 116).
 */
export function createOsmEvidenceCollector(): OsmEvidenceCollector {
  return {
    collect(features, cell, retrievedAt) {
      for (const w of features.ways) assertSize(w.lengthM, "way lengthM");
      for (const a of features.areas) assertSize(a.areaM2, "areaM2");

      const facadeColors: Weights<FacadeColorClass> = {};
      const facadeMaterials: Weights<FacadeMaterialClass> = {};
      const roofTypes: Weights<RoofTypeClass> = {};
      const roadSurfaces: Weights<RoadSurfaceClass> = {};
      const sidewalkTypes: Weights<SidewalkTypeClass> = {};

      let buildingObserved = 0;
      let buildingColorClassified = 0;
      let buildingMaterialClassified = 0;
      let roofClassified = 0;
      let roadObserved = 0;
      let roadClassified = 0;
      let sidewalkObserved = 0;
      let sidewalkClassified = 0;
      let usableSamples = 0;
      let buildingAreaM2 = 0;
      let roadLengthM = 0;
      let greenAreaM2 = 0;
      let trees = 0;
      let streetLights = 0;
      let benches = 0;
      let bollards = 0;
      let parkedVehicles = 0;

      for (const f of features.areas) {
        const tags = f.tags;
        let classified = false;
        if (tags["building"] !== undefined) {
          buildingObserved += 1;
          buildingAreaM2 += f.areaM2;
          const material = FACADE_MATERIAL_TAGS[tags["building:material"] ?? ""];
          if (material) {
            facadeMaterials[material] = (facadeMaterials[material] ?? 0) + f.areaM2;
            buildingMaterialClassified += 1;
            classified = true;
          }
          const color = FACADE_COLOR_TAGS[tags["building:colour"] ?? ""];
          if (color) {
            facadeColors[color] = (facadeColors[color] ?? 0) + f.areaM2;
            buildingColorClassified += 1;
            classified = true;
          }
          const roof = ROOF_MATERIAL_TAGS[tags["roof:material"] ?? ""] ?? (tags["roof:shape"] === "flat" ? "flat-concrete" : undefined);
          if (roof) {
            roofTypes[roof] = (roofTypes[roof] ?? 0) + f.areaM2;
            roofClassified += 1;
            classified = true;
          }
        }
        const greenKey = ["landuse", "natural", "leisure"]
          .map((key) => (tags[key] !== undefined ? `${key}=${tags[key]}` : undefined))
          .find((k) => k !== undefined && GREEN_AREA_TAGS[k]);
        if (greenKey) greenAreaM2 += f.areaM2;
        if (tags["parking"] === "parking") parkedVehicles += 1;
        if (classified) usableSamples += 1;
      }

      for (const w of features.ways) {
        const tags = w.tags;
        const highway = tags["highway"];
        if (highway === undefined) continue;
        let classified = false;
        if (highway === "footway") {
          sidewalkObserved += 1;
          const sidewalk = SIDEWALK_SURFACE_TAGS[tags["surface"] ?? ""];
          if (sidewalk) {
            sidewalkTypes[sidewalk] = (sidewalkTypes[sidewalk] ?? 0) + w.lengthM;
            sidewalkClassified += 1;
            classified = true;
          }
        } else {
          roadObserved += 1;
          roadLengthM += w.lengthM;
          const surface = ROAD_SURFACE_TAGS[tags["surface"] ?? ""];
          if (surface) {
            roadSurfaces[surface] = (roadSurfaces[surface] ?? 0) + w.lengthM;
            roadClassified += 1;
            classified = true;
          }
        }
        if (tags["lighting"] === "street" || tags["street_lights"] === "yes" || tags["highway:street_lights"] === "yes") streetLights += 1;
        if (tags["parking"] === "lane" || tags["parking"] === "bay") parkedVehicles += 1;
        if (classified) usableSamples += 1;
      }

      for (const n of features.nodes) {
        const tags = n.tags;
        if (tags["natural"] === "tree") trees += 1;
        if (tags["amenity"] === "bench") benches += 1;
        if (tags["barrier"] === "bollard") bollards += 1;
      }

      const requestedSamples = features.areas.length + features.ways.length + features.nodes.length;
      const cellArea = cellAreaM2(cell);
      const greenFraction = clamp01(greenAreaM2 / cellArea);
      // OSM asserts sparseness (absence of green), never climate character.
      const vegetation =
        requestedSamples > 0 && greenFraction < SPARSE_GREEN_FRACTION
          ? buildDistribution(VEGETATION_ORDER, { sparse: 1 }, round4(1 - greenFraction / SPARSE_GREEN_FRACTION))
          : emptyDistribution<VegetationClass>();

      const coverage = {
        requestedSamples,
        usableSamples,
        spatialCoverage: clamp01((buildingAreaM2 + roadLengthM * ROAD_WIDTH_M + greenAreaM2) / cellArea),
        directionalCoverage: 0,
        imageryConfidence: 0,
        osmConfidence: 0,
        overall: 0,
      };
      const categories = [
        buildDistribution(FACADE_COLOR_ORDER, facadeColors, buildingObserved > 0 ? buildingColorClassified / buildingObserved : 0),
        buildDistribution(FACADE_MATERIAL_ORDER, facadeMaterials, buildingObserved > 0 ? buildingMaterialClassified / buildingObserved : 0),
        buildDistribution(ROOF_TYPE_ORDER, roofTypes, buildingObserved > 0 ? roofClassified / buildingObserved : 0),
        buildDistribution(SIDEWALK_TYPE_ORDER, sidewalkTypes, sidewalkObserved > 0 ? sidewalkClassified / sidewalkObserved : 0),
        buildDistribution(ROAD_SURFACE_ORDER, roadSurfaces, roadObserved > 0 ? roadClassified / roadObserved : 0),
      ];
      coverage.osmConfidence = round4(categories.reduce((sum, c) => sum + c.confidence, 0) / categories.length);
      coverage.overall = round4((coverage.imageryConfidence + coverage.osmConfidence) / 2);
      coverage.spatialCoverage = round4(coverage.spatialCoverage);

      // revision = f(collector version, cell, canonical features) (spec 57/116)
      const canonical = JSON.stringify({
        v: OSM_COLLECTOR_VERSION,
        cell: cell.id,
        nodes: features.nodes.map((n: OsmNode) => sortedTags(n.tags)),
        ways: features.ways.map((w: OsmWay) => [Math.round(w.lengthM * 100) / 100, sortedTags(w.tags)]),
        areas: features.areas.map((a: OsmArea) => [Math.round(a.areaM2 * 100) / 100, sortedTags(a.tags)]),
      });
      const evidenceRevision = `osm:v${OSM_COLLECTOR_VERSION}:${(stableStringHash(canonical) >>> 0).toString(16).padStart(8, "0")}`;

      const evidence: VisualEvidenceProfile = {
        schemaVersion: 1,
        cell,
        evidenceRevision,
        facadeColors: categories[0] as Distribution<FacadeColorClass>,
        facadeMaterials: categories[1] as Distribution<FacadeMaterialClass>,
        roofTypes: categories[2] as Distribution<RoofTypeClass>,
        sidewalkTypes: categories[3] as Distribution<SidewalkTypeClass>,
        roadSurfaces: categories[4] as Distribution<RoadSurfaceClass>,
        vegetation,
        urbanCharacter: emptyDistribution<UrbanCharacterClass>(),
        streetFurniture: emptyDistribution<StreetFurnitureClass>(),
        observedDensities: {
          tree: saturated(trees),
          streetLight: saturated(streetLights),
          bench: saturated(benches),
          bollard: saturated(bollards),
          parkedVehicle: saturated(parkedVehicles),
        },
        coverage,
        provenanceSummary: { providers: ["osm"], sampleCount: requestedSamples, retrievedAt },
      };
      return evidence;
    },
  };
}

/** Convenience binding for tests and the service layer. */
export function collectOsmEvidence(features: OsmCellFeatures, cell: SpatialCell, retrievedAt: string): VisualEvidenceProfile {
  return createOsmEvidenceCollector().collect(features, cell, retrievedAt);
}
