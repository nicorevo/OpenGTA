/**
 * Visual evidence contracts (VPS, spec sections 10, 15-16, 21-28, 34-39, 116).
 *
 * Evidence only OBSERVES the real world: closed vocabularies + confidence.
 * It never emits colors, hex values or OpenGTA asset ids — those live in the
 * VisualCatalog. Provider-neutral: no Mapillary/OSM types leak in here.
 */

export type FacadeColorClass =
  | "white"
  | "cream"
  | "sand"
  | "ochre"
  | "terracotta"
  | "red"
  | "brown"
  | "warm-grey"
  | "cool-grey"
  | "dark"
  | "mixed"
  | "unknown";

export type FacadeMaterialClass =
  | "plaster"
  | "stone"
  | "brick"
  | "concrete"
  | "glass"
  | "metal"
  | "wood"
  | "mixed"
  | "unknown";

export type RoofTypeClass =
  | "terracotta-tile"
  | "red-tile"
  | "dark-tile"
  | "slate"
  | "zinc"
  | "metal"
  | "flat-concrete"
  | "green-roof"
  | "mixed"
  | "unknown";

export type SidewalkTypeClass =
  | "light-stone"
  | "warm-stone"
  | "dark-stone"
  | "concrete"
  | "pavers"
  | "brick"
  | "asphalt"
  | "mixed"
  | "unknown";

export type RoadSurfaceClass =
  | "asphalt"
  | "concrete"
  | "cobblestone"
  | "pavers"
  | "gravel"
  | "dirt"
  | "mixed"
  | "unknown";

export type VegetationClass =
  | "mediterranean-urban"
  | "temperate-urban"
  | "continental-urban"
  | "tropical-urban"
  | "arid-urban"
  | "sparse"
  | "mixed"
  | "unknown";

export type UrbanCharacterClass =
  | "historic-dense"
  | "historic-medium"
  | "modern-dense"
  | "modern-medium"
  | "residential-lowrise"
  | "suburban"
  | "industrial"
  | "commercial"
  | "mixed"
  | "unknown";

export type StreetFurnitureClass =
  | "classic-europe"
  | "modern-europe"
  | "north-american"
  | "east-asian"
  | "minimal"
  | "mixed"
  | "unknown";

export interface GeoPoint {
  readonly latitude: number;
  readonly longitude: number;
}

export interface GeoBounds {
  readonly south: number;
  readonly west: number;
  readonly north: number;
  readonly east: number;
}

/**
 * Public contract for a spatial cell (spec 10). The implementation may use
 * H3 or any equivalent; the public contract never names it.
 */
export interface SpatialCell {
  readonly id: string;
  readonly center: GeoPoint;
  readonly bounds: GeoBounds;
  readonly resolution: number;
}

/**
 * Normalized score distribution over a closed class set (spec 35).
 * Documented decision: absent classes score 0 and may be omitted from
 * `scores` (partial record); present scores sum to ~1.
 */
export interface Distribution<T extends string> {
  readonly scores: Readonly<Partial<Record<T, number>>>;
  readonly dominant?: T;
  readonly confidence: number;
}

/** How much usable evidence the cell actually produced (spec 39). */
export interface EvidenceCoverage {
  readonly requestedSamples: number;
  readonly usableSamples: number;
  readonly spatialCoverage: number;
  readonly directionalCoverage: number;
  readonly imageryConfidence: number;
  readonly osmConfidence: number;
  readonly overall: number;
}

/** Provenance is not optional by design (spec 16). */
export interface ProvenanceSummary {
  readonly providers: readonly string[];
  readonly sampleCount: number;
  readonly earliestCapturedAt?: string;
  readonly latestCapturedAt?: string;
  readonly retrievedAt: string;
}

/** Stylized density guides, not 1:1 object counts (spec 92-93). */
export interface ObservedDensities {
  readonly tree: number;
  readonly streetLight: number;
  readonly bench: number;
  readonly bollard: number;
  readonly parkedVehicle: number;
}

/**
 * The heart of the pipeline (spec 34): what was observed in a cell, as
 * structured semantic evidence with confidence — never raw provider data.
 */
export interface VisualEvidenceProfile {
  readonly schemaVersion: 1;
  readonly cell: SpatialCell;
  /** Changes with new imagery / OSM data / analyzer / sampling (spec 57). */
  readonly evidenceRevision: string;

  readonly facadeColors: Distribution<FacadeColorClass>;
  readonly facadeMaterials: Distribution<FacadeMaterialClass>;
  readonly roofTypes: Distribution<RoofTypeClass>;
  readonly sidewalkTypes: Distribution<SidewalkTypeClass>;
  readonly roadSurfaces: Distribution<RoadSurfaceClass>;
  readonly vegetation: Distribution<VegetationClass>;
  readonly urbanCharacter: Distribution<UrbanCharacterClass>;
  readonly streetFurniture: Distribution<StreetFurnitureClass>;

  readonly observedDensities: ObservedDensities;

  readonly coverage: EvidenceCoverage;
  readonly provenanceSummary: ProvenanceSummary;
}
