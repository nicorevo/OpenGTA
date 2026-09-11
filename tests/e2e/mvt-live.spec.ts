import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

test("reaches first playable and crosses 10+ distinct chunks with provider=openfreemap-mvt", async ({ page, baseURL }) => {
  test.setTimeout(300000);
  // Every tile request is served the pinned Lecce fixture: the world repeats
  // the tile pattern per chunk, which keeps the road the vehicle spawned on
  // continuous across cell boundaries. Real tile fetches are measured by
  // DATA-10, not by this spec.
  const tileBytes = readFileSync(new URL("../../src/fixtures/geo/lecce-z14-openfreemap.pbf", import.meta.url));
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) => {
    if (route.request().url().startsWith(baseURL!)) return route.continue();
    errors.push("Unexpected remote request: " + route.request().url());
    return route.abort();
  });
  await page.route("**://tiles.openfreemap.org/**", (route) => {
    if (route.request().url().includes("/planet/20260830_080001_pt/14/")) return route.fulfill({ status: 200, contentType: "application/x-protobuf", body: tileBytes });
    errors.push("Unexpected tile request: " + route.request().url());
    return route.abort();
  });

  // Spawn origin pinned to the longest straight drivable span of the
  // fixture tile (minor road heading east, 774 m, deviation < 4 m; probed
  // at DATA-11 time). Each 300 m chunk is a window of the tile, so the
  // vehicle drives straight until the span curves (~716 m measured): the
  // 600 m target leaves margin while the active window slides over 10+
  // distinct chunks.
  await page.goto(`/?mode=open-world-live&provider=openfreemap-mvt&consent=1&lat=40.352027&lon=18.181308`);
  await expect(page.locator("#session-status")).toHaveAttribute("data-state", "ready");

  const debug = () => page.evaluate(() => {
    const handle = (window as unknown as {
      __opengtaV0Debug: {
        vehicle(): { position: { x: number; y: number } } | undefined;
        session(): { firstPlayableMs?: number; state: string; blocked: boolean; runtime: { active: string[]; ready: string[]; errors: Record<string, string> } };
      };
    }).__opengtaV0Debug;
    const vehicle = handle.vehicle();
    return { x: vehicle?.position.x ?? 0, y: vehicle?.position.y ?? 0, s: handle.session() };
  });
  const first = await debug();
  expect(first.s.firstPlayableMs).toBeGreaterThan(0);
  expect(first.s.state).toBe("ready");

  const seen = new Set<string>();
  const trace: string[] = [];
  await page.keyboard.down("w");
  const started = Date.now();
  let targetReached = false;
  let sampleAt = 0;
  while (Date.now() - started < 120000) {
    const { x, y, s } = await debug();
    for (const id of [...s.runtime.active, ...s.runtime.ready]) seen.add(id);
    if (Date.now() > sampleAt) {
      sampleAt = Date.now() + 3000;
      trace.push(`${((Date.now() - started) / 1000).toFixed(0)}s x=${x.toFixed(0)} y=${y.toFixed(0)} dist=${Math.hypot(x, y).toFixed(0)} blocked=${s.blocked ? 1 : 0}`);
    }
    if (Math.hypot(x, y) >= 600) { targetReached = true; break; }
    await page.waitForTimeout(150);
  }
  await page.keyboard.up("w");
  await page.screenshot({ path: "/tmp/opengta-mvt-live.png" });

  expect(targetReached, `vehicle must drive 600 m; seen chunks: ${[...seen].join(",")}\ntrace:\n${trace.join("\n")}`).toBe(true);
  expect(seen.size).toBeGreaterThanOrEqual(10);
  const final = await debug();
  expect(final.s.state).toBe("ready");
  expect(Object.keys(final.s.runtime.errors)).toEqual([]);
  expect(errors).toEqual([]);
  await page.screenshot({ path: "/tmp/opengta-mvt-live.png" });
});
