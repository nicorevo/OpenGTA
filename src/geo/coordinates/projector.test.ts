import { describe, expect, it } from "vitest";
import { createTangentProjector } from "./projector.ts";

const origin = { latitude: 40.35316888888889, longitude: 18.17259 };
describe("V0 tangent projector", () => {
  const projector = createTangentProjector(origin);
  it("matches Lecce validation vectors", () => {
    expect(projector.project({ latitude: 40.350467194504084, longitude: 18.169058606423945 }).x).toBeCloseTo(-300, 5);
    expect(projector.project({ latitude: 40.35587058327369, longitude: 18.176121393576054 }).y).toBeCloseTo(300, 5);
  });
  it("round trips local coordinates", () => {
    const point = { x: 123.4, y: -245.6 };
    const result = projector.unproject(point);
    expect(projector.project(result)).toEqual({ x: expect.closeTo(point.x, 8), y: expect.closeTo(point.y, 8) });
  });
});
