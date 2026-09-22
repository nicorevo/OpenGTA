import { describe, it, expect } from "vitest";
import { validateVisualObservation, fallbackObservation, MAX_ANALYZER_OUTPUT_BYTES } from "./validate.ts";
import type { StreetSample } from "../providers/street-imagery/types.ts";

const SAMPLE: StreetSample = {
  provider: "test-imagery",
  sourceId: "sample-1",
  latitude: 41.8992,
  longitude: 12.4769,
  capturedAt: "2026-01-15T09:00:00Z",
  heading: 90,
  provenance: {
    provider: "test-imagery",
    sourceId: "sample-1",
    capturedAt: "2026-01-15T09:00:00Z",
    retrievedAt: "2026-09-21T00:00:00Z",
  },
};

function validRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sampleId: "sample-1",
    facadeColor: { value: "ochre", confidence: 0.85 },
    facadeMaterial: { value: "plaster", confidence: 0.7 },
    roofType: { value: "terracotta-tile", confidence: 0.8 },
    sidewalkType: { value: "warm-stone", confidence: 0.75 },
    roadSurface: { value: "asphalt", confidence: 0.65 },
    vegetationCharacter: { value: "mediterranean-urban", confidence: 0.72 },
    urbanCharacter: { value: "historic-dense", confidence: 0.8 },
    quality: 0.9,
    ...overrides,
  };
}

describe("validateVisualObservation (VPS-07, spec 20, 21, 30, 78, 103)", () => {
  it("accepts a fully valid payload and keeps every axis", () => {
    const obs = validateVisualObservation(validRaw(), SAMPLE);
    expect(obs.sampleId).toBe("sample-1");
    expect(obs.facadeColor).toEqual({ value: "ochre", confidence: 0.85 });
    expect(obs.roofType).toEqual({ value: "terracotta-tile", confidence: 0.8 });
    expect(obs.vegetationCharacter).toEqual({ value: "mediterranean-urban", confidence: 0.72 });
    expect(obs.quality).toBe(0.9);
    expect(obs.provenance).toEqual(SAMPLE.provenance);
  });

  it("clamps confidences and quality into 0..1 (spec 20: clip external values)", () => {
    const obs = validateVisualObservation(
      validRaw({
        facadeColor: { value: "ochre", confidence: 1.5 },
        roofType: { value: "terracotta-tile", confidence: -0.2 },
        quality: 2,
      }),
      SAMPLE,
    );
    expect(obs.facadeColor?.confidence).toBe(1);
    expect(obs.roofType?.confidence).toBe(0);
    expect(obs.quality).toBe(1);
  });

  it("keeps a partial payload: absent axes stay absent (not observed)", () => {
    const obs = validateVisualObservation(
      { sampleId: "sample-1", roofType: { value: "zinc", confidence: 0.6 }, quality: 0.5 },
      SAMPLE,
    );
    expect(obs.roofType).toEqual({ value: "zinc", confidence: 0.6 });
    expect(obs.facadeColor).toBeUndefined();
    expect(obs.vegetationCharacter).toBeUndefined();
    expect(obs.quality).toBe(0.5);
  });

  it("rejects unknown categories: the model never invents classes (spec 21)", () => {
    const obs = validateVisualObservation(validRaw({ facadeColor: { value: "pink", confidence: 0.9 } }), SAMPLE);
    expect(obs.facadeColor).toBeUndefined();
    expect(obs.quality).toBe(0);
  });

  it("rejects extra fields, including streetFurnitureCharacter which is out of v1 scope (spec 30, 103)", () => {
    const obs = validateVisualObservation(
      validRaw({ streetFurnitureCharacter: { value: "classic-europe", confidence: 0.9 } }),
      SAMPLE,
    );
    expect(obs.streetFurnitureCharacter).toBeUndefined();
    expect(obs.quality).toBe(0);
    expect(obs.facadeColor).toBeUndefined(); // whole payload rejected, no partial acceptance
  });

  it("rejects a sampleId that does not match the sample being analyzed", () => {
    const obs = validateVisualObservation(validRaw({ sampleId: "another-sample" }), SAMPLE);
    expect(obs.sampleId).toBe("sample-1");
    expect(obs.quality).toBe(0);
    expect(obs.facadeColor).toBeUndefined();
  });

  it("rejects non-object payloads outright (spec 78: untrusted data)", () => {
    for (const raw of ["{\"ok\":true}", ["array"], null, 42, undefined]) {
      const obs = validateVisualObservation(raw, SAMPLE);
      expect(obs.quality).toBe(0);
      expect(obs.facadeColor).toBeUndefined();
    }
  });

  it("rejects malformed axis payloads (missing quality, non-numeric confidence, non-object axis)", () => {
    const noQuality = { ...validRaw() };
    delete noQuality.quality;
    expect(validateVisualObservation(noQuality, SAMPLE).quality).toBe(0);
    expect(validateVisualObservation(validRaw({ roofType: { value: "zinc", confidence: "0.8" } }), SAMPLE).quality).toBe(0);
    expect(validateVisualObservation(validRaw({ roofType: "zinc" }), SAMPLE).quality).toBe(0);
    expect(validateVisualObservation(validRaw({ facadeColor: {} }), SAMPLE).quality).toBe(0);
  });

  it("rejects payloads larger than the size limit (spec 78)", () => {
    const hugeSample: StreetSample = {
      ...SAMPLE,
      sourceId: "x".repeat(MAX_ANALYZER_OUTPUT_BYTES),
    };
    const obs = validateVisualObservation(validRaw({ sampleId: hugeSample.sourceId }), hugeSample);
    expect(obs.quality).toBe(0);
  });

  it("fallback observation: no axis, zero quality, sample provenance preserved", () => {
    const obs = fallbackObservation(SAMPLE);
    expect(obs.sampleId).toBe("sample-1");
    expect(obs.quality).toBe(0);
    expect(obs.facadeColor).toBeUndefined();
    expect(obs.facadeMaterial).toBeUndefined();
    expect(obs.roofType).toBeUndefined();
    expect(obs.sidewalkType).toBeUndefined();
    expect(obs.roadSurface).toBeUndefined();
    expect(obs.vegetationCharacter).toBeUndefined();
    expect(obs.urbanCharacter).toBeUndefined();
    expect(obs.streetFurnitureCharacter).toBeUndefined();
    expect(obs.provenance).toEqual(SAMPLE.provenance);
  });

  it("is deterministic: same raw + sample -> identical observation", () => {
    const a = validateVisualObservation(validRaw(), SAMPLE);
    const b = validateVisualObservation(validRaw(), SAMPLE);
    expect(b).toEqual(a);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
