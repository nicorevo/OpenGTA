import { describe, expect, it } from "vitest";
import { stepVehicle } from "./controller.ts";

const fresh = (v = 0) => ({ position: { x: 0, y: 0 }, velocity: { x: v, y: 0 }, heading: 0 });

describe("arcade vehicle", () => {
  it("accelerates forward to the super-fast top speed", () => {
    let state = fresh();
    for (let index = 0; index < 600; index += 1) {
      state = stepVehicle(state, { throttle: 1, steer: 0, brake: 0 });
    }
    expect(state.velocity.x).toBeCloseTo(84, 1);
    expect(state.position.x).toBeGreaterThan(0);
  });

  it("caps forward speed at the tuning ceiling and never exceeds it", () => {
    let state = fresh();
    for (let index = 0; index < 1200; index += 1) {
      state = stepVehicle(state, { throttle: 1, steer: 0, brake: 0 });
      expect(state.velocity.x).toBeLessThanOrEqual(84 + 1e-6);
    }
  });

  it("accelerates harder at low speed than near the top (engine curve, not linear)", () => {
    const gainLow = stepVehicle(fresh(10), { throttle: 1, steer: 0, brake: 0 }).velocity.x - 10;
    const gainHigh = stepVehicle(fresh(40), { throttle: 1, steer: 0, brake: 0 }).velocity.x - 40;
    expect(gainLow).toBeGreaterThan(gainHigh);
  });

  it("coasts to a stop more heavily than the old floaty 1.5 m/s^2", () => {
    let state = fresh(30);
    for (let index = 0; index < 120; index += 1) {
      state = stepVehicle(state, { throttle: 0, steer: 0, brake: 0 });
    }
    expect(state.velocity.x).toBeLessThan(26.5);
  });

  it("brakes to zero without reversing direction", () => {
    const state = stepVehicle(fresh(0.1), { throttle: 0, steer: 0, brake: 1 });
    expect(state.velocity.x).toBe(0);
    expect(state.position.x).toBe(0);
  });
});

describe("arcade vehicle drift (weight, not rails)", () => {
  const maxLateralDuringTurn = (speed: number, steps = 30) => {
    let state = fresh(speed);
    let maxLateral = 0;
    for (let index = 0; index < steps; index += 1) {
      state = stepVehicle(state, { throttle: 0, steer: 1, brake: 0 });
      const forward = { x: Math.cos(state.heading), y: Math.sin(state.heading) };
      const right = { x: -forward.y, y: forward.x };
      maxLateral = Math.max(maxLateral, Math.abs(state.velocity.x * right.x + state.velocity.y * right.y));
    }
    return maxLateral;
  };

  it("slides more (keeps more lateral velocity) in a sharp turn at high speed than at low speed", () => {
    expect(maxLateralDuringTurn(50)).toBeGreaterThan(maxLateralDuringTurn(5));
    expect(maxLateralDuringTurn(50)).toBeGreaterThan(2);
  });
});

describe("arcade vehicle steering direction", () => {
  it("increases heading with positive steer (left turn, CCW world)", () => {
    const next = stepVehicle(fresh(5), { throttle: 0, steer: 1, brake: 0 });
    expect(next.heading).toBeGreaterThan(0);
  });
  it("decreases heading with negative steer (right turn)", () => {
    const next = stepVehicle(fresh(5), { throttle: 0, steer: -1, brake: 0 });
    expect(next.heading).toBeLessThan(0);
  });
});
