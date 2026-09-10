import { describe, expect, it } from "vitest";
import { readVehicleInput } from "./input.ts";

describe("vehicle keyboard input", () => {
  it("steers left with positive steer, matching the CCW world heading", () => {
    // Renderer: vehicle.rotation = -heading, so positive steer turns the nose
    // counterclockwise on screen (left). Arrows and A/D must agree.
    expect(readVehicleInput(new Set(["arrowleft"])).steer).toBe(1);
    expect(readVehicleInput(new Set(["a"])).steer).toBe(1);
  });

  it("steers right with negative steer for both key families", () => {
    expect(readVehicleInput(new Set(["arrowright"])).steer).toBe(-1);
    expect(readVehicleInput(new Set(["d"])).steer).toBe(-1);
  });

  it("maps throttle and brake with WASD and arrows", () => {
    expect(readVehicleInput(new Set(["w"])).throttle).toBe(1);
    expect(readVehicleInput(new Set(["arrowup"])).throttle).toBe(1);
    expect(readVehicleInput(new Set(["s"])).throttle).toBe(-1);
    expect(readVehicleInput(new Set(["arrowdown"])).throttle).toBe(-1);
    expect(readVehicleInput(new Set([" "])).brake).toBe(1);
    expect(readVehicleInput(new Set(["w", "s"])).throttle).toBe(1);
  });
});
