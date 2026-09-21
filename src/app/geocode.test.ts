import { expect, it } from "vitest";
import { createGeocodeClient, GeocodeError, NOMINATIM_SEARCH_URL, normalizeGeocodeQuery } from "./geocode.ts";

type RecordedRequest = { url: URL; signal?: AbortSignal };

function jsonPayload(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
}

/** fetcher finto: registra le richieste e risponde secondo la regola data. */
function fakeFetcher(behavior: (request: RecordedRequest, index: number) => Response | Promise<Response>) {
  const requests: RecordedRequest[] = [];
  const fetcher = async (url: string, init: RequestInit) => {
    const request: RecordedRequest = { url: new URL(url), signal: init.signal ?? undefined };
    requests.push(request);
    return behavior(request, requests.length - 1);
  };
  return { fetcher, requests };
}

const candidate = (overrides: Partial<Record<string, unknown>> = {}) => ({
  place_id: 1,
  osm_type: "relation",
  osm_id: 1,
  lat: "40.4644421",
  lon: "17.2468758",
  display_name: "Taranto, Provincia di Taranto, Puglia, Italia",
  class: "place",
  type: "city",
  ...overrides,
});

it("pinned endpoint is the public Nominatim search URL", () => {
  expect(NOMINATIM_SEARCH_URL).toBe("https://nominatim.openstreetmap.org/search");
});

it("normalizes the query for the cache (trim, collapse whitespace, casefold)", () => {
  expect(normalizeGeocodeQuery("  Taranto   Vecchia ")).toBe("taranto vecchia");
  expect(normalizeGeocodeQuery("")).toBe("");
});

it("builds the search URL with encoded params and the pinned query fields", async () => {
  const { fetcher, requests } = fakeFetcher(() => jsonPayload([]));
  const client = createGeocodeClient({ fetcher });
  await client.search("taranto & ro?cca");
  const [first] = requests;
  expect(first?.url.origin + first?.url.pathname).toBe(NOMINATIM_SEARCH_URL);
  expect(first?.url.searchParams.get("q")).toBe("taranto & ro?cca");
  expect(first?.url.searchParams.get("format")).toBe("jsonv2");
  expect(first?.url.searchParams.get("limit")).toBe("5");
  expect(first?.url.searchParams.get("accept-language")).toBe("it");
});

it("maps valid candidates preserving order and typing", async () => {
  const { fetcher } = fakeFetcher(() => jsonPayload([candidate(), candidate({ place_id: 2, lat: "40.5", lon: "17.0", display_name: "Taranto, Via X" })]));
  const client = createGeocodeClient({ fetcher });
  const result = await client.search("taranto");
  expect(result).toEqual([
    { name: "Taranto, Provincia di Taranto, Puglia, Italia", latitude: 40.4644421, longitude: 17.2468758, placeId: "1" },
    { name: "Taranto, Via X", latitude: 40.5, longitude: 17, placeId: "2" },
  ]);
});

it("accepts numeric lat/lon and trims long display names to the bound", async () => {
  const { fetcher } = fakeFetcher(() => jsonPayload([candidate({ lat: 40.5, lon: 17, display_name: "  " + "x".repeat(200) + "  " })]));
  const client = createGeocodeClient({ fetcher });
  const result = await client.search("taranto");
  expect(result).toHaveLength(1);
  expect(result[0]?.latitude).toBe(40.5);
  expect(result[0]?.name).toBe("x".repeat(200));
});

it("drops invalid candidates and resolves to an empty list when none survive", async () => {
  const { fetcher } = fakeFetcher(() => jsonPayload([
    candidate({ lat: "91" }),               // fuori bound
    candidate({ lon: "non-numero" }),       // non numerico
    candidate({ display_name: "" }),        // nome vuoto
    candidate({ place_id: undefined, lat: undefined }), // campi mancanti
  ]));
  const client = createGeocodeClient({ fetcher });
  await expect(client.search("taranto")).resolves.toEqual([]);
});

it("keeps at most maxCandidates (default 5, configurable)", async () => {
  const seven = Array.from({ length: 7 }, (_, index) => candidate({ place_id: index + 1, display_name: `Luogo ${index + 1}` }));
  const { fetcher } = fakeFetcher(() => jsonPayload(seven));
  expect(await createGeocodeClient({ fetcher }).search("taranto")).toHaveLength(5);
  const { fetcher: f2 } = fakeFetcher(() => jsonPayload(seven));
  expect(await createGeocodeClient({ fetcher: f2, maxCandidates: 2 }).search("taranto")).toHaveLength(2);
});

it("maps 429 to rate-limited and other non-2xx to http with the status", async () => {
  const { fetcher: f429 } = fakeFetcher(() => jsonPayload({ error: "rate limited" }, 429));
  await expect(createGeocodeClient({ fetcher: f429 }).search("taranto")).rejects.toMatchObject({ code: "rate-limited", status: 429 });
  const { fetcher: f500 } = fakeFetcher(() => jsonPayload({ error: "boom" }, 500));
  await expect(createGeocodeClient({ fetcher: f500 }).search("taranto")).rejects.toMatchObject({ code: "http", status: 500 });
});

it("maps a fetch rejection to network", async () => {
  const client = createGeocodeClient({ fetcher: async () => { throw new TypeError("fetch failed"); } });
  await expect(client.search("taranto")).rejects.toMatchObject({ code: "network" });
});

it("maps a non-array payload to invalid-response", async () => {
  const { fetcher } = fakeFetcher(() => jsonPayload({ error: "bad query" }));
  await expect(createGeocodeClient({ fetcher }).search("taranto")).rejects.toMatchObject({ code: "invalid-response" });
});

it("maps an oversized payload to invalid-response", async () => {
  const { fetcher } = fakeFetcher(() => new Response("x".repeat(4096), { status: 200 }));
  await expect(createGeocodeClient({ fetcher, maxResponseBytes: 1024 }).search("taranto")).rejects.toMatchObject({ code: "invalid-response" });
});

it("maps a slow fetcher to timeout", async () => {
  const fetcher: (url: string, init: RequestInit) => Promise<Response> = async (_url, init) =>
    new Promise<Response>((_resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("still running")), 300);
      init.signal?.addEventListener("abort", () => { clearTimeout(timer); reject(Object.assign(new Error("The operation was aborted."), { name: "AbortError" })); }, { once: true });
    });
  await expect(createGeocodeClient({ fetcher, timeoutMs: 20 }).search("taranto")).rejects.toMatchObject({ code: "timeout" });
});

it("maps a caller abort to aborted", async () => {
  const client = createGeocodeClient({ fetcher: async () => jsonPayload([]) });
  const controller = new AbortController();
  controller.abort();
  await expect(client.search("taranto", controller.signal)).rejects.toMatchObject({ code: "aborted" });
});

it("returns an empty list without fetching for a blank query", async () => {
  const { fetcher, requests } = fakeFetcher(() => jsonPayload([candidate()]));
  const client = createGeocodeClient({ fetcher });
  await expect(client.search("   ")).resolves.toEqual([]);
  expect(requests).toHaveLength(0);
});

it("caches successes by normalized query and returns copies", async () => {
  const { fetcher, requests } = fakeFetcher(() => jsonPayload([candidate()]));
  const client = createGeocodeClient({ fetcher });
  const first = await client.search("  Taranto ");
  const second = await client.search("TARANTO");
  expect(requests).toHaveLength(1);
  expect(second).toEqual(first);
  first.push({ name: "iniettato", latitude: 0, longitude: 0, placeId: "x" });
  expect(await client.search("taranto")).toHaveLength(1);
});

it("does not cache failures", async () => {
  let call = 0;
  const fetcher = async () => { call += 1; return call === 1 ? new Response("{}", { status: 429 }) : jsonPayload([candidate()]); };
  const client = createGeocodeClient({ fetcher });
  await expect(client.search("taranto")).rejects.toMatchObject({ code: "rate-limited" });
  await expect(client.search("taranto")).resolves.toHaveLength(1);
  expect(call).toBe(2);
});

it("bounds the cache (LRU eviction refetches the oldest entry)", async () => {
  const { fetcher, requests } = fakeFetcher((request) => jsonPayload([candidate({ display_name: request.url.searchParams.get("q") ?? "?" })]));
  const client = createGeocodeClient({ fetcher, maxCacheEntries: 3 });
  await client.search("uno");
  await client.search("due");
  await client.search("tre");
  await client.search("uno");    // hit: riattualizza "uno" (LRU), nessuna richiesta
  await client.search("quattro"); // evide "due" (il più vecchio)
  await client.search("due");     // miss: ri-fetch
  expect(requests.map((request) => request.url.searchParams.get("q"))).toEqual(["uno", "due", "tre", "quattro", "due"]);
});
