import { Application, Graphics, Container, Text } from "pixi.js";
import type { CompiledChunkV0 } from "../../world/compiler/compiled.ts";
import type { Vec2 } from "../../world/model/types.ts";
import { projectRoadSegments, type RoadSegment } from "./first-person/road-projector.ts";
import { projectBuildings, type BuildingInput } from "./first-person/building-projector.ts";
import { projectPerspective, type ProjectedPoint } from "./first-person/camera3d.ts";
import { DEFAULT_CAMERA_CONFIG } from "./first-person/camera3d.ts";

export interface FirstPersonRenderer {
  readonly app: Application;
  render(chunks: CompiledChunkV0 | readonly CompiledChunkV0[]): void;
  updateVehicle(position: Vec2, heading: number): void;
  cameraState(): { position: Vec2; heading: number };
  dispose(): void;
}

const ROAD_RENDER_DIST = 300;
const BUILDING_RENDER_DIST = 200;
const LATERAL_LIMIT = 50;
const HORIZON_RATIO = 0.35;
const ROAD_FILL = 0x53515a;
const ROAD_EDGE = 0x302e38;
const SKY_TOP_COLOR = 0x1a3a5c;
const SKY_HORIZON_COLOR = 0x87ceeb;
const BUILDING_COLOR = 0x806c61;
const HISTORIC_COLOR = 0xa86f5d;
const MAX_BUILDING_HEIGHT = 25;

function projectPoint(x: number, y: number, z: number): ProjectedPoint {
  return projectPerspective(x, y, z, DEFAULT_CAMERA_CONFIG);
}

function normalizeSy(sy: number): number {
  return Math.abs(sy) / (1 + Math.abs(sy));
}

function clampSx(sx: number): number {
  return Math.max(-1, Math.min(1, sx));
}

function drawSky(graphics: Graphics, w: number, h: number): void {
  graphics.clear();
  const horizonY = h * HORIZON_RATIO;
  const halfHorizon = horizonY * 0.5;
  graphics.poly([{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: halfHorizon }, { x: 0, y: halfHorizon }]).fill(SKY_TOP_COLOR);
  graphics.poly([{ x: 0, y: halfHorizon }, { x: w, y: halfHorizon }, { x: w, y: horizonY }, { x: 0, y: horizonY }]).fill(SKY_HORIZON_COLOR);
}

interface DepthItem {
  depth: number;
  pixelYBottom: number;
  pixelXLeft: number;
  pixelXRight: number;
  pixelYTop: number;
  fill: number | null;
  stroke: number | null;
}

function buildRoadItems(
  centerline: readonly Vec2[],
  widthMeters: number,
  camX: number,
  camY: number,
  heading: number,
): DepthItem[] {
  const cosH = Math.cos(heading);
  const sinH = Math.sin(heading);
  const relative: { x: number; z: number }[] = [];
  for (const pt of centerline) {
    const dx = pt.x - camX;
    const dy = pt.y - camY;
    relative.push({ x: dx * cosH + dy * sinH, z: -dx * sinH + dy * cosH });
  }
  if (relative.length < 2) return [];

  const segments: { z: number; leftX: number; rightX: number }[] = [];
  for (let i = 0; i < relative.length - 1; i++) {
    const a = relative[i];
    const b = relative[i + 1];
    if (a.z <= 0 && b.z <= 0) continue;
    if (a.z >= ROAD_RENDER_DIST && b.z >= ROAD_RENDER_DIST) continue;
    const midZ = (a.z + b.z) / 2;
    const midX = (a.x + b.x) / 2;
    if (Math.abs(midX) > LATERAL_LIMIT * 2) continue;
    segments.push({ z: midZ, leftX: midX - widthMeters / 2, rightX: midX + widthMeters / 2 });
  }
  if (segments.length === 0) return [];

  segments.sort((a, b) => b.z - a.z);

  const items: DepthItem[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const leftProj = projectPoint(seg.leftX, 0, seg.z);
    const rightProj = projectPoint(seg.rightX, 0, seg.z);
    if (leftProj.rejected && rightProj.rejected) continue;

    const avgSy = Math.abs((leftProj.sy + rightProj.sy) / 2);
    const normSy = normalizeSy(avgSy);
    const segDepth = seg.z;

    const leftSx = clampSx(leftProj.sx);
    const rightSx = clampSx(rightProj.sx);
    const widthRatio = Math.max(0.01, (rightSx - leftSx) / 2);

    items.push({
      depth: segDepth,
      pixelYBottom: normSy,
      pixelXLeft: (leftSx + 1) / 2 - widthRatio * 0.02 * (i / segments.length),
      pixelXRight: (rightSx + 1) / 2 + widthRatio * 0.02 * (i / segments.length),
      pixelYTop: i === 0 ? 0 : normalizeSy(Math.abs((segments[i - 1] ? (projectPoint((segments[i - 1].leftX + segments[i - 1].rightX) / 2, 0, segments[i - 1].z).sy) : 0))),
      fill: ROAD_FILL,
      stroke: i < 3 ? ROAD_EDGE : null,
    });
  }
  return items;
}

function buildBuildingItem(
  footprint: readonly Vec2[],
  heightMeters: number,
  isHistoric: boolean,
  camX: number,
  camY: number,
  heading: number,
): DepthItem | null {
  const cosH = Math.cos(heading);
  const sinH = Math.sin(heading);

  let totalZ = 0;
  let totalX = 0;
  const relPts: { x: number; z: number }[] = [];

  for (const pt of footprint) {
    const dx = pt.x - camX;
    const dy = pt.y - camY;
    const rx = dx * cosH + dy * sinH;
    const rz = -dx * sinH + dy * cosH;
    relPts.push({ x: rx, z: rz });
    totalZ += rz;
    totalX += rx;
  }

  const count = relPts.length;
  if (count === 0) return null;

  const avgZ = totalZ / count;
  const avgX = totalX / count;

  if (avgZ <= 0 || avgZ > BUILDING_RENDER_DIST) return null;
  if (Math.abs(avgX) > LATERAL_LIMIT) return null;

  const clampedHeight = Math.min(MAX_BUILDING_HEIGHT, Math.max(1, heightMeters));
  const centerIdx = Math.floor(count / 2);
  const cx = relPts[centerIdx].x;
  const cz = relPts[centerIdx].z;

  const bottomProj = projectPoint(cx, 0, cz);
  const topProj = projectPoint(cx, clampedHeight, cz);
  if (bottomProj.rejected && topProj.rejected) return null;

  const syBottom = bottomProj.rejected ? 0 : normalizeSy(bottomProj.sy);
  const syTop = topProj.rejected ? 0 : normalizeSy(topProj.sy);
  const sx = bottomProj.rejected ? 0 : bottomProj.sx;

  const halfW = 0.12;
  const leftSx = clampSx(sx - halfW);
  const rightSx = clampSx(sx + halfW);

  return {
    depth: cz,
    pixelYBottom: syBottom,
    pixelXLeft: leftSx,
    pixelXRight: rightSx,
    pixelYTop: syTop,
    fill: isHistoric ? HISTORIC_COLOR : BUILDING_COLOR,
    stroke: null,
  };
}

export function createFirstPersonRenderer(canvas: HTMLCanvasElement): FirstPersonRenderer {
  const app = new Application();
  app.init({ canvas, background: 0x00000000, antialias: true, preference: "webgl", resizeTo: canvas.parentElement ?? window });

  const worldContainer = new Container();
  app.stage.addChild(worldContainer);

  const skyGraphics = new Graphics();
  const renderGraphics = new Graphics();
  const debugGraphics = new Graphics();
  const debugTextStyle = new Text({
    text: "",
    style: {
      fontFamily: "monospace",
      fontSize: 11,
      fill: "#ff0000",
      dropShadow: true,
    },
  });
  worldContainer.addChild(skyGraphics, renderGraphics, debugGraphics, debugTextStyle);
  debugTextStyle.anchor.set(0, 0);
  debugTextStyle.x = 8;
  debugTextStyle.y = 8;

  let vehiclePos: Vec2 = { x: 0, y: 0 };
  let vehicleHeading = 0;

  const renderScene = (chunks: readonly CompiledChunkV0[]): void => {
    const w = app.screen.width;
    const h = app.screen.height;
    if (w === 0 || h === 0) return;

    const horizonY = h * HORIZON_RATIO;
    const groundHeight = h - horizonY;

    drawSky(skyGraphics, w, h);

    // Collect all geometry from all chunks
    const allRoads: { centerline: readonly Vec2[]; widthMeters: number }[] = [];
    const allBuildings: BuildingInput[] = [];

    for (const chunk of chunks) {
      for (const road of chunk.roads) {
        allRoads.push({ centerline: road.centerline, widthMeters: road.widthMeters });
      }
      for (const building of chunk.buildings) {
        const roof = building.roof;
        if (roof.outer.length < 3) continue;
        allBuildings.push({
          footprint: roof.outer,
          heightMeters: building.visualHeightMeters,
          isHistoric: building.styleKey.includes("historic"),
        });
      }
    }

    const camX = vehiclePos.x;
    const camY = vehiclePos.y;
    const heading = vehicleHeading;

    // Build depth-sorted render items
    const items: DepthItem[] = [];

    // Roads
    for (const road of allRoads) {
      const items2 = buildRoadItems(road.centerline, road.widthMeters, camX, camY, heading);
      items.push(...items2);
    }

    // Buildings
    for (const b of allBuildings) {
      const item = buildBuildingItem(b.footprint, b.heightMeters, b.isHistoric, camX, camY, heading);
      if (item) items.push(item);
    }

    // Sort by depth (far to near)
    items.sort((a, b) => b.depth - a.depth);

    // Draw depth-sorted items
    renderGraphics.clear();
    for (const item of items) {
      const yBottom = horizonY + item.pixelYBottom * groundHeight;
      const yTop = horizonY + item.pixelYTop * groundHeight;
      const xLeft = item.pixelXLeft * w;
      const xRight = item.pixelXRight * w;

      if (item.fill !== null) {
        renderGraphics.poly([
          { x: xLeft, y: yBottom },
          { x: xRight, y: yBottom },
          { x: xRight, y: yTop },
          { x: xLeft, y: yTop },
        ]).fill(item.fill);
      }
      if (item.stroke !== null) {
        renderGraphics.poly([{ x: xLeft, y: yBottom }, { x: xLeft, y: yTop }]).stroke({ color: item.stroke, width: Math.max(1, w * 0.002) });
        renderGraphics.poly([{ x: xRight, y: yBottom }, { x: xRight, y: yTop }]).stroke({ color: item.stroke, width: Math.max(1, w * 0.002) });
      }
    }

    // Final road strip: draw the nearest road segment as a full-width ground fill
    // This ensures the road always occludes buildings below it
    if (items.length > 0) {
      const nearestRoadItem = items.find((i) => i.fill === ROAD_FILL);
      if (nearestRoadItem) {
        const roadBottomY = horizonY + nearestRoadItem.pixelYBottom * groundHeight;
        renderGraphics.poly([
          { x: 0, y: roadBottomY },
          { x: w, y: roadBottomY },
          { x: w, y: h },
          { x: 0, y: h },
        ]).fill(ROAD_FILL);

        // Draw side curbs on nearest items
        const roadAreaHeight = h - horizonY;
        const curbWidth = Math.max(1, w * 0.003);
        const nearestSegments = items.filter((i) => i.fill === ROAD_FILL).slice(0, 3);
        for (const seg of nearestSegments) {
          const segBottomY = horizonY + seg.pixelYBottom * roadAreaHeight;
          const segTopY = horizonY + seg.pixelYTop * roadAreaHeight;
          const segLeftX = seg.pixelXLeft * w;
          const segRightX = seg.pixelXRight * w;
          renderGraphics.poly([{ x: segLeftX, y: segBottomY }, { x: segLeftX, y: segTopY }]).stroke({ color: ROAD_EDGE, width: curbWidth });
          renderGraphics.poly([{ x: segRightX, y: segBottomY }, { x: segRightX, y: segTopY }]).stroke({ color: ROAD_EDGE, width: curbWidth });
        }
      }
    }

    // Debug overlay
    debugGraphics.clear();
    const roadCount = allRoads.length;
    const buildingCount = allBuildings.length;
    const projectedCount = items.filter((i) => i.fill === ROAD_FILL).length;
    const buildingProjectedCount = items.filter((i) => i.fill !== ROAD_FILL).length;
    const debugMsg = `FPV | cam:${camX.toFixed(0)},${camY.toFixed(0)} | heading:${(heading * 180 / Math.PI).toFixed(0)}deg | chunks:${chunks.length} roads:${roadCount} bldgs:${buildingCount} proj:${projectedCount}/${buildingProjectedCount}`;
    debugTextStyle.text = debugMsg;
  };

  return {
    app,
    render(chunks) {
      const arr = Array.isArray(chunks) ? chunks : [chunks];
      renderScene(arr);
    },
    updateVehicle(position, heading) {
      vehiclePos = { ...position };
      vehicleHeading = heading;
    },
    cameraState() {
      return { position: { ...vehiclePos }, heading: vehicleHeading };
    },
    dispose() {
      app.destroy(false, { children: true });
    },
  };
}
