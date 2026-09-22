import type { VisualEvidenceProfile } from "../evidence/types.ts";

/**
 * Evidence cache key (spec 55/56): the evidence of a cell depends on the
 * cell, the evidence schema and the evidence run — never on the compiler or
 * catalog, which are profile-side concerns (recompiling must not invalidate
 * analyzed imagery).
 */
export function evidenceCacheKey(args: {
  cellId: string;
  schemaVersion: number;
  evidenceRevision: string;
}): string {
  return `cell:${args.cellId}|schema:${args.schemaVersion}|evidence:${args.evidenceRevision}`;
}

export interface EvidenceCache {
  get(cellId: string, schemaVersion: number, evidenceRevision: string): VisualEvidenceProfile | undefined;
  set(evidence: VisualEvidenceProfile): void;
  has(cellId: string, schemaVersion: number, evidenceRevision: string): boolean;
  readonly size: number;
  clear(): void;
}

/**
 * In-memory EvidenceCache (spec 54): stores VisualEvidenceProfile per
 * cell + evidence revision. A new evidence run coexists with the previous
 * one (spec 57) instead of shadowing it. Persistence/TTL are service-level
 * concerns (VPS-10), not core ones.
 */
export function createEvidenceCache(): EvidenceCache {
  const store = new Map<string, VisualEvidenceProfile>();
  return {
    get(cellId, schemaVersion, evidenceRevision) {
      return store.get(evidenceCacheKey({ cellId, schemaVersion, evidenceRevision }));
    },
    set(evidence) {
      store.set(
        evidenceCacheKey({
          cellId: evidence.cell.id,
          schemaVersion: evidence.schemaVersion,
          evidenceRevision: evidence.evidenceRevision,
        }),
        evidence,
      );
    },
    has(cellId, schemaVersion, evidenceRevision) {
      return store.has(evidenceCacheKey({ cellId, schemaVersion, evidenceRevision }));
    },
    get size() {
      return store.size;
    },
    clear() {
      store.clear();
    },
  };
}
