import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

test("first-person view (V) projects the road ahead of the vehicle", async ({ page, baseURL }) => {
  test.setTimeout(120000);
  // Same pinned-tile setup as mvt-live: the world repeats the fixture tile
  // and the spawn sits on the longest straight drivable span (east heading,
  // matching the vehicle's default heading of 0), so a correctly oriented
  // first-person camera sees the road run ahead of the vehicle.
  const tileBytes = readFileSync(new URL("../../src/fixtures/geo/lecce-z14-openfreemap.pbf", import.meta.url));
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) => {
    if (route.request().url().startsWith(baseURL!)) return route.continue();
    return route.abort();
  });
  await page.route("**://tiles.openfreemap.org/**", (route) => {
    if (route.request().url().includes("/planet/20260830_080001_pt/14/")) return route.fulfill({ status: 200, contentType: "application/x-protobuf", body: tileBytes });
    return route.abort();
  });

  await page.goto(`/?mode=open-world-live&provider=openfreemap-mvt&consent=1&lat=40.352027&lon=18.181308`);
  await expect(page.locator("#session-status")).toHaveAttribute("data-state", "ready");

  // Drive a few seconds on the straight span, then switch to first-person.
  await page.keyboard.down("w");
  await page.waitForTimeout(4000);
  await page.keyboard.up("w");
  await page.keyboard.press("v");
  await page.waitForTimeout(500);

  const diagnostics = await page.evaluate(() => (window as unknown as {
    __opengtaV0Debug: { firstPerson(): { chunks: number; roadItems: number; buildingItems: number } };
  }).__opengtaV0Debug.firstPerson());

  await page.screenshot({ path: "/tmp/opengta-fpv.png" });

  expect(diagnostics.chunks).toBeGreaterThan(0);
  // A camera aligned with the vehicle heading sees the straight road ahead:
  // dozens of segments within the 150 m render distance. A camera rotated
  // 90 degrees sees almost none (this regression shipped as proj: 3/35).
  expect(diagnostics.roadItems).toBeGreaterThan(5);
  expect(errors).toEqual([]);
});
