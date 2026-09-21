import { expect, test, type Page } from "@playwright/test";
import { latLonToTile } from "../../src/geo/mvt/math.ts";
import { DEFAULT_ORIGIN } from "../../src/world/runtime/live-config.ts";
import { OPENFREEMAP_TILE_BASE_URL } from "../../src/world/runtime/vector-tile/provider.ts";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

const TARANTO = { latitude: 40.4644421, longitude: 17.2468758 };
const TARANTO_CANDIDATES = [
  { place_id: 3134652, osm_type: "relation", osm_id: 3330830, lat: "40.4644421", lon: "17.2468758", display_name: "Taranto, Provincia di Taranto, Puglia, Italia", class: "place", type: "city" },
  { place_id: 3134700, osm_type: "way", osm_id: 1234567, lat: "40.4691000", lon: "17.2510000", display_name: "Taranto Vecchia, Taranto, Puglia, Italia", class: "place", type: "suburb" },
];

interface MockedRoutes {
  readonly geocodeCalls: string[];
  readonly tileUrls: string[];
}

async function installRoutes(page: Page, baseURL: string, options: { status?: number; payload?: unknown; delayMs?: number } = {}): Promise<MockedRoutes> {
  const geocodeCalls: string[] = [];
  const tileUrls: string[] = [];
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.startsWith(baseURL)) return route.continue();
    if (url.startsWith(NOMINATIM_URL)) {
      geocodeCalls.push(url);
      if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      return route.fulfill({ status: options.status ?? 200, contentType: "application/json", body: JSON.stringify(options.payload ?? TARANTO_CANDIDATES) });
    }
    if (url.startsWith(OPENFREEMAP_TILE_BASE_URL)) {
      tileUrls.push(url);
      return route.abort();
    }
    return route.abort();
  });
  return { geocodeCalls, tileUrls };
}

async function openPanel(page: Page) {
  await page.locator("#live-controls summary").click();
}

test("lists geocode candidates after the debounce", async ({ page, baseURL }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const { geocodeCalls } = await installRoutes(page, baseURL!);
  await page.goto("/?consent=1");
  await openPanel(page);
  await page.locator("input[name=place]").fill("tar");
  await expect(page.getByRole("option", { name: "Taranto, Provincia di Taranto, Puglia, Italia" })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("option", { name: "Taranto Vecchia, Taranto, Puglia, Italia" })).toBeVisible();
  expect(geocodeCalls).toHaveLength(1);
  expect(geocodeCalls[0]).toContain("q=tar");
  expect(errors).toEqual([]);
});

test("selecting a candidate fills the coordinates and starts the session on that tile", async ({ page, baseURL }) => {
  test.setTimeout(30000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const { tileUrls } = await installRoutes(page, baseURL!);
  await page.goto("/?consent=1");
  await openPanel(page);
  await page.locator("input[name=place]").fill("tar");
  const central = latLonToTile(TARANTO.latitude, TARANTO.longitude, 14);
  const expectedTileUrl = `${OPENFREEMAP_TILE_BASE_URL}/${central.z}/${central.x}/${central.y}.pbf`;
  await page.getByRole("option", { name: "Taranto, Provincia di Taranto, Puglia, Italia" }).click();
  await expect(page.locator("input[name=lat]")).toHaveValue(String(TARANTO.latitude));
  await expect(page.locator("input[name=lon]")).toHaveValue(String(TARANTO.longitude));
  await page.getByRole("button", { name: "Avvia" }).click();
  await expect.poll(() => tileUrls.includes(expectedTileUrl), { timeout: 20000 }).toBe(true);
  expect(errors).toEqual([]);
});

test("keyboard selection (ArrowDown + Enter) fills the coordinates", async ({ page, baseURL }) => {
  await installRoutes(page, baseURL!);
  await page.goto("/?consent=1");
  await openPanel(page);
  await page.locator("input[name=place]").fill("tar");
  const options = page.locator("#place-suggestions [role=option]");
  await expect(options.first()).toBeVisible({ timeout: 10000 });
  await page.locator("input[name=place]").press("ArrowDown");
  await page.locator("input[name=place]").press("Enter");
  await expect(page.locator("input[name=lat]")).toHaveValue(String(TARANTO.latitude));
  await expect(page.locator("input[name=lon]")).toHaveValue(String(TARANTO.longitude));
  await expect(page.locator("input[name=place]")).toHaveValue("Taranto, Provincia di Taranto, Puglia, Italia");
});

test("a one-character query performs no geocode request", async ({ page, baseURL }) => {
  const { geocodeCalls } = await installRoutes(page, baseURL!);
  await page.goto("/?consent=1");
  await openPanel(page);
  await page.locator("input[name=place]").fill("t");
  await page.waitForTimeout(900);
  expect(geocodeCalls).toHaveLength(0);
});

test("a 429 shows a rate-limit status and leaves the coordinates untouched", async ({ page, baseURL }) => {
  const { geocodeCalls } = await installRoutes(page, baseURL!, { status: 429, payload: { error: "rate limited" } });
  await page.goto("/?consent=1");
  await openPanel(page);
  await page.locator("input[name=place]").fill("tar");
  await expect(page.locator("#place-status")).toContainText(/troppo frequente/i, { timeout: 10000 });
  await expect(page.locator("input[name=lat]")).toHaveValue(String(DEFAULT_ORIGIN.latitude));
  expect(geocodeCalls).toHaveLength(1);
});

test("a slow geocoder fails with a timeout status", async ({ page, baseURL }) => {
  test.setTimeout(30000);
  await installRoutes(page, baseURL!, { delayMs: 6500 });
  await page.goto("/?consent=1");
  await openPanel(page);
  await page.locator("input[name=place]").fill("tar");
  await expect(page.locator("#place-status")).toContainText(/tempo scaduto/i, { timeout: 15000 });
});

test("offline mode disables the place search field", async ({ page, baseURL }) => {
  const { geocodeCalls } = await installRoutes(page, baseURL!);
  await page.goto("/?mode=offline&consent=1");
  await openPanel(page);
  await expect(page.locator("input[name=place]")).toBeDisabled();
  expect(geocodeCalls).toHaveLength(0);
});
