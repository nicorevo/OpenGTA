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

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

function moveTowards(value: number, target: number, maxDelta: number): number {
  if (value < target) return Math.min(value + maxDelta, target);
  if (value > target) return Math.max(value - maxDelta, target);
  return target;
}

export function stepVehicle(state: VehicleState, input: VehicleInput, dt = 1 / 60): VehicleState {
  const throttle = clamp(input.throttle, -1, 1);
  const steer = clamp(input.steer, -1, 1);
  const brake = clamp(input.brake, 0, 1);
  const forward = { x: Math.cos(state.heading), y: Math.sin(state.heading) };
  const right = { x: -forward.y, y: forward.x };
  let longitudinal = state.velocity.x * forward.x + state.velocity.y * forward.y;
  const lateral = state.velocity.x * right.x + state.velocity.y * right.y;
  const target = throttle >= 0 ? 22 * throttle : 7 * throttle;
  const acceleration = throttle === 0 ? 1.5 : throttle >= 0 ? 9 : 5;

  longitudinal = moveTowards(longitudinal, target, acceleration * dt);
  longitudinal = moveTowards(longitudinal, 0, 14 * brake * dt);
  longitudinal = clamp(longitudinal, -7, 22);

  const lateralDamping = Math.max(0, 1 - 7 * dt);
  const newLateral = lateral * lateralDamping;
  const speedFactor = Math.abs(longitudinal) < 0.8 ? 0 : Math.min(1, Math.abs(longitudinal) / 4);
  const heading = state.heading
    + steer * 2.4 * speedFactor * (longitudinal < 0 ? -1 : 1) * dt;
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
