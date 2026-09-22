/**
 * DeepSeek vision analyzer (VPS-11, spec 18-21/30/78/106-107/82-83).
 *
 * Implements the pure VisualAnalyzer contract (src/vps/analysis/types.ts) on
 * top of the DeepSeek OpenAI-compatible API (deepseek-flash, the only
 * vision-capable model on that platform).
 *
 * Two live-verified quirks shape this design (2026-09-22 smoke, documented):
 *  - the model's CDN cannot download Mapillary CloudFront URLs server-side,
 *    so the image is fetched HERE (service layer, spec 82-83), with a size
 *    and content-type guard, and sent as a base64 data URL. The memo keeps
 *    shared images (same street crossing two cells) out of repeated fetches;
 *    nothing is persisted to disk (spec 17: no license assumption encoded).
 *  - deepseek-flash defaults to thinking mode, which silently burns the
 *    completion budget (empty `content`), so thinking is explicitly disabled
 *    and temperature applies.
 *
 * The raw model output ALWAYS goes through the same strict validator
 * (spec 30/78) as the offline test analyzer: a bad answer (non-JSON,
 * out-of-vocabulary value, extra field, sampleId mismatch) degrades to the
 * fallback observation (quality 0) and never throws. Service-level failures
 * (network, non-2xx, bad image, malformed envelope) DO throw: the pipeline
 * (VPS-09) catches per sample and degrades the cell (spec 80) — a dead model
 * must look like "no vision", never like "wrong vision".
 *
 * The model prompt enumerates the same closed vocabularies the validator
 * enforces (imported, not copied — no drift, spec 21).
 */
import { Buffer } from "node:buffer";
import type { VisualAnalyzer, VisualObservation } from "../../src/vps/analysis/types.ts";
import { AXIS_VOCABULARIES, fallbackObservation, validateVisualObservation } from "../../src/vps/analysis/validate.ts";
import type { StreetSample } from "../../src/vps/providers/street-imagery/types.ts";
import { createTokenBucket } from "../rate-limit.ts";
import type { RateLimiter } from "../rate-limit.ts";

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-flash";

/** Peak rates in USD per 1M tokens (cache miss) — api-docs.deepseek.com, 2026-09-22. A conservative upper bound for estimates (spec 107). */
export const PEAK_PRICE_PER_MTOKEN = { input: 0.3, output: 1.2 } as const;

/** Hard cap for one downloaded street thumbnail (base64-inflated request must stay far under the 48 MiB body limit). */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
/** Image download timeout: a dead CDN must not stall the cell. */
const IMAGE_TIMEOUT_MS = 30_000;
/** In-memory memo bound (data URLs are ~1 MiB each); cleared when exceeded. */
const MEMO_MAX_ENTRIES = 24;

/** Per-analyzer-instance measurement (spec 107: requests, images, duration, cost). */
export interface VisionStats {
  requests: number;
  /** Observations that passed the strict validator. */
  analyzed: number;
  /** Fallback observations (bad model answer or missing image). */
  fallbacks: number;
  totalMs: number;
  promptTokens: number;
  completionTokens: number;
  /** Prompt+completion tokens at peak price (USD); recomputed after each usage report. */
  estimatedCostUsd: number;
}

export interface DeepSeekVisualAnalyzer extends VisualAnalyzer {
  readonly stats: VisionStats;
}

export interface DeepSeekAnalyzerOptions {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly model?: string;
  /** "low" downscales to 512x512 — enough for material/color classes, fewer tokens. */
  readonly detail?: "low" | "original";
  readonly maxTokens?: number;
  /** Injectable fetch (tests); used for BOTH the image download and the model call. */
  readonly fetchImpl?: typeof fetch;
  /** Shared across cells: the bucket must outlive a single request (spec 107 cost control). */
  readonly rateLimiter?: RateLimiter;
  /** Shared across generations (server owns it): imageUrl -> base64 data URL. */
  readonly imageMemo?: Map<string, string>;
}

function systemPrompt(sampleId: string): string {
  const axes = Object.entries(AXIS_VOCABULARIES)
    .map(([axis, values]) => `  - ${axis}: ${values.join(" | ")}`)
    .join("\n");
  return [
    "You are a strict computer-vision classifier for a city visual-profile compiler.",
    "Classify the street-level photograph using ONLY the closed axes below.",
    'Respond with ONLY one JSON object — no prose, no markdown, no code fences.',
    "Schema:",
    "{",
    `  "sampleId": "${sampleId}", // echo this exactly`,
    '  "quality": <number 0..1, your overall confidence in this observation>,',
    '  // include ONLY the axes you can clearly see; each one is {"value": <allowed value>, "confidence": <number 0..1>}',
    "}",
    "Allowed axes and values (closed lists, never invent another):",
    axes,
    'Rules: omit an axis you cannot observe; use "mixed" when the scene clearly combines values; use "unknown" only when an axis is visible but genuinely ambiguous; report honest confidences (a guess is not a classification).',
  ].join("\n");
}

function extractContent(data: unknown): string | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const choices = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return undefined;
  const first: unknown = choices[0];
  if (typeof first !== "object" || first === null) return undefined;
  const message: unknown = (first as { message?: unknown }).message;
  if (typeof message !== "object" || message === null) return undefined;
  const content: unknown = (message as { content?: unknown }).content;
  return typeof content === "string" ? content : undefined;
}

function hasAnyAxis(observation: VisualObservation): boolean {
  return (
    observation.facadeColor !== undefined ||
    observation.facadeMaterial !== undefined ||
    observation.roofType !== undefined ||
    observation.sidewalkType !== undefined ||
    observation.roadSurface !== undefined ||
    observation.vegetationCharacter !== undefined ||
    observation.urbanCharacter !== undefined ||
    observation.streetFurnitureCharacter !== undefined
  );
}

/** Download one street thumbnail and turn it into a base64 data URL (guarded). */
async function toDataUrl(
  imageUrl: string,
  doFetch: typeof fetch,
  memo: Map<string, string>,
): Promise<string> {
  const cached = memo.get(imageUrl);
  if (cached !== undefined) return cached;
  let response: Response;
  try {
    response = await doFetch(imageUrl, { signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS) });
  } catch (error) {
    throw new Error(`image download failed for ${imageUrl}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!response.ok) {
    throw new Error(`image download responded ${response.status} for ${imageUrl}`);
  }
  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.startsWith("image/")) {
    throw new Error(`image URL is not an image (content-type: ${contentType || "unknown"}): ${imageUrl}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(`image exceeds the ${MAX_IMAGE_BYTES} byte cap: ${imageUrl}`);
  }
  const dataUrl = `data:${contentType.split(";")[0]};base64,${bytes.toString("base64")}`;
  if (memo.size >= MEMO_MAX_ENTRIES) memo.clear();
  memo.set(imageUrl, dataUrl);
  return dataUrl;
}

export function createDeepSeekAnalyzer(options: DeepSeekAnalyzerOptions): DeepSeekVisualAnalyzer {
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const model = options.model ?? DEFAULT_MODEL;
  const detail = options.detail ?? "low";
  const maxTokens = options.maxTokens ?? 512;
  const doFetch = options.fetchImpl ?? fetch;
  const limiter = options.rateLimiter ?? createTokenBucket({ perMinute: 60 });
  const imageMemo = options.imageMemo ?? new Map<string, string>();

  const stats: VisionStats = {
    requests: 0,
    analyzed: 0,
    fallbacks: 0,
    totalMs: 0,
    promptTokens: 0,
    completionTokens: 0,
    estimatedCostUsd: 0,
  };

  function addUsage(data: unknown): void {
    const usage = (typeof data === "object" && data !== null ? (data as { usage?: unknown }).usage : undefined) as
      | { prompt_tokens?: unknown; completion_tokens?: unknown }
      | undefined;
    if (usage !== undefined) {
      if (typeof usage.prompt_tokens === "number") stats.promptTokens += usage.prompt_tokens;
      if (typeof usage.completion_tokens === "number") stats.completionTokens += usage.completion_tokens;
    }
    stats.estimatedCostUsd =
      (stats.promptTokens * PEAK_PRICE_PER_MTOKEN.input + stats.completionTokens * PEAK_PRICE_PER_MTOKEN.output) / 1_000_000;
  }

  return {
    stats,
    async analyze(sample: StreetSample): Promise<VisualObservation> {
      if (!sample.imageUrl) {
        stats.fallbacks += 1;
        return fallbackObservation(sample);
      }
      await limiter.acquire();
      // The image must be downloadable by US, not by the model provider:
      // DeepSeek's egress cannot reach the Mapillary CDN (verified 2026-09-22).
      const imageUrl = await toDataUrl(sample.imageUrl, doFetch, imageMemo);
      stats.requests += 1;
      const started = Date.now();
      let response: Response;
      try {
        response = await doFetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: { authorization: `Bearer ${options.apiKey}`, "content-type": "application/json" },
          body: JSON.stringify({
            model,
            // Thinking is ON by default and silently burns the completion budget
            // (empty content); with it disabled, temperature applies.
            thinking: { type: "disabled" },
            temperature: 0,
            max_tokens: maxTokens,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemPrompt(sample.sourceId) },
              {
                role: "user",
                content: [
                  { type: "text", text: `sampleId: ${sample.sourceId}. Classify this street-level photograph.` },
                  { type: "image_url", image_url: { url: imageUrl, detail } },
                ],
              },
            ],
          }),
        });
      } catch (error) {
        throw new Error(`deepseek request failed: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        stats.totalMs += Date.now() - started;
      }
      if (!response.ok) {
        throw new Error(`deepseek responded ${response.status}${response.status === 429 ? " (rate limited)" : ""}`);
      }
      let data: unknown;
      try {
        data = await response.json();
      } catch {
        throw new Error("deepseek returned a non-JSON body");
      }
      const content = extractContent(data);
      if (content === undefined) {
        throw new Error("deepseek returned a malformed envelope (no choices[0].message.content)");
      }
      addUsage(data);
      let raw: unknown;
      try {
        raw = JSON.parse(content);
      } catch {
        stats.fallbacks += 1;
        return fallbackObservation(sample);
      }
      const observation = validateVisualObservation(raw, sample);
      if (observation.quality === 0 && !hasAnyAxis(observation)) {
        stats.fallbacks += 1;
      } else {
        stats.analyzed += 1;
      }
      return observation;
    },
  };
}
