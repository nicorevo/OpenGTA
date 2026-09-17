/** Perspective camera configuration for first-person rendering. */
export interface CameraConfig {
  /** Field of view in degrees. */
  readonly fovDegrees: number;
  /** Camera height above ground in meters. */
  readonly cameraHeight: number;
  /** Near clipping plane in meters. */
  readonly nearClip: number;
  /** Far clipping plane in meters. */
  readonly farClip: number;
}

/** Default configuration tuned for arcade driving perspective. */
export const DEFAULT_CAMERA_CONFIG: Readonly<CameraConfig> = Object.freeze({
  fovDegrees: 60,
  cameraHeight: 1.5,
  nearClip: 0.5,
  farClip: 150,
});

/**
 * Project a ground-level point (worldY = 0) at camera-space coordinates into
 * normalized device coordinates without any rejection. Polygon fills need
 * their off-screen vertices projected as well (the GPU clips them), so
 * callers must guarantee worldZ > nearClip (clip against the near/far
 * planes first).
 *
 * sx: -1..1 across the horizontal field of view, 0 = center.
 * sy: 0 = horizon, positive = below the horizon (ground), negative = above.
 */
export function projectGroundNdc(worldX: number, worldZ: number, config: CameraConfig): { readonly sx: number; readonly sy: number } {
  return projectNdc(worldX, 0, worldZ, config);
}

/**
 * Project a point at camera-space coordinates (X right, Y up, Z forward)
 * into normalized device coordinates without rejection. sx: -1..1 across the
 * horizontal field of view; sy: 0 = horizon, positive = below. Callers must
 * guarantee worldZ > nearClip.
 */
export function projectNdc(worldX: number, worldY: number, worldZ: number, config: CameraConfig): { readonly sx: number; readonly sy: number } {
  const halfFovTan = Math.tan((config.fovDegrees * Math.PI) / 180 / 2);
  return { sx: worldX / worldZ / halfFovTan, sy: (config.cameraHeight - worldY) / worldZ / halfFovTan };
}
