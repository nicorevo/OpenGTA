import { describe, expect, it } from "vitest";
import { applyTouchAction, TOUCH_ACTION_KEY, type TouchAction } from "./touch-controls.ts";
import { readVehicleInput } from "./input.ts";

describe("touch control input mapping", () => {
  it("maps each control to the synthetic key it drives", () => {
    expect(TOUCH_ACTION_KEY).toEqual({ gas: "w", reverse: "s", left: "a", right: "d" });
  });

  it("adds the key on press and removes it on release", () => {
    const keys = new Set<string>();
    applyTouchAction(keys, "gas", true);
    expect(keys.has("w")).toBe(true);
    applyTouchAction(keys, "gas", false);
    expect(keys.has("w")).toBe(false);
  });

  it.each([
    ["gas", { throttle: 1, steer: 0, brake: 0 }],
    ["reverse", { throttle: -1, steer: 0, brake: 0 }],
    ["left", { throttle: 0, steer: 1, brake: 0 }],
    ["right", { throttle: 0, steer: -1, brake: 0 }],
  ] as [TouchAction, { throttle: number; steer: number; brake: number }][])(
    "pressing %s produces the same vehicle input as the matching key",
    (action, expected) => {
      const keys = new Set<string>();
      applyTouchAction(keys, action, true);
      expect(readVehicleInput(keys)).toEqual(expected);
    },
  );

  it("combines gas and steering like holding W and A together", () => {
    const keys = new Set<string>();
    applyTouchAction(keys, "gas", true);
    applyTouchAction(keys, "left", true);
    expect(readVehicleInput(keys)).toEqual({ throttle: 1, steer: 1, brake: 0 });
  });
});
