import { describe, it, expect } from "vitest";
import { projectBuildings, type BuildingInput, BUILDING_COLOR, HISTORIC_COLOR, MAX_PROJECTED_HEIGHT } from "./building-projector.ts";
import { DEFAULT_CAMERA_CONFIG } from "./camera3d.ts";
import type { Vec2 } from "../../../world/model/types.ts";

const TAN30 = Math.tan(Math.PI / 6);
const cameraPos: Vec2 = { x: 0, y: 0 };

function boxAt(cx: number, cy: number, size: number, heightMeters: number, isHistoric = false): BuildingInput {
  const h = size / 2;
  return {
    footprint: [
      { x: cx - h, y: cy - h },
      { x: cx + h, y: cy - h },
      { x: cx + h, y: cy + h },
      { x: cx - h, y: cy + h },
    ],
    heightMeters,
    isHistoric,
  };
}

describe("building-projector (box model)", () => {
  it("projects an axis-aligned box ahead with one visible wall and a roof above the walls", () => {
    const [box] = projectBuildings([boxAt(30, 0, 10, 8)], cameraPos, 0, DEFAULT_CAMERA_CONFIG);
    expect(box).toBeDefined();
    expect(box!.depth).toBeCloseTo(25, 5);
    expect(box!.walls).toHaveLength(1);
    expect(box!.roof).toHaveLength(4);
    expect(box!.color).toBe(BUILDING_COLOR);
    expect(box!.roofColor).not.toBe(box!.color);

    // The roof's near-top corners coincide with the visible wall's top
    // corners (continuous top of the box); the far roof corners project
    // lower on screen due to perspective.
    expect(Math.min(...box!.roof.map((p) => p.sy))).toBeCloseTo(
      Math.min(...box!.walls[0].slice(2).map((p) => p.sy)),
      10,
    );
    // The whole roof sits above the wall bottoms (smaller sy = higher up).
    expect(Math.max(...box!.roof.map((p) => p.sy))).toBeLessThan(
      Math.max(...box!.walls[0].slice(0, 2).map((p) => p.sy)),
    );

    // Wall bottoms sit below the horizon (positive NDC sy at 25-35 m).
    for (const p of box!.walls[0].slice(0, 2)) {
      expect(p.sy).toBeGreaterThan(0);
    }
  });

  it("places the box top at the clamped height, not the raw height", () => {
    const [box] = projectBuildings([boxAt(30, 0, 10, 60)], cameraPos, 0, DEFAULT_CAMERA_CONFIG);
    expect(box).toBeDefined();
    // Far-right roof corner sits at z = 35: among the right-side (sx > 0)
    // corners the far one has the largest sy.
    const rightCorners = box!.roof.filter((p) => p.sx > 0);
    const farRight = rightCorners.reduce((a, b) => (b.sy > a.sy ? b : a));
    expect(farRight.sx).toBeCloseTo(5 / (35 * TAN30), 4);
    expect(farRight.sy).toBeCloseTo((DEFAULT_CAMERA_CONFIG.cameraHeight - MAX_PROJECTED_HEIGHT) / (35 * TAN30), 4);
  });

  it("shows two walls for a rotated box", () => {
    const diamond: BuildingInput = {
      footprint: [
        { x: 35, y: 15 },
        { x: 30, y: 20 },
        { x: 25, y: 15 },
        { x: 30, y: 10 },
      ],
      heightMeters: 8,
      isHistoric: false,
    };
    const [box] = projectBuildings([diamond], cameraPos, 0, DEFAULT_CAMERA_CONFIG);
    expect(box).toBeDefined();
    expect(box!.walls).toHaveLength(2);
    for (const wall of box!.walls) expect(wall).toHaveLength(4);
  });

  it("skips buildings behind the camera", () => {
    expect(projectBuildings([boxAt(-30, 0, 10, 8)], cameraPos, 0, DEFAULT_CAMERA_CONFIG)).toHaveLength(0);
  });

  it("skips buildings beyond the forward limit", () => {
    expect(projectBuildings([boxAt(200, 0, 10, 8)], cameraPos, 0, DEFAULT_CAMERA_CONFIG)).toHaveLength(0);
  });

  it("skips boxes with corners inside the near clip zone", () => {
    expect(projectBuildings([boxAt(5, 0, 10, 8)], cameraPos, 0, DEFAULT_CAMERA_CONFIG)).toHaveLength(0);
  });

  it("uses the historic color for landmarks", () => {
    const [box] = projectBuildings([boxAt(30, 0, 10, 8, true)], cameraPos, 0, DEFAULT_CAMERA_CONFIG);
    expect(box).toBeDefined();
    expect(box!.color).toBe(HISTORIC_COLOR);
  });

  it("sorts boxes back-to-front", () => {
    const boxes = projectBuildings([boxAt(20, 0, 8, 8), boxAt(60, 0, 8, 8)], cameraPos, 0, DEFAULT_CAMERA_CONFIG);
    expect(boxes).toHaveLength(2);
    expect(boxes[0].depth).toBeGreaterThan(boxes[1].depth);
  });
});
