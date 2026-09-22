import type { StreetSample } from "../providers/street-imagery/types.ts";
import type { VisualAnalyzer, VisualObservation } from "./types.ts";
import { validateVisualObservation } from "./validate.ts";

export type RawAnalyzerOutput = unknown;

/**
 * Deterministic offline analyzer (spec 5 names test providers; this is the
 * analyzer-side equivalent, and spec 115 requires VisualObservation[] fixtures
 * so the compiler/aggregator stay testable offline).
 *
 * The raw output per sample is stored UNVALIDATED on purpose: it goes through
 * the same strict validator (spec 30/78) as a real model response, so the
 * offline pipeline exercises the exact validation path a live model hits.
 *
 * Resolution order for a sample:
 *   1. explicit map entry by sampleId (raw, possibly invalid);
 *   2. the output function, if provided;
 *   3. no raw at all -> fallback observation.
 */
export function createTestVisualAnalyzer(
  rawBySampleId?: ReadonlyMap<string, RawAnalyzerOutput>,
  outputFor?: (sample: StreetSample) => RawAnalyzerOutput,
): VisualAnalyzer {
  return {
    async analyze(sample: StreetSample): Promise<VisualObservation> {
      let raw: RawAnalyzerOutput;
      if (rawBySampleId?.has(sample.sourceId)) {
        raw = rawBySampleId.get(sample.sourceId);
      } else if (outputFor !== undefined) {
        raw = outputFor(sample);
      } else {
        raw = undefined;
      }
      return validateVisualObservation(raw, sample);
    },
  };
}
