import { expect, it } from "vitest";
import { cameraBounds, lodForZoom, zoomFactor, type ZoomLevel } from "../../src/app/camera.ts";
import { createChunkGrid } from "../../src/world/chunk/grid.ts";
import { selectActiveChunks } from "../../src/world/chunk/window.ts";

// Demand report per zoom level at the reference viewport: run explicitly with
// `npx vitest run --config vitest.bench.config.ts tests/bench/zoom-demand.test.ts`.
const screen = { width: 1280, height: 720 };
const grid = createChunkGrid(300);

it("reports camera demand per zoom level", () => {
  for (const level of [0, 1, 2, 3, 4, 5] as ZoomLevel[]) {
    const scale = zoomFactor(level) * (Math.max(1, Math.min(screen.width, screen.height)) / 360);
    const bounds = cameraBounds({ x: 0, y: 0 }, screen, scale);
    const demand = selectActiveChunks(grid, { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, cameraBounds: bounds });
    const metersX = bounds.maxX - bounds.minX;
    const metersY = bounds.maxY - bounds.minY;
    expect(bounds.maxX).toBeGreaterThan(bounds.minX);
    console.log(`ZOOM_BENCH level=${level} factor=${zoomFactor(level)} lod=${lodForZoom(level)} camera=${metersX.toFixed(0)}x${metersY.toFixed(0)}m demandedCells=${demand.length}`);
  }
  // Zooming in must never demand more cells than zooming out.
  const out = selectActiveChunks(grid, { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, cameraBounds: cameraBounds({ x: 0, y: 0 }, screen, zoomFactor(0) * 2) }).length;
  const inCells = selectActiveChunks(grid, { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, cameraBounds: cameraBounds({ x: 0, y: 0 }, screen, zoomFactor(4) * 2) }).length;
  expect(inCells).toBeLessThanOrEqual(out);
});
