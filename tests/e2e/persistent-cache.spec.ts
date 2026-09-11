import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import rawFixture from "../../src/fixtures/geo/lecce-sant-oronzo-v0.raw.json" with { type: "json" };
import type { CompiledChunkV0 } from "../../src/world/compiler/compiled.ts";
import { liveWorld } from "../fixtures/live-world.ts";

/**
 * CACHE-02: the IndexedDB backend exercised with the real browser IndexedDB.
 *
 * The spec is offline and deterministic: every request outside the dev server
 * origin is aborted by the catch-all route, the payload comes from the
 * committed Lecce fixture and the chunk is compiled in the page. It is the
 * environment used for the AC2 measurements (write/read/quota), so it reports
 * the raw numbers to stdout and to /tmp/opengta-cache-measurement.json instead
 * of hiding them behind a pass/fail assertion.
 */

const PATHS = {
  store: "/src/world/chunk/persistent-indexeddb.ts",
  projector: "/src/geo/coordinates/projector.ts",
  normalize: "/src/geo/normalize/osm.ts",
  compiler: "/src/world/compiler/compiled.ts",
  config: "/src/world/runtime/live-config.ts",
  fixture: "/__test-fixture",
} as const;

async function guardNetwork(page: Page, baseURL: string | undefined, unexpected: string[]): Promise<void> {
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (url.includes("/__test-fixture")) return route.fulfill({ json: rawFixture });
    if (baseURL && url.startsWith(baseURL)) return route.continue();
    unexpected.push(url);
    return route.abort();
  });
}

const percentile = (samples: readonly number[], fraction: number): number => {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
};

test("roundtrips a compiled fixture chunk through the real browser IndexedDB", async ({ page, baseURL }) => {
  test.setTimeout(60000);
  const unexpected: string[] = [];
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await guardNetwork(page, baseURL, unexpected);
  await page.goto("/tests/e2e/harness.html");

  const measurement = await page.evaluate(async (paths) => {
    const [storeModule, projectorModule, normalizeModule, compilerModule, configModule] = await Promise.all([
      import(paths.store),
      import(paths.projector),
      import(paths.normalize),
      import(paths.compiler),
      import(paths.config),
    ]) as [
      typeof import("../../src/world/chunk/persistent-indexeddb.ts"),
      typeof import("../../src/geo/coordinates/projector.ts"),
      typeof import("../../src/geo/normalize/osm.ts"),
      typeof import("../../src/world/compiler/compiled.ts"),
      typeof import("../../src/world/runtime/live-config.ts"),
    ];

    const response = await fetch(paths.fixture);
    const fixtureText = await response.text();
    const raw = JSON.parse(fixtureText) as Parameters<typeof normalizeModule.normalizeOsm>[0];
    const origin = configModule.DEFAULT_ORIGIN;
    const compileStart = performance.now();
    const region = normalizeModule.normalizeOsm(raw, projectorModule.createTangentProjector(origin), origin, "lecce-sant-oronzo-v0");
    const compiled = compilerModule.compileRegion(region);
    const compileMs = performance.now() - compileStart;
    const chunk = compiled.chunks[0] as CompiledChunkV0;

    // The serializer is CACHE-03: this spec only needs stable bytes to store.
    const serializeStart = performance.now();
    const serialized = JSON.stringify(chunk);
    const payload = new TextEncoder().encode(serialized);
    const serializeMs = performance.now() - serializeStart;

    // Namespace of the warm cache: reused verbatim through persistentKeyFrom.
    const namespace = JSON.stringify(["tangent-wgs84-v1", 0, origin.latitude, origin.longitude, 500, "fixture:lecce-v0", "v0"]);
    const keyFor = (index: number) => ({ namespace, chunkId: `chunk:0:${index}`, compilerVersion: "v0-runtime", schemaVersion: 0 });
    const store = storeModule.createIndexedDbChunkStore();
    await store.clear();
    const quotaStart = await store.quota();
    const missing = await store.get(keyFor(99));

    const writeMs: number[] = [];
    const readMs: number[] = [];
    let roundtrip = true;
    let featureIdsPreserved = true;
    let collisionsPreserved = true;
    let diagnosticsPreserved = true;
    let lastStored: Uint8Array | undefined;
    for (let index = 0; index < 5; index += 1) {
      const key = keyFor(index);
      const writeStart = performance.now();
      await store.put(key, payload);
      writeMs.push(performance.now() - writeStart);
      const readStart = performance.now();
      const hit = await store.get(key);
      readMs.push(performance.now() - readStart);
      if (hit.status !== "hit") { roundtrip = false; continue; }
      lastStored = hit.value;
      const decoded = new TextDecoder().decode(hit.value);
      roundtrip = roundtrip && decoded === serialized;
      const restored = JSON.parse(decoded) as CompiledChunkV0;
      featureIdsPreserved = featureIdsPreserved && JSON.stringify(restored.featureIndex) === JSON.stringify(chunk.featureIndex);
      collisionsPreserved = collisionsPreserved && JSON.stringify(restored.collisions) === JSON.stringify(chunk.collisions);
      diagnosticsPreserved = diagnosticsPreserved && JSON.stringify(restored.diagnostics) === JSON.stringify(chunk.diagnostics);
    }

    const deserializeStart = performance.now();
    let firstFeatureId: string | null = null;
    if (lastStored) {
      const restoredChunk = JSON.parse(new TextDecoder().decode(lastStored)) as CompiledChunkV0;
      firstFeatureId = Object.keys(restoredChunk.featureIndex)[0] ?? null;
    }
    const deserializeMs = performance.now() - deserializeStart;
    const quota = await store.quota();
    const estimate = navigator.storage?.estimate ? await navigator.storage.estimate() : undefined;
    const deleted = await store.delete(keyFor(0));
    const afterDelete = await store.quota();
    await store.clear();
    const afterClear = await store.quota();
    await store.close();

    return {
      userAgent: navigator.userAgent,
      hardwareConcurrency: navigator.hardwareConcurrency ?? null,
      fixtureJsonChars: fixtureText.length,
      payloadBytes: payload.byteLength,
      declaredBudgetBytes: storeModule.DEFAULT_PERSISTENT_BUDGET_BYTES,
      databaseName: storeModule.PERSISTENT_DATABASE_NAME,
      databaseVersion: storeModule.PERSISTENT_DATABASE_VERSION,
      compileMs,
      serializeMs,
      deserializeMs,
      chunk: {
        id: chunk.id,
        schemaVersion: chunk.schemaVersion,
        features: Object.keys(chunk.featureIndex).length,
        buildings: chunk.buildings.length,
        roads: chunk.roads.length,
        labels: chunk.labels.length,
        collisions: chunk.collisions.length,
        inputFeatureCount: chunk.diagnostics.inputFeatureCount,
        skippedFeatureCount: chunk.diagnostics.skippedFeatureCount,
        warnings: chunk.diagnostics.warnings.length,
        firstFeatureId,
      },
      roundtrip,
      featureIdsPreserved,
      collisionsPreserved,
      diagnosticsPreserved,
      writeMs,
      readMs,
      missing,
      quotaStart,
      quota,
      afterDelete,
      afterClear,
      deleted,
      estimate: estimate ? { usage: estimate.usage ?? null, quota: estimate.quota ?? null } : null,
    };
  }, PATHS);

  const report = {
    ...measurement,
    envelope: {
      writeMs: { min: Math.min(...measurement.writeMs), median: percentile(measurement.writeMs, 0.5), max: Math.max(...measurement.writeMs) },
      readMs: { min: Math.min(...measurement.readMs), median: percentile(measurement.readMs, 0.5), max: Math.max(...measurement.readMs) },
    },
  };
  console.log("CACHE_MEASUREMENT", JSON.stringify(report));
  await writeFile("/tmp/opengta-cache-measurement.json", JSON.stringify(report, null, 2));

  expect(measurement.roundtrip, "the stored payload must come back byte-identical").toBe(true);
  expect(measurement.featureIdsPreserved, "feature ids must survive the roundtrip").toBe(true);
  expect(measurement.collisionsPreserved, "collision shapes must survive the roundtrip").toBe(true);
  expect(measurement.diagnosticsPreserved, "compile diagnostics must survive the roundtrip").toBe(true);
  expect(measurement.payloadBytes).toBeGreaterThan(1000);
  expect(measurement.chunk.features).toBeGreaterThan(0);
  expect(measurement.chunk.buildings).toBeGreaterThan(0);
  expect(measurement.chunk.roads).toBeGreaterThan(0);
  expect(measurement.chunk.collisions).toBeGreaterThan(0);
  expect(measurement.missing).toEqual({ status: "miss", reason: "absent" });
  expect(measurement.quota).toEqual({ budgetBytes: measurement.declaredBudgetBytes, usedBytes: 5 * measurement.payloadBytes, entries: 5 });
  expect(measurement.deleted).toBe(true);
  expect(measurement.afterDelete).toEqual({ budgetBytes: measurement.declaredBudgetBytes, usedBytes: 4 * measurement.payloadBytes, entries: 4 });
  expect(measurement.afterClear).toEqual({ budgetBytes: measurement.declaredBudgetBytes, usedBytes: 0, entries: 0 });
  expect(pageErrors, pageErrors.join("\n")).toEqual([]);
  expect(unexpected).toEqual([]);
});

test("degrades without a usable IndexedDB factory and keeps the session running", async ({ page, baseURL }) => {
  const unexpected: string[] = [];
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await guardNetwork(page, baseURL, unexpected);
  // Absent factory, then a factory that denies open: both must resolve to typed
  // degradation. The module resolves the global lazily, so no re-import is needed.
  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", { value: undefined, configurable: true, writable: true });
  });
  await page.goto("/tests/e2e/harness.html");

  const absent = await page.evaluate(async (storePath) => {
    const storeModule = await import(storePath) as typeof import("../../src/world/chunk/persistent-indexeddb.ts");
    const store = storeModule.createIndexedDbChunkStore();
    const key = { namespace: "tangent-wgs84-v1:fixture", chunkId: "chunk:0:0", compilerVersion: "v0-runtime", schemaVersion: 0 };
    let putName = "";
    let putCode = "";
    try { await store.put(key, new Uint8Array([1, 2, 3])); }
    catch (error) { putName = (error as Error).name; putCode = String((error as { code?: string }).code ?? ""); }
    const result = {
      miss: await store.get(key),
      hit: await store.get({ ...key, chunkId: "chunk:9:9" }),
      putName,
      putCode,
      deleted: await store.delete(key),
      quota: await store.quota(),
    };
    await store.clear();
    return result;
  }, PATHS.store);

  const denied = await page.evaluate(async (storePath) => {
    Object.defineProperty(window, "indexedDB", {
      value: { open: () => { throw new DOMException("denied by policy", "SecurityError"); } },
      configurable: true,
      writable: true,
    });
    const storeModule = await import(storePath) as typeof import("../../src/world/chunk/persistent-indexeddb.ts");
    const store = storeModule.createIndexedDbChunkStore();
    const key = { namespace: "tangent-wgs84-v1:fixture", chunkId: "chunk:0:0", compilerVersion: "v0-runtime", schemaVersion: 0 };
    let putCode = "";
    try { await store.put(key, new Uint8Array([1, 2, 3])); }
    catch (error) { putCode = String((error as { code?: string }).code ?? ""); }
    return { miss: await store.get(key), putCode, quota: await store.quota() };
  }, PATHS.store);

  expect(absent.miss).toEqual({ status: "miss", reason: "unavailable" });
  expect(absent.hit).toEqual({ status: "miss", reason: "unavailable" });
  expect(absent.putName).toBe("PersistentStoreError");
  expect(absent.putCode).toBe("storage-unavailable");
  expect(absent.deleted).toBe(false);
  expect(absent.quota).toEqual({ budgetBytes: 0, usedBytes: 0, entries: 0 });
  expect(denied.miss).toEqual({ status: "miss", reason: "unavailable" });
  expect(denied.putCode).toBe("storage-unavailable");
  expect(denied.quota).toEqual({ budgetBytes: 0, usedBytes: 0, entries: 0 });
  expect(pageErrors, pageErrors.join("\n")).toEqual([]);
  expect(unexpected).toEqual([]);
});

test("reloads reuse compiled chunks from IndexedDB without new provider calls", async ({ page, baseURL }) => {
  let requests = 0;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (url.includes("/__test-geo")) { requests++; return route.fulfill({ json: liveWorld }); }
    if (url.startsWith(baseURL!)) return route.continue();
    errors.push("Unexpected remote request"); return route.abort();
  });
  const url = `/?mode=open-world-live&endpoint=${encodeURIComponent(baseURL + "/__test-geo")}&consent=1`;
  await page.goto(url);
  await expect(page.locator("#session-status")).toHaveAttribute("data-state", "ready");
  await expect.poll(async () => (await page.evaluate(() => (window as unknown as { __opengtaV0Debug: { session(): { runtime: { pending: string[] } } } }).__opengtaV0Debug.session().runtime.pending.length)), { timeout: 20000 }).toBe(0);
  const firstLoadRequests = requests;
  expect(firstLoadRequests).toBeGreaterThan(0);
  await page.reload();
  await expect(page.locator("#session-status")).toHaveAttribute("data-state", "ready");
  await expect.poll(async () => (await page.evaluate(() => (window as unknown as { __opengtaV0Debug: { session(): { runtime: { pending: string[] } } } }).__opengtaV0Debug.session().runtime.pending.length)), { timeout: 20000 }).toBe(0);
  expect(requests).toBe(firstLoadRequests); // every window cell came from IndexedDB
  expect(errors).toEqual([]);
});
