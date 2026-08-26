import { DEFAULT_OVERPASS_ENDPOINT } from "./source.ts";

export interface LiveSourceConfig {
  readonly endpoint: string;
  readonly provider: "http" | "osm-overpass";
  readonly consent: true;
}

export function readLiveSourceConfig(params: Pick<URLSearchParams, "get">): LiveSourceConfig | undefined {
  if (params.get("mode") !== "open-world-live") return undefined;
  if (params.get("consent") !== "1") throw new Error("live mode requires explicit consent");
  const provider = params.get("provider") === "osm" ? "osm-overpass" : "http";
  const rawEndpoint = params.get("endpoint") ?? (provider === "osm-overpass" ? DEFAULT_OVERPASS_ENDPOINT : undefined);
  if (!rawEndpoint || rawEndpoint.length > 2_048) throw new Error("live mode requires a bounded endpoint");
  let endpoint: URL;
  try {
    endpoint = new URL(rawEndpoint);
  } catch {
    throw new TypeError("live mode endpoint must be a valid URL");
  }
  if (endpoint.protocol !== "http:" && endpoint.protocol !== "https:") throw new TypeError("live mode endpoint must use HTTP or HTTPS");
  return { endpoint: endpoint.toString(), provider, consent: true };
}
