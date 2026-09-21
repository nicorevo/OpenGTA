import { expect, test } from "@playwright/test";
import { liveWorld } from "../fixtures/live-world.ts";
import { mockReverseGeocoding } from "../fixtures/geocode-mock.ts";

test("zoom buttons clamp at the limits and driving keeps working", async ({ page, baseURL }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (url.includes("/__test-geo")) return route.fulfill({ json: liveWorld });
    if (url.startsWith(baseURL!)) return route.continue();
    errors.push("Unexpected remote request"); return route.abort();
  });
  await mockReverseGeocoding(page);
  const zoomLevel = () => page.evaluate(() => (window as unknown as { __opengtaV0Debug: { session(): { zoomLevel: number } } }).__opengtaV0Debug.session().zoomLevel);
  const position = () => page.evaluate(() => (window as unknown as { __opengtaV0Debug: { vehicle(): { position: { x: number } } } }).__opengtaV0Debug.vehicle().position.x);
  await page.goto(`/?mode=open-world-live&provider=http&endpoint=${encodeURIComponent(baseURL + "/__test-geo")}&consent=1`);
  await expect(page.locator("#session-status")).toHaveAttribute("data-state", "ready");
  expect(await zoomLevel()).toBe(3);
  const plus = page.getByRole("button", { name: "Aumenta zoom" });
  const minus = page.getByRole("button", { name: "Riduci zoom" });
  await plus.click();
  await expect.poll(zoomLevel).toBe(4);
  await plus.click();
  await expect.poll(zoomLevel).toBe(5);
  await expect(plus).toBeDisabled();
  await minus.click();
  await minus.click();
  await minus.click();
  await minus.click();
  await minus.click();
  await expect.poll(zoomLevel).toBe(0);
  await expect(minus).toBeDisabled();
  // AC2 (G2D-01): zoom in/out non sposta la posa fisica del veicolo a riposo.
  const atRestX = await position();
  await page.keyboard.press("=");
  await expect.poll(zoomLevel).toBe(1);
  await expect.poll(position).toBe(atRestX);
  await page.keyboard.press("=");
  await expect.poll(zoomLevel).toBe(2);
  await expect.poll(position).toBe(atRestX);
  // Keyboard shortcuts and driving right after a click.
  const before = await position();
  await page.keyboard.down("w");
  await expect.poll(position).toBeGreaterThan(before + 1);
  await page.keyboard.up("w");
  // Responsive: buttons stay within the viewport at mobile size.
  await page.setViewportSize({ width: 390, height: 844 });
  const bounds = await plus.boundingBox();
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(errors).toEqual([]);
});
