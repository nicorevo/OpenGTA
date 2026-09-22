import type { ThemeColor } from "../../render/theme/types.ts";
import type {
  FacadeColorClass,
  RoofTypeClass,
  RoadSurfaceClass,
  SidewalkTypeClass,
  VegetationClass,
  StreetFurnitureClass,
} from "../evidence/types.ts";

/**
 * The VisualCatalog (spec 46-50): OpenGTA's artistic language. The evidence
 * pipeline may say "ochre" or "zinc" — only the catalog decides the actual
 * colors. Family ids are stable and versioned with `catalogRevision`.
 */

export interface FacadePaletteDefinition {
  readonly id: string;
  /** Closed-vocabulary evidence classes that select this palette. */
  readonly semanticTags: readonly FacadeColorClass[];
  readonly colors: readonly ThemeColor[];
}

export interface RoofFamilyDefinition {
  readonly id: string;
  readonly semanticTags: readonly RoofTypeClass[];
  /** Concrete roof colors; variants are picked deterministically per feature. */
  readonly variants: readonly ThemeColor[];
}

export interface RoadFamilyDefinition {
  readonly id: string;
  readonly semanticTags: readonly RoadSurfaceClass[];
  readonly base: { readonly fill: ThemeColor; readonly casing: ThemeColor };
  readonly classes: Readonly<Record<string, { readonly fill: ThemeColor; readonly casing: ThemeColor }>>;
}

export interface SidewalkFamilyDefinition {
  readonly id: string;
  readonly semanticTags: readonly SidewalkTypeClass[];
  readonly fill: ThemeColor;
  readonly curb: ThemeColor;
}

export interface VegetationFamilyDefinition {
  readonly id: string;
  readonly semanticTags: readonly VegetationClass[];
  /** Ground land-use tones contributed by this family. */
  readonly ground: { readonly park: ThemeColor; readonly grass: ThemeColor; readonly forest: ThemeColor };
  /** Procedural density guide 0..1 (spec 92), not a 1:1 object count. */
  readonly densityHint: number;
}

export interface StreetFurnitureFamilyDefinition {
  readonly id: string;
  readonly semanticTags: readonly StreetFurnitureClass[];
}

export interface VisualCatalog {
  readonly catalogRevision: number;
  readonly facadePalettes: readonly FacadePaletteDefinition[];
  readonly roofFamilies: readonly RoofFamilyDefinition[];
  readonly roadFamilies: readonly RoadFamilyDefinition[];
  readonly sidewalkFamilies: readonly SidewalkFamilyDefinition[];
  readonly vegetationFamilies: readonly VegetationFamilyDefinition[];
  readonly streetFurnitureFamilies: readonly StreetFurnitureFamilyDefinition[];
}
