import type { VisualProfile } from "../../render/theme/types.ts";
import { COMPILER_REVISION } from "../compiler/compiler.ts";
import type { GeneratedVisualProfile, ProfileCompiler } from "../compiler/types.ts";
import type { VisualCatalog } from "../catalog/types.ts";
import type { SpatialCell, VisualEvidenceProfile } from "../evidence/types.ts";
import { collectOsmEvidence } from "../osm/osm-evidence.ts";
import type { OsmCellFeatures } from "../osm/types.ts";
import type { StreetImageryProvider, StreetSample, StreetSamplingOptions } from "../providers/street-imagery/types.ts";
import type { VisualAnalyzer, VisualObservation } from "../analysis/types.ts";
import { fallbackObservation } from "../analysis/validate.ts";
import { aggregateEvidence } from "../aggregate/aggregate.ts";
import type { EvidenceCache } from "../cache/evidence-cache.ts";
import type { ProfileCache } from "../cache/profile-cache.ts";

/** Baseline sampling (spec 13): 400 m radius, 20-30 samples. */
export const DEFAULT_SAMPLING_OPTIONS: StreetSamplingOptions = {
  radiusMeters: 400,
  maxSamples: 24,
};

export interface VisualPipelineDependencies {
  /**
   * OSM feature source: turns a cell into plain tagged geometries. In the
   * offline slice this is a fixture; in VPS-10 the service-side Overpass
   * client implements it. Failures degrade the cell to vision-only (spec 80).
   */
  readonly osmSource: (cell: SpatialCell) => Promise<OsmCellFeatures> | OsmCellFeatures;
  readonly imagery: StreetImageryProvider;
  readonly analyzer: VisualAnalyzer;
  readonly compiler: ProfileCompiler;
  readonly catalog: VisualCatalog;
  /** LVP-resolved fallback profile for the cell (spec 12: LVP guarantees). */
  readonly resolveParent: (cell: SpatialCell) => VisualProfile;
  readonly evidenceCache: EvidenceCache;
  readonly profileCache: ProfileCache;
  readonly samplingOptions?: StreetSamplingOptions;
}

export type SourceStatus = "ok" | "failed";

export interface PipelineDiagnostics {
  readonly osm: SourceStatus;
  readonly imagery: SourceStatus;
  readonly requestedSamples: number;
  readonly analyzedSamples: number;
  /** True when the recomputed evidence revision already had a stored entry (the stored object is reused). */
  readonly evidenceCacheHit: boolean;
  readonly profileCacheHit: boolean;
}

export interface PipelineResult {
  readonly evidence: VisualEvidenceProfile;
  readonly profile: GeneratedVisualProfile;
  readonly diagnostics: PipelineDiagnostics;
}

export interface VisualPipeline {
  run(cell: SpatialCell, retrievedAt: string): Promise<PipelineResult>;
}

/**
 * Visual pipeline (VPS-09, spec 105/109): the offline end-to-end chain
 * collect (OSM + street imagery) -> analyze -> aggregate -> compile ->
 * cache -> serve. Pure composition of the existing layers: no network, no
 * credentials, no wall clock (retrievedAt is injected), and a failing
 * provider degrades the cell (vision-only, OSM-only, or fully parent LVP)
 * instead of breaking OpenGTA (spec 80, 110-111).
 *
 * The caches are value caches keyed by revision (spec 55-57): the pipeline
 * always runs the full chain (that is what the end-to-end tests exercise),
 * and the caches contribute identity and compile avoidance — a recomputed
 * evidence whose revision already has a stored entry reuses the stored
 * object (no shadowing: new revisions coexist, spec 57), and a cached
 * profile is served only when it was compiled from that same evidence
 * revision (a new evidence run recompiles but never reanalyzes, spec 56).
 * The service-level freshness index (cell -> current revision, TTL,
 * persistence, spec 54 levels 2-3) is a VPS-10 concern.
 */
export function createVisualPipeline(deps: VisualPipelineDependencies): VisualPipeline {
  const sampling = deps.samplingOptions ?? DEFAULT_SAMPLING_OPTIONS;

  return {
    async run(cell, retrievedAt): Promise<PipelineResult> {
      let osmStatus: SourceStatus = "ok";
      let imageryStatus: SourceStatus = "ok";
      let requestedSamples = 0;
      let analyzedSamples = 0;

      let osmEvidence: VisualEvidenceProfile | undefined;
      try {
        const features = await deps.osmSource(cell);
        osmEvidence = collectOsmEvidence(features, cell, retrievedAt);
      } catch {
        osmStatus = "failed";
      }

      let samples: readonly StreetSample[] = [];
      try {
        const batch = await deps.imagery.sample(cell, sampling, retrievedAt);
        samples = batch.samples;
        requestedSamples = batch.requested;
      } catch {
        imageryStatus = "failed";
      }

      const observations: VisualObservation[] = [];
      for (const sample of samples) {
        try {
          observations.push(await deps.analyzer.analyze(sample));
        } catch {
          // contract: the analyzer validates its own output and returns the
          // fallback; a throwing analyzer must still not break the pipeline
          observations.push(fallbackObservation(sample));
        }
        analyzedSamples += 1;
      }

      const computed = aggregateEvidence({
        cell,
        osmEvidence,
        observations,
        samples,
        requestedSamples,
        retrievedAt,
      });
      const stored = deps.evidenceCache.get(cell.id, computed.schemaVersion, computed.evidenceRevision);
      const evidenceCacheHit = stored !== undefined;
      const evidence: VisualEvidenceProfile = stored ?? computed;
      if (stored === undefined) {
        deps.evidenceCache.set(computed);
      }

      let profile = deps.profileCache.get(cell.id, evidence.schemaVersion, COMPILER_REVISION, deps.catalog.catalogRevision);
      // A profile is only valid for the evidence revision it was compiled
      // from: a new evidence run must be recompiled (but never reanalyzed).
      if (profile !== undefined && profile.generation.evidenceRevision !== evidence.evidenceRevision) {
        profile = undefined;
      }
      const profileCacheHit = profile !== undefined;

      if (profile === undefined) {
        profile = deps.compiler.compile(evidence, {
          parentProfile: deps.resolveParent(cell),
          catalog: deps.catalog,
          compilerRevision: COMPILER_REVISION,
        });
        deps.profileCache.set(profile);
      }

      return {
        evidence,
        profile,
        diagnostics: {
          osm: osmStatus,
          imagery: imageryStatus,
          requestedSamples,
          analyzedSamples,
          evidenceCacheHit,
          profileCacheHit,
        },
      };
    },
  };
}
