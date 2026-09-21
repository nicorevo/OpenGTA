import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { mockReverseGeocoding } from "../fixtures/geocode-mock.ts";

test("presents the fixed MVT live form with implicit consent and offline coordinate lock", async ({ page, baseURL }) => {
  test.setTimeout(90000);
  const tileBytes = readFileSync(new URL("../../src/fixtures/geo/lecce-z14-openfreemap.pbf", import.meta.url));
  const errors: string[] = [];
  const unexpected: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) => {
    if (route.request().url().startsWith(baseURL!)) return route.continue();
    unexpected.push(route.request().url()); return route.abort();
  });
  await page.route("**://tiles.openfreemap.org/**", (route) => {
    if (route.request().url().includes("/planet/20260830_080001_pt/14/")) return route.fulfill({ status: 200, contentType: "application/x-protobuf", body: tileBytes });
    return route.abort();
  });
  await mockReverseGeocoding(page);

  // Online is now the default: a bare load auto-starts the pinned MVT session.
  await page.goto("/");
  await expect(page.locator("#session-status")).toHaveAttribute("data-state", "ready", { timeout: 30000 });

  await page.getByText("OpenGTA / Area di gioco", { exact: true }).click();
  // Consent is implicit and always on; provider and endpoint are fixed and hidden.
  const consent = page.getByLabel("Autorizzo l'invio delle coordinate al provider");
  await expect(consent).toBeChecked();
  await expect(consent).toBeDisabled();
  await expect(page.locator('select[name="provider"]')).toHaveCount(0);
  await expect(page.locator('input[type="url"]')).toHaveCount(0);
  // Online is the default mode; the map origin is editable.
  await expect(page.getByLabel("Modalita'")).toHaveValue("open-world-live");
  await expect(page.getByLabel("Latitudine")).toBeEnabled();
  // Coordinate validation still applies before any request is made.
  await page.getByLabel("Latitudine").fill("91");
  await page.getByRole("button", { name: "Avvia", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Coordinate");
  // Offline mode locks the (irrelevant) coordinate inputs.
  await page.getByLabel("Modalita'").selectOption("offline");
  await expect(page.getByLabel("Latitudine")).toBeDisabled();
  await expect(page.getByLabel("Longitudine")).toBeDisabled();
  expect(errors).toEqual([]);
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
  test.setTimeout(90000);
  const tileBytes = readFileSync(new URL("../../src/fixtures/geo/lecce-z14-openfreemap.pbf", import.meta.url));
  const errors: string[] = [];
  const unexpected: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) => {
    if (route.request().url().startsWith(baseURL!)) return route.continue();
    unexpected.push(route.request().url()); return route.abort();
  });
  await page.route("**://tiles.openfreemap.org/**", (route) => {
    if (route.request().url().includes("/planet/20260830_080001_pt/14/")) return route.fulfill({ status: 200, contentType: "application/x-protobuf", body: tileBytes });
    return route.abort();
  });
  await mockReverseGeocoding(page);

  await page.goto("/");
  await expect(page.locator("#session-status")).toHaveAttribute("data-state", "ready", { timeout: 30000 });
  // Operate the form by keyboard only: open the panel and submit it.
  await page.getByText("OpenGTA / Area di gioco", { exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Avvia", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#session-status")).toHaveAttribute("data-state", "ready", { timeout: 30000 });
  expect(errors).toEqual([]);
  expect(unexpected).toEqual([]);
});
