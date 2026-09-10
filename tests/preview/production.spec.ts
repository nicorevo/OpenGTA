import { expect, test } from "@playwright/test";
import { liveWorld } from "../fixtures/live-world.ts";

test("built assets run offline and only the production HTTPS policy permits live data", async ({ page, baseURL }) => {
  const errors: string[] = [];
  let localRequests = 0;
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (url.startsWith("https://overpass-api.de/api/interpreter")) return route.fulfill({ json: liveWorld });
    if (url.includes("/__test-geo")) { localRequests++; return route.abort(); }
    if (url.startsWith(baseURL!)) return route.continue();
    errors.push("Unexpected remote endpoint"); return route.abort();
  });
  await page.goto("/");
  await expect(page.locator("#session-status")).toHaveAttribute("data-state", "ready");
  await page.keyboard.press("F3");
  await expect(page.locator("#debug-overlay")).toContainText(/buildings: [1-9]/);
  await page.screenshot({ path: "/tmp/opengta-preview-desktop.png" });
  await page.goto(`/?mode=open-world-live&consent=1&endpoint=${encodeURIComponent(baseURL + "/__test-geo")}`);
  await expect(page.getByRole("alert")).toContainText("Endpoint non autorizzato");
  expect(localRequests).toBe(0);
  await page.goto("/?mode=open-world-live&provider=osm&consent=1");
  await expect(page.locator("#session-status")).toHaveAttribute("data-state", "ready");
  // The documented URL shape without provider=osm: the provider select must
  // fall back to its only option instead of submitting an empty value.
  await page.goto(`/?mode=open-world-live&consent=1&endpoint=${encodeURIComponent("https://overpass-api.de/api/interpreter")}`);
  await expect(page.locator("#session-status")).toHaveAttribute("data-state", "ready");
  await expect(page.locator('select[name="provider"]')).toHaveValue("osm");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("canvas")).toBeVisible();
  await page.screenshot({ path: "/tmp/opengta-preview-mobile.png" });
  expect(errors).toEqual([]);
});
