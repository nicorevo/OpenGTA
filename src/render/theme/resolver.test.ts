import { describe, expect, it } from "vitest";
import type { LocationContext } from "../../app/location-context.ts";
import { stableStringHash } from "./hash.ts";
import { buildingStyle, defaultProfile, franceProfile, groundFill, italyProfile, parisProfile, roadStyle, romeProfile, tokyoProfile } from "./index.ts";
import { createVisualProfileResolver, knownThemeIds, normalizeLocationToken, themeIdOfProfile, THEME_BY_ID } from "./resolver.ts";

const resolver = createVisualProfileResolver();

const loc = (overrides: Partial<LocationContext> = {}): LocationContext => ({
  latitude: 41.9, longitude: 12.5, source: "nominatim", ...overrides,
});

describe("VisualProfileResolver.resolve", () => {
  it("falls back to default without a location", () => {
    const resolution = resolver.resolve(undefined);
    expect(resolution.profile.id).toBe("default");
    expect(resolution.matchedBy).toBe("default");
    expect(resolution.location).toBeUndefined();
  });

  it("matches the country when only countryCode is known", () => {
    expect(resolver.resolve(loc({ countryCode: "IT" })).profile.id).toBe("italy");
    expect(resolver.resolve(loc({ countryCode: "IT" })).matchedBy).toBe("country");
    expect(resolver.resolve(loc({ countryCode: "FR" })).profile.id).toBe("france");
  });

  it("matches the locality qualified by its country", () => {
    expect(resolver.resolve(loc({ countryCode: "IT", locality: "Roma" })).profile.id).toBe("rome");
    expect(resolver.resolve(loc({ countryCode: "IT", locality: "Roma" })).matchedBy).toBe("locality");
    expect(resolver.resolve(loc({ countryCode: "IT", locality: "Rome" })).profile.id).toBe("rome");
    expect(resolver.resolve(loc({ countryCode: "FR", locality: "Paris" })).profile.id).toBe("paris");
    expect(resolver.resolve(loc({ countryCode: "FR", locality: "Parigi" })).profile.id).toBe("paris");
    expect(resolver.resolve(loc({ countryCode: "JP", locality: "Tokyo" })).profile.id).toBe("tokyo");
    expect(resolver.resolve(loc({ countryCode: "JP", locality: "Tokyo" })).matchedBy).toBe("locality");
    expect(resolver.resolve(loc({ countryCode: "CL", locality: "Santiago" })).profile.id).toBe("santiago");
    expect(resolver.resolve(loc({ countryCode: "CL", locality: "Santiago" })).matchedBy).toBe("locality");
    expect(resolver.resolve(loc({ countryCode: "GR", locality: "Athens" })).profile.id).toBe("athens");
    expect(resolver.resolve(loc({ countryCode: "GR", locality: "Atene" })).profile.id).toBe("athens");
  });

  it("does not select a city theme when the country contradicts", () => {
    expect(resolver.resolve(loc({ countryCode: "US", locality: "Paris" })).profile.id).toBe("default");
    expect(resolver.resolve(loc({ countryCode: "US", locality: "Tokyo" })).profile.id).toBe("default");
    // other JP cities have no country-level theme in LVP-2: default
    expect(resolver.resolve(loc({ countryCode: "JP", locality: "Osaka" })).profile.id).toBe("default");
    // a non-matching locality falls through to the country rule
    expect(resolver.resolve(loc({ countryCode: "IT", locality: "Paris" })).profile.id).toBe("italy");
  });

  it("never guesses a city without a country code", () => {
    expect(resolver.resolve(loc({ locality: "Roma" })).profile.id).toBe("default");
    expect(resolver.resolve(loc({ locality: "Roma", region: "Lazio" })).profile.id).toBe("default");
  });

  it("gives absolute priority to a valid forced theme", () => {
    const resolution = resolver.resolve(loc({ countryCode: "FR", locality: "Paris" }), "rome");
    expect(resolution.profile.id).toBe("rome");
    expect(resolution.matchedBy).toBe("forced");
    expect(resolver.resolve(undefined, "paris").profile.id).toBe("paris");
  });

  it("falls back to auto resolution for an invalid forced theme", () => {
    const resolution = resolver.resolve(loc({ countryCode: "IT", locality: "Roma" }), "not-a-theme");
    expect(resolution.profile.id).toBe("rome");
    expect(resolution.matchedBy).toBe("locality");
  });
});

describe("normalizeLocationToken", () => {
  it("trims, lowercases and collapses whitespace", () => {
    expect(normalizeLocationToken("  Roma  ")).toBe("roma");
    expect(normalizeLocationToken("ROME")).toBe("rome");
    expect(normalizeLocationToken("New   York")).toBe("new york");
  });

  it("strips diacritics without fuzzy matching", () => {
    expect(normalizeLocationToken("Rím")).toBe("rim");
    expect(normalizeLocationToken("São Paulo")).toBe("sao paulo");
    expect(normalizeLocationToken("Parigi")).toBe("parigi");
  });
});

describe("theme registry", () => {
  it("exposes exactly the LVP theme ids (v1 + LVP-2 tokyo + v1.1 santiago/athens)", () => {
    expect([...knownThemeIds].sort()).toEqual(["athens", "default", "france", "italy", "paris", "rome", "santiago", "tokyo"]);
  });

  it("exposes the theme id of every registered profile as its city key", () => {
    for (const [id, profile] of THEME_BY_ID) {
      expect(themeIdOfProfile(profile)).toBe(id);
    }
  });

  it("keeps the inheritance chain default -> italy/france -> rome/paris", () => {
    expect(italyProfile.id).toBe("italy");
    expect(romeProfile.id).toBe("rome");
    expect(franceProfile.id).toBe("france");
    expect(parisProfile.id).toBe("paris");
    // an untouched field inherits from the parent (e.g. water keeps the lineage)
    expect(romeProfile.ground.water).toBe(italyProfile.ground.water);
    expect(parisProfile.ground.water).toBe(franceProfile.ground.water);
    // the city profiles must actually differ from their parent
    expect(romeProfile.buildings.roofPalette).not.toEqual(italyProfile.buildings.roofPalette);
    expect(parisProfile.buildings.roofPalette).not.toEqual(franceProfile.buildings.roofPalette);
    // tokyo (LVP-2) extends default directly and differs from it
    expect(tokyoProfile.id).toBe("tokyo");
    expect(tokyoProfile.buildings.roofPalette).not.toEqual(defaultProfile.buildings.roofPalette);
    expect(tokyoProfile.buildings.facadePalette).not.toEqual(defaultProfile.buildings.facadePalette);
  });
});

describe("deterministic style selection (spec 35)", () => {
  it("stableStringHash is deterministic per featureId + profile.id", () => {
    const seed = stableStringHash("way:123:paris");
    expect(stableStringHash("way:123:paris")).toBe(seed);
    expect(stableStringHash("way:123:paris")).not.toBe(stableStringHash("way:123:rome"));
  });

  it("buildingStyle is stable for the same (profile, class, seed)", () => {
    const a = buildingStyle(parisProfile, "unknown", 42);
    const b = buildingStyle(parisProfile, "unknown", 42);
    expect(a).toEqual(b);
  });

  it("changing the profile id can select a different variant", () => {
    let differs = false;
    for (let feature = 0; feature < 64 && !differs; feature += 1) {
      const paris = buildingStyle(parisProfile, "unknown", stableStringHash(`way:${feature}:paris`));
      const rome = buildingStyle(romeProfile, "unknown", stableStringHash(`way:${feature}:rome`));
      differs = paris.roof !== rome.roof || paris.facade !== rome.facade;
    }
    expect(differs).toBe(true);
  });

  it("pins typed buildings regardless of the seed", () => {
    const a = buildingStyle(romeProfile, "historic", 1);
    const b = buildingStyle(romeProfile, "historic", 999999);
    expect(a).toEqual(b);
  });

  it("groundFill resolves water, known land classes and the base fallback", () => {
    expect(groundFill(defaultProfile, "water", "lake")).toBe(defaultProfile.ground.water);
    expect(groundFill(defaultProfile, "land", "park")).toBe(defaultProfile.ground.land.park);
    expect(groundFill(defaultProfile, "land", "not-a-class")).toBe(defaultProfile.ground.base);
    expect(groundFill(romeProfile, "land", "not-a-class")).toBe(romeProfile.ground.base);
  });

  it("roadStyle resolves classes and falls back to the base asphalt", () => {
    expect(roadStyle(defaultProfile, "motorway")).toEqual(defaultProfile.roads.classes.motorway);
    expect(roadStyle(defaultProfile, "not-a-class")).toEqual(defaultProfile.roads.base);
  });

  it("generic buildings pick from the palette by seed (no Math.random)", () => {
    const i = 7 % parisProfile.buildings.roofPalette.length;
    const j = 7 % parisProfile.buildings.facadePalette.length;
    expect(buildingStyle(parisProfile, "generic", 7)).toEqual({
      roof: parisProfile.buildings.roofPalette[i],
      facade: parisProfile.buildings.facadePalette[j],
    });
  });
});
