import rawFixture from "../fixtures/geo/lecce-sant-oronzo-v0.raw.json";
import { createTangentProjector } from "../geo/coordinates/projector.ts";
import { normalizeOsm } from "../geo/normalize/osm.ts";
import { compileRegion, type CompiledChunkV0 } from "../world/compiler/compiled.ts";
import { createChunkCache } from "../world/chunk/cache.ts";
import { createIndexedDbChunkStore } from "../world/chunk/persistent-indexeddb.ts";
import { createGeoDataSource, createHttpGeoDataSource, createOverpassGeoDataSource, OSM_QUERY_PROFILE } from "../world/runtime/source.ts";
import { createOpenFreeMapProvider } from "../world/runtime/vector-tile/provider.ts";
import { createVectorTileCanonicalRegionSource } from "../world/runtime/canonical-source.ts";
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
  const legend = "W/S guida · A/D sterzo · L etichette · F3 diagnostica";
  const hint = document.createElement("p");
  hint.textContent = `OpenGTA | ${legend} | OpenStreetMap contributors`;
  hint.style.cssText = "position:fixed;bottom:8px;left:12px;right:12px;margin:0;color:#fff;background:#202225dd;width:fit-content;max-width:calc(100% - 24px);padding:4px 8px;font-size:12px";
  const status = document.createElement("div"); status.id = "session-status"; status.setAttribute("role", "status");
  status.style.cssText = "position:fixed;bottom:44px;left:12px;max-width:calc(100% - 24px);display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:8px;background:#202225ed;border-radius:4px;z-index:2";
  const message = document.createElement("span"); message.textContent = messages.loading;
  const retry = document.createElement("button"); retry.textContent = "Riprova"; retry.hidden = true;
  const stop = document.createElement("button"); stop.textContent = "Interrompi";
  status.append(message, retry, stop);
  const zoom = { in: () => {}, out: () => {}, level: () => 2 as 0 | 1 | 2 | 3 | 4 };
  const zoomOutButton = document.createElement("button"); zoomOutButton.textContent = "−"; zoomOutButton.setAttribute("aria-label", "Riduci zoom");
  const zoomInButton = document.createElement("button"); zoomInButton.textContent = "+"; zoomInButton.setAttribute("aria-label", "Aumenta zoom");
  const zoomBar = document.createElement("div");
  zoomBar.style.cssText = "position:fixed;top:8px;right:8px;display:flex;gap:4px;z-index:3;background:#202225dd;padding:4px;border-radius:4px";
  zoomBar.append(zoomOutButton, zoomInButton);
  const updateZoomState = () => { zoomOutButton.disabled = zoom.level() <= 0; zoomInButton.disabled = zoom.level() >= 4; };
  zoomInButton.onclick = () => { zoom.in(); zoomInButton.blur(); updateZoomState(); };
  zoomOutButton.onclick = () => { zoom.out(); zoomOutButton.blur(); updateZoomState(); };
  root.append(canvas, overlay, hint, status, zoomBar);
  const params = new URLSearchParams(window.location.search);
  const policy = { ...DEFAULT_ENDPOINT_POLICY, developmentOrigin: import.meta.env.DEV ? window.location.origin : undefined };
  let config: RuntimeConfig;
  let initialError: string | undefined;
  try { config = readRuntimeConfig(params, policy); }
  catch (error) { config = readRuntimeConfig(new URLSearchParams()); initialError = error instanceof Error ? error.message : "Configurazione non valida"; }
  // Source and warm cache outlive retries, so restarting cannot bypass cooldown.
  const sources = new Map<string, ReturnType<typeof createGeoDataSource>>();
  const cache = createChunkCache<CompiledChunkV0>(9);
  const persistentStore = (() => { try { return createIndexedDbChunkStore(); } catch { return undefined; } })();
  let disposeCurrent: (() => Promise<void>) | undefined;
  let current: RuntimeSession | undefined;
  let epoch = 0; let busy = false; let stopLoop = () => {};
  const start = async () => {
    if (busy) return;
    busy = true; retry.disabled = true;
    const token = ++epoch;
    try {
      stopLoop(); await disposeCurrent?.(); disposeCurrent = undefined; current = undefined;
      if (token !== epoch) return;
      const nextCanvas = canvas.cloneNode(false) as HTMLCanvasElement;
      canvas.replaceWith(nextCanvas); canvas = nextCanvas;
      status.dataset.state = "loading"; message.textContent = messages.loading; retry.hidden = true; stop.hidden = false;
      const physics = await createPhysicsAdapter([]);
      let renderer;
      try { renderer = await createPixiRenderer(nextCanvas); }
      catch (error) { physics.dispose(); throw error; }
      if (token !== epoch) { physics.dispose(); renderer.dispose(); return; }
      const { origin, live: liveConfig } = config;
      const openWorld = config.mode !== "offline";
      const sourceIdentity = liveConfig ? liveConfig.provider + ":" + liveConfig.endpoint : "fixture:lecce-v0";
      const mvt = liveConfig?.provider === "openfreemap-mvt";
      if (!mvt && !sources.has(sourceIdentity)) sources.set(sourceIdentity, liveConfig ? liveConfig.provider === "osm-overpass" ? createOverpassGeoDataSource(liveConfig.endpoint, undefined, { fallbackEndpoints: import.meta.env.DEV ? ["https://maps.mail.ru/osm/tools/overpass/api/interpreter"] : undefined }) : createHttpGeoDataSource(liveConfig.endpoint) : createGeoDataSource(async () => rawFixture));
      const source = mvt ? undefined : sources.get(sourceIdentity)!;
      let offlineVehicle: PhysicsVehicleState | undefined;
      let offlineCounts = { buildings: 0, roads: 0, compiled: 0 };
      if (openWorld) {
        const regionSource = mvt ? createVectorTileCanonicalRegionSource({ provider: createOpenFreeMapProvider(), identity: sourceIdentity }) : undefined;
        const liveSession = createRuntimeSession({ source, regionSource, origin, renderer, physics, cache, sourceIdentity, queryProfile: mvt ? "mvt-z14-v1" : OSM_QUERY_PROFILE, persistentStore });
        current = liveSession;
        zoom.in = () => liveSession.zoomIn(); zoom.out = () => liveSession.zoomOut(); zoom.level = () => liveSession.snapshot().zoomLevel;
        disposeCurrent = async () => { try { await liveSession.dispose(); } catch { /* teardown is best-effort */ } };
        void current.start();
      } else {
        const region = normalizeOsm(rawFixture, createTangentProjector(origin), origin, "lecce-sant-oronzo-v0");
        const result = compileRegion(region);
        physics.setChunk("offline", result.chunks.flatMap((chunk) => chunk.collisions)); renderer.render(result.chunks);
        offlineCounts = { buildings: region.buildings.length, roads: region.roads.length, compiled: result.diagnostics.compiledFeatureCount };
        offlineVehicle = physics.createVehicle({ x: 0, y: 0, heading: 0 });
        zoom.in = () => renderer.zoomIn(); zoom.out = () => renderer.zoomOut(); zoom.level = () => renderer.cameraState().zoomLevel;
        disposeCurrent = async () => { try { physics.dispose(); renderer.dispose(); } catch { /* teardown is best-effort */ } };
        status.dataset.state = "ready"; message.textContent = "Offline"; stop.hidden = true;
      }
      const session = current;
      const vehicleSnapshot = () => session ? session.vehicle() : offlineVehicle ? { position: { ...offlineVehicle.position }, velocity: { ...offlineVehicle.velocity }, heading: offlineVehicle.heading } : undefined;
      const metrics = new RuntimeMetrics();
      Object.defineProperty(window, "__opengtaV0Debug", { configurable: true, value: Object.freeze({ vehicle: vehicleSnapshot, session: () => session?.snapshot(), presentation: () => renderer.presentationCounts() }) });
      Object.defineProperty(window, "__opengtaV0Metrics", { configurable: true, value: Object.freeze({ snapshot: () => metrics.snapshot() }) });
      const updateStatus = () => {
        const snapshot = session?.snapshot(); if (!snapshot) return;
        status.dataset.state = snapshot.state;
        const code = Object.values(snapshot.runtime.errors)[0];
        message.textContent = snapshot.blocked ? "Settore davanti non disponibile" : code ? messages[snapshot.state] + ": " + (errorMessages[code] ?? "Errore dati") : messages[snapshot.state];
        retry.hidden = !["error", "empty", "degraded"].includes(snapshot.state) && !snapshot.blocked;
      };
      const updateOverlay = () => {
        const m = metrics.snapshot(); const s = session?.snapshot(); const v = vehicleSnapshot();
        overlay.textContent = [
          "region: " + (s?.regionId ?? "lecce-sant-oronzo-v0"),
          "origin: " + config.origin.latitude.toFixed(5) + ", " + config.origin.longitude.toFixed(5),
          "buildings: " + (s?.buildings ?? offlineCounts.buildings), "roads: " + (s?.roads ?? offlineCounts.roads), "compiled: " + (s?.features.length ?? offlineCounts.compiled),
          "warnings: " + (s?.warnings ?? 0), "compile: " + (s?.lastCompileMs ?? 0).toFixed(1) + " ms",
          "car: " + (v ? v.position.x.toFixed(1) + ", " + v.position.y.toFixed(1) + " | " + Math.hypot(v.velocity.x, v.velocity.y).toFixed(1) + " m/s | " + (v.heading * 180 / Math.PI).toFixed(0) + " deg" : "none"),
          "physics bodies: " + (v ? 1 : 0), "physics colliders: " + physics.colliderCount(),
          "FPS: " + m.fps.toFixed(1), "frame avg: " + m.averageFrameMs.toFixed(2) + " ms", "frame p95: " + m.p95FrameMs.toFixed(2) + " ms", "long frames: " + m.longFrames,
          "physics steps: " + m.physicsSteps, "physics avg: " + m.averagePhysicsMs.toFixed(3) + " ms", "physics p95: " + m.p95PhysicsMs.toFixed(3) + " ms",
          "sim debt: " + m.simulationDebtDrops + " drops, " + m.droppedSimulationSeconds.toFixed(2) + " s",
          "active: " + (s?.runtime.active.length ?? 1), "pending: " + (s?.runtime.pending.length ?? 0), "warm: " + (s?.runtime.cacheSize ?? 0),
        "source: " + (s?.source ? s.source.lastHost + " | " + (s.source.lastCategory ?? "ok") + " | attempts " + s.source.attempts + " | " + (s.source.lastDurationMs ? s.source.lastDurationMs.toFixed(0) + " ms" : "-") : "n/a"),
          "canvas: " + renderer.app.screen.width + "x" + renderer.app.screen.height + " px", "renderer: PixiJS WebGL",
        ].join("\n");
      };
      const listeners = new AbortController(); const keys = new Set<string>();
      window.addEventListener("keydown", (event) => {
        if (event.target instanceof HTMLInputElement && ["text", "number", "url", "search", "email", "password", ""].includes(event.target.type)) return;
        if (event.target instanceof HTMLSelectElement) return;
        if (event.target instanceof HTMLTextAreaElement) return;
        keys.add(event.key.toLowerCase());
        if (event.key === "F3") { event.preventDefault(); overlay.hidden = !overlay.hidden; updateOverlay(); }
        if (event.key === "+" || event.key === "=") { event.preventDefault(); zoom.in(); updateZoomState(); }
        if (event.key === "-" || event.key === "_") { event.preventDefault(); zoom.out(); updateZoomState(); }
        if (!event.repeat && event.key.toLowerCase() === "l") hint.textContent = (renderer.toggleLabels() ? "Nomi attivi" : "OpenGTA") + ` | ${legend} | OpenStreetMap contributors`;
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
        if (now - lastUpdate >= 200) { lastUpdate = now; void session?.stream(now); updateStatus(); updateZoomState(); if (!overlay.hidden || params.get("benchmark") === "1") updateOverlay(); }
        if (params.get("benchmark") === "1" && now - benchmarkStart >= 30000) { document.body.dataset.benchmarkComplete = "true"; document.body.dataset.benchmarkResult = JSON.stringify(metrics.snapshot()); }
        raf = requestAnimationFrame(frame);
      };
      stopLoop = () => { cancelAnimationFrame(raf); listeners.abort(); keys.clear(); };
      raf = requestAnimationFrame(frame);
    } finally {
      if (token === epoch) { busy = false; retry.disabled = false; }
    }
  };
  const reportFailure = () => { busy = false; retry.disabled = false; retry.hidden = false; status.dataset.state = "error"; message.textContent = "Inizializzazione non riuscita"; };
  retry.onclick = () => {
    if (current?.vehicle() && current.snapshot().state !== "error") {
      retry.disabled = true;
      void current.retryMissing().finally(() => { retry.disabled = false; retry.blur(); });
    } else { retry.blur(); void start().catch(reportFailure); }
  };
  const stopCurrent = (revoked = false) => {
    ++epoch; stopLoop(); const disposal = disposeCurrent?.();
    disposeCurrent = async () => { try { await disposal; } catch { /* teardown is best-effort */ } };
    current = undefined; busy = false; retry.disabled = false; retry.hidden = false; stop.hidden = true;
    if (revoked) config = readRuntimeConfig(new URLSearchParams());
    status.dataset.state = "error"; message.textContent = "Sessione interrotta";
  };
  stop.onclick = () => stopCurrent();
  const controls = createLiveControls(root, params, policy, async (next) => {
    if (busy) throw new Error("Avvio in corso");
    config = next; await start();
  }, (revoked) => stopCurrent(revoked));
  await start().catch(reportFailure);
  if (initialError) { controls.showError(initialError); status.dataset.state = "error"; message.textContent = "Configurazione live non valida"; }
}
