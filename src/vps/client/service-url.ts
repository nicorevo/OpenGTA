const LOCAL_HOSTNAMES: ReadonlySet<string> = new Set(["127.0.0.1", "localhost", "[::1]"]);

/**
 * Read and validate the optional ?vpsService=<url> parameter (spec 106,
 * closed-registry discipline like the live geo endpoints):
 * - development: local origins only (the service runs alongside via
 *   `npm run service`);
 * - production: https only.
 * Credentials, query and hash are never allowed. Absent parameter returns
 * undefined: the VPS layer is off and nothing is fetched.
 */
export function readVpsServiceUrl(
  params: Pick<URLSearchParams, "get">,
  options: { readonly developmentOrigin?: string },
): string | undefined {
  const raw = params.get("vpsService");
  if (raw === null) return undefined;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("VPS service URL non valida");
  }
  if (url.username || url.password) throw new Error("VPS service URL non autorizzata");
  if (url.search || url.hash) throw new Error("VPS service URL non autorizzata");
  if (options.developmentOrigin !== undefined) {
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("VPS service URL non autorizzata");
    if (!LOCAL_HOSTNAMES.has(url.hostname)) throw new Error("VPS service: in sviluppo sono ammesse solo origini locali");
  } else if (url.protocol !== "https:") {
    throw new Error("VPS service: in produzione e' richiesto https");
  }
  return url.origin;
}
