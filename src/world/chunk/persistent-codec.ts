import type { CompiledChunkV0 } from "../compiler/compiled.ts";
import type { PersistentChunkKey } from "./persistent.ts";

/**
 * Payload codec and validation for the persistent chunk store. The stored
 * bytes are a JSON encoding of the compiled chunk; deserialization validates
 * version and structural shape and returns undefined for anything
 * incompatible or corrupt, so the runtime can never reuse a stale entry
 * silently: a failed read is indistinguishable from a miss.
 */

export function serializeCompiledChunk(chunk: CompiledChunkV0): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(chunk));
}

export function deserializeCompiledChunk(bytes: Uint8Array): CompiledChunkV0 | undefined {
  let value: unknown;
  try { value = JSON.parse(new TextDecoder().decode(bytes)); }
  catch { return undefined; }
  if (!value || typeof value !== "object") return undefined;
  const chunk = value as Partial<CompiledChunkV0>;
  // Version and shape gate the reuse; namespace/compiler identity already
  // live in the persistent key, so a mismatch there never reaches this read.
  if (chunk.schemaVersion !== 0) return undefined;
  if (!chunk.id || typeof chunk.id !== "string") return undefined;
  if (!chunk.spatial || typeof chunk.spatial.regionId !== "string") return undefined;
  if (!Array.isArray(chunk.ground) || !Array.isArray(chunk.roads) || !Array.isArray(chunk.buildings) || !Array.isArray(chunk.labels) || !Array.isArray(chunk.collisions)) return undefined;
  if (!chunk.featureIndex || typeof chunk.featureIndex !== "object") return undefined;
  if (!chunk.diagnostics || typeof chunk.diagnostics !== "object") return undefined;
  return chunk as CompiledChunkV0;
}
