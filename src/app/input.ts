export type VehicleInput = {
  throttle: number;
  steer: number;
  brake: number;
};

export function readVehicleInput(keys: ReadonlySet<string>): VehicleInput {
  return {
    throttle: keys.has("w") || keys.has("arrowup") ? 1 : keys.has("s") || keys.has("arrowdown") ? -1 : 0,
    steer: keys.has("a") || keys.has("arrowleft") ? 1 : keys.has("d") || keys.has("arrowright") ? -1 : 0,
    brake: keys.has(" ") ? 1 : 0,
  };
}
