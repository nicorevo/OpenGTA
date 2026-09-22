/**
 * VPS public surface (core layer): provider-neutral evidence, the Visual
 * Catalog and the pure ProfileCompiler. No DOM, no network, no credentials —
 * the service layer (API/providers/cache) builds on top of this (ADR-015).
 */
export { defaultCatalog } from "./catalog/catalog.ts";
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
