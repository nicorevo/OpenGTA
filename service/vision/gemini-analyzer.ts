/**
 * Gemini vision analyzer (VPS-11, spec 18-21/30/78/106-107/82-83).
 *
 * Implements the pure VisualAnalyzer contract (src/vps/analysis/types.ts) on
 * top of the Google Gemini API (gemini-3.6-flash by default: fast,
 * vision-capable, generous limits on a Google One AI Pro subscription).
 * Replaces the DeepSeek analyzer (2026-09-23): same contract, same
 * validator, same degrade-to-LVP guarantees — only the wire format changed.
 *
 * Two live-verified quirks shape this design (2026-09-22 smoke, documented):
 *  - the service must not assume the model provider's egress can download
 *    Mapillary CloudFront URLs, so the image is fetched HERE (service layer,
 *    spec 82-83), with a size and content-type guard, and sent inline
 *    (inlineData, raw base64 + mime type). The memo keeps shared images
 *    (same street crossing two cells) out of repeated fetches; nothing is
 *    persisted to disk (spec 17: no license assumption encoded).
 *  - 2.5/3.x Gemini models think by default, which silently burns the
 *    completion budget (and adds latency), so thinking is explicitly
 *    disabled (thinkingBudget 0) and temperature applies.
 *  - free-tier keys carry per-minute AND per-day request quotas (the 429
 *    body names the exact quota and a retry delay), so a 429 is retried a
 *    bounded number of times honoring the Retry-After header before the
 *    sample degrades like any other service failure.
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

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODEL = "gemini-3.6-flash";

/** Peak rates in USD per 1M tokens (non-cached, <200K context) — ai.google.dev/gemini-api/docs/pricing, 2026-09-23, flash tier. A conservative upper bound for estimates (spec 107). */
export const PEAK_PRICE_PER_MTOKEN = { input: 0.3, output: 2.5 } as const;

/** Hard cap for one downloaded street thumbnail (base64-inflated request must stay far under provider body limits). */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
/** Image download timeout: a dead CDN must not stall the cell. */
const IMAGE_TIMEOUT_MS = 30_000;
/** In-memory memo bound (base64 thumbs are ~1 MiB each); cleared when exceeded. */
const MEMO_MAX_ENTRIES = 24;
/** Default 429 backoff when the response carries no usable Retry-After (ms per retry). */
const RETRY_BACKOFF_MS = [5_000, 15_000] as const;
/** A provider-requested retry delay beyond this is treated as "quota is far away": give up. */
const MAX_RETRY_DELAY_MS = 60_000;

/** Per-analyzer-instance measurement (spec 107: requests, images, duration, cost). */
export interface VisionStats {
  requests: number;
  /** Observations that passed the strict validator. */
  analyzed: number;
  /** Fallback observations (bad model answer or missing image). */
  fallbacks: number;
  /** Service-level failures (image download, network, non-2xx, non-JSON body, malformed envelope): these samples end up as pipeline fallbacks but the model never answered. */
  errors: number;
  totalMs: number;
  promptTokens: number;
  completionTokens: number;
  /** Prompt+completion tokens at peak price (USD); recomputed after each usage report. */
  estimatedCostUsd: number;
}

export interface GeminiVisualAnalyzer extends VisualAnalyzer {
  readonly stats: VisionStats;
}

export interface GeminiAnalyzerOptions {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly model?: string;
  readonly maxTokens?: number;
  /** Retries on 429 (rate limit) before degrading the sample; other failures never retry. */
  readonly maxRetries?: number;
  /** Injectable fetch (tests); used for BOTH the image download and the model call. */
  readonly fetchImpl?: typeof fetch;
  /** Injectable sleep (tests); default is setTimeout. */
  readonly sleepImpl?: (ms: number) => Promise<void>;
  /** Shared across cells: the bucket must outlive a single request (spec 107 cost control). */
  readonly rateLimiter?: RateLimiter;
  /** Shared across generations (server owns it): imageUrl -> downloaded image. */
  readonly imageMemo?: Map<string, DownloadedImage>;
}

/** A downloaded thumbnail, ready for Gemini's inlineData (raw base64, no data: prefix). */
export interface DownloadedImage {
  readonly mimeType: string;
  readonly base64: string;
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

/** Joins the text parts of the first candidate (the model may split long answers). */
function extractContent(data: unknown): string | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const candidates = (data as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return undefined;
  const first: unknown = candidates[0];
  if (typeof first !== "object" || first === null) return undefined;
  const content: unknown = (first as { content?: unknown }).content;
  if (typeof content !== "object" || content === null) return undefined;
  const parts: unknown = (content as { parts?: unknown }).parts;
  if (!Array.isArray(parts) || parts.length === 0) return undefined;
  const texts: string[] = [];
  for (const part of parts) {
    if (typeof part === "object" && part !== null) {
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") texts.push(text);
    }
  }
  return texts.length > 0 ? texts.join("") : undefined;
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

/** Retry-After in seconds -> ms, clamped; null/parse failure -> the default backoff for the attempt. */
function retryDelayMs(header: string | null, attempt: number): number {
  if (header !== null) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(Math.ceil(seconds * 1000), MAX_RETRY_DELAY_MS);
    }
  }
  return RETRY_BACKOFF_MS[attempt] ?? RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1];
}

/** Download one street thumbnail and turn it into Gemini inlineData material (guarded). */
async function downloadImage(
  imageUrl: string,
  doFetch: typeof fetch,
  memo: Map<string, DownloadedImage>,
): Promise<DownloadedImage> {
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
  const image: DownloadedImage = { mimeType: contentType.split(";")[0], base64: bytes.toString("base64") };
  if (memo.size >= MEMO_MAX_ENTRIES) memo.clear();
  memo.set(imageUrl, image);
  return image;
}

export function createGeminiAnalyzer(options: GeminiAnalyzerOptions): GeminiVisualAnalyzer {
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const model = options.model ?? DEFAULT_MODEL;
  const maxTokens = options.maxTokens ?? 512;
  const maxRetries = options.maxRetries ?? 2;
  const doFetch = options.fetchImpl ?? fetch;
  const sleep = options.sleepImpl ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const limiter = options.rateLimiter ?? createTokenBucket({ perMinute: 60 });
  const imageMemo = options.imageMemo ?? new Map<string, DownloadedImage>();

  const stats: VisionStats = {
    requests: 0,
    analyzed: 0,
    fallbacks: 0,
    errors: 0,
    totalMs: 0,
    promptTokens: 0,
    completionTokens: 0,
    estimatedCostUsd: 0,
  };

  function addUsage(data: unknown): void {
    const usage = (typeof data === "object" && data !== null ? (data as { usageMetadata?: unknown }).usageMetadata : undefined) as
      | { promptTokenCount?: unknown; candidatesTokenCount?: unknown }
      | undefined;
    if (usage !== undefined) {
      if (typeof usage.promptTokenCount === "number") stats.promptTokens += usage.promptTokenCount;
      if (typeof usage.candidatesTokenCount === "number") stats.completionTokens += usage.candidatesTokenCount;
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
      // the provider's egress to the Mapillary CDN cannot be assumed.
      let image: DownloadedImage;
      try {
        image = await downloadImage(sample.imageUrl, doFetch, imageMemo);
      } catch (error) {
        stats.errors += 1;
        throw error;
      }
      stats.requests += 1;
      const started = Date.now();
      let response: Response;
      for (let attempt = 0; ; attempt += 1) {
        try {
          response = await doFetch(`${baseUrl}/models/${model}:generateContent`, {
            method: "POST",
            // Header auth (x-goog-api-key) keeps the key out of the URL/query string.
            headers: { "x-goog-api-key": options.apiKey, "content-type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt(sample.sourceId) }] },
              contents: [
                {
                  role: "user",
                  parts: [
                    { text: `sampleId: ${sample.sourceId}. Classify this street-level photograph.` },
                    { inlineData: { mimeType: image.mimeType, data: image.base64 } },
                  ],
                },
              ],
              generationConfig: {
                // Thinking is ON by default in 2.5/3.x models and silently burns
                // the completion budget (and latency); a zero budget disables it
                // and temperature applies.
                thinkingConfig: { thinkingBudget: 0 },
                temperature: 0,
                maxOutputTokens: maxTokens,
                responseMimeType: "application/json",
              },
            }),
          });
        } catch (error) {
          stats.totalMs += Date.now() - started;
          stats.errors += 1;
          throw new Error(`gemini request failed: ${error instanceof Error ? error.message : String(error)}`);
        }
        // Only a 429 is retried: a dead or broken model must not stall the cell.
        if (response.status !== 429 || attempt >= maxRetries) break;
        await sleep(retryDelayMs(response.headers.get("retry-after"), attempt));
      }
      stats.totalMs += Date.now() - started;
      if (!response.ok) {
        stats.errors += 1;
        throw new Error(`gemini responded ${response.status}${response.status === 429 ? " (rate limited)" : ""}`);
      }
      let data: unknown;
      try {
        data = await response.json();
      } catch {
        stats.errors += 1;
        throw new Error("gemini returned a non-JSON body");
      }
      const content = extractContent(data);
      if (content === undefined) {
        stats.errors += 1;
        throw new Error("gemini returned a malformed envelope (no candidates[0].content.parts[].text)");
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
