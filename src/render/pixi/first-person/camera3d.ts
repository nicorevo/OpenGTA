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

/** Output of a single perspective projection. */
export interface ProjectedPoint {
  /** Normalized X: -1 (left) to 1 (right). */
  readonly sx: number;
  /** Normalized Y: -1 (top) to 1 (bottom). */
  readonly sy: number;
  /** Normalized depth: 0 (near) to 1 (far). */
  readonly depth: number;
  /** True when the point is behind the camera or beyond the far clip. */
  readonly rejected: boolean;
}

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

/**
 * Project a world point onto the normalized screen plane.
 *
 * Coordinate convention:
 * - Z positive = forward (along the camera's gaze direction)
 * - X positive = right of the camera
 * - Y positive = up from ground level
 * - Camera sits at (0, cameraHeight, 0), looking along +Z
 *
 * Returns rejected=true when the point is behind the near clip or beyond
 * the far clip — callers should skip drawing such points.
 */
export function projectPerspective(
  worldX: number,
  worldY: number,
  worldZ: number,
  config: CameraConfig,
): ProjectedPoint {
  // Behind camera?
  if (worldZ <= 0) return { sx: 0, sy: 0, depth: 0, rejected: true };

  const halfFovRad = (config.fovDegrees * Math.PI) / 180 / 2;
  const halfFovTan = Math.tan(halfFovRad);

  // Vertical angle: Y is measured from ground, camera is at cameraHeight
  const relativeY = worldY - config.cameraHeight;
  const sx = (worldX / worldZ) / halfFovTan;
  const sy = -(relativeY / worldZ) / halfFovTan;

  // Clipped?
  if (sx < -2 || sx > 2 || sy < -2 || sy > 2) {
    return { sx, sy, depth: 0, rejected: true };
  }

  const depth = (worldZ - config.nearClip) / (config.farClip - config.nearClip);
  if (depth < 0) return { sx, sy, depth: 0, rejected: true };
  if (depth > 1) return { sx, sy, depth: 1, rejected: true };

  return { sx, sy, depth, rejected: false };
}
