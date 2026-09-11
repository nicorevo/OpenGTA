import type { DecodedVectorTile } from "../../src/geo/mvt/decode.ts";
import { normalizeMvtTiles } from "../../src/geo/normalize/mvt.ts";
import type { WorldWarning } from "../../src/world/model/types.ts";

/** Shared Sant'Oronzo bench origin and pinned z14 tile. */
export const ORIGIN = { latitude: 40.35316888888889, longitude: 18.17259 };
export const TILE = { z: 14, x: 9019, y: 6181 };
export const EXTENT = 4096;

/** Build a WorldRegion from the decoded tile through the canonical normalizer. */
export function mvtToRegion(decoded: DecodedVectorTile): { region: ReturnType<typeof normalizeMvtTiles>["region"]; warnings: readonly WorldWarning[]; raw: { roads: number; buildings: number; land: number; water: number } } {
  const normalized = normalizeMvtTiles({ tiles: [{ tile: TILE, decoded }], origin: ORIGIN, regionId: "mvt-z14" });
  return { region: normalized.region, warnings: normalized.region.warnings, raw: normalized.raw };
}
