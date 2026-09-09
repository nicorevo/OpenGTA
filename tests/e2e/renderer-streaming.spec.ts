import { expect, test } from "@playwright/test";

test("static updates preserve vehicle, camera and labels, including resize", async ({ page }) => {
  await page.goto("/tests/e2e/harness.html");
  const result = await page.evaluate(async () => {
    const path = "/src/render/pixi/renderer.ts";
    const { createPixiRenderer } = await import(path) as typeof import("../../src/render/pixi/renderer.ts");
    const renderer = await createPixiRenderer(document.querySelector("canvas")!);
    const a = { schemaVersion: 0 as const, id: "a", spatial: { regionId: "a", bounds: { minX: 0, minY: 0, maxX: 300, maxY: 300 }, originOffset: { x: 0, y: 0 } }, ground: [], roads: [], buildings: [], labels: [], collisions: [], featureIndex: {}, diagnostics: { inputFeatureCount: 0, compiledFeatureCount: 0, skippedFeatureCount: 0, warnings: [], stageDurationsMs: {} } };
    renderer.render(a);
    renderer.updateVehicle({ x: 80, y: -15 }, 0.7);
    renderer.toggleLabels();
    const world = renderer.app.stage.children[0];
    const vehicle = world.children.at(-1)!;
    const before = { position: { x: vehicle.x, y: vehicle.y }, rotation: vehicle.rotation, camera: renderer.cameraBounds() };
    renderer.render([a, { ...a, id: "b" }]);
    const staticLayer = world.children[0];
    renderer.render([{ ...a, id: "b" }]);
    const revision = world.children[0].children[0];
    renderer.render([a]);
    const same = world.children[0].children[0];
    renderer.render([a]);
    const noAllocation = same === world.children[0].children[0];
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
    return { preserved, noAllocation, oldDestroyed, labelsVisible, center, nonblank: colors.size > 3, staticOwned: staticLayer.destroyed };
  });
  expect(result).toMatchObject({ preserved: true, noAllocation: true, oldDestroyed: true, labelsVisible: true, center: { x: 80, y: -15 }, nonblank: true, staticOwned: true });
});
