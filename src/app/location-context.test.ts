import { describe, expect, it } from "vitest";
import { normalizeCountryCode, toLocationContext } from "./location-context.ts";

const base = { latitude: 41.9028, longitude: 12.4964, name: "Roma, Lazio, Italia", placeId: "3177" };

describe("normalizeCountryCode", () => {
  it("uppercases the two-letter Nominatim codes", () => {
    expect(normalizeCountryCode("it")).toBe("IT");
    expect(normalizeCountryCode("fr")).toBe("FR");
  });

  it("accepts already-uppercase codes and trims", () => {
    expect(normalizeCountryCode("IT")).toBe("IT");
    expect(normalizeCountryCode("  it ")).toBe("IT");
  });

  it("rejects anything that is not a two-letter code", () => {
    expect(normalizeCountryCode("ITA")).toBeUndefined();
    expect(normalizeCountryCode("i7")).toBeUndefined();
    expect(normalizeCountryCode("x")).toBeUndefined();
    expect(normalizeCountryCode("")).toBeUndefined();
    expect(normalizeCountryCode(undefined)).toBeUndefined();
  });
});

describe("toLocationContext", () => {
  it("maps a structured reverse result to the provider-neutral context", () => {
    const context = toLocationContext({
      ...base,
      countryCode: "IT",
      country: "Italy",
      region: "Lazio",
      locality: "Roma",
      district: "Centro",
    });
    expect(context).toEqual({
      latitude: 41.9028,
      longitude: 12.4964,
      countryCode: "IT",
      country: "Italy",
      region: "Lazio",
      locality: "Roma",
      district: "Centro",
      source: "nominatim",
      placeId: "3177",
      displayName: "Roma, Lazio, Italia",
    });
  });

  it("tolerates a result without any structured address", () => {
    const context = toLocationContext(base);
    expect(context.countryCode).toBeUndefined();
    expect(context.country).toBeUndefined();
    expect(context.region).toBeUndefined();
    expect(context.locality).toBeUndefined();
    expect(context.district).toBeUndefined();
    expect(context.source).toBe("nominatim");
    expect(context.displayName).toBe(base.name);
  });
});
