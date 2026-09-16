import { describe, it, expect } from "vitest";
import { projectPerspective, DEFAULT_CAMERA_CONFIG, type CameraConfig } from "./camera3d.ts";

describe("camera3d", () => {
  it("default config has correct values", () => {
    const config = DEFAULT_CAMERA_CONFIG;
    expect(config.fovDegrees).toBe(60);
    expect(config.cameraHeight).toBe(1.5);
    expect(config.nearClip).toBe(0.5);
    expect(config.farClip).toBe(150);
  });

  it("projects straight-ahead point to center of screen", () => {
    const result = projectPerspective(0, 0, 10, DEFAULT_CAMERA_CONFIG);
    expect(result.sx).toBeCloseTo(0, 5);
    // Ground level projects below horizon (positive sy = down)
    expect(result.sy).toBeGreaterThan(0.1);
    expect(result.depth).toBeGreaterThan(0);
    expect(result.depth).toBeLessThan(1);
    expect(result.rejected).toBe(false);
  });

  it("projects right-side point to positive sx", () => {
    const result = projectPerspective(5, 0, 10, DEFAULT_CAMERA_CONFIG);
    expect(result.sx).toBeGreaterThan(0.5);
  });

  it("projects left-side point to negative sx", () => {
    const result = projectPerspective(-5, 0, 10, DEFAULT_CAMERA_CONFIG);
    expect(result.sx).toBeLessThan(-0.5);
  });

  it("projects near clip to depth 0", () => {
    const result = projectPerspective(0, 0, 0.5, DEFAULT_CAMERA_CONFIG);
    expect(result.depth).toBeCloseTo(0, 1);
    expect(result.rejected).toBe(true);
  });

  it("projects far clip to depth 1", () => {
    const result = projectPerspective(0, 0, 150, DEFAULT_CAMERA_CONFIG);
    expect(result.depth).toBeCloseTo(1, 1);
    expect(result.rejected).toBe(false);
  });

  it("projects camera-height point to horizon sy", () => {
    const result = projectPerspective(0, 1.5, 10, DEFAULT_CAMERA_CONFIG);
    expect(result.sy).toBeCloseTo(0, 5);
    expect(result.rejected).toBe(false);
  });

  it("projects above camera to negative sy (up on screen)", () => {
    const result = projectPerspective(0, 3, 10, DEFAULT_CAMERA_CONFIG);
    expect(result.sy).toBeLessThan(-0.05);
    expect(result.rejected).toBe(false);
  });

  it("projects ground to positive sy (down on screen)", () => {
    const result = projectPerspective(0, 0, 10, DEFAULT_CAMERA_CONFIG);
    expect(result.sy).toBeGreaterThan(0.1);
    expect(result.rejected).toBe(false);
  });

  it("rejects points behind camera (negative Z)", () => {
    const result = projectPerspective(0, 0, -5, DEFAULT_CAMERA_CONFIG);
    expect(result.rejected).toBe(true);
  });

  it("rejects points beyond far clip", () => {
    const result = projectPerspective(0, 0, 200, DEFAULT_CAMERA_CONFIG);
    expect(result.rejected).toBe(true);
  });
});
