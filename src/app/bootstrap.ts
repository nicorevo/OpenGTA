import rawFixture from "../fixtures/geo/lecce-sant-oronzo-v0.raw.json";
import { createTangentProjector } from "../geo/coordinates/projector.ts";
import { normalizeOsm } from "../geo/normalize/osm.ts";
import { compileRegion } from "../world/compiler/compiled.ts";
import { createPixiRenderer } from "../render/pixi/renderer.ts";
import { createPhysicsAdapter } from "../physics/rapier/adapter.ts";
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

  const origin = { latitude: 40.35316888888889, longitude: 18.17259 };
  const region = normalizeOsm(rawFixture, createTangentProjector(origin), origin, "lecce-sant-oronzo-v0");
  const result = compileRegion(region);
  const physics = await createPhysicsAdapter(result.chunks[0].collisions);
  const renderer = await createPixiRenderer(canvas);
  renderer.render(result.chunks[0]);
  const metrics = new RuntimeMetrics();
  const benchmark = new URLSearchParams(window.location.search).get("benchmark") === "1";
  const benchmarkStartedAt = performance.now();
  let lastOverlayUpdate = 0;
  const keys = new Set<string>();
  let vehicle = physics.createVehicle({ x: 0, y: 0, heading: 0 });
  const updateOverlay = () => {
    const snapshot = metrics.snapshot();
    overlay.textContent = `region: ${region.id}\nbuildings: ${region.buildings.length}\nroads: ${region.roads.length}\ncompiled: ${result.diagnostics.compiledFeatureCount}\nphysics colliders: ${physics.colliderCount()}\nFPS: ${snapshot.fps.toFixed(1)}\nframe p95: ${snapshot.p95FrameMs.toFixed(2)} ms\nlong frames: ${snapshot.longFrames}\nphysics avg: ${snapshot.averagePhysicsMs.toFixed(3)} ms\nwarnings: ${region.warnings.length + result.diagnostics.warnings.length}\nrenderer: PixiJS WebGL`;
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
    const physicsStartedAt = performance.now();
    vehicle = physics.stepVehicle(vehicle, {
      throttle: keys.has("w") || keys.has("arrowup") ? 1 : keys.has("s") || keys.has("arrowdown") ? -1 : 0,
      steer: keys.has("a") || keys.has("arrowleft") ? -1 : keys.has("d") || keys.has("arrowright") ? 1 : 0,
      brake: keys.has(" ") ? 1 : 0,
    });
    metrics.recordFrame(frameMs, performance.now() - physicsStartedAt);
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
