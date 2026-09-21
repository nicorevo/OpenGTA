import { expect, test } from "@playwright/test";

test("static updates preserve vehicle, camera and labels, including resize", async ({ page }) => {
  await page.goto("/tests/e2e/harness.html");
  const result = await page.evaluate(async () => {
    const path = "/src/render/pixi/renderer.ts";
    const { createPixiRenderer } = await import(path) as typeof import("../../src/render/pixi/renderer.ts");
    const renderer = await createPixiRenderer(document.querySelector("canvas")!);
    // Both chunks carry the same physical road feature (a road crossing the
    // chunk boundary is compiled into each one): only one label may survive.
    const roadLabel = (position: { x: number; y: number }) => ({ featureId: "road:1", text: "Via A", position, angle: 0, kind: "road" as const, priority: 90 });
    const a = { schemaVersion: 0 as const, id: "a", spatial: { regionId: "a", bounds: { minX: 0, minY: 0, maxX: 300, maxY: 300 }, originOffset: { x: 0, y: 0 } }, ground: [], roads: [], buildings: [], labels: [roadLabel({ x: 20, y: 20 })], collisions: [], featureIndex: {}, diagnostics: { inputFeatureCount: 0, compiledFeatureCount: 0, skippedFeatureCount: 0, warnings: [], stageDurationsMs: {} } };
    renderer.render(a);
    renderer.updateVehicle({ x: 80, y: -15 }, 0.7);
    renderer.toggleLabels();
    const world = renderer.app.stage.children[0];
    const vehicle = world.children.at(-1)!;
    const before = { position: { x: vehicle.x, y: vehicle.y }, rotation: vehicle.rotation, camera: renderer.cameraBounds() };
    renderer.render([a, { ...a, id: "b", labels: [roadLabel({ x: 180, y: 20 })] }]);
    const labelLayer = world.children[0].children.at(-1);
    const labelTextCount = (labelLayer?.children ?? []).reduce((sum, chunkLabels) => sum + chunkLabels.children.length, 0);
    const staticLayer = world.children[0];
    // Incremental structure: staticLayer holds the layer containers; the
    // per-chunk ground graphics live in the first (ground) layer.
    const groundLayer = world.children[0].children[0];
    renderer.render([{ ...a, id: "b" }]);
    const revision = groundLayer.children[0];
    renderer.render([a]);
    const same = groundLayer.children[0];
    renderer.render([a]);
    const noAllocation = same === groundLayer.children[0];
    renderer.render([]);
    const preserved = vehicle === world.children.at(-1) && vehicle.x === before.position.x && vehicle.rotation === before.rotation;
    const labelsVisible = world.children[0].children.at(-1)?.visible;
    const oldDestroyed = revision.destroyed;
    renderer.app.renderer.resize(390, 844);
    renderer.updateVehicle({ x: 80, y: -15 }, 0.7);
    const bounds = renderer.cameraBounds();
    const center = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
    const pixels = renderer.app.renderer.extract.pixels({ target: renderer.app.stage }).pixels;
    const colors = new Set(Array.from(pixels).filter((_, i) => i % 4 !== 3));
    renderer.dispose(); renderer.dispose();
    return { preserved, noAllocation, oldDestroyed, labelsVisible, center, labelTextCount, nonblank: colors.size > 3, staticOwned: staticLayer.destroyed };
  });
  expect(result).toMatchObject({ preserved: true, noAllocation: true, oldDestroyed: true, labelsVisible: true, center: { x: 80, y: -15 }, nonblank: true, staticOwned: true });
  // Dedup guard: the same road feature compiled into two adjacent chunks
  // yields a single label (the copy nearest the camera target), not two.
  expect(result.labelTextCount).toBe(1);
});

test("discrete zoom rescales the camera without touching the vehicle pose", async ({ page }) => {
  await page.goto("/tests/e2e/harness.html");
  const result = await page.evaluate(async () => {
    const path = "/src/render/pixi/renderer.ts";
    const { createPixiRenderer } = await import(path) as typeof import("../../src/render/pixi/renderer.ts");
    const renderer = await createPixiRenderer(document.querySelector("canvas")!);
    renderer.updateVehicle({ x: 80, y: -15 }, 0.7);
    const width = () => renderer.cameraBounds().maxX - renderer.cameraBounds().minX;
    const center = () => { const b = renderer.cameraBounds(); return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 }; };
    const c0 = center();
    const before = { level: renderer.cameraState().zoomLevel, width: width() };
    const inLevels = [renderer.zoomIn(), renderer.zoomIn(), renderer.zoomIn()]; // clamps at 5
    const zoomed = { level: renderer.cameraState().zoomLevel, width: width() };
    const outLevels = [renderer.zoomOut(), renderer.zoomOut(), renderer.zoomOut(), renderer.zoomOut(), renderer.zoomOut(), renderer.zoomOut(), renderer.zoomOut(), renderer.zoomOut()]; // clamps at 0
    const minLevel = renderer.cameraState().zoomLevel;
    const widthMin = width();
    const cMin = center();
    renderer.setZoom(2);
    const restored = renderer.cameraState().zoomLevel;
    renderer.dispose();
    return { c0, before, inLevels, zoomed, outLevels, minLevel, widthMin, cMin, restored };
  });
  expect(result.before).toMatchObject({ level: 3 });
  expect(result.inLevels).toEqual([4, 5, 5]);
  expect(result.zoomed.width).toBeLessThan(result.before.width);
  expect(result.minLevel).toBe(0);
  expect(result.outLevels).toEqual([4, 3, 2, 1, 0, 0, 0, 0]);
  expect(result.widthMin).toBeGreaterThan(result.before.width);
  expect(Math.hypot(result.cMin.x - result.c0.x, result.cMin.y - result.c0.y)).toBeLessThan(0.01);
  expect(result.restored).toBe(2);
});

test("LOD tiers reshape labels, facades, casing and culling per zoom", async ({ page }) => {
  await page.goto("/tests/e2e/harness.html");
  const result = await page.evaluate(async () => {
    const path = "/src/render/pixi/renderer.ts";
    const { createPixiRenderer } = await import(path) as typeof import("../../src/render/pixi/renderer.ts");
    const renderer = await createPixiRenderer(document.querySelector("canvas")!);
    const chunk = {
      schemaVersion: 0 as const, id: "lod",
      spatial: { regionId: "lod", bounds: { minX: 0, minY: 0, maxX: 300, maxY: 300 }, originOffset: { x: 0, y: 0 } },
      ground: [
        { featureId: "big-park", area: { outer: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }, { x: 0, y: 50 }], holes: [] }, styleKey: "land:park" },
        { featureId: "tiny-patch", area: { outer: [{ x: 60, y: 60 }, { x: 62, y: 60 }, { x: 62, y: 62 }, { x: 60, y: 62 }], holes: [] }, styleKey: "land:grass" },
      ],
      roads: [{ featureId: "road:1", widthMeters: 6, styleKey: "road:residential", surface: { outer: [{ x: -10, y: 20 }, { x: 80, y: 20 }, { x: 80, y: 26 }, { x: -10, y: 26 }], holes: [] }, centerline: [{ x: 0, y: 23 }, { x: 80, y: 23 }] }],
      buildings: [{ featureId: "building:1", roof: { outer: [{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 20 }, { x: 10, y: 20 }], holes: [] }, visualHeightMeters: 12, styleKey: "building:residential", fakeDepth: { enabled: true, scale: 1 } }],
      labels: [
        { featureId: "road:1", text: "Via Minore", position: { x: 40, y: 23 }, angle: 0, kind: "road" as const, priority: 60 },
        { featureId: "big-park", text: "Parco Maggiore", position: { x: 25, y: 25 }, angle: 0, kind: "place" as const, priority: 110 },
      ],
      collisions: [], featureIndex: { "building:1": { kind: "building" }, "road:1": { kind: "road" } },
      diagnostics: { inputFeatureCount: 4, compiledFeatureCount: 4, skippedFeatureCount: 0, warnings: [], stageDurationsMs: {} },
    };
    renderer.render(chunk);
    const medium = renderer.presentationDiagnostics();
    renderer.setZoom(0); // far
    const far = renderer.presentationDiagnostics();
    renderer.setZoom(4); // near
    const near = renderer.presentationDiagnostics();
    renderer.toggleLabels();
    // labelLayer is the last static-layer container; its per-chunk children
    // hold the label Text nodes, which must be scaled-down 128px rasters.
    const labelLayer = renderer.app.stage.children[0].children[0].children.at(-1);
    const labelScales = (labelLayer?.children ?? []).flatMap((chunkLabels) => chunkLabels.children.map((text) => text.scale.x));
    renderer.dispose();
    return { medium, far, near, labelScales };
  });
  // MEDIUM (default): the 60-priority road label is kept (threshold 60).
  expect(result.medium).toMatchObject({ labels: 2, facades: 1, roadCasing: true, culledFeatures: 0 });
  // FAR: facade hidden, casing removed, tiny patch culled.
  expect(result.far).toMatchObject({ labels: 1, facades: 0, roadCasing: false, culledFeatures: 1 });
  // NEAR: full detail restored, both labels back.
  expect(result.near).toMatchObject({ labels: 2, facades: 1, roadCasing: true, culledFeatures: 0 });
  // Nitidezza/carreggiata guard: every visible label is a downscaled 128px
  // design raster (scale < 0.1), never 1:1 world-unit text that the view
  // transform would stretch into a blurred giant band.
  expect(result.labelScales).toHaveLength(2);
  for (const scale of result.labelScales) {
    expect(scale).toBeGreaterThan(0);
    expect(scale).toBeLessThan(0.1);
  }
});
