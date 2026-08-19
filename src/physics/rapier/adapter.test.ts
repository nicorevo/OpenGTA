import { describe, expect, it } from "vitest";
import { createPhysicsAdapter } from "./adapter.ts";

describe("Rapier vehicle integration", () => {
  it("keeps a dynamic vehicle outside a static wall", async () => {
    const physics = await createPhysicsAdapter([{
      kind: "polygon",
      featureId: "wall",
      polygon: { outer: [{ x: 2, y: -5 }, { x: 3, y: -5 }, { x: 3, y: 5 }, { x: 2, y: 5 }], holes: [] },
    }]);
    let state = physics.createVehicle({ x: 0, y: 0, heading: 0 });
    for (let i = 0; i < 120; i += 1) state = physics.stepVehicle(state, { throttle: 1, steer: 0, brake: 0 });
    expect(state.position.x).toBeLessThan(2);
  });
});
