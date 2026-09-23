import { describe, expect, it } from "vitest";
import { readVpsServiceUrl } from "./service-url.ts";

const DEV = { developmentOrigin: "http://127.0.0.1:5180" };
const PROD: { developmentOrigin?: string } = {};
const params = (value: string | null) => new URLSearchParams(value === null ? "" : `vpsService=${value}`);

describe("readVpsServiceUrl", () => {
  it("returns undefined when the parameter is absent", () => {
    expect(readVpsServiceUrl(new URLSearchParams(), DEV)).toBeUndefined();
  });

  it("accepts a same-origin local URL in development", () => {
    expect(readVpsServiceUrl(params("http://127.0.0.1:5180"), DEV)).toBe("http://127.0.0.1:5180");
  });

  it("accepts any local origin in development (the service dev port)", () => {
    expect(readVpsServiceUrl(params("http://localhost:8787"), DEV)).toBe("http://localhost:8787");
  });

  it("rejects remote URLs in development", () => {
    expect(() => readVpsServiceUrl(params("http://vps.example.com"), DEV)).toThrow();
    expect(() => readVpsServiceUrl(params("https://vps.example.com"), DEV)).toThrow();
  });

  it("accepts https URLs in production", () => {
    expect(readVpsServiceUrl(params("https://vps.example.com"), PROD)).toBe("https://vps.example.com");
  });

  it("rejects http URLs in production", () => {
    expect(() => readVpsServiceUrl(params("http://vps.example.com"), PROD)).toThrow();
  });

  it("rejects credentials, query and hash in any environment", () => {
    expect(() => readVpsServiceUrl(params("http://user:pass@localhost:8787"), DEV)).toThrow();
    expect(() => readVpsServiceUrl(params("http://localhost:8787?x=1"), DEV)).toThrow();
    expect(() => readVpsServiceUrl(params("https://vps.example.com#frag"), PROD)).toThrow();
  });

  it("normalizes a trailing slash and rejects relative or malformed URLs", () => {
    expect(readVpsServiceUrl(params("http://127.0.0.1:5180/"), DEV)).toBe("http://127.0.0.1:5180");
    expect(() => readVpsServiceUrl(params("/v1"), DEV)).toThrow();
    expect(() => readVpsServiceUrl(params("not a url"), PROD)).toThrow();
  });
});
