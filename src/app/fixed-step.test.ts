import { describe, expect, it } from "vitest";
import {
  advanceFixedStep,
  FIXED_STEP_SECONDS,
  MAX_CATCH_UP_STEPS,
  MAX_FRAME_DELTA_SECONDS,
} from "./fixed-step.ts";

describe("fixed-step scheduling", () => {
  it("runs one simulation step when one fixed delta is accumulated", () => {
    expect(advanceFixedStep(0, FIXED_STEP_SECONDS)).toEqual({
      accumulatorSeconds: 0,
      simulatedSteps: 1,
      droppedSeconds: 0,
    });
  });

  it("clamps extreme frame deltas before computing catch-up", () => {
    const result = advanceFixedStep(0, 10);
    expect(result.simulatedSteps).toBe(MAX_CATCH_UP_STEPS);
    expect(result.droppedSeconds).toBeGreaterThan(0);
    expect(result.droppedSeconds).toBeLessThanOrEqual(MAX_FRAME_DELTA_SECONDS);
  });

  it("drops excess debt after the catch-up cap is reached", () => {
    const result = advanceFixedStep(0, FIXED_STEP_SECONDS * (MAX_CATCH_UP_STEPS + 2));
    expect(result.simulatedSteps).toBe(MAX_CATCH_UP_STEPS);
    expect(result.accumulatorSeconds).toBe(0);
    expect(result.droppedSeconds).toBeCloseTo(FIXED_STEP_SECONDS * 2);
  });
});
