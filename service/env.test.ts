import { describe, it, expect } from "vitest";
import { loadConfig, parseEnvFile } from "./env.ts";

describe("parseEnvFile (VPS-10)", () => {
  it("parses key=value lines, ignores comments and blanks", () => {
    const text = [
      "# comment",
      "",
      "MAPILLARY_CLIENT_ID=MLY|abc|def",
      'QUOTED="hello world"',
      "SPACED =  padded  ",
    ].join("\n");
    expect(parseEnvFile(text)).toEqual({
      MAPILLARY_CLIENT_ID: "MLY|abc|def",
      QUOTED: "hello world",
      SPACED: "padded",
    });
  });
});

describe("loadConfig (VPS-10, spec 82-83: credentials live in the service only)", () => {
  const base = {
    MAPILLARY_CLIENT_ID: "MLY|real|token",
  };

  it("applies documented defaults for everything but the credential", () => {
    const config = loadConfig({ ...base });
    expect(config.mapillary.baseUrl).toBe("https://graph.mapillary.com");
    expect(config.overpass.endpoint).toBe("https://overpass-api.de/api/interpreter");
    expect(config.cacheDir).toBe(".vps-cache");
    expect(config.ttlMs).toBe(604_800_000); // 7 days
    expect(config.rateLimitPerMin).toBe(60);
    expect(config.port).toBe(8787);
  });

  it("honors overrides", () => {
    const config = loadConfig({
      ...base,
      MAPILLARY_BASE_URL: "https://example.test",
      VPS_TTL_MS: "1234",
      VPS_PORT: "9999",
      VPS_RATE_LIMIT_PER_MIN: "5",
    });
    expect(config.mapillary.baseUrl).toBe("https://example.test");
    expect(config.ttlMs).toBe(1234);
    expect(config.port).toBe(9999);
    expect(config.rateLimitPerMin).toBe(5);
  });

  it("refuses a missing or placeholder client id (fail fast, no silent unauthenticated calls)", () => {
    expect(() => loadConfig({})).toThrow(/MAPILLARY_CLIENT_ID/);
    expect(() => loadConfig({ MAPILLARY_CLIENT_ID: "MLY|YOUR_CLIENT_ID_HERE" })).toThrow(/placeholder/);
  });

  it("omits the gemini section when no key is provided (service stays OSM-only)", () => {
    expect(loadConfig({ ...base }).gemini).toBeUndefined();
  });

  it("applies gemini defaults when a key is present (VPS-11: vision key is server-side only)", () => {
    const config = loadConfig({ ...base, GEMINI_API_KEY: "gm-test" });
    expect(config.gemini).toEqual({
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      apiKey: "gm-test",
      model: "gemini-3.6-flash",
    });
  });

  it("honors gemini overrides and trims trailing slashes", () => {
    const config = loadConfig({
      ...base,
      GEMINI_API_KEY: "gm-test",
      GEMINI_BASE_URL: "https://example.test/",
      GEMINI_MODEL: "gemini-3.6-flash-x",
    });
    expect(config.gemini?.baseUrl).toBe("https://example.test");
    expect(config.gemini?.model).toBe("gemini-3.6-flash-x");
  });

  it("refuses a placeholder gemini key (fail fast, no silent test-mode in production)", () => {
    expect(() => loadConfig({ ...base, GEMINI_API_KEY: "gm-YOUR_GEMINI_API_KEY_HERE" })).toThrow(/placeholder/);
  });

  it("rejects non-numeric numeric values", () => {
    expect(() => loadConfig({ ...base, VPS_TTL_MS: "soon" })).toThrow(/VPS_TTL_MS/);
    expect(() => loadConfig({ ...base, VPS_PORT: "abc" })).toThrow(/VPS_PORT/);
  });
});
