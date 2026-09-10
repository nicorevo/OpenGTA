import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { liveWorld } from "../fixtures/live-world.ts";

for (const trial of [1, 2, 3]) test(`records cold and warm session measurements ${trial}`, async ({ page, baseURL }) => {
  test.setTimeout(40000);
  let requests = 0;
  await page.route("**/*", (route) => {
    if (route.request().url() === "https://overpass-api.de/api/interpreter") { requests++; return route.fulfill({ json: liveWorld }); }
    if (route.request().url().startsWith(baseURL!)) return route.continue();
    throw new Error("Unexpected remote request");
  });
  const snapshot = () => page.evaluate(() => {
    const debug = window as unknown as { __opengtaV0Debug: { session(): { firstPlayableMs: number; lastChunkAppliedMs: number; runtime: { pending: string[]; active: string[]; records: number; cacheSize: number }; colliders: number } }; __opengtaV0Metrics: { snapshot(): { frames: number; p95FrameMs: number; physicsSteps: number } } };
    return { session: debug.__opengtaV0Debug.session(), metrics: debug.__opengtaV0Metrics.snapshot() };
  });
  const navigationStart = performance.now();
  await page.goto("/?mode=open-world-live&provider=osm&consent=1");
  await expect(page.locator("#session-status")).toHaveAttribute("data-state", "ready");
  const navigationToReadyMs = performance.now() - navigationStart;
  await expect.poll(async () => (await snapshot()).session.runtime.pending.length, { timeout: 20000 }).toBe(0);
  const cold = await snapshot(); const coldRequests = requests;
  await page.getByRole("button", { name: "Interrompi", exact: true }).click();
  await page.getByRole("button", { name: "Riprova", exact: true }).click();
  await expect(page.locator("#session-status")).toHaveAttribute("data-state", "ready");
  await expect.poll(async () => (await snapshot()).metrics.frames).toBeGreaterThan(120);
  const warm = await snapshot();
  expect(requests).toBe(coldRequests);
  expect(cold.session.firstPlayableMs).toBeLessThan(cold.session.lastChunkAppliedMs);
  const measurement = { trial, navigationToReadyMs, coldRequests, warmRequests: requests - coldRequests, cold, warm };
  await writeFile(`/tmp/opengta-measurement-${trial}.json`, JSON.stringify(measurement, null, 2));
  console.log("ONLINE_MEASUREMENT", JSON.stringify(measurement));
});
