import { describe, expect, it } from "vitest";
import { themeOverrideFromSearch } from "./override.ts";

const ids = new Set(["default", "italy", "rome", "france", "paris", "tokyo"]);

describe("themeOverrideFromSearch", () => {
  it("returns undefined when the theme parameter is missing", () => {
    expect(themeOverrideFromSearch("", ids)).toBeUndefined();
    expect(themeOverrideFromSearch("?mode=offline&consent=1", ids)).toBeUndefined();
  });

  it("treats auto as no override", () => {
    expect(themeOverrideFromSearch("?theme=auto", ids)).toBeUndefined();
  });

  it("returns the id for every valid theme", () => {
    for (const id of ["default", "italy", "rome", "france", "paris", "tokyo"]) {
      expect(themeOverrideFromSearch(`?theme=${id}`, ids)).toBe(id);
    }
  });

  it("returns undefined for invalid ids without throwing", () => {
    expect(themeOverrideFromSearch("?theme=bogus", ids)).toBeUndefined();
    expect(themeOverrideFromSearch("?theme=", ids)).toBeUndefined();
    // never a path, a URL or an injection vector: only the closed registry
    expect(themeOverrideFromSearch("?theme=../etc/passwd", ids)).toBeUndefined();
    expect(themeOverrideFromSearch("?theme=https://evil.example/x", ids)).toBeUndefined();
    expect(themeOverrideFromSearch("?theme=rome;drop table", ids)).toBeUndefined();
    expect(themeOverrideFromSearch("?theme=import('x')", ids)).toBeUndefined();
  });

  it("normalizes case/whitespace before the closed-registry lookup", () => {
    expect(themeOverrideFromSearch("?theme=Paris", ids)).toBe("paris");
    expect(themeOverrideFromSearch("?theme=  rome  ", ids)).toBe("rome");
  });

  it("ignores other parameters and repeated values take the first", () => {
    expect(themeOverrideFromSearch("?mode=offline&theme=paris&consent=1", ids)).toBe("paris");
    expect(themeOverrideFromSearch("?theme=paris&theme=bogus", ids)).toBe("paris");
  });
});
