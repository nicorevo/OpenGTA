import type { CompiledChunkV0 } from "../compiler/compiled.ts";
import type { PersistentChunkKey } from "./persistent.ts";

/**
 * Payload codec and validation for the persistent chunk store. The stored
 * bytes are a JSON encoding of the compiled chunk; deserialization validates
 * version, structural shape and element-level sanity (finite, bounded
 * numerics; well-formed, non-empty geometries) and returns undefined for
 * anything incompatible or corrupt, so the runtime can never reuse a stale
 * entry silently: a failed read is indistinguishable from a miss.
 */

export function serializeCompiledChunk(chunk: CompiledChunkV0): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(chunk));
}

/**
 * World coordinates are meters around a per-region origin; the app itself
 * bounds sessions far tighter. ±2000 km is a corruption sanity bound, not a
 * geography claim: anything beyond it cannot be a legitimate compiled chunk.
 */
const MAX_COORDINATE_METERS = 2_000_000;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isBoundedCoordinate(value: unknown): boolean {
  return isFiniteNumber(value) && Math.abs(value) <= MAX_COORDINATE_METERS;
}

function isPoint(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const point = value as { x?: unknown; y?: unknown };
  return isBoundedCoordinate(point.x) && isBoundedCoordinate(point.y);
}

function isPointList(value: unknown, minimumLength: number): boolean {
  return Array.isArray(value) && value.length >= minimumLength && value.every(isPoint);
}

function isPolygon(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const polygon = value as { outer?: unknown; holes?: unknown };
  if (!isPointList(polygon.outer, 3)) return false;
  if (polygon.holes !== undefined && !Array.isArray(polygon.holes)) return false;
  for (const hole of polygon.holes ?? []) if (!isPointList(hole, 3)) return false;
  return true;
}

function isBounds(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const bounds = value as Record<string, unknown>;
  return (
    isBoundedCoordinate(bounds.minX) && isBoundedCoordinate(bounds.minY) &&
    isBoundedCoordinate(bounds.maxX) && isBoundedCoordinate(bounds.maxY) &&
    (bounds.minX as number) <= (bounds.maxX as number) && (bounds.minY as number) <= (bounds.maxY as number)
  );
}

function isStringMap(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((entry) => entry && typeof (entry as { kind?: unknown }).kind === "string");
}

function isGroundEntry(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.featureId === "string" && isPolygon(entry.area) && typeof entry.styleKey === "string";
}

function isRoadEntry(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.featureId === "string" && isPolygon(entry.surface) &&
    isPointList(entry.centerline, 2) && isFiniteNumber(entry.widthMeters) &&
    (entry.widthMeters as number) > 0 && typeof entry.styleKey === "string"
  );
}

function isBuildingEntry(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  const fakeDepth = entry.fakeDepth as Record<string, unknown> | undefined;
  return (
    typeof entry.featureId === "string" && isPolygon(entry.roof) &&
    isFiniteNumber(entry.visualHeightMeters) && (entry.visualHeightMeters as number) >= 0 &&
    typeof entry.styleKey === "string" &&
    !!fakeDepth && typeof fakeDepth.enabled === "boolean" && isFiniteNumber(fakeDepth.scale)
  );
}

function isLabelEntry(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.featureId === "string" && typeof entry.text === "string" &&
    isPoint(entry.position) && isFiniteNumber(entry.angle) &&
    (entry.kind === "road" || entry.kind === "place") && isFiniteNumber(entry.priority)
  );
}

function isCollisionEntry(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  if (typeof entry.featureId !== "string") return false;
  if (entry.kind === "polygon") return isPolygon(entry.polygon);
  if (entry.kind === "segment") {
    return isPoint(entry.a) && isPoint(entry.b) && (entry.thicknessMeters === undefined || isFiniteNumber(entry.thicknessMeters));
  }
  if (entry.kind === "circle") return isPoint(entry.center) && isFiniteNumber(entry.radiusMeters) && (entry.radiusMeters as number) >= 0;
  return false;
}

function isDiagnostics(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const diagnostics = value as Record<string, unknown>;
  const nonNegative = (field: unknown): boolean => isFiniteNumber(field) && (field as number) >= 0;
  return (
    nonNegative(diagnostics.inputFeatureCount) && nonNegative(diagnostics.compiledFeatureCount) &&
    nonNegative(diagnostics.skippedFeatureCount) &&
    Array.isArray(diagnostics.warnings) && diagnostics.warnings.every((warning) => typeof warning === "string") &&
    diagnostics.stageDurationsMs !== null && typeof diagnostics.stageDurationsMs === "object" && !Array.isArray(diagnostics.stageDurationsMs) &&
    Object.values(diagnostics.stageDurationsMs as Record<string, unknown>).every(nonNegative)
  );
}

export function deserializeCompiledChunk(bytes: Uint8Array): CompiledChunkV0 | undefined {
  let value: unknown;
  try { value = JSON.parse(new TextDecoder().decode(bytes)); }
  catch { return undefined; }
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const chunk = value as Partial<CompiledChunkV0>;
  // Version and shape gate the reuse; namespace/compiler identity already
  // live in the persistent key, so a mismatch there never reaches this read.
  if (chunk.schemaVersion !== 0) return undefined;
  if (!chunk.id || typeof chunk.id !== "string") return undefined;
  if (!chunk.spatial || typeof chunk.spatial.regionId !== "string" || !isBounds(chunk.spatial.bounds) || !isPoint(chunk.spatial.originOffset)) return undefined;
  if (!Array.isArray(chunk.ground) || !chunk.ground.every(isGroundEntry)) return undefined;
  if (!Array.isArray(chunk.roads) || !chunk.roads.every(isRoadEntry)) return undefined;
  if (!Array.isArray(chunk.buildings) || !chunk.buildings.every(isBuildingEntry)) return undefined;
  if (!Array.isArray(chunk.labels) || !chunk.labels.every(isLabelEntry)) return undefined;
  if (!Array.isArray(chunk.collisions) || !chunk.collisions.every(isCollisionEntry)) return undefined;
  if (!isStringMap(chunk.featureIndex)) return undefined;
  if (!isDiagnostics(chunk.diagnostics)) return undefined;
  return chunk as CompiledChunkV0;
}
