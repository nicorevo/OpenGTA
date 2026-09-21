import { expect, test } from "@playwright/test";

/**
 * G2D-00: quartiere di riferimento ripetibile per il look GTA 2D.
 * Il fixture vive in `tests/fixtures/gta-city.ts` e viene avviato
 * nell'harness con `?fixture=gta-city`. Questa spec registra la baseline:
 * scena offline, percorso guidabile, tre viewport della spec, camera fissa,
 * dimensioni auto/strada, tempi e classificazione GPU.
 */

const VIEWPORTS = [
  { label: "640x480", width: 640, height: 480 },
  { label: "1280x800", width: 1280, height: 800 },
  { label: "390x844", width: 390, height: 844 },
] as const;

interface GtaCityFixtureSnapshot {
  pose: { x: number; y: number; heading: number };
  zoomLevel: number;
  cameraBounds: { minX: number; minY: number; maxX: number; maxY: number };
  viewScalePxPerMeter: number;
  vehiclePx: { length: number; width: number };
  roadPx: { widthMeters: number; widthPx: number };
  gpu: { rendererType: string; unmasked: string; software: boolean };
  compileMs: number;
  renderMs: number;
  compiled: { buildings: number; roads: number; ground: number; warnings: string[] };
  drivable: boolean;
  drivableError?: string;
}
type GtaCityDebug = GtaCityFixtureSnapshot & {
  ready: boolean;
  resize(width: number, height: number): void;
  snapshot(): GtaCityFixtureSnapshot;
  dispose(): void;
};

test("gta-city fixture boots offline, drives a clear path and reproduces the three spec viewports", async ({ page, baseURL }, testInfo) => {
  const pageErrors: string[] = [];
  const unexpected: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (url.startsWith(baseURL!)) return route.continue();
    unexpected.push(url);
    return route.abort();
  });

  await page.goto("/tests/e2e/harness.html?fixture=gta-city");
  await expect.poll(() => page.evaluate(() => {
    const debug = (window as unknown as { __opengtaGtaCityDebug?: GtaCityDebug }).__opengtaGtaCityDebug;
    return debug?.ready ?? false;
  })).toBe(true);
  // Il check del percorso guidabile (fisica) termina dopo il boot.
  await expect.poll(() => page.evaluate(() => {
    const debug = (window as unknown as { __opengtaGtaCityDebug?: GtaCityDebug }).__opengtaGtaCityDebug;
    return Boolean(debug && (debug.drivable || debug.drivableError));
  })).toBe(true);

  const baseline = await page.evaluate(() => (window as unknown as { __opengtaGtaCityDebug: GtaCityDebug }).__opengtaGtaCityDebug.snapshot());
  expect(baseline.drivableError, baseline.drivableError).toBeUndefined();
  expect(baseline.drivable).toBe(true);
  expect(baseline.compiled.buildings).toBe(7);
  expect(baseline.compiled.roads).toBe(9);
  expect(baseline.compiled.ground).toBe(2);
  expect(baseline.compiled.warnings).toEqual([]);

  const snapshots: GtaCityFixtureSnapshot[] = [];
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.evaluate(({ width, height }) => (window as unknown as { __opengtaGtaCityDebug: GtaCityDebug }).__opengtaGtaCityDebug.resize(width, height), viewport);
    await page.waitForTimeout(150);
    const snapshot = await page.evaluate(() => (window as unknown as { __opengtaGtaCityDebug: GtaCityDebug }).__opengtaGtaCityDebug.snapshot());
    snapshots.push(snapshot);
    await page.screenshot({ path: testInfo.outputPath(`gta-city-${viewport.label}.png`) });
  }

  // AC2: posa fissa e camera centrata sulla posa a ogni viewport -> confronto ripetibile.
  for (const snapshot of snapshots) {
    expect(snapshot.pose).toEqual({ x: 20, y: 10, heading: 0 });
    expect(snapshot.zoomLevel).toBe(3);
    const center = { x: (snapshot.cameraBounds.minX + snapshot.cameraBounds.maxX) / 2, y: (snapshot.cameraBounds.minY + snapshot.cameraBounds.maxY) / 2 };
    expect(Math.hypot(center.x - snapshot.pose.x, center.y - snapshot.pose.y)).toBeLessThan(0.01);
    // AC2: un tratto percorribile resta visibile davanti all'auto (heading 0 -> +x).
    expect(snapshot.cameraBounds.maxX - snapshot.pose.x).toBeGreaterThanOrEqual(25);
  }
  // AC1 (G2D-01): a 640x480 il taxi misura 35-55 x 16-27 px e una strada di
  // 6 m contiene almeno due larghezze visive dell'auto.
  const reference = snapshots[0];
  expect(reference.vehiclePx.length).toBeGreaterThanOrEqual(35);
  expect(reference.vehiclePx.length).toBeLessThanOrEqual(55);
  expect(reference.vehiclePx.width).toBeGreaterThanOrEqual(16);
  expect(reference.vehiclePx.width).toBeLessThanOrEqual(27);
  expect(reference.roadPx.widthPx).toBeGreaterThanOrEqual(2 * reference.vehiclePx.width);
  // AC3: dimensioni auto/strada registrate e coerenti con la scala della
  // viewport. Lo sprite conserva l'aspect ratio della texture, vincolato
  // dalla larghezza: con VEHICLE_VISUAL_SCALE nell'intervallo 1.0-1.3 della
  // spec la lunghezza visiva resta tra 3.5 e 6 m.
  for (const snapshot of snapshots) {
    const visualLengthMeters = snapshot.vehiclePx.length / snapshot.viewScalePxPerMeter;
    expect(visualLengthMeters).toBeGreaterThan(3.5);
    expect(visualLengthMeters).toBeLessThan(6);
    expect(snapshot.roadPx.widthMeters).toBe(6);
    expect(snapshot.roadPx.widthPx).toBeGreaterThan(snapshot.vehiclePx.width);
  }
  const aspectRatios = snapshots.map((snapshot) => snapshot.vehiclePx.length / snapshot.vehiclePx.width);
  for (const ratio of aspectRatios.slice(1)) expect(Math.abs(ratio - aspectRatios[0])).toBeLessThan(0.05);
  // Driving preset (level 3): fattore 6.0 sul divisore 360.
  expect(snapshots[0].viewScalePxPerMeter).toBeCloseTo(480 / 360 * 6, 5);
  expect(snapshots[1].viewScalePxPerMeter).toBeCloseTo(800 / 360 * 6, 5);
  expect(snapshots[2].viewScalePxPerMeter).toBeCloseTo(390 / 360 * 6, 5);
  // AC3: GPU reale vs headless software registrati, non dedotti.
  expect(baseline.gpu.rendererType).toBe("webgl");
  expect(baseline.gpu.unmasked.length).toBeGreaterThan(0);
  expect(typeof baseline.gpu.software).toBe("boolean");
  expect(baseline.compileMs).toBeGreaterThan(0);
  expect(baseline.renderMs).toBeGreaterThanOrEqual(0);
  expect(pageErrors).toEqual([]);
  expect(unexpected).toEqual([]);
  await page.evaluate(() => (window as unknown as { __opengtaGtaCityDebug: GtaCityDebug }).__opengtaGtaCityDebug.dispose());
});

test("chunk-boundary variant splits the seam building across two chunks without inventing walls", async ({ page }) => {
  await page.goto("/tests/e2e/harness.html");
  const result = await page.evaluate(async () => {
    const fixturePath = "/tests/fixtures/gta-city.ts";
    const { compileGtaCity, partitionGtaCityChunks } = await import(fixturePath) as typeof import("../../tests/fixtures/gta-city.ts");
    const { chunks } = compileGtaCity();
    const parts = partitionGtaCityChunks(chunks[0]);
    const area = (outer: readonly { x: number; y: number }[]) => {
      let sum = 0;
      for (let i = 0; i < outer.length; i += 1) {
        const a = outer[i]; const b = outer[(i + 1) % outer.length];
        sum += a.x * b.y - b.x * a.y;
      }
      return Math.abs(sum) / 2;
    };
    const fragmentsOf = (featureId: string) => parts.flatMap((part) => part.buildings.filter((building) => building.featureId === featureId));
    const seam = fragmentsOf("bld-seam");
    const low = fragmentsOf("bld-bassa");
    const tee = parts.flatMap((part) => part.roads.filter((road) => road.featureId === "via-tee"));
    return {
      partCount: parts.length,
      seam: seam.map((fragment) => ({ vertices: fragment.roof.outer.length, area: area(fragment.roof.outer) })),
      lowFragments: low.length,
      teeFragments: tee.length,
    };
  });
  expect(result.partCount).toBe(35);
  expect(result.seam).toHaveLength(2);
  for (const fragment of result.seam) {
    expect(fragment.vertices).toBeGreaterThanOrEqual(4);
    expect(fragment.area).toBeGreaterThan(0);
  }
  expect(result.lowFragments).toBe(1);
  expect(result.teeFragments).toBe(2);
});
