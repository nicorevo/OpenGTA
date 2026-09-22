import { Buffer } from "node:buffer";
import { describe, it, expect } from "vitest";
import { createDeepSeekAnalyzer, PEAK_PRICE_PER_MTOKEN, MAX_IMAGE_BYTES } from "./deepseek-analyzer.ts";
import type { StreetSample } from "../../src/vps/providers/street-imagery/types.ts";
import type { RateLimiter } from "../rate-limit.ts";

function makeSample(overrides: Partial<StreetSample> = {}): StreetSample {
  return {
    provider: "mapillary",
    sourceId: "img-1",
    latitude: 41.8992,
    longitude: 12.4769,
    capturedAt: "2023-05-01T10:00:00.000Z",
    heading: 90,
    imageUrl: "https://d1v4zhj629m55e.cloudfront.net/vpp/xyz/img.jpg",
    provenance: {
      provider: "mapillary",
      sourceId: "img-1",
      sourceUrl: "https://d1v4zhj629m55e.cloudfront.net/vpp/xyz/img.jpg",
      capturedAt: "2023-05-01T10:00:00.000Z",
      retrievedAt: "2026-09-22T00:00:00.000Z",
    },
    ...overrides,
  };
}

interface RecordedCall {
  readonly url: string;
  readonly init: RequestInit;
}

type ModelResponse = { status?: number; json?: unknown } | ((call: number) => { status?: number; json?: unknown });

interface FakeOverrides {
  /** Image download response (any non /chat/completions URL). */
  imageStatus?: number;
  imageBody?: Uint8Array;
  imageContentType?: string;
  /** Model call response; counter is over MODEL calls only. */
  model?: ModelResponse;
}

const FAKE_JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x42]);
const FAKE_JPEG_B64 = Buffer.from(FAKE_JPEG).toString("base64");

/**
 * Fake fetch dispatching by URL: the image download (any non-chat URL) and
 * the model call (/chat/completions) share one injectable, as in production.
 */
function makeFetch(overrides: FakeOverrides = {}, calls: RecordedCall[] = []) {
  let imageServed = 0;
  let modelCalls = 0;
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init: init ?? {} });
    if (url.includes("/chat/completions")) {
      modelCalls += 1;
      const spec = typeof overrides.model === "function" ? overrides.model(modelCalls) : (overrides.model ?? { json: {} });
      return new Response(JSON.stringify(spec.json ?? {}), { status: spec.status ?? 200 });
    }
    imageServed += 1;
    if (overrides.imageStatus) return new Response("image error", { status: overrides.imageStatus });
    return new Response((overrides.imageBody ?? FAKE_JPEG).buffer as ArrayBuffer, {
      status: 200,
      headers: { "content-type": overrides.imageContentType ?? "image/jpeg" },
    });
  }) as unknown as typeof fetch;
  return { impl, imageServed: () => imageServed, modelCalls: () => modelCalls };
}

function modelEnvelope(content: string, usage?: { prompt_tokens: number; completion_tokens: number }) {
  return { choices: [{ message: { content } }], ...(usage ? { usage } : {}) };
}

const VALID_CONTENT = JSON.stringify({
  sampleId: "img-1",
  quality: 0.8,
  roadSurface: { value: "cobblestone", confidence: 0.9 },
  urbanCharacter: { value: "historic-dense", confidence: 0.7 },
});

function options(overrides: Record<string, unknown> = {}) {
  return { apiKey: "sk-test", fetchImpl: makeFetch({}).impl, ...overrides };
}

describe("createDeepSeekAnalyzer (VPS-11, spec 18-21/30/78/106-107: server-side vision behind VisualAnalyzer)", () => {
  it("downloads the thumbnail here and sends it as a base64 data URL (DeepSeek egress cannot reach the Mapillary CDN)", async () => {
    const calls: RecordedCall[] = [];
    const fake = makeFetch({ model: { json: modelEnvelope(VALID_CONTENT) } }, calls);
    const analyzer = createDeepSeekAnalyzer(options({ fetchImpl: fake.impl }));
    await analyzer.analyze(makeSample());

    expect(fake.imageServed()).toBe(1);
    expect(fake.modelCalls()).toBe(1);
    const chatCall = calls.find((c) => c.url.includes("/chat/completions"))!;
    const init = chatCall.init as RequestInit & { body: string };
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["authorization"]).toBe("Bearer sk-test");
    expect(headers["content-type"]).toBe("application/json");

    const body = JSON.parse(init.body) as {
      model: string;
      thinking: { type: string };
      temperature: number;
      response_format: { type: string };
      messages: Array<{ role: string; content: unknown }>;
    };
    expect(body.model).toBe("deepseek-flash");
    // thinking is ON by default and silently burns the completion budget (live-verified); disable it
    expect(body.thinking).toEqual({ type: "disabled" });
    expect(body.temperature).toBe(0);
    expect(body.response_format).toEqual({ type: "json_object" });

    const system = body.messages[0].content as string;
    // the prompt must expose the same closed vocabularies the validator enforces (no drift, spec 21)
    for (const value of ["terracotta-tile", "cobblestone", "mediterranean-urban", "historic-dense", "light-stone", "zinc"]) {
      expect(system).toContain(value);
    }
    expect(system).toContain("img-1");

    const user = body.messages[1].content as Array<{ type: string; text?: string; image_url?: { url: string; detail: string } }>;
    const textBlock = user.find((b) => b.type === "text");
    const imageBlock = user.find((b) => b.type === "image_url");
    expect(textBlock?.text).toContain("img-1");
    expect(imageBlock?.image_url?.url).toBe(`data:image/jpeg;base64,${FAKE_JPEG_B64}`);
    expect(imageBlock?.image_url?.detail).toBe("low");
  });

  it("returns a validated observation from valid model JSON (clamped confidences, sample provenance)", async () => {
    const content = JSON.stringify({
      sampleId: "img-1",
      quality: 0.4,
      roadSurface: { value: "cobblestone", confidence: 1.5 }, // clamped to 1
      facadeColor: { value: "ochre", confidence: -0.2 }, // clamped to 0
    });
    const fake = makeFetch({ model: { json: modelEnvelope(content) } });
    const analyzer = createDeepSeekAnalyzer(options({ fetchImpl: fake.impl }));
    const sample = makeSample();
    const observation = await analyzer.analyze(sample);

    expect(observation.sampleId).toBe("img-1");
    expect(observation.quality).toBe(0.4);
    expect(observation.roadSurface).toEqual({ value: "cobblestone", confidence: 1 });
    expect(observation.facadeColor).toEqual({ value: "ochre", confidence: 0 });
    expect(observation.provenance).toBe(sample.provenance);
    expect(observation.sidewalkType).toBeUndefined(); // absent axis = not observed
    expect(analyzer.stats.analyzed).toBe(1);
  });

  it("memoizes downloaded images: the same URL is fetched once across samples", async () => {
    const fake = makeFetch({ model: { json: modelEnvelope(VALID_CONTENT) } });
    const analyzer = createDeepSeekAnalyzer(options({ fetchImpl: fake.impl }));
    await analyzer.analyze(makeSample({ sourceId: "img-1" }));
    await analyzer.analyze(makeSample({ sourceId: "img-2" })); // same imageUrl
    expect(fake.imageServed()).toBe(1);
    expect(fake.modelCalls()).toBe(2);
  });

  it("falls back (quality 0, no axes) on non-JSON model output — a bad answer never throws", async () => {
    const fake = makeFetch({ model: { json: modelEnvelope("sure, here is the scene...") } });
    const analyzer = createDeepSeekAnalyzer(options({ fetchImpl: fake.impl }));
    const sample = makeSample();
    const observation = await analyzer.analyze(sample);
    expect(observation.quality).toBe(0);
    expect(observation.sampleId).toBe("img-1");
    expect(observation.provenance).toBe(sample.provenance);
    expect(observation.roadSurface).toBeUndefined();
    expect(analyzer.stats.fallbacks).toBe(1);
  });

  it("falls back on out-of-vocabulary values (spec 21: never accept invented categories)", async () => {
    const content = JSON.stringify({ sampleId: "img-1", quality: 0.9, roadSurface: { value: "plaid", confidence: 0.9 } });
    const fake = makeFetch({ model: { json: modelEnvelope(content) } });
    const analyzer = createDeepSeekAnalyzer(options({ fetchImpl: fake.impl }));
    const observation = await analyzer.analyze(makeSample());
    expect(observation.quality).toBe(0);
    expect(analyzer.stats.fallbacks).toBe(1);
  });

  it("falls back on extra top-level fields and on sampleId mismatch (spec 30: closed schema)", async () => {
    const extra = JSON.stringify({ sampleId: "img-1", quality: 0.5, nonsense: true });
    const mismatch = JSON.stringify({ sampleId: "other", quality: 0.5 });
    const model: ModelResponse = (call: number) => ({ json: modelEnvelope(call === 1 ? extra : mismatch) });
    const fake = makeFetch({ model });
    const analyzer = createDeepSeekAnalyzer(options({ fetchImpl: fake.impl }));
    expect((await analyzer.analyze(makeSample())).quality).toBe(0);
    expect((await analyzer.analyze(makeSample())).quality).toBe(0);
    expect(analyzer.stats.fallbacks).toBe(2);
  });

  it("returns the fallback without any network call when the sample has no image", async () => {
    const calls: RecordedCall[] = [];
    const fake = makeFetch({}, calls);
    const analyzer = createDeepSeekAnalyzer(options({ fetchImpl: fake.impl }));
    const observation = await analyzer.analyze(makeSample({ imageUrl: undefined }));
    expect(observation.quality).toBe(0);
    expect(calls).toHaveLength(0);
    expect(analyzer.stats.fallbacks).toBe(1);
  });

  it("throws on a failed image download (404) before counting a request — transient, the cell degrades (spec 80)", async () => {
    const fake = makeFetch({ imageStatus: 404, model: { json: modelEnvelope(VALID_CONTENT) } });
    const analyzer = createDeepSeekAnalyzer(options({ fetchImpl: fake.impl }));
    await expect(analyzer.analyze(makeSample())).rejects.toThrow(/image download responded 404/);
    expect(analyzer.stats.requests).toBe(0);
    expect(fake.modelCalls()).toBe(0);
  });

  it("throws when the image URL serves something that is not an image", async () => {
    const fake = makeFetch({ imageContentType: "text/html", model: { json: modelEnvelope(VALID_CONTENT) } });
    const analyzer = createDeepSeekAnalyzer(options({ fetchImpl: fake.impl }));
    await expect(analyzer.analyze(makeSample())).rejects.toThrow(/not an image/);
  });

  it("throws when the image exceeds the byte cap (never an unbounded base64 request)", async () => {
    const oversize = new Uint8Array(MAX_IMAGE_BYTES + 1);
    const fake = makeFetch({ imageBody: oversize, model: { json: modelEnvelope(VALID_CONTENT) } });
    const analyzer = createDeepSeekAnalyzer(options({ fetchImpl: fake.impl }));
    await expect(analyzer.analyze(makeSample())).rejects.toThrow(/byte cap/);
  });

  it("throws on 429 and 500 so the pipeline degrades the cell (spec 80)", async () => {
    const limited = makeFetch({ model: { status: 429, json: { error: { code: 429 } } } });
    const limitedAnalyzer = createDeepSeekAnalyzer(options({ fetchImpl: limited.impl }));
    await expect(limitedAnalyzer.analyze(makeSample())).rejects.toThrow(/429/);
    const down = makeFetch({ model: { status: 500 } });
    const downAnalyzer = createDeepSeekAnalyzer(options({ fetchImpl: down.impl }));
    await expect(downAnalyzer.analyze(makeSample())).rejects.toThrow(/500/);
    expect(limitedAnalyzer.stats.requests).toBe(1);
  });

  it("throws on a malformed 200 envelope (no choices/message/content)", async () => {
    for (const json of [{ choices: [] }, { choices: [{ message: {} }] }, "not-an-object", { error: "boom" }]) {
      const fake = makeFetch({ model: { json } });
      const analyzer = createDeepSeekAnalyzer(options({ fetchImpl: fake.impl }));
      await expect(analyzer.analyze(makeSample())).rejects.toThrow(/malformed envelope/);
    }
  });

  it("awaits the injected rate limiter before every request", async () => {
    let acquired = 0;
    const limiter: RateLimiter = { acquire: async () => { acquired += 1; } };
    const calls: RecordedCall[] = [];
    const fake = makeFetch({ model: { json: modelEnvelope(VALID_CONTENT) } }, calls);
    const analyzer = createDeepSeekAnalyzer(options({ rateLimiter: limiter, fetchImpl: fake.impl }));
    await analyzer.analyze(makeSample());
    await analyzer.analyze(makeSample());
    expect(acquired).toBe(2);
    expect(calls.filter((c) => c.url.includes("/chat/completions"))).toHaveLength(2);
  });

  it("tracks stats: requests, tokens, duration and a peak-rate cost estimate (spec 107)", async () => {
    const usage = { prompt_tokens: 1024, completion_tokens: 100 };
    const fake = makeFetch({ model: { json: modelEnvelope(VALID_CONTENT, usage) } });
    const analyzer = createDeepSeekAnalyzer(options({ fetchImpl: fake.impl }));
    await analyzer.analyze(makeSample());
    expect(analyzer.stats.requests).toBe(1);
    expect(analyzer.stats.analyzed).toBe(1);
    expect(analyzer.stats.fallbacks).toBe(0);
    expect(analyzer.stats.totalMs).toBeGreaterThanOrEqual(0);
    expect(analyzer.stats.promptTokens).toBe(1024);
    expect(analyzer.stats.completionTokens).toBe(100);
    const expectedCost = (1024 * PEAK_PRICE_PER_MTOKEN.input + 100 * PEAK_PRICE_PER_MTOKEN.output) / 1_000_000;
    expect(analyzer.stats.estimatedCostUsd).toBeCloseTo(expectedCost, 10);
  });

  it("honors custom baseUrl and model", async () => {
    const calls: RecordedCall[] = [];
    const fake = makeFetch({ model: { json: modelEnvelope(VALID_CONTENT) } }, calls);
    const analyzer = createDeepSeekAnalyzer(
      options({ baseUrl: "https://example.test/", model: "deepseek-flash-x", fetchImpl: fake.impl }),
    );
    await analyzer.analyze(makeSample());
    const chatCall = calls.find((c) => c.url.includes("/chat/completions"))!;
    expect(chatCall.url).toBe("https://example.test/chat/completions");
    expect(JSON.parse((chatCall.init as RequestInit & { body: string }).body).model).toBe("deepseek-flash-x");
  });
});
