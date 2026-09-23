import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { OPENFREEMAP_TILE_BASE_URL } from "../../src/world/runtime/vector-tile/provider.ts";
import { romeProfile } from "../../src/render/theme/profiles/rome.ts";

const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";
const TILE_BYTES = readFileSync(new URL("../../src/fixtures/geo/lecce-z14-openfreemap.pbf", import.meta.url));

const ROME_REVERSE_PAYLOAD = {
  place_id: 3193603314,
  display_name: "Roma, Municipio Roma I Centro, Città metropolitana di Roma Capitale, Lazio, Italia",
  lat: "41.8902",
  lon: "12.4922",
  address: {
    country: "Italy",
    country_code: "it",
    state: "Lazio",
    city: "Roma",
    city_district: "Centro Storico",
  },
};

const GENERATED_PROFILE = { ...romeProfile, id: "vps:v1:e2e-cell:c1" };
const VPS_BODY = {
  source: "generated",
  cell: { id: "h3:e2e-cell", center: { latitude: 41.8902, longitude: 12.4922 } },
  servedAt: "2026-09-22T00:00:00Z",
  profile: GENERATED_PROFILE,
};

interface VpsDebug {
  readonly cellId: string | null;
  readonly state: "idle" | "loading" | "applied" | "failed";
  readonly profileId?: string;
  readonly source?: string;
  readonly error?: string;
}

async function installRoutes(
  page: Page,
  baseURL: string,
  vps: { status?: number; body?: unknown } = {},
): Promise<{ profileCalls: string[]; reverseCalls: string[] }> {
  const profileCalls: string[] = [];
  const reverseCalls: string[] = [];
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.startsWith(baseURL)) {
      if (url.includes("/v1/profile")) {
        profileCalls.push(url);
        return route.fulfill({
          status: vps.status ?? 200,
          contentType: "application/json",
          body: JSON.stringify(vps.body ?? VPS_BODY),
        });
      }
      return route.continue();
    }
    if (url.startsWith(NOMINATIM_REVERSE_URL)) {
      reverseCalls.push(url);
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ROME_REVERSE_PAYLOAD) });
    }
    if (url.startsWith(OPENFREEMAP_TILE_BASE_URL)) {
      return route.fulfill({ status: 200, contentType: "application/x-protobuf", body: TILE_BYTES });
    }
    return route.abort();
  });
  return { profileCalls, reverseCalls };
}

const themeId = (page: Page) => page.evaluate(
  () => (window as unknown as { __opengtaV0Debug?: { theme(): { id: string } } }).__opengtaV0Debug?.theme().id ?? "pending",
);
const vpsDebug = (page: Page) => page.evaluate(
  () => (window as unknown as { __opengtaV0Debug?: { vps?(): VpsDebug | null } }).__opengtaV0Debug?.vps?.() ?? null,
);

test("open world switches to the VPS generated profile from the service (spec 106)", async ({ page, baseURL }) => {
  test.setTimeout(30000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const { profileCalls } = await installRoutes(page, baseURL!);
  await page.goto(`/?consent=1&vpsService=${encodeURIComponent(baseURL!)}`);
  // Until the service answers the theme stays the LVP resolution (rome); the
  // background fetch then switches it to the generated profile.
  await expect.poll(() => themeId(page), { timeout: 20000 }).toBe("vps:v1:e2e-cell:c1");
  const vps = await vpsDebug(page);
  expect(vps).toMatchObject({ state: "applied", source: "generated", profileId: "vps:v1:e2e-cell:c1" });
  expect(vps?.cellId ?? "").toMatch(/^89/); // h3 res-9 cell index
  expect(profileCalls.length).toBeGreaterThanOrEqual(1);
  expect(profileCalls[0]).toContain("/v1/profile?lat=");
  expect(errors).toEqual([]);
});

test("a failing VPS service keeps the LVP theme and cools down (spec 80/106)", async ({ page, baseURL }) => {
  test.setTimeout(30000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const { profileCalls } = await installRoutes(page, baseURL!, { status: 500, body: { error: "boom" } });
  await page.goto(`/?consent=1&vpsService=${encodeURIComponent(baseURL!)}`);
  await expect.poll(() => themeId(page), { timeout: 20000 }).toBe("rome"); // LVP resolution intact
  await page.waitForTimeout(1000); // several 200 ms ticks: the cooldown must suppress retries
  const vps = await vpsDebug(page);
  expect(vps?.state).toBe("failed");
  expect(vps?.error).toBeTruthy();
  expect(profileCalls).toHaveLength(1); // one attempt, then quiet for the cooldown
  expect(errors).toEqual([]);
});

test("without vpsService the VPS layer is off and nothing is fetched", async ({ page, baseURL }) => {
  test.setTimeout(30000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const { profileCalls } = await installRoutes(page, baseURL!);
  await page.goto("/?consent=1");
  await expect.poll(() => themeId(page), { timeout: 20000 }).toBe("rome");
  await page.waitForTimeout(1000);
  expect(await vpsDebug(page)).toBeNull();
  expect(profileCalls).toHaveLength(0);
  expect(errors).toEqual([]);
});
