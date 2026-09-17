import { expect, test } from "@playwright/test";

type Vehicle = { position: { x: number; y: number }; velocity: { x: number; y: number }; heading: number };

// Touch emulation with a 1x scale factor: boundingBox is reported in CSS px,
// so a lower deviceScaleFactor does not change the layout assertions while
// keeping the context light enough to survive the fully-parallel suite.
const touchContext = (browser: import("@playwright/test").Browser, baseURL: string | undefined) =>
  browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 393, height: 851 }, deviceScaleFactor: 1, baseURL });

test("mobile touch controls are large and present, and Vie toggles street names", async ({ browser, baseURL }) => {
  const context = await touchContext(browser, baseURL);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?mode=offline");
  test.setTimeout(90000);
  await expect.poll(() => page.evaluate(() => "__opengtaV0Debug" in window), { timeout: 30000 }).toBe(true);

  // The on-screen driving controls are rendered large enough for a thumb.
  const gas = page.getByLabel("Accelerazione");
  const reverse = page.getByLabel("Indietro");
  const steerLeft = page.getByLabel("Sterza sinistra");
  const steerRight = page.getByLabel("Sterza destra");
  for (const control of [gas, reverse, steerLeft, steerRight]) {
    await expect(control).toBeVisible();
    const box = (await control.boundingBox())!;
    expect(box.width).toBeGreaterThan(80);
    expect(box.height).toBeGreaterThan(80);
  }

  // The zoom bar is enlarged on touch and includes the street-name toggle.
  const zoomIn = page.getByLabel("Aumenta zoom");
  const zoomOut = page.getByLabel("Riduci zoom");
  const vie = page.getByLabel("Mostra nomi delle vie");
  for (const control of [zoomIn, zoomOut, vie]) {
    await expect(control).toBeVisible();
    const box = (await control.boundingBox())!;
    expect(box.height).toBeGreaterThan(40);
  }

  // The zoom bar (enlarged on touch: dark container + street toggle) must not
  // overlap the live-controls panel, even with the panel expanded. Checking the
  // whole bar container (not just the street button) also catches the padding.
  const rectIntersect = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
    a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  await page.locator("#live-controls summary").click();
  const panelBox = (await page.locator("#live-controls").boundingBox())!;
  const zoomBarBox = (await page.locator("#zoom-bar").boundingBox())!;
  expect(rectIntersect(panelBox, zoomBarBox)).toBe(false);

  // The street button toggles the street names (same state as the "L" key).
  await vie.click();
  await expect(page.locator("p")).toContainText("Nomi attivi");
  await vie.click();
  await expect(page.locator("p")).not.toContainText("Nomi attivi");
  await expect(page.locator("p")).toContainText("OpenGTA");
  expect(errors).toEqual([]);
  await context.close();
});

test("mobile touch controls drive the vehicle", async ({ browser, baseURL }) => {
  const context = await touchContext(browser, baseURL);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?mode=offline");
  test.setTimeout(90000);
  await expect.poll(() => page.evaluate(() => "__opengtaV0Debug" in window), { timeout: 30000 }).toBe(true);

  const vehicle = () => page.evaluate(() => (window as unknown as { __opengtaV0Debug: { vehicle: () => Vehicle } }).__opengtaV0Debug.vehicle());
  const gas = page.getByLabel("Accelerazione");
  const reverse = page.getByLabel("Indietro");
  const steerLeft = page.getByLabel("Sterza sinistra");

  // Hold the gas pedal: the vehicle must accelerate from rest.
  const start = await vehicle();
  await gas.dispatchEvent("pointerdown");
  await expect.poll(async () => {
    const v = await vehicle();
    return Math.hypot(v.position.x - start.position.x, v.position.y - start.position.y);
  }, { timeout: 15000 }).toBeGreaterThan(5);

  // While moving, the left steer control must turn the vehicle.
  const headingBefore = (await vehicle()).heading;
  await steerLeft.dispatchEvent("pointerdown");
  await expect.poll(async () => Math.abs((await vehicle()).heading - headingBefore), { timeout: 15000 }).toBeGreaterThan(0.05);
  await gas.dispatchEvent("pointerup");
  await steerLeft.dispatchEvent("pointerup");

  // Reverse (indietro) must drive the vehicle backwards (negative longitudinal
  // velocity: velocity projected onto the heading direction is negative).
  await reverse.dispatchEvent("pointerdown");
  await expect.poll(async () => {
    const v = await vehicle();
    const forward = { x: Math.cos(v.heading), y: Math.sin(v.heading) };
    return v.velocity.x * forward.x + v.velocity.y * forward.y;
  }, { timeout: 15000 }).toBeLessThan(-0.5);
  await reverse.dispatchEvent("pointerup");

  expect(errors).toEqual([]);
  await context.close();
});
