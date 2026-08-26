import { describe, expect, it } from "vitest";
import { RuntimeMetrics } from "./metrics.ts";

describe("runtime metrics", () => {
  it("reports frame percentiles and long frames", () => {
    const metrics = new RuntimeMetrics();
    [10, 12, 15, 40].forEach((frameMs) => metrics.recordFrame(frameMs));

    const snapshot = metrics.snapshot();

    expect(snapshot.frames).toBe(4);
    expect(snapshot.p95FrameMs).toBe(40);
    expect(snapshot.longFrames).toBe(1);
  });

  it("counts and times every fixed physics step", () => {
    const metrics = new RuntimeMetrics();
    [0.5, 1, 2].forEach((physicsMs) => metrics.recordPhysicsStep(physicsMs));

    const snapshot = metrics.snapshot();

    expect(snapshot.physicsSteps).toBe(3);
    expect(snapshot.averagePhysicsMs).toBeCloseTo(3.5 / 3);
    expect(snapshot.p95PhysicsMs).toBe(2);
  });

  it("tracks simulation debt drop events and duration", () => {
    const metrics = new RuntimeMetrics();
    metrics.recordSimulationDebtDrop(0);
    metrics.recordSimulationDebtDrop(0.05);
    metrics.recordSimulationDebtDrop(0.1);

    const snapshot = metrics.snapshot();

    expect(snapshot.simulationDebtDrops).toBe(2);
    expect(snapshot.droppedSimulationSeconds).toBeCloseTo(0.15);
  });
});
