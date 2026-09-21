import { describe, expect, it } from "vitest";
import { createGeocodeClient, GeocodeError, NOMINATIM_REVERSE_URL, NOMINATIM_SEARCH_URL, normalizeGeocodeQuery } from "./geocode.ts";

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

describe("reverse geocoding", () => {
  it("uses the pinned reverse endpoint by default", () => {
    expect(NOMINATIM_REVERSE_URL).toBe("https://nominatim.openstreetmap.org/reverse");
  });

  it("serializes lat/lon and the pinned query fields", async () => {
    const { fetcher, requests } = fakeFetcher(() => jsonPayload({ place_id: 1, display_name: "Lecce, Puglia, Italia" }));
    await createGeocodeClient({ fetcher }).reverse(40.3531, 18.1726);
    const [first] = requests;
    expect(first?.url.origin + first?.url.pathname).toBe(NOMINATIM_REVERSE_URL);
    expect(first?.url.searchParams.get("lat")).toBe("40.3531");
    expect(first?.url.searchParams.get("lon")).toBe("18.1726");
    expect(first?.url.searchParams.get("format")).toBe("jsonv2");
    expect(first?.url.searchParams.get("zoom")).toBe("10");
    expect(first?.url.searchParams.get("accept-language")).toBe("it");
  });

  it("maps the candidate using the requested coordinates", async () => {
    const { fetcher } = fakeFetcher(() => jsonPayload({ place_id: 3134652, display_name: "Lecce, Puglia, Italia", lat: "90", lon: "180" }));
    const result = await createGeocodeClient({ fetcher }).reverse(40.3531, 18.1726);
    expect(result).toEqual({ name: "Lecce, Puglia, Italia", latitude: 40.3531, longitude: 18.1726, placeId: "3134652" });
  });

  it("resolves undefined when Nominatim reports no data for the point", async () => {
    const { fetcher } = fakeFetcher(() => jsonPayload({ error: "Unable to reverse geocode" }));
    await expect(createGeocodeClient({ fetcher }).reverse(40.3531, 18.1726)).resolves.toBeUndefined();
  });

  it("maps non-object or invalid payloads to invalid-response", async () => {
    const { fetcher: array } = fakeFetcher(() => jsonPayload([{ display_name: "x" }]));
    await expect(createGeocodeClient({ fetcher: array }).reverse(40, 18)).rejects.toMatchObject({ code: "invalid-response" });
    const { fetcher: missing } = fakeFetcher(() => jsonPayload({ place_id: 1 }));
    await expect(createGeocodeClient({ fetcher: missing }).reverse(40, 18)).rejects.toMatchObject({ code: "invalid-response" });
  });

  it("maps 429 to rate-limited and a slow fetcher to timeout", async () => {
    const { fetcher: f429 } = fakeFetcher(() => jsonPayload({}, 429));
    await expect(createGeocodeClient({ fetcher: f429 }).reverse(40, 18)).rejects.toMatchObject({ code: "rate-limited", status: 429 });
    const slow = async (_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("still running")), 300);
      init.signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new Error("aborted")); }, { once: true });
    });
    await expect(createGeocodeClient({ fetcher: slow, timeoutMs: 20 }).reverse(40, 18)).rejects.toMatchObject({ code: "timeout" });
  });

  it("maps a caller abort to aborted", async () => {
    const client = createGeocodeClient({ fetcher: async () => jsonPayload({ display_name: "x" }) });
    const controller = new AbortController();
    controller.abort();
    await expect(client.reverse(40, 18, controller.signal)).rejects.toMatchObject({ code: "aborted" });
  });

  it("requests the structured address (addressdetails=1)", async () => {
    const { fetcher, requests } = fakeFetcher(() => jsonPayload({ display_name: "Roma, Lazio, Italia" }));
    await createGeocodeClient({ fetcher }).reverse(41.9, 12.5);
    expect(requests[0]?.url.searchParams.get("addressdetails")).toBe("1");
  });

  it("parses the structured address into countryCode/country/region/locality/district", async () => {
    const { fetcher } = fakeFetcher(() => jsonPayload({
      place_id: 3177,
      display_name: "Roma, Lazio, Italia",
      address: {
        country_code: "it",
        country: "Italy",
        state: "Lazio",
        city: "Roma",
        city_district: "Centro",
      },
    }));
    const result = await createGeocodeClient({ fetcher }).reverse(41.9028, 12.4964);
    expect(result).toMatchObject({
      name: "Roma, Lazio, Italia",
      latitude: 41.9028,
      longitude: 12.4964,
      countryCode: "IT",
      country: "Italy",
      region: "Lazio",
      locality: "Roma",
      district: "Centro",
    });
  });

  it("resolves locality with the priority city > town > village > municipality", async () => {
    const variants: Record<string, unknown> = { town: "Taranto", village: "Altamura", municipality: "Pula" };
    for (const [key, value] of Object.entries(variants)) {
      const { fetcher } = fakeFetcher(() => jsonPayload({ display_name: "x", address: { [key]: value } }));
      const result = await createGeocodeClient({ fetcher }).reverse(40.5, 17.2);
      expect(result?.locality).toBe(String(value));
    }
    const { fetcher: all } = fakeFetcher(() => jsonPayload({ display_name: "x", address: { city: "Città", town: "T", village: "V", municipality: "M" } }));
    expect((await createGeocodeClient({ fetcher: all }).reverse(40.5, 17.2))?.locality).toBe("Città");
  });

  it("resolves district with the priority city_district > borough > suburb > neighbourhood", async () => {
    const variants: Record<string, unknown> = { borough: "Montmartre", suburb: "Ivry", neighbourhood: "Quartier Latin" };
    for (const [key, value] of Object.entries(variants)) {
      const { fetcher } = fakeFetcher(() => jsonPayload({ display_name: "x", address: { [key]: value } }));
      const result = await createGeocodeClient({ fetcher }).reverse(48.85, 2.35);
      expect(result?.district).toBe(String(value));
    }
    const { fetcher: all } = fakeFetcher(() => jsonPayload({ display_name: "x", address: { city_district: "CD", borough: "B", suburb: "S", neighbourhood: "N" } }));
    expect((await createGeocodeClient({ fetcher: all }).reverse(48.85, 2.35))?.district).toBe("CD");
  });

  it("uses state before region and drops an invalid country_code", async () => {
    const { fetcher } = fakeFetcher(() => jsonPayload({
      display_name: "x",
      address: { country_code: "ita", state: "Piemonte", region: "Regione X", city: "Torino" },
    }));
    const result = await createGeocodeClient({ fetcher }).reverse(45.07, 7.69);
    expect(result?.countryCode).toBeUndefined();
    expect(result?.region).toBe("Piemonte");
  });

  it("keeps the candidate usable when the response has no address", async () => {
    const { fetcher } = fakeFetcher(() => jsonPayload({ place_id: 1, display_name: "Lecce, Puglia, Italia" }));
    const result = await createGeocodeClient({ fetcher }).reverse(40.3531, 18.1726);
    expect(result).toEqual({ name: "Lecce, Puglia, Italia", latitude: 40.3531, longitude: 18.1726, placeId: "1" });
  });
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
