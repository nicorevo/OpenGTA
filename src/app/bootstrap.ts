import rawFixture from "../fixtures/geo/lecce-sant-oronzo-v0.raw.json";
import { createTangentProjector } from "../geo/coordinates/projector.ts";
import { normalizeOsm } from "../geo/normalize/osm.ts";
import { compileRegion, type CompiledChunkV0 } from "../world/compiler/compiled.ts";
import { createChunkCache } from "../world/chunk/cache.ts";
import { createGeoDataSource, createHttpGeoDataSource, createOverpassGeoDataSource, OSM_QUERY_PROFILE } from "../world/runtime/source.ts";
import { DEFAULT_ENDPOINT_POLICY, readRuntimeConfig, type RuntimeConfig } from "../world/runtime/live-config.ts";
import { createLiveControls } from "./live-controls.ts";
import { createPixiRenderer } from "../render/pixi/renderer.ts";
import { createPhysicsAdapter, type PhysicsVehicleState } from "../physics/rapier/adapter.ts";
import { createRuntimeSession, type RuntimeSession } from "./runtime-session.ts";
import { advanceFixedStep } from "./fixed-step.ts";
import { readVehicleInput } from "./input.ts";
import { RuntimeMetrics } from "./metrics.ts";

const messages = { loading: "Caricamento area...", ready: "Area pronta", degraded: "Area parziale: alcuni settori non disponibili", empty: "Nessuna strada percorribile in questa area", error: "Caricamento non riuscito" };
const errorMessages: Record<string, string> = { http: "Servizio non disponibile", network: "Connessione non riuscita", timeout: "Tempo di attesa scaduto", "provider-error": "Il provider ha restituito dati incompleti", "invalid-response": "Risposta geografica non valida", "queue-timeout": "Attesa del servizio scaduta", "response-too-large": "Risposta geografica troppo grande" };

export async function bootstrap(root: HTMLElement): Promise<void> {
  root.replaceChildren();
  root.style.cssText = "position:fixed;inset:0;background:#202225;color:#fff;font:14px system-ui;overflow:hidden";
  let canvas = document.createElement("canvas");
  canvas.setAttribute("aria-label", "OpenGTA Web V0 world");
  canvas.style.cssText = "display:block;width:100%;height:100%";
  const overlay = document.createElement("pre");
  overlay.id = "debug-overlay"; overlay.hidden = true;
  overlay.style.cssText = "position:fixed;top:8px;right:8px;margin:0;padding:8px;background:#111e;color:#fff;z-index:3;max-width:calc(100vw - 32px);max-height:65vh;overflow:auto;font-size:12px";
  const hint = document.createElement("p");
  hint.textContent = "OpenGTA | OpenStreetMap contributors";
  hint.style.cssText = "position:fixed;bottom:8px;left:12px;right:12px;margin:0;color:#fff;background:#202225dd;width:fit-content;max-width:calc(100% - 24px);padding:4px 8px;font-size:12px";
  const status = document.createElement("div"); status.id = "session-status"; status.setAttribute("role", "status");
  status.style.cssText = "position:fixed;bottom:44px;left:12px;max-width:calc(100% - 24px);display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:8px;background:#202225ed;border-radius:4px;z-index:2";
  const message = document.createElement("span"); message.textContent = messages.loading;
  const retry = document.createElement("button"); retry.textContent = "Riprova"; retry.hidden = true;
  const stop = document.createElement("button"); stop.textContent = "Interrompi";
  status.append(message, retry, stop); root.append(canvas, overlay, hint, status);
  const params = new URLSearchParams(window.location.search);
  const policy = { ...DEFAULT_ENDPOINT_POLICY, developmentOrigin: import.meta.env.DEV ? window.location.origin : undefined };
  let config: RuntimeConfig;
  let initialError: string | undefined;
  try { config = readRuntimeConfig(params, policy); }
  catch (error) { config = readRuntimeConfig(new URLSearchParams()); initialError = error instanceof Error ? error.message : "Configurazione non valida"; }
  // Source and warm cache outlive retries, so restarting cannot bypass cooldown.
  const sources = new Map<string, ReturnType<typeof createGeoDataSource>>();
  const cache = createChunkCache<CompiledChunkV0>(9);
  let disposeCurrent: (() => Promise<void>) | undefined;
  let current: RuntimeSession | undefined;
  let epoch = 0; let busy = false; let stopLoop = () => {};
  const start = async () => {
    if (busy) return;
    busy = true; retry.disabled = true;
    const token = ++epoch;
    stopLoop(); await disposeCurrent?.(); disposeCurrent = undefined; current = undefined;
    const nextCanvas = canvas.cloneNode(false) as HTMLCanvasElement;
    canvas.replaceWith(nextCanvas); canvas = nextCanvas;
    status.dataset.state = "loading"; message.textContent = messages.loading; retry.hidden = true; stop.hidden = false;
    const physics = await createPhysicsAdapter([]);
    let renderer;
    try { renderer = await createPixiRenderer(canvas); }
    catch (error) { physics.dispose(); throw error; }
    if (token !== epoch) { physics.dispose(); renderer.dispose(); return; }
    const { origin, live: liveConfig } = config;
    const openWorld = config.mode !== "offline";
    const sourceIdentity = liveConfig ? liveConfig.provider + ":" + liveConfig.endpoint : "fixture:lecce-v0";
    if (!sources.has(sourceIdentity)) sources.set(sourceIdentity, liveConfig ? liveConfig.provider === "osm-overpass" ? createOverpassGeoDataSource(liveConfig.endpoint) : createHttpGeoDataSource(liveConfig.endpoint) : createGeoDataSource(async () => rawFixture));
    const source = sources.get(sourceIdentity)!;
    let offlineVehicle: PhysicsVehicleState | undefined;
    let offlineCounts = { buildings: 0, roads: 0, compiled: 0 };
    if (openWorld) {
      current = createRuntimeSession({ source, origin, renderer, physics, cache, sourceIdentity: liveConfig ? liveConfig.provider + ":" + liveConfig.endpoint : "fixture:lecce-v0", queryProfile: OSM_QUERY_PROFILE });
      disposeCurrent = current.dispose;
      void current.start();
    } else {
      const region = normalizeOsm(rawFixture, createTangentProjector(origin), origin, "lecce-sant-oronzo-v0");
      const result = compileRegion(region);
      physics.setChunk("offline", result.chunks.flatMap((chunk) => chunk.collisions)); renderer.render(result.chunks);
      offlineCounts = { buildings: region.buildings.length, roads: region.roads.length, compiled: result.diagnostics.compiledFeatureCount };
      offlineVehicle = physics.createVehicle({ x: 0, y: 0, heading: 0 });
      disposeCurrent = async () => { physics.dispose(); renderer.dispose(); };
      status.dataset.state = "ready"; message.textContent = "Offline"; stop.hidden = true;
    }
    const session = current;
    const vehicleSnapshot = () => session ? session.vehicle() : offlineVehicle ? { position: { ...offlineVehicle.position }, velocity: { ...offlineVehicle.velocity }, heading: offlineVehicle.heading } : undefined;
    const metrics = new RuntimeMetrics();
    Object.defineProperty(window, "__opengtaV0Debug", { configurable: true, value: Object.freeze({ vehicle: vehicleSnapshot, session: () => session?.snapshot() }) });
    Object.defineProperty(window, "__opengtaV0Metrics", { configurable: true, value: Object.freeze({ snapshot: () => metrics.snapshot() }) });
    const updateStatus = () => {
      const snapshot = session?.snapshot(); if (!snapshot) return;
      status.dataset.state = snapshot.state;
      const code = Object.values(snapshot.runtime.errors)[0];
      message.textContent = snapshot.blocked ? "Settore davanti non disponibile" : code ? messages[snapshot.state] + ": " + (errorMessages[code] ?? "Errore dati") : messages[snapshot.state];
      retry.hidden = !["error", "empty", "degraded"].includes(snapshot.state) && !snapshot.blocked;
    };
    const updateOverlay = () => {
      const m = metrics.snapshot(); const s = session?.snapshot();
      overlay.textContent = [
        "region: " + (s?.regionId ?? "lecce-sant-oronzo-v0"), "buildings: " + (s?.buildings ?? offlineCounts.buildings),
        "roads: " + (s?.roads ?? offlineCounts.roads), "compiled: " + (s?.features.length ?? offlineCounts.compiled),
        "physics colliders: " + physics.colliderCount(), "FPS: " + m.fps.toFixed(1), "frame p95: " + m.p95FrameMs.toFixed(2) + " ms",
        "physics steps: " + m.physicsSteps, "physics p95: " + m.p95PhysicsMs.toFixed(3) + " ms",
        "sim debt drops: " + m.simulationDebtDrops, "active: " + (s?.runtime.active.length ?? 1), "pending: " + (s?.runtime.pending.length ?? 0),
        "warm: " + (s?.runtime.cacheSize ?? 0), "renderer: PixiJS WebGL",
      ].join("\n");
    };
    const listeners = new AbortController(); const keys = new Set<string>();
    window.addEventListener("keydown", (event) => {
      if (event.target instanceof HTMLElement && event.target.matches("input, select, textarea, button")) return;
      keys.add(event.key.toLowerCase());
      if (event.key === "F3") { event.preventDefault(); overlay.hidden = !overlay.hidden; updateOverlay(); }
      if (!event.repeat && event.key.toLowerCase() === "l") hint.textContent = (renderer.toggleLabels() ? "Nomi attivi" : "OpenGTA") + " | OpenStreetMap contributors";
      if (event.key.startsWith("Arrow")) event.preventDefault();
    }, { signal: listeners.signal });
    window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()), { signal: listeners.signal });
    window.addEventListener("blur", () => keys.clear(), { signal: listeners.signal });
    let last = performance.now(); let accumulator = 0; let lastUpdate = -Infinity; let raf = 0;
    const benchmarkStart = last;
    const frame = (now: number) => {
      if (token !== epoch) return;
      const frameMs = now - last; last = now;
      const stepState = advanceFixedStep(accumulator, frameMs / 1000); accumulator = stepState.accumulatorSeconds;
      metrics.recordSimulationDebtDrop(stepState.droppedSeconds);
      const input = readVehicleInput(keys);
      for (let step = 0; step < stepState.simulatedSteps; step++) {
        const startTime = performance.now();
        if (session?.vehicle()) { session.step(input); metrics.recordPhysicsStep(performance.now() - startTime); }
        else if (offlineVehicle) { offlineVehicle = physics.stepVehicle(offlineVehicle, input); metrics.recordPhysicsStep(performance.now() - startTime); }
      }
      if (offlineVehicle) renderer.updateVehicle(offlineVehicle.position, offlineVehicle.heading);
      metrics.recordFrame(frameMs);
      if (now - lastUpdate >= 200) { lastUpdate = now; void session?.stream(now); updateStatus(); if (!overlay.hidden || params.get("benchmark") === "1") updateOverlay(); }
      if (params.get("benchmark") === "1" && now - benchmarkStart >= 30000) { document.body.dataset.benchmarkComplete = "true"; document.body.dataset.benchmarkResult = JSON.stringify(metrics.snapshot()); }
      raf = requestAnimationFrame(frame);
    };
    stopLoop = () => { cancelAnimationFrame(raf); listeners.abort(); keys.clear(); };
    raf = requestAnimationFrame(frame);
    busy = false; retry.disabled = false;
  };
  const reportFailure = () => { busy = false; retry.disabled = false; retry.hidden = false; status.dataset.state = "error"; message.textContent = "Inizializzazione non riuscita"; };
  retry.onclick = () => {
    if (current?.vehicle()) {
      retry.disabled = true;
      void current.retryMissing().finally(() => { retry.disabled = false; retry.blur(); });
    } else { retry.blur(); void start().catch(reportFailure); }
  };
  const stopCurrent = () => {
    ++epoch; stopLoop(); const disposal = disposeCurrent?.(); disposeCurrent = async () => { await disposal; };
    current = undefined; busy = false; retry.disabled = false; retry.hidden = false; stop.hidden = true;
    status.dataset.state = "error"; message.textContent = "Sessione interrotta";
  };
  stop.onclick = stopCurrent;
  const controls = createLiveControls(root, params, policy, async (next) => {
    if (busy) throw new Error("Avvio in corso");
    config = next; await start();
  }, stopCurrent);
  await start().catch(reportFailure);
  if (initialError) { controls.showError(initialError); status.dataset.state = "error"; message.textContent = "Configurazione live non valida"; }
}
