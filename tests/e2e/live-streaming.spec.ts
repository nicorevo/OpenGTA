import { expect, test } from "@playwright/test";
import { liveWorld } from "../fixtures/live-world.ts";

test("drives over three chunk borders without recreating the vehicle", async ({ page, baseURL }) => {
  test.setTimeout(90000);
  let requests = 0;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) => {
    if (route.request().url().includes("/__test-geo")) { requests++; return route.fulfill({ json: liveWorld }); }
    if (route.request().url().startsWith(baseURL!)) return route.continue();
    errors.push("Unexpected remote request"); return route.abort();
  });
  await page.goto(`/?mode=open-world-live&provider=http&endpoint=${encodeURIComponent(baseURL + "/__test-geo")}&consent=1`);
  await expect(page.locator("#session-status")).toHaveAttribute("data-state", "ready");
  const position = () => page.evaluate(() => (window as unknown as { __opengtaV0Debug: { vehicle(): { position: { x: number } } } }).__opengtaV0Debug.vehicle().position.x);
  await page.keyboard.down("w");
  await expect.poll(position, { timeout: 40000, intervals: [200] }).toBeGreaterThan(400);
  const landmark = await page.evaluate(() => (window as unknown as { __opengtaV0Debug: { session(): { features: string[] } } }).__opengtaV0Debug.session().features);
  expect(landmark.some((id) => id.includes("2000"))).toBe(true);
  await page.screenshot({ path: "/tmp/opengta-streaming-landmark.png" });
  await expect.poll(position, { timeout: 75000, intervals: [200] }).toBeGreaterThan(920);
  await expect.poll(position, { timeout: 15000, intervals: [200] }).toBeGreaterThan(1070);
  const steps = () => page.evaluate(() => (window as unknown as { __opengtaV0Metrics: { snapshot(): { physicsSteps: number } } }).__opengtaV0Metrics.snapshot().physicsSteps);
  const beforeCollision = await steps();
  await expect.poll(steps).toBeGreaterThan(beforeCollision + 120);
  expect(await position()).toBeLessThan(1079);
  await page.keyboard.up("w");
  const snapshot = await page.evaluate(() => (window as unknown as { __opengtaV0Debug: { session(): { runtime: { active: string[]; cacheSize: number; records: number }; colliders: number } } }).__opengtaV0Debug.session());
  expect(snapshot.runtime.active).toContain("chunk:3:0");
  expect(snapshot.runtime.cacheSize).toBeLessThanOrEqual(9);
  expect(snapshot.runtime.records).toBeLessThanOrEqual(12);
  expect(requests).toBeGreaterThan(4);
  expect(errors).toEqual([]);
  await page.screenshot({ path: "/tmp/opengta-streaming-desktop.png" });
});
