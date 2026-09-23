import { expect, test, type Page } from "@playwright/test";

/**
 * VPS-GATE (spec 112): QA visuale del layer VPS in-browser.
 * Stessa scena offline (fixture Lecce), stessa posa e stessa camera a ogni
 * run; si confronta la scena fallback (LVP, nessun VPS) con la scena in cui
 * il layer VPS compila un profilo sullo stesso parent. Tre proprieta':
 *   1. baseline: ?theme=rome senza VPS -> id "rome";
 *   2. effetto: ?vps=rome -> id "vps:..." e frame visibilmente diverso
 *      (diff > 4% dei pixel; misurato ~9%: roof palette del catalogo e
 *      identity families) — il layer VPS guida il rendering;
 *   3. cross-city: ?vps=paris su parent rome -> id "vps:..." e frame ancora
 *      piu' diverso (diff > 7% dei pixel; misurato ~13%).
 * Il rendering e' deterministico in questo ambiente (due load dello stesso
 * URL misurano 0.00% di differenza), quindi le soglie cross-load sono
 * affidabili. I pixel si campionano a 64x48 dentro un requestAnimationFrame
 * (dopo il render Pixi della stessa frame, prima del composito: il buffer
 * WebGL e' ancora valido senza preserveDrawingBuffer).
 */

const W = 64;
const H = 48;

interface ThemeDebug {
  readonly id: string;
  readonly location: { countryCode?: string; locality?: string } | null;
}

const themeId = (page: Page) => page.evaluate(
  () => (window as unknown as { __opengtaV0Debug?: { theme(): ThemeDebug } }).__opengtaV0Debug?.theme().id ?? "pending",
);

/** Sample the visible scene as a 64x48 RGB array from inside the page. */
const samplePixels = (page: Page): Promise<number[]> => page.evaluate(
  () => new Promise<number[]>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("rAF did not fire within 5000ms")), 5000);
    requestAnimationFrame(() => {
      window.clearTimeout(timer);
      const gl = document.querySelector("canvas");
      const ctx2d = document.createElement("canvas");
      ctx2d.width = 64;
      ctx2d.height = 48;
      const ctx = ctx2d.getContext("2d");
      if (!gl || !ctx) {
        reject(new Error("scene canvas or 2d context unavailable"));
        return;
      }
      ctx.drawImage(gl, 0, 0, 64, 48);
      const data = ctx.getImageData(0, 0, 64, 48).data;
      const out: number[] = [];
      for (let i = 0; i < data.length; i += 4) out.push(data[i], data[i + 1], data[i + 2]);
      resolve(out);
    });
  }),
);

/** Share of sampled pixels where any channel differs by more than 16/255. */
function diffShare(a: number[], b: number[]): number {
  if (a.length !== b.length) return 1;
  let changed = 0;
  for (let i = 0; i < a.length; i += 3) {
    if (
      Math.abs(a[i] - b[i]) > 16 ||
      Math.abs(a[i + 1] - b[i + 1]) > 16 ||
      Math.abs(a[i + 2] - b[i + 2]) > 16
    ) {
      changed += 1;
    }
  }
  return changed / (a.length / 3);
}

async function boot(page: Page, query: string): Promise<number[]> {
  await page.goto(`/?mode=offline&${query}&consent=1`);
  await expect(page.locator("#session-status")).toHaveAttribute("data-state", "ready", { timeout: 20000 });
  await page.waitForTimeout(800);
  return samplePixels(page);
}

test("VPS layer visibly drives the rendering (spec 112)", async ({ page, baseURL }, testInfo) => {
  test.setTimeout(90000);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  // Offline mode fetches nothing external; abort every non-local URL.
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (url.startsWith(baseURL!)) return route.continue();
    return route.abort();
  });

  // 1. Baseline: classic rome theme, no VPS (the spec 112 "fallback" scene).
  const baseline = await boot(page, "theme=rome");
  expect(await themeId(page)).toBe("rome");
  await page.screenshot({ path: testInfo.outputPath("vps-gate-1-baseline-rome.png") });

  // 2. VPS rome fixture on the rome parent: the theme id switches to the
  //    generated profile and the frame must visibly change (catalog roof
  //    palette + identity families; ~9% measured).
  const vpsRome = await boot(page, "theme=rome&vps=rome");
  expect(await themeId(page)).toMatch(/^vps:v1:vps-fixture-rome/);
  const effect = diffShare(baseline, vpsRome);
  expect(effect).toBeGreaterThan(0.04);
  await page.screenshot({ path: testInfo.outputPath(`vps-gate-2-vps-rome-effect-${(effect * 100).toFixed(1)}pct.png`) });

  // 3. Cross-city VPS fixture: Paris evidence over the Rome parent must be
  //    even more distinguishable from the baseline (~13% measured).
  const cross = await boot(page, "theme=rome&vps=paris");
  expect(await themeId(page)).toMatch(/^vps:v1:vps-fixture-paris/);
  const share = diffShare(baseline, cross);
  expect(share).toBeGreaterThan(0.07);
  await page.screenshot({ path: testInfo.outputPath(`vps-gate-3-vps-paris-diff-${(share * 100).toFixed(1)}pct.png`) });
  expect(pageErrors).toEqual([]);
});
