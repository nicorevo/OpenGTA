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
import { createFirstPersonRenderer } from "../render/pixi/first-person-renderer.ts";
import { createPhysicsAdapter, type PhysicsVehicleState } from "../physics/rapier/adapter.ts";
import { createGeocodeClient } from "./geocode.ts";
import { createPlaceTracker, type PlaceTracker } from "./place-status.ts";
import { createVisualProfileResolver, knownThemeIds, themeOverrideFromSearch } from "../render/theme/index.ts";
import { createProfileCompiler, createVpsProfileClient, readVpsServiceUrl, COMPILER_REVISION, defaultCatalog, EVIDENCE_FIXTURES, EVIDENCE_FIXTURE_IDS, vpsFixtureFromSearch } from "../vps/index.ts";
import type { VisualProfile } from "../render/theme/types.ts";
import { createRuntimeSession, type RuntimeSession } from "./runtime-session.ts";
import { switchView, type ViewLoop } from "./view-toggle.ts";
import { advanceFixedStep } from "./fixed-step.ts";
import { readVehicleInput } from "./input.ts";
import { RuntimeMetrics } from "./metrics.ts";
import { createTouchControls, isTouchDevice } from "./touch-controls.ts";

const messages = { loading: "Caricamento area...", ready: "Area pronta", degraded: "Area parziale: alcuni settori non disponibili", empty: "Nessuna strada percorribile in questa area", error: "Caricamento non riuscito" };
const errorMessages: Record<string, string> = { http: "Servizio non disponibile", network: "Connessione non riuscita", timeout: "Tempo di attesa scaduto", "provider-error": "Il provider ha restituito dati incompleti", "invalid-response": "Risposta geografica non valida", "queue-timeout": "Attesa del servizio scaduta", "response-too-large": "Risposta geografica troppo grande" };

export async function bootstrap(root: HTMLElement): Promise<void> {
  root.replaceChildren();
  root.style.cssText = "position:fixed;inset:0;background:#202225;color:#fff;font:14px system-ui;overflow:hidden";
  let tpCanvas = document.createElement("canvas");
  tpCanvas.setAttribute("aria-label", "OpenGTA Web V0 world");
  tpCanvas.style.cssText = "display:block;width:100%;height:100%";
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
  const zoom = { in: () => {}, out: () => {}, level: () => 3 as 0 | 1 | 2 | 3 | 4 | 5 };
  // Labels toggle is shared by the "L" key and the on-screen "Vie" button; the
  // concrete implementation is bound to the active renderer inside start().
  const labels = { toggle: () => false };
  const updateLabelHint = (visible: boolean) => { hint.textContent = (visible ? "Nomi attivi" : "OpenGTA") + ` | ${legend} | OpenStreetMap contributors`; };
  const zoomOutButton = document.createElement("button"); zoomOutButton.textContent = "−"; zoomOutButton.setAttribute("aria-label", "Riduci zoom");
  const zoomInButton = document.createElement("button"); zoomInButton.textContent = "+"; zoomInButton.setAttribute("aria-label", "Aumenta zoom");
  const vieButton = document.createElement("button"); vieButton.textContent = "street"; vieButton.setAttribute("aria-label", "Mostra nomi delle vie");
  const isTouch = isTouchDevice();
  if (isTouch) {
    const bigZoom = "width:48px;height:44px;font-size:24px;line-height:1;background:#2b2f33;color:#fff;border:1px solid #ffffff33;border-radius:8px;";
    zoomOutButton.style.cssText = bigZoom; zoomInButton.style.cssText = bigZoom;
    vieButton.style.cssText = "width:48px;height:44px;font-size:15px;line-height:1;background:#2b2f33;color:#fff;border:1px solid #ffffff33;border-radius:8px;";
  }
  const zoomBar = document.createElement("div"); zoomBar.id = "zoom-bar";
  // On touch the bar is a narrow vertical column, and the live-controls panel
  // is narrowed (via isTouchDevice(), see live-controls.ts) so the two never overlap.
  zoomBar.style.cssText = isTouch ? "position:fixed;top:10px;right:10px;display:flex;flex-direction:column;gap:6px;z-index:3;background:#202225dd;padding:6px;border-radius:10px" : "position:fixed;top:8px;right:8px;display:flex;gap:4px;z-index:3;background:#202225dd;padding:4px;border-radius:4px";
  if (isTouch) zoomBar.append(zoomOutButton, zoomInButton, vieButton);
  else zoomBar.append(zoomOutButton, zoomInButton);
  const updateZoomState = () => { zoomOutButton.disabled = zoom.level() <= 0; zoomInButton.disabled = zoom.level() >= 5; };
  zoomInButton.onclick = () => { zoom.in(); zoomInButton.blur(); updateZoomState(); };
  zoomOutButton.onclick = () => { zoom.out(); zoomOutButton.blur(); updateZoomState(); };
  vieButton.onclick = () => { const visible = labels.toggle(); vieButton.style.background = visible ? "#1f9d55" : "#2b2f33"; updateLabelHint(visible); vieButton.blur(); };
  root.append(tpCanvas, overlay, hint, status, zoomBar);
  // Touch controls (mobile) write synthetic keys into the active session's
  // input set, so they drive the vehicle exactly like the keyboard.
  let activeKeys: Set<string> | undefined;
  if (isTouchDevice()) createTouchControls(root, (key, pressed) => { const k = activeKeys; if (!k) return; if (pressed) k.add(key); else k.delete(key); });
  const params = new URLSearchParams(window.location.search);
  const policy = { ...DEFAULT_ENDPOINT_POLICY, developmentOrigin: import.meta.env.DEV ? window.location.origin : undefined };
  let config: RuntimeConfig;
  let initialError: string | undefined;
  try { config = readRuntimeConfig(params, policy); }
  catch (error) { config = readRuntimeConfig(new URLSearchParams()); initialError = error instanceof Error ? error.message : "Configurazione non valida"; }
  // Optional VPS service (spec 106): off unless ?vpsService= is present; a
  // malformed URL is a config error like any other, never a silent default.
  let vpsServiceUrl: string | undefined;
  try { vpsServiceUrl = readVpsServiceUrl(params, { developmentOrigin: import.meta.env.DEV ? window.location.origin : undefined }); }
  catch (error) { if (initialError === undefined) initialError = error instanceof Error ? error.message : "Configurazione non valida"; }
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
      const nextCanvas = tpCanvas.cloneNode(false) as HTMLCanvasElement;
      tpCanvas.replaceWith(nextCanvas); tpCanvas = nextCanvas;
      status.dataset.state = "loading"; message.textContent = messages.loading; retry.hidden = true; stop.hidden = false;
      const physics = await createPhysicsAdapter([]);
      // Visual identity: one resolver per session; the ?theme= override is
      // read once (closed registry, invalid/auto fall back to resolution).
      const themeResolver = createVisualProfileResolver();
      const forcedThemeId = themeOverrideFromSearch(window.location.search, knownThemeIds);
      // Dev-only VPS hook (?vps=<fixture>): compile an offline evidence
      // fixture on top of the LVP-resolved parent (spec 61/133). Same closed
      // discipline as ?theme=; invalid/auto means "no VPS override".
      const forcedVpsFixtureId = vpsFixtureFromSearch(window.location.search, EVIDENCE_FIXTURE_IDS);
      const vpsCompiler = createProfileCompiler();
      const applyVps = (parent: VisualProfile) =>
        forcedVpsFixtureId
          ? vpsCompiler.compile(EVIDENCE_FIXTURES[forcedVpsFixtureId], { parentProfile: parent, catalog: defaultCatalog, compilerRevision: COMPILER_REVISION })
          : undefined;
      const baseTheme = themeResolver.resolve(undefined, forcedThemeId).profile;
      const initialTheme = applyVps(baseTheme) ?? baseTheme;
      let renderer;
      try { renderer = await createPixiRenderer(nextCanvas, { visualProfile: initialTheme }); }
      catch (error) { physics.dispose(); throw error; }
      if (token !== epoch) { physics.dispose(); renderer.dispose(); return; }
      labels.toggle = () => renderer.toggleLabels();
      // First-person overlay canvas (hidden by default)
      const fpCanvas = document.createElement("canvas");
      fpCanvas.style.cssText = "position:fixed;inset:0;display:none;width:100%;height:100%;";
      fpCanvas.setAttribute("aria-label", "OpenGTA FPV");
      root.append(fpCanvas);
      let firstPerson;
      try { firstPerson = await createFirstPersonRenderer(fpCanvas); }
      catch (error) { physics.dispose(); throw error; }
      if (token !== epoch) { physics.dispose(); firstPerson.dispose(); return; }
      let viewMode: "top-down" | "perspective" = "top-down";
      let fpVisible = false;
      const topLoop: ViewLoop = { get started() { return renderer.app.ticker.started; }, stop: () => renderer.app.ticker.stop(), start: () => renderer.app.ticker.start(), render: () => renderer.app.render() };
      const fpLoop: ViewLoop = { get started() { return firstPerson.app.ticker.started; }, stop: () => firstPerson.app.ticker.stop(), start: () => firstPerson.app.ticker.start(), render: () => firstPerson.app.render() };
      // The FP canvas starts hidden: its render loop must not run.
      fpLoop.stop();
      const toggleFP = () => {
        viewMode = viewMode === "top-down" ? "perspective" : "top-down";
        fpVisible = viewMode === "perspective";
        tpCanvas.style.display = viewMode === "top-down" ? "block" : "none";
        fpCanvas.style.display = viewMode === "perspective" ? "block" : "none";
        if (fpVisible) {
          // The FP scene only advances while visible: push the current chunks
          // so the immediate pass draws a fresh scene, not a stale one.
          const chunks = session ? session.getActiveChunks() : currentChunks;
          if (chunks.length > 0) firstPerson.render(chunks);
        }
        if (fpVisible) switchView(topLoop, fpLoop);
        else switchView(fpLoop, topLoop);
        hint.textContent = (viewMode === "perspective" ? "Modo: prima persona" : "OpenGTA") + ` | ${legend} | OpenStreetMap contributors`;
      };
      const { origin, live: liveConfig } = config;
      const openWorld = config.mode !== "offline";
      const sourceIdentity = liveConfig ? liveConfig.provider + ":" + liveConfig.endpoint : "fixture:lecce-v0";
      const mvt = liveConfig?.provider === "openfreemap-mvt";
      // VPS generated-profile client (spec 106): background fetch per h3 cell
      // with LVP fallback; the dev-only ?vps= fixture hook takes precedence
      // (when set, the service client stays off: one source at a time).
      const vpsClient = openWorld && forcedVpsFixtureId === undefined && vpsServiceUrl !== undefined
        // fetch needs its window receiver: a bare reference is an illegal
        // invocation, so wrap it instead of destructuring it into deps.
        ? createVpsProfileClient({ fetch: (url, init) => window.fetch(url, init), baseUrl: vpsServiceUrl })
        : undefined;
      if (!mvt && !sources.has(sourceIdentity)) sources.set(sourceIdentity, liveConfig ? liveConfig.provider === "osm-overpass" ? createOverpassGeoDataSource(liveConfig.endpoint, undefined, { fallbackEndpoints: import.meta.env.DEV ? ["https://maps.mail.ru/osm/tools/overpass/api/interpreter"] : undefined }) : createHttpGeoDataSource(liveConfig.endpoint) : createGeoDataSource(async () => rawFixture));
      const source = mvt ? undefined : sources.get(sourceIdentity)!;
      let offlineVehicle: PhysicsVehicleState | undefined;
      let offlineCounts = { buildings: 0, roads: 0, compiled: 0 };
      let currentChunks: readonly CompiledChunkV0[] = [];
      if (openWorld) {
        // Live budgets: 16 MiB per tile (fetch AND decode), 30k features and
        // 100k points per geometry — measured dense z14 peaks are ~17k
        // features / ~52k points (central Paris), so these keep ~2-3x headroom
        // without weakening the decode security defaults.
        const regionSource = mvt ? createVectorTileCanonicalRegionSource({ provider: createOpenFreeMapProvider({ maxTileBytes: 16 * 1024 * 1024, maxFeaturesPerTile: 30_000, maxPointsPerGeometry: 100_000 }), identity: sourceIdentity }) : undefined;
        const liveSession = createRuntimeSession({ source, regionSource, origin, renderer, physics, cache, sourceIdentity, queryProfile: mvt ? "mvt-z14-v1" : OSM_QUERY_PROFILE, persistentStore });
        current = liveSession;
        zoom.in = () => liveSession.zoomIn(); zoom.out = () => liveSession.zoomOut(); zoom.level = () => liveSession.snapshot().zoomLevel;
        disposeCurrent = async () => { try { await liveSession.dispose(); firstPerson.dispose(); fpCanvas.style.display = "none"; } catch { /* teardown is best-effort */ } };
        void current.start();
      } else {
        const region = normalizeOsm(rawFixture, createTangentProjector(origin), origin, "lecce-sant-oronzo-v0");
        const result = compileRegion(region);
        currentChunks = result.chunks;
        physics.setChunk("offline", currentChunks.flatMap((chunk) => chunk.collisions)); renderer.render(currentChunks); firstPerson.render(currentChunks);
        offlineCounts = { buildings: region.buildings.length, roads: region.roads.length, compiled: result.diagnostics.compiledFeatureCount };
        offlineVehicle = physics.createVehicle({ x: 0, y: 0, heading: 0 });
        zoom.in = () => renderer.zoomIn(); zoom.out = () => renderer.zoomOut(); zoom.level = () => renderer.cameraState().zoomLevel;
        disposeCurrent = async () => { try { physics.dispose(); renderer.dispose(); firstPerson.dispose(); fpCanvas.style.display = "none"; } catch { /* teardown is best-effort */ } };
        status.dataset.state = "ready"; message.textContent = "Offline"; stop.hidden = true;
      }
      const session = current;
      const vehicleSnapshot = () => session ? session.vehicle() : offlineVehicle ? { position: { ...offlineVehicle.position }, velocity: { ...offlineVehicle.velocity }, heading: offlineVehicle.heading } : undefined;
      // Current-place display: reverse-geocoded zone name (open-world only);
      // the projector mirrors the session's origin, so world → lon/lat matches.
      const placeProjector = openWorld && session ? createTangentProjector(config.origin) : undefined;
      const placeTracker: PlaceTracker | undefined = placeProjector
        ? createPlaceTracker({ reverse: createGeocodeClient().reverse, toLonLat: (x, y) => placeProjector.unproject({ x, y }) })
        : undefined;
      // Automatic theme: the resolved profile follows the last valid location.
      // Same profile id is a renderer no-op, so this is safe to run on every
      // status tick and never refetches data.
      const syncVisualTheme = () => {
        const location = placeTracker?.location();
        const resolution = themeResolver.resolve(location, forcedThemeId);
        // VPS service profile (spec 106): applied when generated/cached,
        // otherwise the LVP resolution is kept as-is.
        const serviceProfile = vpsClient?.sync(location);
        // The VPS layer (when forced) compiles on top of whatever LVP parent
        // the resolver just produced, so the generated profile keeps the
        // fallback hierarchy: generated cell -> ... -> LVP -> default.
        const profile = serviceProfile ?? applyVps(resolution.profile) ?? resolution.profile;
        if (profile.id !== renderer.visualProfileId()) renderer.setVisualProfile(profile);
      };
      const metrics = new RuntimeMetrics();
      Object.defineProperty(window, "__opengtaV0Debug", { configurable: true, value: Object.freeze({ vehicle: vehicleSnapshot, session: () => session?.snapshot(), chunks: () => session?.getActiveChunks() ?? [], presentation: () => renderer.presentationCounts(), theme: () => ({ id: renderer.visualProfileId(), location: placeTracker?.location() ?? null }), vps: () => vpsClient?.diagnostics() ?? null, firstPerson: () => firstPerson.diagnostics(), viewLoops: () => ({ topDown: topLoop.started, firstPerson: fpLoop.started }) }) });
      Object.defineProperty(window, "__opengtaV0Metrics", { configurable: true, value: Object.freeze({ snapshot: () => metrics.snapshot() }) });
      const updateStatus = () => {
        const snapshot = session?.snapshot(); if (!snapshot) return;
        const pose = session?.vehicle()?.position;
        if (placeTracker && pose) placeTracker.track(pose.x, pose.y);
        syncVisualTheme();
        status.dataset.state = snapshot.state;
        const code = Object.values(snapshot.runtime.errors)[0];
        const base = snapshot.state === "ready" ? (placeTracker?.place() ?? messages.ready) : messages[snapshot.state];
        message.textContent = snapshot.blocked ? "Settore davanti non disponibile" : code ? base + ": " + (errorMessages[code] ?? "Errore dati") : base;
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
      activeKeys = keys;
      window.addEventListener("keydown", (event) => {
        if (event.target instanceof HTMLInputElement && ["text", "number", "url", "search", "email", "password", ""].includes(event.target.type)) return;
        if (event.target instanceof HTMLSelectElement) return;
        if (event.target instanceof HTMLTextAreaElement) return;
        keys.add(event.key.toLowerCase());
        if (event.key === "F3") { event.preventDefault(); overlay.hidden = !overlay.hidden; updateOverlay(); }
        if (event.key === "+" || event.key === "=") { event.preventDefault(); zoom.in(); updateZoomState(); }
        if (event.key === "-" || event.key === "_") { event.preventDefault(); zoom.out(); updateZoomState(); }
        if (!event.repeat && event.key.toLowerCase() === "l") updateLabelHint(labels.toggle());
        if (!event.repeat && event.key.toLowerCase() === "v") toggleFP();
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
        const veh = session?.vehicle();
        if (veh) { renderer.updateVehicle(veh.position, veh.heading, veh.velocity); firstPerson.updateVehicle(veh.position, veh.heading); }
        else if (offlineVehicle) { renderer.updateVehicle(offlineVehicle.position, offlineVehicle.heading, offlineVehicle.velocity); firstPerson.updateVehicle(offlineVehicle.position, offlineVehicle.heading); }
        // Forward active chunks to the FP renderer only while it is on
        // screen: rendering a hidden canvas costs a full pass per frame.
        metrics.recordFrame(frameMs);
        if (fpVisible && (veh || offlineVehicle)) { const chunks = session ? session.getActiveChunks() : currentChunks; if (chunks.length > 0) firstPerson.render(chunks); }
        if (now - lastUpdate >= 200) { lastUpdate = now; void session?.stream(now); updateStatus(); updateZoomState(); if (!overlay.hidden || params.get("benchmark") === "1") updateOverlay(); }
        if (params.get("benchmark") === "1" && now - benchmarkStart >= 30000) { document.body.dataset.benchmarkComplete = "true"; document.body.dataset.benchmarkResult = JSON.stringify(metrics.snapshot()); }
        raf = requestAnimationFrame(frame);
      };
      stopLoop = () => { cancelAnimationFrame(raf); listeners.abort(); keys.clear(); activeKeys = undefined; placeTracker?.dispose(); };
      raf = requestAnimationFrame(frame);
    } finally {
      if (token === epoch) { busy = false; retry.disabled = false; }
    }
  };
  const reportFailure = (error?: unknown) => { console.error("BOOTSTRAP_FAILURE", error); busy = false; retry.disabled = false; retry.hidden = false; status.dataset.state = "error"; message.textContent = "Inizializzazione non riuscita"; };
  retry.onclick = () => {
    if (current?.vehicle() && current.snapshot().state !== "error") {
      retry.disabled = true;
      void current.retryMissing().finally(() => { retry.disabled = false; retry.blur(); });
    } else { retry.blur(); void start().catch(reportFailure); }
  };
  const stopCurrent = () => {
    ++epoch; stopLoop(); const disposal = disposeCurrent?.();
    disposeCurrent = async () => { try { await disposal; } catch { /* teardown is best-effort */ } };
    current = undefined; busy = false; retry.disabled = false; retry.hidden = false; stop.hidden = true;
    status.dataset.state = "error"; message.textContent = "Sessione interrotta";
  };
  stop.onclick = () => stopCurrent();
  const controls = createLiveControls(root, params, policy, async (next) => {
    if (busy) throw new Error("Avvio in corso");
    config = next; await start();
  });
  await start().catch(reportFailure);
  if (initialError) { controls.showError(initialError); status.dataset.state = "error"; message.textContent = "Configurazione live non valida"; }
}
