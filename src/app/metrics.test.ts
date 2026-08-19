import { describe, expect, it } from "vitest";
import { RuntimeMetrics } from "./metrics.ts";

describe("runtime metrics", () => {
  it("reports percentiles and long frames", () => {
    const metrics = new RuntimeMetrics();
    [10, 12, 15, 40].forEach((frameMs) => metrics.recordFrame(frameMs, 1));
    const snapshot = metrics.snapshot();
    expect(snapshot.frames).toBe(4);
    expect(snapshot.p95FrameMs).toBe(40);
    expect(snapshot.longFrames).toBe(1);
    expect(snapshot.averagePhysicsMs).toBe(1);
  });
});
