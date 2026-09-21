import type { Page } from "@playwright/test";

/** Pinned reverse-geocoding endpoint used by the app (see src/app/geocode.ts). */
export const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";

/**
 * While a live session is ready the app reverse-geocodes the current zone.
 * Register this AFTER the network guard so the "no unexpected external call"
 * contract of these specs is preserved: the lookup resolves to "no data" and
 * the status bar keeps its default message.
 */
export async function mockReverseGeocoding(page: Page): Promise<void> {
  await page.route(`${NOMINATIM_REVERSE_URL}**`, (route) => {
    void route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ error: "mocked" }) });
  });
}
