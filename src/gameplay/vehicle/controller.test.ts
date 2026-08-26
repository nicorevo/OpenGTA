import { describe, expect, it } from "vitest";
import { stepVehicle } from "./controller.ts";

describe("arcade vehicle", () => {
  it("accelerates forward with bounded speed", () => {
    let state = { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, heading: 0 };
    for (let index = 0; index < 300; index += 1) {
      state = stepVehicle(state, { throttle: 1, steer: 0, brake: 0 });
    }
    expect(state.velocity.x).toBeCloseTo(22, 1);
    expect(state.position.x).toBeGreaterThan(0);
  });

  it("brakes to zero without reversing direction", () => {
    const state = stepVehicle({
      position: { x: 0, y: 0 },
      velocity: { x: 0.1, y: 0 },
      heading: 0,
    }, { throttle: 0, steer: 0, brake: 1 });

    expect(state.velocity.x).toBe(0);
    expect(state.position.x).toBe(0);
  });
});
