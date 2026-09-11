import { DEFAULT_OVERPASS_ENDPOINT } from "./source.ts";
import { OPENFREEMAP_TILE_BASE_URL } from "./vector-tile/provider.ts";

export interface LiveSourceConfig {
  readonly endpoint: string;
  readonly provider: "http" | "osm-overpass" | "openfreemap-mvt";
  readonly consent: true;
}

export interface EndpointPolicy {
  readonly httpsEndpoints: readonly string[];
  readonly developmentOrigin?: string;
}
export const DEFAULT_ENDPOINT_POLICY: EndpointPolicy = { httpsEndpoints: [DEFAULT_OVERPASS_ENDPOINT] };
export const DEFAULT_ORIGIN = { latitude: 40.35316888888889, longitude: 18.17259 };
export interface RuntimeConfig {
  readonly mode: "offline" | "open-world" | "open-world-live";
  readonly origin: { readonly latitude: number; readonly longitude: number };
  readonly live?: LiveSourceConfig;
}

export function readRuntimeConfig(params: Pick<URLSearchParams, "get">, policy = DEFAULT_ENDPOINT_POLICY): RuntimeConfig {
  const mode = params.get("mode") ?? "offline";
  if (mode !== "offline" && mode !== "open-world" && mode !== "open-world-live") throw new Error("Modalita' non valida");
  const provider = params.get("provider");
  if (provider !== null && provider !== "osm" && provider !== "http" && provider !== "openfreemap-mvt") throw new Error("Provider non valido");
  const coordinate = (name: string, fallback: number, bound: number) => {
    const raw = params.get(name);
    if (raw === null) return fallback;
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(raw.trim())) throw new Error("Coordinate non valide");
    const value = Number(raw);
    if (!Number.isFinite(value) || Math.abs(value) > bound) throw new Error("Coordinate fuori intervallo");
    return value;
  };
  const origin = { latitude: coordinate("lat", DEFAULT_ORIGIN.latitude, 90), longitude: coordinate("lon", DEFAULT_ORIGIN.longitude, 180) };
  return { mode, origin, live: readLiveSourceConfig(params, policy) };
}

export function readLiveSourceConfig(params: Pick<URLSearchParams, "get">, policy = DEFAULT_ENDPOINT_POLICY): LiveSourceConfig | undefined {
  if (params.get("mode") !== "open-world-live") return undefined;
  if (params.get("consent") !== "1") throw new Error("live mode requires explicit consent");
  if (params.get("provider") !== null && !["osm", "http", "openfreemap-mvt"].includes(params.get("provider")!)) throw new Error("Provider non valido");
  // The MVT provider is experimental and pinned: the endpoint is a constant,
  // never user input, so the endpoint allowlist policy stays unchanged.
  if (params.get("provider") === "openfreemap-mvt") return { endpoint: OPENFREEMAP_TILE_BASE_URL, provider: "openfreemap-mvt", consent: true };
  const provider = params.get("provider") === "osm" ? "osm-overpass" : "http";
  const rawEndpoint = params.get("endpoint") ?? (provider === "osm-overpass" ? DEFAULT_OVERPASS_ENDPOINT : undefined);
  if (!rawEndpoint || rawEndpoint.length > 2_048) throw new Error("live mode requires a bounded endpoint");
  let endpoint: URL;
  try {
    endpoint = new URL(rawEndpoint);
  } catch {
    throw new TypeError("live mode endpoint must be a valid URL");
  }
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new Error("Endpoint non autorizzato");
  const allowedHttps = endpoint.protocol === "https:" && policy.httpsEndpoints.includes(endpoint.toString());
  let allowedLocal = false;
  if (policy.developmentOrigin) {
    const local = new URL(policy.developmentOrigin);
    allowedLocal = ["127.0.0.1", "localhost", "[::1]"].includes(local.hostname) && endpoint.origin === local.origin && endpoint.pathname === "/__test-geo";
  }
  if (!allowedHttps && !allowedLocal) throw new Error("Endpoint non autorizzato");
  return { endpoint: endpoint.toString(), provider, consent: true };
}
