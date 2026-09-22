import { describe, it, expect } from "vitest";
import { createTestVisualAnalyzer } from "./test-analyzer.ts";
import { OBSERVATION_FIXTURES, romeHistoricObservations } from "./fixtures/observations.ts";
import { validateVisualObservation } from "./validate.ts";
import type { VisualAnalyzer, VisualObservation } from "./types.ts";
import type { StreetSample } from "../providers/street-imagery/types.ts";
import { createTestImageryProvider } from "../providers/street-imagery/test-provider.ts";

const RETRIEVED = "2026-09-21T00:00:00Z";

function sample(id: string): StreetSample {
  return {
    provider: "test-imagery",
    sourceId: id,
    latitude: 41.8992,
    longitude: 12.4769,
    capturedAt: "2026-01-15T09:00:00Z",
    heading: 90,
    provenance: { provider: "test-imagery", sourceId: id, capturedAt: "2026-01-15T09:00:00Z", retrievedAt: RETRIEVED },
  };
}

const VALID_RAW = {
  sampleId: "s-1",
  facadeColor: { value: "ochre", confidence: 0.9 },
  roofType: { value: "terracotta-tile", confidence: 0.8 },
  quality: 0.9,
};

describe("createTestVisualAnalyzer (VPS-07, spec 18, 115)", () => {
  it("returns validated observations for known samples and clamps like the validator", async () => {
    const analyzer: VisualAnalyzer = createTestVisualAnalyzer(
      new Map([["s-1", { ...VALID_RAW, facadeColor: { value: "ochre", confidence: 1.4 } }]]),
    );
    const obs = await analyzer.analyze(sample("s-1"));
    expect(obs.facadeColor?.confidence).toBe(1); // clamped through the real validation path
    expect(obs.roofType).toEqual({ value: "terracotta-tile", confidence: 0.8 });
    expect(obs.provenance).toEqual(sample("s-1").provenance);
  });

  it("falls back (no axes, zero quality) for unknown samples", async () => {
    const analyzer = createTestVisualAnalyzer(new Map([["s-1", VALID_RAW]]));
    const obs = await analyzer.analyze(sample("s-unknown"));
    expect(obs.sampleId).toBe("s-unknown");
    expect(obs.quality).toBe(0);
    expect(obs.facadeColor).toBeUndefined();
  });

  it("routes invalid stored raw through the validator too (no bypass)", async () => {
    const analyzer = createTestVisualAnalyzer(
      new Map([["s-1", { sampleId: "s-1", facadeColor: { value: "pink", confidence: 0.9 }, quality: 0.9 }]]),
    );
    const obs = await analyzer.analyze(sample("s-1"));
    expect(obs.quality).toBe(0);
    expect(obs.facadeColor).toBeUndefined();
  });

  it("supports the output-function form and is deterministic", async () => {
    const analyzer = createTestVisualAnalyzer(undefined, (s) =>
      s.sourceId === "s-1" ? { ...VALID_RAW, sampleId: "s-1" } : undefined,
    );
    const a = await analyzer.analyze(sample("s-1"));
    const b = await analyzer.analyze(sample("s-1"));
    expect(b).toEqual(a);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.facadeColor?.value).toBe("ochre");
    expect((await analyzer.analyze(sample("s-2"))).quality).toBe(0);
  });
});

describe("observation fixtures (VPS-07, spec 115)", () => {
  it("every fixture observation passes the strict validator", () => {
    for (const [cellId, observations] of Object.entries(OBSERVATION_FIXTURES)) {
      expect(observations.length).toBeGreaterThan(0);
      for (const obs of observations) {
        const rebuilt = validateVisualObservation(
          {
            sampleId: obs.sampleId,
            ...(obs.facadeColor ? { facadeColor: obs.facadeColor } : {}),
            ...(obs.facadeMaterial ? { facadeMaterial: obs.facadeMaterial } : {}),
            ...(obs.roofType ? { roofType: obs.roofType } : {}),
            ...(obs.sidewalkType ? { sidewalkType: obs.sidewalkType } : {}),
            ...(obs.roadSurface ? { roadSurface: obs.roadSurface } : {}),
            ...(obs.vegetationCharacter ? { vegetationCharacter: obs.vegetationCharacter } : {}),
            ...(obs.urbanCharacter ? { urbanCharacter: obs.urbanCharacter } : {}),
            quality: obs.quality,
          },
          sample(obs.sampleId),
        );
        expect(rebuilt.quality, `cell ${cellId} / ${obs.sampleId}`).toBe(obs.quality);
        expect(rebuilt.facadeColor?.value, obs.sampleId).toBe(obs.facadeColor?.value);
        expect(rebuilt.urbanCharacter?.value, obs.sampleId).toBe(obs.urbanCharacter?.value);
      }
    }
  });

  it("dominants are coherent with the VPS-01 evidence fixtures", () => {
    const dominant = (obs: VisualObservation, key: keyof VisualObservation): string | undefined =>
      (obs[key] as { value: string } | undefined)?.value;
    expect(romeHistoricObservations.every((o) => dominant(o, "facadeColor") === "ochre" || dominant(o, "facadeColor") === "cream")).toBe(true);
    expect(romeHistoricObservations.every((o) => dominant(o, "roofType") === "terracotta-tile")).toBe(true);
    expect(romeHistoricObservations.every((o) => dominant(o, "urbanCharacter") === "historic-dense")).toBe(true);

    const paris = OBSERVATION_FIXTURES["vps-fixture-paris-central"]!;
    expect(paris.every((o) => dominant(o, "roofType") === "zinc")).toBe(true);
    expect(paris.every((o) => dominant(o, "urbanCharacter") === "historic-medium")).toBe(true);

    const tokyo = OBSERVATION_FIXTURES["vps-fixture-tokyo-dense"]!;
    expect(tokyo.every((o) => dominant(o, "urbanCharacter") === "modern-dense")).toBe(true);
  });

  it("all confidences and qualities are in 0..1 and within the closed vocabularies", () => {
    const all = Object.values(OBSERVATION_FIXTURES).flat();
    for (const obs of all) {
      expect(obs.quality).toBeGreaterThan(0);
      expect(obs.quality).toBeLessThanOrEqual(1);
      for (const key of ["facadeColor", "facadeMaterial", "roofType", "sidewalkType", "roadSurface", "vegetationCharacter", "urbanCharacter"] as const) {
        const result = obs[key];
        if (result === undefined) continue;
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
        expect(typeof result.value).toBe("string");
      }
      expect(obs.provenance.retrievedAt).toBe(RETRIEVED);
      expect(obs.provenance.sourceId).toBe(obs.sampleId);
    }
  });
});

describe("pipeline wiring (VPS-06 provider -> VPS-07 analyzer)", () => {
  it("test provider samples feed the test analyzer with the provenance chain intact", async () => {
    const raw = new Map<string, unknown>([
      ["probe-1", { sampleId: "probe-1", roofType: { value: "terracotta-tile", confidence: 0.9 }, quality: 0.85 }],
    ]);
    const provider = createTestImageryProvider([
      {
        provider: "custom",
        sourceId: "probe-1",
        latitude: 41.8992,
        longitude: 12.4769,
        capturedAt: "2026-03-01T00:00:00Z",
        heading: 0,
        provenance: { provider: "custom", sourceId: "probe-1", retrievedAt: RETRIEVED },
      },
    ]);
    const batch = await provider.sample(
      { id: "h3:891e8050527ffff", center: { latitude: 41.8992, longitude: 12.4769 }, bounds: { south: 41.89, west: 12.46, north: 41.91, east: 12.5 } },
      { radiusMeters: 400, maxSamples: 5 },
      RETRIEVED,
    );
    expect(batch.samples).toHaveLength(1);
    const analyzer = createTestVisualAnalyzer(raw);
    const obs = await analyzer.analyze(batch.samples[0]!);
    expect(obs.sampleId).toBe("probe-1");
    expect(obs.roofType?.value).toBe("terracotta-tile");
    expect(obs.provenance.sourceId).toBe("probe-1");
    expect(obs.provenance.retrievedAt).toBe(RETRIEVED);
    expect(obs.quality).toBe(0.85);
  });
});
