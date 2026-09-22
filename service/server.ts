import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import {
  createMapillaryProvider,
  createProfileCompiler,
  createTestVisualAnalyzer,
  createVisualPipeline,
  defaultCatalog,
  evidenceCacheKey,
  cellForCoordinates,
  profileCacheKey,
} from "../src/vps/index.ts";
import type {
  EvidenceCache,
  GeneratedVisualProfile,
  PipelineResult,
  ProfileCache,
  VisualAnalyzer,
  VisualPipeline,
} from "../src/vps/index.ts";
import { THEME_BY_ID } from "../src/render/theme/resolver.ts";
import type { VisualProfile } from "../src/render/theme/types.ts";
import { createFileValueCache } from "./file-cache.ts";
import type { FileValueCache } from "./file-cache.ts";
import { createTokenBucket } from "./rate-limit.ts";
import type { RateLimiter } from "./rate-limit.ts";
import { createOsmSource } from "./overpass-source.ts";
import { createMapillaryClient } from "./mapillary-client.ts";
import { loadConfig, parseEnvFile } from "./env.ts";
import type { VpsServiceConfig } from "./env.ts";
import { createDeepSeekAnalyzer } from "./vision/deepseek-analyzer.ts";
import type { VisionStats } from "./vision/deepseek-analyzer.ts";

/**
 * VPS service (VPS-10, spec 106): GET /v1/profile?lat&lon -> a GeneratedVisual
 * Profile for the cell containing the coordinates, or the LVP parent profile
 * immediately, on any failure. The service is the only layer with credentials
 * and network access (spec 82-83); everything it calls downstream (pipeline,
 * caches, compiler) is the pure core.
 *
 * Freshness (spec 54 levels 2-3): a service-level entry per cell (profile +
 * evidence + diagnostics) is persisted with a TTL; a fresh entry is served
 * without touching the network at all.
 */

interface CityCircle {
  readonly themeId: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly radiusKm: number;
}

/**
 * v1 approximation of LVP geocoding: the service receives bare lat/lon and the
 * LVP registry knows the city themes, so a coarse circle match selects the
 * parent (full Nominatim geocoding stays client-side in LVP).
 */
const CITY_CIRCLES: readonly CityCircle[] = [
  { themeId: "rome", latitude: 41.9028, longitude: 12.4964, radiusKm: 12 },
  { themeId: "paris", latitude: 48.8566, longitude: 2.3522, radiusKm: 12 },
  { themeId: "tokyo", latitude: 35.6762, longitude: 139.6503, radiusKm: 20 },
];

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const r = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(s));
}

function parentProfileFor(latitude: number, longitude: number): VisualProfile {
  for (const city of CITY_CIRCLES) {
    if (haversineKm(latitude, longitude, city.latitude, city.longitude) <= city.radiusKm) {
      return THEME_BY_ID.get(city.themeId) ?? THEME_BY_ID.get("default")!;
    }
  }
  return THEME_BY_ID.get("default")!;
}

/** File-backed adapter: the pipeline's EvidenceCache on top of the TTL'd store. */
function toEvidenceCache(store: FileValueCache): EvidenceCache {
  const keyOf = (cellId: string, schemaVersion: number, evidenceRevision: string) =>
    evidenceCacheKey({ cellId, schemaVersion, evidenceRevision });
  return {
    get: (cellId, schemaVersion, evidenceRevision) => store.get(keyOf(cellId, schemaVersion, evidenceRevision)),
    set: (evidence) =>
      store.set(
        evidenceCacheKey({
          cellId: evidence.cell.id,
          schemaVersion: evidence.schemaVersion,
          evidenceRevision: evidence.evidenceRevision,
        }),
        evidence,
      ),
    has: (cellId, schemaVersion, evidenceRevision) => store.has(keyOf(cellId, schemaVersion, evidenceRevision)),
    get size() {
      return store.size;
    },
    clear: () => store.clear(),
  };
}

/** File-backed adapter: the pipeline's ProfileCache on top of the TTL'd store. */
function toProfileCache(store: FileValueCache): ProfileCache {
  const keyOf = (cellId: string, schemaVersion: number, compilerRevision: number, catalogRevision: number) =>
    profileCacheKey({ cellId, schemaVersion, compilerRevision, catalogRevision });
  return {
    get: (cellId, schemaVersion, compilerRevision, catalogRevision) =>
      store.get<GeneratedVisualProfile>(keyOf(cellId, schemaVersion, compilerRevision, catalogRevision)),
    set: (profile) =>
      store.set(
        profileCacheKey({
          cellId: profile.generation.cellId,
          schemaVersion: profile.schemaVersion,
          compilerRevision: profile.generation.compilerRevision,
          catalogRevision: profile.generation.catalogRevision,
        }),
        profile,
      ),
    has: (cellId, schemaVersion, compilerRevision, catalogRevision) =>
      store.has(keyOf(cellId, schemaVersion, compilerRevision, catalogRevision)),
    get size() {
      return store.size;
    },
    clear: () => store.clear(),
  };
}

/** Service-level freshness entry (spec 54 level 3): served without network while fresh. */
interface ServiceEntry {
  readonly profile: GeneratedVisualProfile;
  readonly evidence: PipelineResult["evidence"];
  readonly diagnostics: PipelineResult["diagnostics"];
  readonly vision?: VisionStats;
}

/** The JSON body of every /v1/profile response (spec 106). */
export interface ProfileResponseBody {
  readonly source: "cache" | "generated" | "lvp";
  readonly cell: { readonly id: string; readonly center: { readonly latitude: number; readonly longitude: number } };
  readonly servedAt: string;
  /** Generated (VPS) profile, or the LVP parent profile on the lvp path. */
  readonly profile: GeneratedVisualProfile | VisualProfile;
  readonly evidence?: PipelineResult["evidence"];
  readonly diagnostics?: PipelineResult["diagnostics"];
  /** Per-generation vision measurement (spec 107); absent when no vision model is configured or on the lvp path. */
  readonly vision?: VisionStats;
  readonly error?: string;
}

export interface ProfileErrorResponse {
  readonly error: string;
}

export interface ProfileHandlerResponse {
  readonly status: number;
  readonly body: ProfileResponseBody | ProfileErrorResponse;
}

export interface ProfileHandlerDeps {
  readonly config: VpsServiceConfig;
  /** Injectable fetch (tests); defaults to the global fetch. */
  readonly fetchImpl?: typeof fetch;
  /** Injectable clock (tests); defaults to Date.now. */
  readonly now?: () => number;
  /** Cache directory override (tests); defaults to config.cacheDir. */
  readonly cacheDir?: string;
  /**
   * Per-generation vision analyzer (VPS-11); the shared rate limiter is
   * injected so the bucket outlives a single cell. Defaults to the offline
   * test analyzer (OSM-only, deterministic).
   */
  readonly analyzerFactory?: (rateLimiter: RateLimiter) => VisualAnalyzer;
  /** Test/extension seam: replace the whole pipeline. */
  readonly pipelineFactory?: (deps: PipelineWiring) => VisualPipeline;
}

/** What the default pipeline factory needs; exposed for custom factories. */
export interface PipelineWiring {
  readonly osmSource: ReturnType<typeof createOsmSource>;
  readonly imagery: ReturnType<typeof createMapillaryProvider>;
  readonly analyzer: VisualAnalyzer;
  readonly parent: VisualProfile;
  readonly evidenceCache: EvidenceCache;
  readonly profileCache: ProfileCache;
}

/** Snapshot of a live VisionStats counter, if the analyzer exposes one (duck-typed: the core test analyzer does not). */
function readVisionStats(analyzer: VisualAnalyzer): VisionStats | undefined {
  const stats = (analyzer as { stats?: VisionStats }).stats;
  return stats === undefined ? undefined : { ...stats };
}

export type ProfileHandler = (path: string, search: URLSearchParams) => Promise<ProfileHandlerResponse>;

export function createProfileHandler(deps: ProfileHandlerDeps): ProfileHandler {
  const doFetch = deps.fetchImpl ?? fetch;
  const now = deps.now ?? Date.now;
  const rateLimiter: RateLimiter = createTokenBucket({ perMinute: deps.config.rateLimitPerMin, now });
  const store = createFileValueCache({ dir: deps.cacheDir ?? deps.config.cacheDir, ttlMs: deps.config.ttlMs, now });
  const evidenceCache = toEvidenceCache(store);
  const profileCache = toProfileCache(store);

  const defaultFactory = (wiring: PipelineWiring): VisualPipeline =>
    createVisualPipeline({
      osmSource: wiring.osmSource,
      imagery: wiring.imagery,
      analyzer: wiring.analyzer,
      compiler: createProfileCompiler(),
      catalog: defaultCatalog,
      resolveParent: () => wiring.parent,
      evidenceCache,
      profileCache,
    });
  const pipelineFactory = deps.pipelineFactory ?? defaultFactory;

  return async (path, search): Promise<ProfileHandlerResponse> => {
    if (path !== "/v1/profile") {
      return { status: 404, body: { error: "not found" } };
    }
    const latRaw = search.get("lat");
    const lonRaw = search.get("lon");
    const latitude = latRaw === null ? Number.NaN : Number(latRaw);
    const longitude = lonRaw === null ? Number.NaN : Number(lonRaw);
    if (
      !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180
    ) {
      return { status: 400, body: { error: "lat and lon are required, finite and in range" } };
    }

    const cell = cellForCoordinates(latitude, longitude);
    const parent = parentProfileFor(cell.center.latitude, cell.center.longitude);
    const cellRef = { id: cell.id, center: cell.center };
    const servedAt = new Date(now()).toISOString();

    // Spec 54 level 3 fast path: a fresh service entry is served without network.
    const serviceKey = `service:${cell.id}|compiler:${defaultCatalog.catalogRevision}`;
    const fresh = store.get<ServiceEntry>(serviceKey);
    if (fresh) {
      return {
        status: 200,
        body: { source: "cache", cell: cellRef, servedAt, profile: fresh.profile, evidence: fresh.evidence, diagnostics: fresh.diagnostics, vision: fresh.vision },
      };
    }

    try {
      // The analyzer is created per generation so its stats are per-request
      // (spec 107); the rate limiter is shared across generations.
      const analyzer = (deps.analyzerFactory ?? (() => createTestVisualAnalyzer()))(rateLimiter);
      const wiring: PipelineWiring = {
        osmSource: createOsmSource({ endpoint: deps.config.overpass.endpoint, fetchImpl: doFetch, rateLimiter }),
        imagery: createMapillaryProvider(
          createMapillaryClient({ baseUrl: deps.config.mapillary.baseUrl, clientId: deps.config.mapillary.clientId, fetchImpl: doFetch, rateLimiter }),
        ),
        analyzer,
        parent,
        evidenceCache,
        profileCache,
      };
      const result = await pipelineFactory(wiring).run(cell, servedAt);
      const vision = readVisionStats(analyzer);
      const entry: ServiceEntry = { profile: result.profile, evidence: result.evidence, diagnostics: result.diagnostics, vision };
      store.set(serviceKey, entry);
      return { status: 200, body: { source: "generated", cell: cellRef, servedAt, ...entry } };
    } catch {
      // Spec 106: immediate LVP fallback — the service degrades to the
      // guaranteed LVP profile instead of failing the request.
      return { status: 200, body: { source: "lvp", cell: cellRef, servedAt, profile: parent } };
    }
  };
}

/**
 * Production entry: a plain node:http server. `node service/server.ts`
 * (Node >= 23.6 native TS type stripping) boots it; reads .env (process env
 * wins), loads the config and listens on VPS_PORT.
 */
export function startServer(config: VpsServiceConfig, handlerDeps: Omit<ProfileHandlerDeps, "config"> = {}): ReturnType<typeof createServer> {
  const handler = createProfileHandler({ config, ...handlerDeps });
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    handler(url.pathname, url.searchParams)
      .then(({ status, body }) => {
        res.writeHead(status, {
          "content-type": "application/json; charset=utf-8",
          "access-control-allow-origin": "*",
          "cache-control": "no-store",
        });
        res.end(JSON.stringify(body));
      })
      .catch(() => {
        res.writeHead(500, { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" });
        res.end(JSON.stringify({ error: "internal error" }));
      });
  });
  server.listen(config.port);
  return server;
}

function loadDotEnv(path: string): Record<string, string> {
  // Local-only convenience: .env fills gaps, process env always wins.
  try {
    return parseEnvFile(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env: Record<string, string> = { ...loadDotEnv(".env") };
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = value;
  }
  const config = loadConfig(env);
  const handlerDeps: { analyzerFactory?: (rateLimiter: RateLimiter) => VisualAnalyzer } = {};
  if (config.deepseek) {
    const { baseUrl, apiKey, model } = config.deepseek;
    // Shared across generations: a street crossing two cell boundaries
    // downloads each thumbnail once, not once per cell (in-memory, spec 17).
    const imageMemo = new Map<string, string>();
    handlerDeps.analyzerFactory = (rateLimiter) => createDeepSeekAnalyzer({ apiKey, baseUrl, model, rateLimiter, imageMemo });
  }
  startServer(config, handlerDeps);
  console.log(
    `VPS service listening on http://localhost:${config.port} (cache: ${config.cacheDir}, ttl: ${config.ttlMs}ms, vision: ${config.deepseek ? `${config.deepseek.model}` : "off (OSM-only)"})`,
  );
}
