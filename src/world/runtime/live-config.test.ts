import { describe, expect, it } from "vitest";
import { DEFAULT_ENDPOINT_POLICY, readLiveSourceConfig, readRuntimeConfig } from "./live-config.ts";

describe("live runtime configuration", () => {
  it("defaults to online with the pinned MVT provider when no URL parameters are supplied", () => {
    const config = readRuntimeConfig(new URLSearchParams(""));
    expect(config.mode).toBe("open-world-live");
    expect(config.live).toMatchObject({ provider: "openfreemap-mvt", consent: true });
    expect(config.live?.endpoint).toContain("/planet/20260830_080001_pt");
  });

  it("starts live mode without requiring explicit consent", () => {
    const config = readLiveSourceConfig(new URLSearchParams("mode=open-world-live"));
    expect(config).toMatchObject({ provider: "openfreemap-mvt", consent: true });
  });

  it("accepts an explicit http endpoint with the pinned allowlist (consent is implicit)", () => {
    expect(readLiveSourceConfig(new URLSearchParams("mode=open-world-live&provider=http&endpoint=https%3A%2F%2Fgeo.test%2Fquery"), { httpsEndpoints: ["https://geo.test/query"] })).toEqual({
      endpoint: "https://geo.test/query",
      provider: "http",
      consent: true,
    });
  });

  it("rejects an http provider without an endpoint", () => {
    expect(() => readLiveSourceConfig(new URLSearchParams("mode=open-world-live&provider=http"))).toThrow("endpoint");
  });

  it("returns no live config for offline mode", () => {
    expect(readLiveSourceConfig(new URLSearchParams("mode=open-world"))).toBeUndefined();
    expect(readRuntimeConfig(new URLSearchParams("mode=offline")).live).toBeUndefined();
  });

  it("selects the default OpenStreetMap Overpass endpoint explicitly", () => {
    expect(readLiveSourceConfig(new URLSearchParams("mode=open-world-live&provider=osm"))).toMatchObject({
      provider: "osm-overpass",
      endpoint: "https://overpass-api.de/api/interpreter",
      consent: true,
    });
  });
});

it.each(["lat=", "lat=NaN", "lat=Infinity", "lat=91", "lon=-181", "mode=unknown", "provider=unknown", "mode="])("rejects invalid shared configuration %s", (input) => {
  expect(() => readRuntimeConfig(new URLSearchParams(input))).toThrow();
});

it.each(["http://overpass-api.de/api/interpreter", "https://evil.test/query", "https://user:pass@overpass-api.de/api/interpreter", "https://overpass-api.de/api/interpreter?secret=x", "https://overpass-api.de.evil.test/api/interpreter", "javascript:alert(1)"])("rejects untrusted endpoint %s", (endpoint) => {
  expect(() => readRuntimeConfig(new URLSearchParams({ mode: "open-world-live", provider: "osm", endpoint }))).toThrow();
});

it("permits only the exact development origin and path supplied by trusted code", () => {
  const params = new URLSearchParams({ mode: "open-world-live", provider: "http", endpoint: "http://127.0.0.1:5180/__test-geo" });
  const policy = { httpsEndpoints: [], developmentOrigin: "http://127.0.0.1:5180" };
  expect(readRuntimeConfig(params, policy).live?.endpoint).toBe(params.get("endpoint"));
  expect(() => readRuntimeConfig(params)).toThrow();
  params.set("endpoint", "http://localhost.evil.test/__test-geo");
  expect(() => readRuntimeConfig(params, policy)).toThrow();
});

it("pins the experimental MVT provider to its dataset endpoint and ignores user endpoints", () => {
  const params = new URLSearchParams({ mode: "open-world-live", provider: "openfreemap-mvt", endpoint: "https://evil.test/x" });
  const config = readRuntimeConfig(params, DEFAULT_ENDPOINT_POLICY);
  expect(config.live).toMatchObject({ provider: "openfreemap-mvt", consent: true });
  expect(config.live?.endpoint).toContain("/planet/20260830_080001_pt");
  expect(config.live?.endpoint).not.toContain("evil");
});
