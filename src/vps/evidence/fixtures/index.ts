import type { VisualEvidenceProfile } from "../types.ts";
import { romeLikeEvidence } from "./rome-like.ts";
import { parisLikeEvidence } from "./paris-like.ts";
import { tokyoLikeEvidence } from "./tokyo-like.ts";

/**
 * Closed set of offline evidence fixtures (VPS-01, spec 97/140): the first
 * VPS experiment compiles these with the catalog — no provider, no network,
 * no AI.
 */
export type EvidenceFixtureId = "rome" | "paris" | "tokyo";

export const EVIDENCE_FIXTURES: Readonly<Record<EvidenceFixtureId, VisualEvidenceProfile>> = {
  rome: romeLikeEvidence,
  paris: parisLikeEvidence,
  tokyo: tokyoLikeEvidence,
};

export const EVIDENCE_FIXTURE_IDS: ReadonlySet<EvidenceFixtureId> = new Set(Object.keys(EVIDENCE_FIXTURES) as EvidenceFixtureId[]);
