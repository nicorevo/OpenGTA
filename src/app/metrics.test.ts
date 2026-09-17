import { describe, expect, it, vi } from "vitest";
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

  it("keeps a bounded frame window of the most recent samples without array shifts", () => {
    const metrics = new RuntimeMetrics();
    const shiftSpy = vi.spyOn(Array.prototype, "shift");
    try {
      for (let i = 0; i < 1_800; i += 1) metrics.recordFrame(1);
      metrics.recordFrame(1_000);

      const snapshot = metrics.snapshot();

      // Window = the most recent 1_800 samples: the oldest 1 ms sample is
      // evicted, the counter keeps the lifetime total.
      expect(snapshot.averageFrameMs).toBeCloseTo((1_799 * 1 + 1_000) / 1_800);
      expect(snapshot.maxFrameMs).toBe(1_000);
      expect(snapshot.frames).toBe(1_801);
      expect(shiftSpy).not.toHaveBeenCalled();
    } finally {
      shiftSpy.mockRestore();
    }
  });

  it("keeps a bounded physics window of the most recent samples", () => {
    const metrics = new RuntimeMetrics();
    for (let i = 0; i < 3_600; i += 1) metrics.recordPhysicsStep(1);
    metrics.recordPhysicsStep(100);

    const snapshot = metrics.snapshot();

    expect(snapshot.averagePhysicsMs).toBeCloseTo((3_599 * 1 + 100) / 3_600);
  });
});
