import { expect, test } from "@playwright/test";
import { liveWorld } from "../fixtures/live-world.ts";

test("chunk presentations grow and shrink only by the changed chunks", async ({ page, baseURL }) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (url.includes("/__test-geo")) return route.fulfill({ json: liveWorld });
    if (url.startsWith(baseURL!)) return route.continue();
    errors.push("Unexpected remote request"); return route.abort();
  });
  const presentation = () => page.evaluate(() => (window as unknown as { __opengtaV0Debug: { presentation(): { chunkPresentations: number; graphicsObjects: number } } }).__opengtaV0Debug.presentation());
  await page.goto(`/?mode=open-world-live&endpoint=${encodeURIComponent(baseURL + "/__test-geo")}&consent=1`);
  await expect(page.locator("#session-status")).toHaveAttribute("data-state", "ready");
  const early = await presentation();
  expect(early.chunkPresentations).toBeGreaterThanOrEqual(1);
  await expect.poll(async () => (await page.evaluate(() => (window as unknown as { __opengtaV0Debug: { session(): { runtime: { pending: string[] } } } }).__opengtaV0Debug.session().runtime.pending.length)), { timeout: 20000 }).toBe(0);
  const loaded = await presentation();
  expect(loaded.chunkPresentations).toBeGreaterThan(early.chunkPresentations);
  expect(loaded.graphicsObjects).toBe(loaded.chunkPresentations * 5);
  // No demand change: presentations must not churn while idle.
  await page.waitForTimeout(1500);
  const idle = await presentation();
  expect(idle).toEqual(loaded);
  // Drive across one chunk border: only the delta chunks change resources.
  const position = () => page.evaluate(() => (window as unknown as { __opengtaV0Debug: { vehicle(): { position: { x: number } } } }).__opengtaV0Debug.vehicle().position.x);
  await page.keyboard.down("w");
  await expect.poll(position, { timeout: 40000, intervals: [200] }).toBeGreaterThan(400);
  await page.keyboard.up("w");
  await expect.poll(async () => (await page.evaluate(() => (window as unknown as { __opengtaV0Debug: { session(): { runtime: { pending: string[] } } } }).__opengtaV0Debug.session().runtime.pending.length)), { timeout: 20000 }).toBe(0);
  const crossed = await presentation();
  expect(crossed.chunkPresentations).toBeLessThanOrEqual(12);
  expect(crossed.graphicsObjects).toBe(crossed.chunkPresentations * 5);
  expect(errors).toEqual([]);
});
