import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_ORIGIN } from "../../src/world/runtime/live-config.ts";
import { OPENFREEMAP_TILE_BASE_URL } from "../../src/world/runtime/vector-tile/provider.ts";

const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";
const TILE_BYTES = readFileSync(new URL("../../src/fixtures/geo/lecce-z14-openfreemap.pbf", import.meta.url));

const ROME_REVERSE_PAYLOAD = {
  place_id: 3193603314,
  display_name: "Roma, Municipio Roma I Centro, Città metropolitana di Roma Capitale, Lazio, Italia",
  lat: String(DEFAULT_ORIGIN.latitude),
  lon: String(DEFAULT_ORIGIN.longitude),
  address: {
    country: "Italy",
    country_code: "it",
    state: "Lazio",
    city: "Roma",
    city_district: "Centro Storico",
  },
};

interface ThemeDebug {
  readonly id: string;
  readonly location: { countryCode?: string; locality?: string } | null;
}

async function installRoutes(page: Page, baseURL: string, reverse: { status?: number; payload?: unknown } = {}): Promise<{ reverseCalls: string[] }> {
  const reverseCalls: string[] = [];
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.startsWith(baseURL)) return route.continue();
    if (url.startsWith(NOMINATIM_REVERSE_URL)) {
      reverseCalls.push(url);
      return route.fulfill({ status: reverse.status ?? 200, contentType: "application/json", body: JSON.stringify(reverse.payload ?? ROME_REVERSE_PAYLOAD) });
    }
    if (url.startsWith(OPENFREEMAP_TILE_BASE_URL)) {
      return route.fulfill({ status: 200, contentType: "application/x-protobuf", body: TILE_BYTES });
    }
    return route.abort();
  });
  return { reverseCalls };
}

// The debug snapshot exists only after bootstrap finished the async setup,
// so the poll helper reports "pending" instead of throwing while it is absent.
const theme = (page: Page) => page.evaluate(
  () => (window as unknown as { __opengtaV0Debug: { theme(): ThemeDebug } }).__opengtaV0Debug.theme(),
);
const themeId = (page: Page) => page.evaluate(
  () => (window as unknown as { __opengtaV0Debug?: { theme(): ThemeDebug } }).__opengtaV0Debug?.theme().id ?? "pending",
);

test("offline mode applies a forced theme without geocoding", async ({ page, baseURL }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const { reverseCalls } = await installRoutes(page, baseURL!);
  await page.goto("/?mode=offline&theme=paris&consent=1");
  await expect.poll(() => themeId(page)).toBe("paris");
  await page.waitForTimeout(500);
  expect(reverseCalls).toHaveLength(0);
  expect(errors).toEqual([]);
});

test("offline mode accepts every valid registry theme and rejects unknown ids", async ({ page, baseURL }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const { reverseCalls } = await installRoutes(page, baseURL!);
  await page.goto("/?mode=offline&theme=rome&consent=1");
  await expect.poll(() => themeId(page)).toBe("rome");
  await page.goto("/?mode=offline&theme=tokyo&consent=1");
  await expect.poll(() => themeId(page)).toBe("tokyo");
  // invalid id: degrade to auto resolution (no location -> default), no crash
  await page.goto("/?mode=offline&theme=bogus&consent=1");
  await expect.poll(() => themeId(page)).toBe("default");
  await page.goto("/?mode=offline&consent=1");
  await expect.poll(() => themeId(page)).toBe("default");
  await page.waitForTimeout(500);
  expect(reverseCalls).toHaveLength(0);
  expect(errors).toEqual([]);
});

test("open world resolves the city theme from structured reverse data", async ({ page, baseURL }) => {
  test.setTimeout(30000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const { reverseCalls } = await installRoutes(page, baseURL!);
  await page.goto("/?consent=1");
  await expect.poll(() => themeId(page), { timeout: 20000 }).toBe("rome");
  const info = await theme(page);
  expect(info.location?.countryCode).toBe("IT");
  expect(info.location?.locality).toBe("Roma");
  // the reverse request must carry the structured-address contract
  expect(reverseCalls[0]).toContain("addressdetails=1");
  expect(errors).toEqual([]);
});

test("a failing reverse lookup keeps the current theme (no flicker, no crash)", async ({ page, baseURL }) => {
  test.setTimeout(30000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await installRoutes(page, baseURL!, { status: 500, payload: { error: "boom" } });
  await page.goto("/?consent=1");
  await expect(page.locator("#session-status")).toHaveAttribute("data-state", "ready", { timeout: 20000 });
  await expect.poll(() => themeId(page)).toBe("default");
  expect(errors).toEqual([]);
});
