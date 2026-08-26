import { describe, expect, it } from "vitest";
import { readVehicleInput } from "./input.ts";

describe("vehicle keyboard input", () => {
  it("maps the left and right arrow keys to inverted steering", () => {
    expect(readVehicleInput(new Set(["arrowleft"])).steer).toBe(1);
    expect(readVehicleInput(new Set(["arrowright"])).steer).toBe(-1);
  });

  it("keeps A and D steering unchanged", () => {
    expect(readVehicleInput(new Set(["a"])).steer).toBe(-1);
    expect(readVehicleInput(new Set(["d"])).steer).toBe(1);
  });
});
