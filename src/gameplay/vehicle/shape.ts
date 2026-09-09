import type { Vec2 } from "../../world/model/types.ts";

export const VEHICLE_HALF_LENGTH = 2;
export const VEHICLE_HALF_WIDTH = 0.82;
export interface VehiclePose { readonly position: Vec2; readonly heading: number }

export function vehicleFootprint(pose: VehiclePose, margin = 0): readonly Vec2[] {
  const c = Math.cos(pose.heading); const s = Math.sin(pose.heading);
  const x = VEHICLE_HALF_LENGTH + margin; const y = VEHICLE_HALF_WIDTH + margin;
  return [[-x, -y], [x, -y], [x, y], [-x, y]].map(([dx, dy]) => ({ x: pose.position.x + dx * c - dy * s, y: pose.position.y + dx * s + dy * c }));
}
