import { describe, it, expect } from "vitest";
import { DEFAULT_CAMERA_CONFIG } from "./camera3d.ts";

describe("camera3d", () => {
  it("default config has correct values", () => {
    const config = DEFAULT_CAMERA_CONFIG;
    expect(config.fovDegrees).toBe(60);
    expect(config.cameraHeight).toBe(1.5);
    expect(config.nearClip).toBe(0.5);
    expect(config.farClip).toBe(150);
  });
});
