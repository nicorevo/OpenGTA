/**
 * VPS public surface (core layer): provider-neutral evidence, the Visual
 * Catalog and the pure ProfileCompiler. No DOM, no network, no credentials —
 * the service layer (API/providers/cache) builds on top of this (ADR-015).
 */
export { defaultCatalog } from "./catalog/catalog.ts";
export { cellForCoordinates, URBAN_CELL_RESOLUTION } from "./cell/cell.ts";
export { collectOsmEvidence, createOsmEvidenceCollector, OSM_COLLECTOR_VERSION, DENSITY_SATURATION } from "./osm/osm-evidence.ts";
export type { OsmNode, OsmWay, OsmArea, OsmCellFeatures, OsmEvidenceCollector } from "./osm/types.ts";
export { evidenceCacheKey, createEvidenceCache, type EvidenceCache } from "./cache/evidence-cache.ts";
export { profileCacheKey, createProfileCache, type ProfileCache } from "./cache/profile-cache.ts";
export type {
  VisualCatalog,
  FacadePaletteDefinition,
  RoofFamilyDefinition,
  RoadFamilyDefinition,
  SidewalkFamilyDefinition,
  VegetationFamilyDefinition,
  StreetFurnitureFamilyDefinition,
} from "./catalog/types.ts";
export { createProfileCompiler, COMPILER_REVISION, MIN_GENERATED_CONFIDENCE } from "./compiler/compiler.ts";
export { vpsFixtureFromSearch } from "./compiler/override.ts";
export type { ProfileCompiler, ProfileCompilationContext, GeneratedVisualProfile } from "./compiler/types.ts";
export { EVIDENCE_FIXTURES, EVIDENCE_FIXTURE_IDS } from "./evidence/fixtures/index.ts";
export type { EvidenceFixtureId } from "./evidence/fixtures/index.ts";
export {
  aggregateEvidence,
  createEvidenceAggregator,
  AGGREGATOR_REVISION,
} from "./aggregate/aggregate.ts";
export {
  DEFAULT_SOURCE_TRUST,
  DEFAULT_RECENCY_BANDS,
  DEFAULT_SPATIAL_CLUSTER_METERS,
  VISION_CONFIDENCE_SAMPLE_CAP,
} from "./aggregate/types.ts";
export type {
  AggregatorAxis,
  AxisSourceTrust,
  SourceTrust,
  RecencyBands,
  AggregationInput,
  AggregatorOptions,
  EvidenceAggregator,
} from "./aggregate/types.ts";
export { ANALYZER_REVISION } from "./analysis/types.ts";
export type { ClassificationResult, VisualObservation, VisualAnalyzer } from "./analysis/types.ts";
export {
  validateVisualObservation,
  fallbackObservation,
  MAX_ANALYZER_OUTPUT_BYTES,
} from "./analysis/validate.ts";
export { createTestVisualAnalyzer } from "./analysis/test-analyzer.ts";
export {
  OBSERVATION_FIXTURES,
  romeHistoricObservations,
  parisCentralObservations,
  tokyoDenseObservations,
} from "./analysis/fixtures/observations.ts";
export {
  selectStreetSamples,
  MIN_POSITION_SPREAD_M,
  DEFAULT_HEADING_SPREAD_DEG,
  MAX_HEADINGS_PER_POSITION,
} from "./providers/street-imagery/sampling.ts";
export { createTestImageryProvider, TEST_PROVIDER_NAME } from "./providers/street-imagery/test-provider.ts";
export { createMapillaryProvider, MAPILLARY_PROVIDER_NAME } from "./providers/street-imagery/mapillary.ts";
export { StreetImageryProviderError } from "./providers/street-imagery/types.ts";
export type {
  GeoArea,
  StreetSamplingOptions,
  EvidenceProvenance,
  ProviderDetection,
  StreetSample,
  StreetSampleBatch,
  StreetImageryProvider,
} from "./providers/street-imagery/types.ts";
export type { MapillaryClient, MapillaryImageRef, MapillaryDetectionRef } from "./providers/street-imagery/mapillary.ts";
export type {
  VisualEvidenceProfile,
  Distribution,
  EvidenceCoverage,
  SpatialCell,
  FacadeColorClass,
  FacadeMaterialClass,
  RoofTypeClass,
  SidewalkTypeClass,
  RoadSurfaceClass,
  VegetationClass,
  UrbanCharacterClass,
  StreetFurnitureClass,
} from "./evidence/types.ts";
