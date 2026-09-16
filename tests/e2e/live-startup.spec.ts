import { expect, test } from "@playwright/test";
import fixture from "../../src/fixtures/geo/lecce-sant-oronzo-v0.raw.json" with { type: "json" };
import { liveWorld } from "../fixtures/live-world.ts";

test("OSM live compiles real geometry using only the selected provider", async ({ page, baseURL }) => {
  const unexpected: string[] = [];
  const errors: string[] = [];
  let calls = 0;
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (request.url().startsWith(baseURL!)) return route.continue();
    if (request.url() !== "https://overpass-api.de/api/interpreter") {
      unexpected.push(request.url());
      return route.abort();
    }
    expect(request.method()).toBe("POST");
    expect(new URLSearchParams(request.postData()!).get("data")).toContain('nwr["building"]');
    calls++;
    return route.fulfill({ json: fixture });
  });
  await page.goto("/?mode=open-world-live&provider=osm&consent=1");
  await expect(page.locator('canvas[aria-label="OpenGTA Web V0 world"]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => "__opengtaV0Debug" in window), { timeout: 15000 }).toBe(true);
  await page.keyboard.press("F3");
  await expect(page.locator("#debug-overlay")).toContainText(/buildings: [1-9]/);
  await expect(page.locator("#debug-overlay")).toContainText(/roads: [1-9]/);
  expect(calls).toBeGreaterThan(0);
  expect(unexpected).toEqual([]);
  expect(errors).toEqual([]);
});

test("starts driving while a neighbor is delayed and recovers after an error", async ({ page, baseURL }) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let fail = true;
  let calls = 0;
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.includes("/__test-geo")) {
      calls++;
      if (fail) return route.fulfill({ status: 503, json: {} });
      if (calls > 5) await held;
      try { await route.fulfill({ json: liveWorld }); } catch { /* Session can abort a held response. */ }
      return;
    }
    if (url.startsWith(baseURL!)) return route.continue();
    errors.push("Unexpected remote request"); return route.abort();
  });
  await page.goto(`/?mode=open-world-live&endpoint=${encodeURIComponent(baseURL + "/__test-geo")}&consent=1`);
  await expect(page.locator("#session-status")).toHaveAttribute("data-state", "error", { timeout: 15000 });
  fail = false;
  await page.getByRole("button", { name: "Riprova", exact: true }).click();
  await expect(page.locator("#session-status")).toHaveAttribute("data-state", "ready", { timeout: 15000 });
  const position = () => page.evaluate(() => (window as unknown as { __opengtaV0Debug: { vehicle(): { position: { x: number } } } }).__opengtaV0Debug.vehicle().position.x);
  const before = await position();
  await page.keyboard.down("w");
  await expect.poll(position).toBeGreaterThan(before + 1);
  await page.keyboard.up("w");
  release();
  expect(calls).toBeGreaterThan(4);
  expect(errors).toEqual([]);
});

test("offline and missing consent never contact a remote provider", async ({ page, baseURL }) => {
  const remote: string[] = [];
  await page.route("**/*", (route) => {
    if (route.request().url().startsWith(baseURL!)) return route.continue();
    remote.push(route.request().url());
    return route.abort();
  });
  await page.goto("/");
  await expect(page.locator('canvas[aria-label="OpenGTA Web V0 world"]')).toBeVisible();
  await page.goto("/?mode=open-world-live&provider=osm");
  await expect(page.locator("#config-error")).toContainText(/consent/i);
  expect(remote).toEqual([]);
});
