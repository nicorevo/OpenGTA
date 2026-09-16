import { Graphics } from "pixi.js";
import type { RoadSegment } from "./road-projector.ts";

/** Asphalt fill color (matches top-down renderer). */
const ROAD_FILL = 0x53515a;
/** Road edge/curb color (matches top-down renderer). */
const ROAD_EDGE = 0x302e38;
/** Number of nearest segments to draw edge strokes on. */
const EDGE_SEGMENT_COUNT = 3;

/**
 * Draw perspective road segments on a PixiJS Graphics object.
 *
 * Segments should be sorted back-to-front (farthest first) so that
 * nearer segments paint over distant ones at junctions.
 *
 * Each segment is drawn as a quadrilateral polygon between its left and
 * right screen coordinates. The fill uses ROAD_FILL for asphalt and
 * ROAD_EDGE for the nearest few segments as curb highlights.
 */
export function drawRoadSegments(
  graphics: Graphics,
  segments: RoadSegment[],
  canvasWidth: number,
  canvasHeight: number,
): void {
  graphics.clear();

  if (segments.length === 0) return;

  // Convert normalized Y to pixel Y (0 at top, canvasHeight at bottom)
  const horizonPixelY = canvasHeight * 0.35; // Matches sky-drawer horizon
  const groundPixelY = canvasHeight;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];

    // Convert normalized X,Y to pixel coordinates
    const farSeg = i === 0 ? null : segments[i - 1];
    const farSegY = farSeg ? farSeg.screenY : 0;
    const segY = seg.screenY;

    // Y: farthest segment at horizon, nearest at bottom
    const pixelYFar = horizonPixelY + (groundPixelY - horizonPixelY) * farSegY;
    const pixelYNear = horizonPixelY + (groundPixelY - horizonPixelY) * segY;

    // X: normalized [-1,1] or [0,1] to pixel
    const leftFarX = (seg.leftScreenX - seg.screenWidth * 0.02 * (i / segments.length)) * canvasWidth;
    const leftNearX = seg.leftScreenX * canvasWidth;
    const rightFarX = (seg.rightScreenX + seg.screenWidth * 0.02 * (i / segments.length)) * canvasWidth;
    const rightNearX = seg.rightScreenX * canvasWidth;

    // Draw the segment polygon
    graphics.poly([
      { x: leftFarX, y: pixelYFar },
      { x: leftNearX, y: pixelYNear },
      { x: rightNearX, y: pixelYNear },
      { x: rightFarX, y: pixelYFar },
    ]).fill(ROAD_FILL);

    // Draw edge strokes on the first 3 segments (nearest)
    if (i < EDGE_SEGMENT_COUNT) {
      const strokePx = Math.max(1, canvasWidth * 0.002);
      graphics.poly([
        { x: leftNearX, y: pixelYNear },
        { x: leftFarX, y: pixelYFar },
      ]).stroke({ color: ROAD_EDGE, width: strokePx });

      graphics.poly([
        { x: rightNearX, y: pixelYNear },
        { x: rightFarX, y: pixelYFar },
      ]).stroke({ color: ROAD_EDGE, width: strokePx });
    }
  }
}
