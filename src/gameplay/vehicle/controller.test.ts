import { describe, expect, it } from "vitest";
import { stepVehicle } from "./controller.ts";
describe("arcade vehicle", () => { it("accelerates forward with bounded speed", () => { let state = { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, heading: 0 }; for (let i = 0; i < 300; i += 1) state = stepVehicle(state, { throttle: 1, steer: 0, brake: 0 }); expect(state.velocity.x).toBeCloseTo(22, 1); expect(state.position.x).toBeGreaterThan(0); }); });
