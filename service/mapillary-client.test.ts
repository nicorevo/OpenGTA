import { describe, it, expect } from "vitest";
import { createMapillaryClient } from "./mapillary-client.ts";
import { StreetImageryProviderError } from "../src/vps/index.ts";
import type { GeoArea, MapillaryImageRef } from "../src/vps/index.ts";

const AREA: GeoArea = {
  id: "h3:891e8052cb3ffff",
  center: { latitude: 41.8992, longitude: 12.4769 },
  bounds: { south: 41.8972, west: 12.4750, north: 41.9012, east: 12.4788 },
};
const TOKEN = "MLY|test|token";

function imagesResponse(items: unknown[]) {
  return new Response(JSON.stringify({ data: items }), { status: 200, headers: { "content-type": "application/json" } });
}

const LIVE_ITEM = {
  id: "1322878655307756",
  geometry: { type: "Point", coordinates: [12.4769852, 41.8991519] },
  compass_angle: 339.62442994118,
  captured_at: 1691411605872,
  thumb_2048_url: "https://cdn.example/thumb.jpg",
};

describe("createMapillaryClient (VPS-10, spec 82-83: the only credential-holding layer)", () => {
  it("queries /images with the cell bbox, limit and fields, authenticated via Bearer (live API shape, VPS-10 recon)", async () => {
    let captured: { url?: string; init?: RequestInit } | undefined;
    const client = createMapillaryClient({
      baseUrl: "https://graph.mapillary.com",
      clientId: TOKEN,
      fetchImpl: (async (url: string | URL, init?: RequestInit) => {
        captured = { url: String(url), init };
        return imagesResponse([LIVE_ITEM]);
      }) as typeof fetch,
    });
    await client.searchImages(AREA, 400);
    expect(captured?.url).toBe(
      "https://graph.mapillary.com/images?bbox=12.475,41.8972,12.4788,41.9012&limit=30&fields=compass_angle,captured_at,thumb_2048_url,geometry",
    );
    const headers = new Headers(captured?.init?.headers as HeadersInit);
    expect(headers.get("authorization")).toBe(`Bearer ${TOKEN}`);
    expect(headers.get("user-agent") ?? "").toContain("OpenGTA-VPS");
  });

  it("maps live image objects into MapillaryImageRef (geometry is [lon, lat]; captured_at is epoch ms)", async () => {
    const client = createMapillaryClient({
      baseUrl: "https://graph.mapillary.com",
      clientId: TOKEN,
      fetchImpl: (async () => imagesResponse([LIVE_ITEM])) as typeof fetch,
    });
    const refs: MapillaryImageRef[] = await client.searchImages(AREA, 400);
    expect(refs).toEqual([
      {
        imageId: "1322878655307756",
        latitude: 41.8991519,
        longitude: 12.4769852,
        capturedAt: new Date(1691411605872).toISOString(),
        compassAngle: 339.62442994118,
        thumbnailUrl: "https://cdn.example/thumb.jpg",
      },
    ]);
  });

  it("skips malformed entries and returns [] for an empty data array", async () => {
    const client = createMapillaryClient({
      baseUrl: "https://graph.mapillary.com",
      clientId: TOKEN,
      fetchImpl: (async () => imagesResponse([
        { id: "ok", geometry: { type: "Point", coordinates: [12.47, 41.89] } },
        { id: "no-geometry" },
        { geometry: { type: "Point", coordinates: [12.47, 41.89] } },
      ])) as typeof fetch,
    });
    expect(await client.searchImages(AREA, 400)).toHaveLength(1);

    const emptyClient = createMapillaryClient({
      baseUrl: "https://graph.mapillary.com",
      clientId: TOKEN,
      fetchImpl: (async () => imagesResponse([])) as typeof fetch,
    });
    expect(await emptyClient.searchImages(AREA, 400)).toEqual([]);
  });

  it.each([
    [429, "rate-limited"],
    [401, "auth"],
    [403, "auth"],
    [500, "unavailable"],
  ] as const)("maps HTTP %i to a StreetImageryProviderError of kind %s (spec 80 degradation)", async (status, kind) => {
    const client = createMapillaryClient({
      baseUrl: "https://graph.mapillary.com",
      clientId: TOKEN,
      fetchImpl: (async () =>
        new Response(JSON.stringify({ error: { message: "boom", type: "MLYApiException", code: 190 } }), { status })) as typeof fetch,
    });
    await expect(client.searchImages(AREA, 400)).rejects.toMatchObject({ kind });
  });

  it("maps network failures and non-JSON bodies to typed errors", async () => {
    const downClient = createMapillaryClient({
      baseUrl: "https://graph.mapillary.com",
      clientId: TOKEN,
      fetchImpl: (async () => { throw new TypeError("fetch failed"); }) as typeof fetch,
    });
    await expect(downClient.searchImages(AREA, 400)).rejects.toBeInstanceOf(StreetImageryProviderError);

    const htmlClient = createMapillaryClient({
      baseUrl: "https://graph.mapillary.com",
      clientId: TOKEN,
      fetchImpl: (async () => new Response("<html></html>", { status: 200 })) as typeof fetch,
    });
    await expect(htmlClient.searchImages(AREA, 400)).rejects.toMatchObject({ kind: "invalid-response" });
  });

  it("fetchDetections resolves to [] (the live API exposes detection ids without labels — spec 31-32: degrade, never assume)", async () => {
    const client = createMapillaryClient({
      baseUrl: "https://graph.mapillary.com",
      clientId: TOKEN,
      fetchImpl: (async () => imagesResponse([LIVE_ITEM])) as typeof fetch,
    });
    expect(await client.fetchDetections!("1322878655307756")).toEqual([]);
  });

  it("acquires a rate-limiter slot before each call", async () => {
    let acquires = 0;
    const client = createMapillaryClient({
      baseUrl: "https://graph.mapillary.com",
      clientId: TOKEN,
      fetchImpl: (async () => imagesResponse([LIVE_ITEM])) as typeof fetch,
      rateLimiter: { acquire: async () => { acquires += 1; } },
    });
    await client.searchImages(AREA, 400);
    expect(acquires).toBe(1);
  });
});
