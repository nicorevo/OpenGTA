/**
 * Visual profile contract: pure visual data (colors, palettes, families),
 * never runtime behavior. A resolved profile is always complete — the
 * renderer asks the style helpers and must never fall back to old
 * hardcoded constants or know parent themes.
 */
export type ThemeColor = number;

export interface RoadVisualStyle {
  readonly fill: ThemeColor;
  readonly casing: ThemeColor;
}

export interface BuildingTypeVisualStyle {
  readonly roof: ThemeColor;

  /**
   * Transitional field for the current fake-depth renderer.
   * It may later become unused when OpenGTA 2D+ removes fake facades.
   */
  readonly facade: ThemeColor;
}

export interface VisualProfile {
  readonly schemaVersion: 1;

  /** Stable machine id: default, italy, rome, france, paris... */
  readonly id: string;

  /** Human-readable diagnostics only. */
  readonly label: string;

  /** Revision for future cache/service evolution. */
  readonly revision: number;

  readonly ground: {
    /** Base ground / background tone; also the fallback for unknown land. */
    readonly base: ThemeColor;
    readonly water: ThemeColor;

    /** Land-use colors keyed by the compiled land class. */
    readonly land: Readonly<Record<string, ThemeColor>>;
  };

  readonly roads: {
    readonly base: RoadVisualStyle;
    /** Overrides keyed by the compiled road class. */
    readonly classes: Readonly<Record<string, RoadVisualStyle>>;
    readonly sidewalk: {
      readonly fill: ThemeColor;
      readonly curb: ThemeColor;
    };
    readonly markings: {
      readonly fill: ThemeColor;
    };
  };

  readonly buildings: {
    /** Used for generic building variants (seeded). */
    readonly roofPalette: readonly ThemeColor[];

    /** Transitional palette for the current fake facade. */
    readonly facadePalette: readonly ThemeColor[];

    /** Overrides keyed by the current building style class. */
    readonly typeStyles: Readonly<Record<string, BuildingTypeVisualStyle>>;

    readonly outline: ThemeColor;

    /**
     * Reserved for the OpenGTA 2D+ direction.
     * The renderer MVP does not have to consume all of these fields yet.
     */
    readonly depth2d: {
      readonly shadowColor: ThemeColor;
      readonly shadowAlpha: number;
      readonly edgeLight: ThemeColor;
      readonly edgeDark: ThemeColor;
    };
  };

  /**
   * Semantic future hooks (asset families).
   * Do not load assets in LVP-01.
   */
  readonly identity: {
    readonly roofFamily: string;
    readonly sidewalkFamily: string;
    readonly vegetationFamily: string;
    readonly streetFurnitureFamily: string;
  };
}
