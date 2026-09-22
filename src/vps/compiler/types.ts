import type { ThemeColor, VisualProfile } from "../../render/theme/types.ts";
import type { VisualCatalog } from "../catalog/types.ts";

/**
 * ProfileCompiler contracts (spec 44-45, 52-53, 116, 117).
 *
 * The compiler sees only structured evidence + catalog + parent. No images,
 * no providers, no network, no timestamps: with equal evidence/compiler/
 * catalog revisions the output is identical (ADR-015).
 */
export interface ProfileCompilationContext {
  readonly countryCode?: string;
  readonly region?: string;
  readonly locality?: string;

  /** LVP-resolved fallback profile; low-confidence categories keep its values. */
  readonly parentProfile: VisualProfile;

  readonly catalog: VisualCatalog;
  readonly compilerRevision: number;
}

export interface GeneratedVisualProfile extends VisualProfile {
  readonly generation: {
    readonly source: "generated";
    readonly cellId: string;
    /**
     * Set by the service at cache-write time (wall clock belongs to SERVE,
     * not to the pure compiler). The offline dev hook uses the evidence
     * `retrievedAt` so output stays deterministic.
     */
    readonly generatedAt: string;
    readonly evidenceRevision: string;
    readonly compilerRevision: number;
    readonly catalogRevision: number;
    /** Overall confidence 0..1 across the categories the profile generated. */
    readonly confidence: number;
  };
}

export interface ProfileCompiler {
  compile(
    evidence: import("../evidence/types.ts").VisualEvidenceProfile,
    context: ProfileCompilationContext,
  ): GeneratedVisualProfile;
}

export type { ThemeColor };
