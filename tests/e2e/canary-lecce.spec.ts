import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";

// Live canary against the real Overpass provider. Skipped unless
// OPENGTA_CANARY=1, so the deterministic CI never contacts the public
// service. Run manually or nightly with `npm run test:canary`.
test("Lecce centre loads a playable P0 from the real provider", async ({ page }) => {
  test.skip(process.env.OPENGTA_CANARY !== "1", "live canary: run explicitly with OPENGTA_CANARY=1");
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const started = Date.now();
  await page.goto("/?mode=open-world-live&provider=osm&lat=40.35316888888889&lon=18.17259&consent=1");
  await expect(page.locator("#session-status")).toHaveAttribute("data-state", /ready|degraded|error/, { timeout: 90000 });
  const snapshot = await page.evaluate(() => (window as unknown as { __opengtaV0Debug: { session(): { state: string; firstPlayableMs: number; runtime: { active: string[]; errors: Record<string, string>; records: number }; roads: number; buildings: number; colliders: number; warnings: number } } }).__opengtaV0Debug.session());
  const report = { date: new Date().toISOString(), endpoint: "https://overpass-api.de/api/interpreter", elapsedMs: Date.now() - started, ...snapshot, pageErrors: errors };
  await writeFile("/tmp/opengta-canary-lecce.json", JSON.stringify(report, null, 2));
  console.log("CANARY_MEASUREMENT", JSON.stringify(report));
  // The canary fails when the provider cannot deliver a playable P0: that
  // is the alert this suite exists for. The report is always written first.
  expect(snapshot.state).not.toBe("error");
  expect(snapshot.runtime.active.length).toBeGreaterThan(0);
  expect(snapshot.roads).toBeGreaterThan(0);
  expect(snapshot.buildings).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
