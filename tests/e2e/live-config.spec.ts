import { expect, test } from "@playwright/test";
import { liveWorld } from "../fixtures/live-world.ts";

test("requires explicit consent, validates coordinates and cancels on revocation", async ({ page, baseURL }) => {
  test.setTimeout(90000);
  let requests = 0;
  const unexpected: string[] = [];
  await page.route("**/*", (route) => {
    if (route.request().url() === "https://overpass-api.de/api/interpreter") { requests++; return route.fulfill({ json: liveWorld }); }
    if (route.request().url().startsWith(baseURL!)) return route.continue();
    unexpected.push(route.request().url()); return route.abort();
  });
  await page.goto("/");
  await page.getByText("OpenGTA / Area di gioco", { exact: true }).click();
  await expect(page.getByLabel("Autorizzo l'invio delle coordinate al provider")).not.toBeChecked();
  await page.getByLabel("Modalita'").selectOption("open-world-live");
  await page.getByRole("button", { name: "Avvia", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(/consent/i);
  expect(requests).toBe(0);
  await page.getByLabel("Autorizzo l'invio delle coordinate al provider").check();
  await page.getByLabel("Latitudine").fill("91");
  await page.getByRole("button", { name: "Avvia", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Coordinate");
  expect(requests).toBe(0);
  await page.getByLabel("Latitudine").fill("40.35316888888889");
  // A previous submission can still be starting (WASM/Pixi init): wait until
  // the button is actionably enabled instead of racing the disabled state.
  const submit = page.getByRole("button", { name: "Avvia", exact: true });
  await expect(submit).toBeEnabled({ timeout: 30000 });
  await submit.click();
  await expect(page.locator("#session-status")).toHaveAttribute("data-state", "ready");
  await expect.poll(() => requests).toBeGreaterThan(0);
  await page.getByText("OpenGTA / Area di gioco", { exact: true }).click();
  await page.getByLabel("Autorizzo l'invio delle coordinate al provider").uncheck();
  await expect(page.locator("#session-status")).toContainText("Sessione interrotta");
  await page.setViewportSize({ width: 390, height: 844 });
  const bounds = await page.locator("#live-controls").boundingBox();
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await expect(page.locator("p")).toContainText("OpenStreetMap");
  await page.screenshot({ path: "/tmp/opengta-controls-mobile.png" });
  expect(unexpected).toEqual([]);
});

test("rejects a URL endpoint outside the trusted allowlist without contacting it", async ({ page }) => {
  let calls = 0;
  await page.route("https://evil.test/**", (route) => { calls++; return route.abort(); });
  await page.goto("/?mode=open-world-live&provider=osm&consent=1&endpoint=https://evil.test/query");
  await expect(page.getByRole("alert")).toContainText("Endpoint non autorizzato");
  expect(calls).toBe(0);
});

test("starts live mode with keyboard input only", async ({ page, baseURL }) => {
  let requests = 0;
  const unexpected: string[] = [];
  await page.route("**/*", (route) => {
    if (route.request().url() === "https://overpass-api.de/api/interpreter") { requests++; return route.fulfill({ json: liveWorld }); }
    if (route.request().url().startsWith(baseURL!)) return route.continue();
    unexpected.push(route.request().url()); return route.abort();
  });
  await page.goto("/");
  await page.getByText("OpenGTA / Area di gioco", { exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.getByLabel("Modalita'").focus();
  await page.keyboard.press("ArrowDown");
  await page.getByLabel("Autorizzo l'invio delle coordinate al provider").focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "Avvia", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#session-status")).toHaveAttribute("data-state", "ready");
  await expect.poll(() => requests).toBeGreaterThan(0);
  await expect(page.locator("p")).toContainText("OpenStreetMap");
  expect(unexpected).toEqual([]);
});
