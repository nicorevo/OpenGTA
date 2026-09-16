import { Graphics } from "pixi.js";

/** Sky top color (dark blue). */
const SKY_TOP_COLOR = 0x1a3a5c;
/** Sky horizon color (light blue). */
const SKY_HORIZON_COLOR = 0x87ceeb;

/**
 * Draw a simple two-color sky gradient.
 *
 * Uses two polygons: a dark blue for the upper half and a light blue
 * for the lower portion (near the horizon).
 */
export function drawSky(graphics: Graphics, canvasWidth: number, canvasHeight: number): void {
  graphics.clear();

  const horizonY = canvasHeight * 0.35; // Horizon at 35% from top (more road space)

  // Upper sky (dark blue)
  graphics.poly([
    { x: 0, y: 0 },
    { x: canvasWidth, y: 0 },
    { x: canvasWidth, y: horizonY * 0.5 },
    { x: 0, y: horizonY * 0.5 },
  ]).fill(SKY_TOP_COLOR);

  // Lower sky (light blue, near horizon)
  graphics.poly([
    { x: 0, y: horizonY * 0.5 },
    { x: canvasWidth, y: horizonY * 0.5 },
    { x: canvasWidth, y: horizonY },
    { x: 0, y: horizonY },
  ]).fill(SKY_HORIZON_COLOR);
}
