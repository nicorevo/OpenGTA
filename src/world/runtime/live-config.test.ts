import { describe, expect, it } from "vitest";
import { readLiveSourceConfig } from "./live-config.ts";

describe("live runtime configuration", () => {
  it("accepts an explicit endpoint only with consent", () => {
    expect(readLiveSourceConfig(new URLSearchParams("mode=open-world-live&endpoint=https%3A%2F%2Fgeo.test%2Fquery&consent=1"))).toEqual({
      endpoint: "https://geo.test/query",
      consent: true,
    });
  });

  it("rejects live mode without consent or endpoint", () => {
    expect(() => readLiveSourceConfig(new URLSearchParams("mode=open-world-live&endpoint=https%3A%2F%2Fgeo.test"))).toThrow("consent");
    expect(() => readLiveSourceConfig(new URLSearchParams("mode=open-world-live&consent=1"))).toThrow("endpoint");
  });

  it("returns no live config for offline mode", () => {
    expect(readLiveSourceConfig(new URLSearchParams("mode=open-world"))).toBeUndefined();
  });
});
