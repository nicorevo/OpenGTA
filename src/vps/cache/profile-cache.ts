import type { GeneratedVisualProfile } from "../compiler/types.ts";

/**
 * Profile cache key (spec 55): cell + evidence schema + compiler + catalog
 * revisions. When the catalog or compiler changes the entry is a miss —
 * the profile must be recompiled, but the cached evidence is untouched
 * (spec 56: recompiling never re-analyzes imagery).
 */
export function profileCacheKey(args: {
  cellId: string;
  schemaVersion: number;
  compilerRevision: number;
  catalogRevision: number;
}): string {
  return `cell:${args.cellId}|schema:${args.schemaVersion}|compiler:${args.compilerRevision}|catalog:${args.catalogRevision}`;
}

export interface ProfileCache {
  get(cellId: string, schemaVersion: number, compilerRevision: number, catalogRevision: number): GeneratedVisualProfile | undefined;
  set(profile: GeneratedVisualProfile): void;
  has(cellId: string, schemaVersion: number, compilerRevision: number, catalogRevision: number): boolean;
  readonly size: number;
  clear(): void;
}

/**
 * In-memory ProfileCache (spec 54): stores GeneratedVisualProfile per
 * cell + revisions, derived from profile.generation. Persistence/TTL are
 * service-level concerns (VPS-10), not core ones.
 */
export function createProfileCache(): ProfileCache {
  const store = new Map<string, GeneratedVisualProfile>();
  const keyOf = (cellId: string, schemaVersion: number, compilerRevision: number, catalogRevision: number) =>
    profileCacheKey({ cellId, schemaVersion, compilerRevision, catalogRevision });
  return {
    get(cellId, schemaVersion, compilerRevision, catalogRevision) {
      return store.get(keyOf(cellId, schemaVersion, compilerRevision, catalogRevision));
    },
    set(profile) {
      const { cellId, compilerRevision, catalogRevision } = profile.generation;
      store.set(keyOf(cellId, profile.schemaVersion, compilerRevision, catalogRevision), profile);
    },
    has(cellId, schemaVersion, compilerRevision, catalogRevision) {
      return store.has(keyOf(cellId, schemaVersion, compilerRevision, catalogRevision));
    },
    get size() {
      return store.size;
    },
    clear() {
      store.clear();
    },
  };
}
