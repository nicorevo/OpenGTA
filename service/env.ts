/**
 * Service configuration (VPS-10, spec 82-83). Pure parsing: no fs, no
 * process access — the caller (server.ts main) reads the file or the
 * environment and hands the record in, which keeps this module testable and
 * credential-free. Defaults match .env.example.
 */
export interface VpsServiceConfig {
  readonly mapillary: {
    readonly baseUrl: string;
    /** The Mapillary credential (server-side only; never leaves the service). */
    readonly clientId: string;
  };
  readonly overpass: {
    readonly endpoint: string;
  };
  readonly cacheDir: string;
  readonly ttlMs: number;
  readonly rateLimitPerMin: number;
  readonly port: number;
  /**
   * Optional (VPS-11): without a key the service runs OSM-only (test
   * analyzer). The vision key is server-side only, like the Mapillary one
   * (spec 82-83).
   */
  readonly gemini?: {
    readonly baseUrl: string;
    readonly apiKey: string;
    readonly model: string;
  };
}

const PLACEHOLDER = "YOUR_CLIENT_ID_HERE";
const GEMINI_PLACEHOLDER = "YOUR_GEMINI_API_KEY_HERE";

/** Minimal .env parser: KEY=VALUE lines, # comments, optional quotes. */
export function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function positiveNumber(env: Record<string, string>, key: string, fallback: number): number {
  const raw = env[key];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${key} must be a positive finite number, got ${raw}`);
  }
  return value;
}

export function loadConfig(env: Record<string, string>): VpsServiceConfig {
  const clientId = (env.MAPILLARY_CLIENT_ID ?? "").trim();
  if (clientId.length === 0) {
    throw new Error("MAPILLARY_CLIENT_ID is required (see .env.example); the service never calls Mapillary unauthenticated");
  }
  if (clientId.includes(PLACEHOLDER)) {
    throw new Error("MAPILLARY_CLIENT_ID still holds the .env.example placeholder; set your real credential in .env");
  }

  const geminiKey = (env.GEMINI_API_KEY ?? "").trim();
  if (geminiKey.includes(GEMINI_PLACEHOLDER)) {
    throw new Error("GEMINI_API_KEY still holds the .env.example placeholder; set your real key in .env");
  }

  return {
    mapillary: {
      baseUrl: (env.MAPILLARY_BASE_URL ?? "https://graph.mapillary.com").replace(/\/+$/, ""),
      clientId,
    },
    overpass: {
      endpoint: env.OVERPASS_ENDPOINT ?? "https://overpass-api.de/api/interpreter",
    },
    cacheDir: env.VPS_CACHE_DIR ?? ".vps-cache",
    ttlMs: positiveNumber(env, "VPS_TTL_MS", 604_800_000),
    rateLimitPerMin: positiveNumber(env, "VPS_RATE_LIMIT_PER_MIN", 60),
    port: positiveNumber(env, "VPS_PORT", 8787),
    gemini:
      geminiKey.length > 0
        ? {
            baseUrl: (env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, ""),
            apiKey: geminiKey,
            model: env.GEMINI_MODEL ?? "gemini-3.6-flash",
          }
        : undefined,
  };
}
