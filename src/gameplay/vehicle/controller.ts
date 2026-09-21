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
  readonly lateralGripBase: number;      // 1/s, grip at low speed (tight, no float)
  readonly lateralGripAtSpeed: number;   // 1/s, grip at top speed (drift / weight)
  readonly engineTaper: number;          // 0..1, engine fill: accel at top = (1-taper)*base
  readonly minSteerSpeed: number;        // m/s
  readonly fullSteerSpeed: number;       // m/s
}

// F1-style tuning seed. Kept as a single named object so the values can be
// surfaced as user-configurable (UI) without touching the controller math.
export const VEHICLE_TUNING: VehicleTuning = {
  maxForwardSpeed: 67.2,        // -20% trim of 84 -> ~242 km/h
  maxReverseSpeed: 11.2,        // -20% trim of 14
  forwardAcceleration: 20,
  reverseAcceleration: 16,
  brakeDeceleration: 48,        // strong: stoppable from top speed in ~3 s
  rollingDeceleration: 2.6,
  maxSteerRate: 2.4,
  lateralGripBase: 16,          // grounded at low speed (~9 deg slide)
  lateralGripAtSpeed: 6,        // drift / weight at top speed (~18 deg slide)
  engineTaper: 0.7,             // engine fill: 30% pull left at top speed
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
  let acceleration: number;
  if (throttle === 0) {
    acceleration = tuning.rollingDeceleration;
  } else if (throttle > 0) {
    // Engine curve: full pull at low speed, tapering as it approaches top speed.
    const fill = clamp(longitudinal / tuning.maxForwardSpeed, 0, 1);
    acceleration = tuning.forwardAcceleration * (1 - tuning.engineTaper * fill);
  } else {
    acceleration = tuning.reverseAcceleration;
  }

  longitudinal = moveTowards(longitudinal, target, acceleration * dt);
  longitudinal = moveTowards(longitudinal, 0, tuning.brakeDeceleration * brake * dt);
  longitudinal = clamp(longitudinal, -tuning.maxReverseSpeed, tuning.maxForwardSpeed);

  // Tires: grip is high at low speed (grounded, no float) and lower at speed
  // (visible drift / weight).
  const speedFill = clamp(Math.abs(longitudinal) / tuning.maxForwardSpeed, 0, 1);
  const grip = tuning.lateralGripBase + (tuning.lateralGripAtSpeed - tuning.lateralGripBase) * speedFill;
  const lateralDamping = Math.max(0, 1 - grip * dt);
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
