import type { Vec2 } from "../../world/model/types.ts";

export interface VehicleInput {
  readonly throttle: number;
  readonly steer: number;
  readonly brake: number;
}

export interface VehicleState {
  position: Vec2;
  velocity: Vec2;
  heading: number;
}

export interface VehicleTuning {
  readonly maxForwardSpeed: number;      // m/s
  readonly maxReverseSpeed: number;      // m/s
  readonly forwardAcceleration: number;  // m/s^2
  readonly reverseAcceleration: number;  // m/s^2
  readonly brakeDeceleration: number;    // m/s^2
  readonly rollingDeceleration: number;  // m/s^2
  readonly maxSteerRate: number;         // rad/s
  readonly lateralGrip: number;          // 1/s
  readonly minSteerSpeed: number;        // m/s
  readonly fullSteerSpeed: number;       // m/s
}

// F1-style tuning seed. Kept as a single named object so the values can be
// surfaced as user-configurable (UI) without touching the controller math.
export const VEHICLE_TUNING: VehicleTuning = {
  maxForwardSpeed: 42,
  maxReverseSpeed: 7,
  forwardAcceleration: 13,
  reverseAcceleration: 5,
  brakeDeceleration: 20,
  rollingDeceleration: 1.5,
  maxSteerRate: 2.4,
  lateralGrip: 7.0,
  minSteerSpeed: 0.8,
  fullSteerSpeed: 4,
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

function moveTowards(value: number, target: number, maxDelta: number): number {
  if (value < target) return Math.min(value + maxDelta, target);
  if (value > target) return Math.max(value - maxDelta, target);
  return target;
}

export function stepVehicle(state: VehicleState, input: VehicleInput, dt = 1 / 60, tuning: VehicleTuning = VEHICLE_TUNING): VehicleState {
  const throttle = clamp(input.throttle, -1, 1);
  const steer = clamp(input.steer, -1, 1);
  const brake = clamp(input.brake, 0, 1);
  const forward = { x: Math.cos(state.heading), y: Math.sin(state.heading) };
  const right = { x: -forward.y, y: forward.x };
  let longitudinal = state.velocity.x * forward.x + state.velocity.y * forward.y;
  const lateral = state.velocity.x * right.x + state.velocity.y * right.y;
  const target = throttle >= 0 ? tuning.maxForwardSpeed * throttle : tuning.maxReverseSpeed * throttle;
  const acceleration = throttle === 0 ? tuning.rollingDeceleration : throttle >= 0 ? tuning.forwardAcceleration : tuning.reverseAcceleration;

  longitudinal = moveTowards(longitudinal, target, acceleration * dt);
  longitudinal = moveTowards(longitudinal, 0, tuning.brakeDeceleration * brake * dt);
  longitudinal = clamp(longitudinal, -tuning.maxReverseSpeed, tuning.maxForwardSpeed);

  const lateralDamping = Math.max(0, 1 - tuning.lateralGrip * dt);
  const newLateral = lateral * lateralDamping;
  const speedFactor = Math.abs(longitudinal) < tuning.minSteerSpeed ? 0 : Math.min(1, Math.abs(longitudinal) / tuning.fullSteerSpeed);
  const heading = state.heading
    + steer * tuning.maxSteerRate * speedFactor * (longitudinal < 0 ? -1 : 1) * dt;
  const velocity = {
    x: forward.x * longitudinal + right.x * newLateral,
    y: forward.y * longitudinal + right.y * newLateral,
  };

  return {
    position: {
      x: state.position.x + velocity.x * dt,
      y: state.position.y + velocity.y * dt,
    },
    velocity,
    heading,
  };
}
