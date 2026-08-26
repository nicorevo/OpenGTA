import { expect, test } from "@playwright/test";

type VehicleSnapshot = {
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  heading: number;
};

test("boots V0 and drives with keyboard input", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await expect(page.locator("canvas")).toHaveAttribute("aria-label", "OpenGTA Web V0 world");

  await page.keyboard.press("F3");
  await expect(page.locator("#debug-overlay")).toBeVisible();
  await expect(page.locator("#debug-overlay")).toContainText("physics steps:");

  const initial = await page.evaluate(() => {
    const debug = (window as unknown as Window & {
      __opengtaV0Debug: { vehicle: () => VehicleSnapshot };
    }).__opengtaV0Debug;
    return debug.vehicle();
  });
  await page.keyboard.down("w");
  await page.waitForTimeout(500);
  await page.keyboard.up("w");

  await expect
    .poll(async () => {
      const snapshot = await page.evaluate(() => {
        const debug = (window as unknown as Window & {
          __opengtaV0Debug: { vehicle: () => VehicleSnapshot };
        }).__opengtaV0Debug;
        return debug.vehicle();
      });
      return Math.hypot(snapshot.position.x - initial.position.x, snapshot.position.y - initial.position.y);
    })
    .toBeGreaterThan(0);

  await page.keyboard.press("l");
  await expect(page.locator("p")).toContainText("Nomi attivi");
  expect(pageErrors).toEqual([]);
});

test("boots the Open World Runtime mode from selectable coordinates", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/?mode=open-world&lat=40.35&lon=18.17");
  await page.keyboard.press("F3");
  await expect(page.locator("#debug-overlay")).toContainText("region: open-world:chunk:0:0");
  await expect(page.locator("#debug-overlay")).toContainText("physics steps:");
  expect(pageErrors).toEqual([]);
});

test("uses an explicitly consented live endpoint without hidden network dependencies", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("https://geo.test/query**", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ elements: [] }) });
  });

  await page.goto("/?mode=open-world-live&lat=40.35&lon=18.17&endpoint=https%3A%2F%2Fgeo.test%2Fquery&consent=1");
  await page.waitForTimeout(500);
  expect(pageErrors, pageErrors.join("\n")).toEqual([]);
  await page.keyboard.press("F3");
  await expect(page.locator("#debug-overlay")).toContainText("region: open-world:chunk:0:0");
  expect(pageErrors).toEqual([]);
});
