import { expect, it } from "vitest";
import { vehicleFootprint } from "./shape.ts";
it("rotates the authoritative physical rectangle", () => {
  const footprint = vehicleFootprint({ position: { x: 10, y: 20 }, heading: Math.PI / 2 });
  expect(Math.max(...footprint.map((p) => p.x))).toBeCloseTo(10.82);
  expect(Math.max(...footprint.map((p) => p.y))).toBeCloseTo(22);
});
