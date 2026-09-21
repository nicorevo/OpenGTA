import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_ORIGIN } from "../../src/world/runtime/live-config.ts";
import { OPENFREEMAP_TILE_BASE_URL } from "../../src/world/runtime/vector-tile/provider.ts";

const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";
const PLACE = "Lecce, Puglia, Italia";
const TILE_BYTES = readFileSync(new URL("../../src/fixtures/geo/lecce-z14-openfreemap.pbf", import.meta.url));

interface MockedRoutes {
  readonly reverseCalls: string[];
  readonly tileUrls: string[];
}

async function installRoutes(page: Page, baseURL: string, reverse: { status?: number; payload?: unknown } = {}): Promise<MockedRoutes> {
  const reverseCalls: string[] = [];
  const tileUrls: string[] = [];
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.startsWith(baseURL)) return route.continue();
    if (url.startsWith(NOMINATIM_REVERSE_URL)) {
      reverseCalls.push(url);
      return route.fulfill({ status: reverse.status ?? 200, contentType: "application/json", body: JSON.stringify(reverse.payload ?? { place_id: 2551, display_name: PLACE, lat: String(DEFAULT_ORIGIN.latitude), lon: String(DEFAULT_ORIGIN.longitude) }) });
    }
    if (url.startsWith(OPENFREEMAP_TILE_BASE_URL)) {
      tileUrls.push(url);
      return route.fulfill({ status: 200, contentType: "application/x-protobuf", body: TILE_BYTES });
    }
    return route.abort();
  });
  return { reverseCalls, tileUrls };
}

const status = (page: Page) => page.locator("#session-status");

function assertNearOrigin(url: string) {
  const params = new URL(url).searchParams;
  const lat = Number(params.get("lat"));
  const lon = Number(params.get("lon"));
  expect(Number.isFinite(lat)).toBe(true);
  expect(Number.isFinite(lon)).toBe(true);
  // The spawn pose lies on a road near the origin, inside the first 1000 m zone.
  expect(Math.abs(lat - DEFAULT_ORIGIN.latitude)).toBeLessThan(0.01);
  expect(Math.abs(lon - DEFAULT_ORIGIN.longitude)).toBeLessThan(0.01);
}

test("shows the mocked current place in the ready status", async ({ page, baseURL }) => {
  test.setTimeout(30000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const { reverseCalls, tileUrls } = await installRoutes(page, baseURL!);
  await page.goto("/?consent=1");
  await expect(status(page)).toContainText(PLACE, { timeout: 20000 });
  await expect(status(page)).toHaveAttribute("data-state", "ready");
  expect(reverseCalls).toHaveLength(1);
  assertNearOrigin(reverseCalls[0]!);
  expect(tileUrls.length).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("keeps Area pronta when the reverse lookup fails with HTTP 500", async ({ page, baseURL }) => {
  test.setTimeout(30000);
  const { reverseCalls } = await installRoutes(page, baseURL!, { status: 500, payload: { error: "boom" } });
  await page.goto("/?consent=1");
  await expect(status(page)).toHaveAttribute("data-state", "ready", { timeout: 20000 });
  await expect(status(page)).toContainText("Area pronta");
  expect(reverseCalls.length).toBeGreaterThanOrEqual(1);
});

test("keeps Area pronta when Nominatim has no data for the point", async ({ page, baseURL }) => {
  test.setTimeout(30000);
  const { reverseCalls } = await installRoutes(page, baseURL!, { payload: { error: "No data found for this location" } });
  await page.goto("/?consent=1");
  await expect(status(page)).toHaveAttribute("data-state", "ready", { timeout: 20000 });
  await expect(status(page)).toContainText("Area pronta");
  await page.waitForTimeout(3000);
  expect(reverseCalls).toHaveLength(1);
});

test("offline mode performs no reverse geocoding request", async ({ page, baseURL }) => {
  const { reverseCalls } = await installRoutes(page, baseURL!);
  await page.goto("/?mode=offline&consent=1");
  await expect(status(page)).toContainText("Offline");
  await page.waitForTimeout(1000);
  expect(reverseCalls).toHaveLength(0);
});
