import rawFixture from "../fixtures/geo/lecce-sant-oronzo-v0.raw.json";
import { createTangentProjector } from "../geo/coordinates/projector.ts";
import { normalizeOsm } from "../geo/normalize/osm.ts";
import { compileRegion } from "../world/compiler/compiled.ts";
import { createChunkCache } from "../world/chunk/cache.ts";
import { createChunkGrid } from "../world/chunk/grid.ts";
import { createGeoDataSource } from "../world/runtime/source.ts";
import { createOpenWorldRuntime } from "../world/runtime/open-world.ts";
import { createPixiRenderer } from "../render/pixi/renderer.ts";
import { createPhysicsAdapter } from "../physics/rapier/adapter.ts";
import { advanceFixedStep } from "./fixed-step.ts";
import { readVehicleInput } from "./input.ts";
import { RuntimeMetrics } from "./metrics.ts";

export async function bootstrap(root: HTMLElement): Promise<void> {
  root.replaceChildren();
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-label", "OpenGTA Web V0 world");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  const overlay = document.createElement("pre");
  overlay.hidden = true;
  overlay.id = "debug-overlay";
  const hint = document.createElement("p");
  hint.textContent = "WASD / frecce: guida · L: nomi vie/luoghi · F3: diagnostica · © OpenStreetMap contributors";
  root.append(canvas, overlay, hint);
  root.style.cssText = "position:fixed;inset:0;background:#17202a;color:#fff;font:14px monospace;overflow:hidden";
  canvas.style.display = "block";
  hint.style.cssText = "position:fixed;bottom:8px;left:12px;margin:0;color:#fff8";
  overlay.style.cssText = "position:fixed;top:8px;left:8px;margin:0;padding:8px;background:#111c;color:#fff;z-index:2";

  const params = new URLSearchParams(window.location.search);
  const defaultOrigin = { latitude: 40.35316888888889, longitude: 18.17259 };
  const origin = {
    latitude: Number(params.get("lat") ?? defaultOrigin.latitude),
    longitude: Number(params.get("lon") ?? defaultOrigin.longitude),
  };
  const openWorldMode = params.get("mode") === "open-world";
  let regionId = "lecce-sant-oronzo-v0";
  let buildingCount = 0;
  let roadCount = 0;
  let regionWarningCount = 0;
  let result;
  if (openWorldMode) {
    const source = createGeoDataSource(async () => rawFixture);
    const runtime = createOpenWorldRuntime({
      baseOrigin: origin,
      cache: createChunkCache(9),
      compilerVersion: "v0-runtime",
      grid: createChunkGrid(300),
      source,
    });
    const activeWindow = await runtime.loadWindow({
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      cameraBounds: { minX: -300, minY: -300, maxX: 300, maxY: 300 },
    });
    const firstChunk = activeWindow.loaded.find((demand) => demand.priority === "P0");
    if (!firstChunk) throw new Error("Open World Runtime could not load the playable chunk");
    const chunk = await runtime.load(firstChunk.key);
    result = { chunks: [chunk], diagnostics: chunk.diagnostics };
    regionId = chunk.spatial.regionId;
    buildingCount = Object.values(chunk.featureIndex).filter((feature) => feature.kind === "building").length;
    roadCount = Object.values(chunk.featureIndex).filter((feature) => feature.kind === "road").length;
    regionWarningCount = chunk.diagnostics.warnings.length;
  } else {
    const region = normalizeOsm(rawFixture, createTangentProjector(origin), origin, regionId);
    result = compileRegion(region);
    buildingCount = region.buildings.length;
    roadCount = region.roads.length;
    regionWarningCount = region.warnings.length;
  }
  const physics = await createPhysicsAdapter(result.chunks[0].collisions);
  const renderer = await createPixiRenderer(canvas);
  renderer.render(result.chunks[0]);
  const metrics = new RuntimeMetrics();
  const benchmark = new URLSearchParams(window.location.search).get("benchmark") === "1";
  const benchmarkStartedAt = performance.now();
  let lastOverlayUpdate = 0;
  const keys = new Set<string>();
  let simulationAccumulatorSeconds = 0;
  let vehicle = physics.createVehicle({ x: 0, y: 0, heading: 0 });
  Object.defineProperty(window, "__opengtaV0Debug", {
    configurable: true,
    value: {
      vehicle: () => ({
        heading: vehicle.heading,
        position: { ...vehicle.position },
        velocity: { ...vehicle.velocity },
      }),
    },
  });
  const updateOverlay = () => {
    const snapshot = metrics.snapshot();
    overlay.textContent = `region: ${regionId}\nbuildings: ${buildingCount}\nroads: ${roadCount}\ncompiled: ${result.diagnostics.compiledFeatureCount}\nphysics colliders: ${physics.colliderCount()}\nFPS: ${snapshot.fps.toFixed(1)}\nframe p95: ${snapshot.p95FrameMs.toFixed(2)} ms\nlong frames: ${snapshot.longFrames}\nphysics steps: ${snapshot.physicsSteps}\nphysics avg: ${snapshot.averagePhysicsMs.toFixed(3)} ms\nphysics p95: ${snapshot.p95PhysicsMs.toFixed(3)} ms\nsim debt drops: ${snapshot.simulationDebtDrops}\ndropped sim debt: ${snapshot.droppedSimulationSeconds.toFixed(3)} s\nwarnings: ${regionWarningCount + result.diagnostics.warnings.length}\nrenderer: PixiJS WebGL`;
  };
  Object.defineProperty(window, "__opengtaV0Metrics", { configurable: true, value: metrics });
  window.addEventListener("keydown", (event) => {
    keys.add(event.key.toLowerCase());
    if (event.key === "F3") {
      overlay.hidden = !overlay.hidden;
      updateOverlay();
    }
    if (event.key.toLowerCase() === "l") {
      hint.textContent = `${renderer.toggleLabels() ? "Nomi attivi" : "Modalità guida"} · WASD / frecce: guida · L: cambia vista · F3: diagnostica · © OpenStreetMap contributors`;
    }
  });
  window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
  let last = performance.now();
  const frame = (now: number) => {
    const frameMs = now - last;
    last = now;
    const input = readVehicleInput(keys);
    const stepState = advanceFixedStep(simulationAccumulatorSeconds, frameMs / 1000);
    simulationAccumulatorSeconds = stepState.accumulatorSeconds;
    metrics.recordSimulationDebtDrop(stepState.droppedSeconds);
    for (let step = 0; step < stepState.simulatedSteps; step += 1) {
      const stepStartedAt = performance.now();
      vehicle = physics.stepVehicle(vehicle, input);
      metrics.recordPhysicsStep(performance.now() - stepStartedAt);
    }
    metrics.recordFrame(frameMs);
    renderer.updateVehicle(vehicle.position, vehicle.heading);
    if (benchmark && now - lastOverlayUpdate > 250) {
      lastOverlayUpdate = now;
      updateOverlay();
    }
    if (benchmark && now - benchmarkStartedAt >= 30_000) {
      document.body.dataset.benchmarkComplete = "true";
      document.body.dataset.benchmarkResult = JSON.stringify(metrics.snapshot());
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
