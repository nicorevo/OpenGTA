import { expect, test } from "@playwright/test";
import fixture from "../../src/fixtures/geo/lecce-sant-oronzo-v0.raw.json" with { type: "json" };

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
  await expect(page.locator("canvas")).toBeVisible();
  await page.keyboard.press("F3");
  await expect(page.locator("#debug-overlay")).toContainText(/buildings: [1-9]/);
  await expect(page.locator("#debug-overlay")).toContainText(/roads: [1-9]/);
  expect(calls).toBeGreaterThan(0);
  expect(unexpected).toEqual([]);
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
  await expect(page.locator("canvas")).toBeVisible();
  await page.goto("/?mode=open-world-live&provider=osm");
  await expect(page.locator("p")).toContainText(/consent/i);
  expect(remote).toEqual([]);
});
