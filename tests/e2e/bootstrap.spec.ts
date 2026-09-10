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
  await expect.poll(() => page.evaluate(() => "__opengtaV0Debug" in window)).toBe(true);
  await page.keyboard.press("F3");
  await expect(page.locator("#debug-overlay")).toContainText("region: open-world:chunk:0:0");
  await expect(page.locator("#debug-overlay")).toContainText("physics steps:");
  expect(pageErrors).toEqual([]);
});

test("reports a valid empty live area without starting a vehicle", async ({ page, baseURL }) => {
  const pageErrors: string[] = [];
  const unexpected: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (url.includes("/__test-geo")) return route.fulfill({ contentType: "application/json", body: JSON.stringify({ elements: [] }) });
    if (url.startsWith(baseURL!)) return route.continue();
    unexpected.push(url); return route.abort();
  });

  await page.goto(`/?mode=open-world-live&lat=40.35&lon=18.17&endpoint=${encodeURIComponent(baseURL + "/__test-geo")}&consent=1`);
  await expect(page.locator("#session-status")).toHaveAttribute("data-state", "empty", { timeout: 15000 });
  expect(pageErrors, pageErrors.join("\n")).toEqual([]);
  await expect(page.getByRole("button", { name: "Riprova", exact: true })).toBeVisible();
  expect(unexpected).toEqual([]);
});
