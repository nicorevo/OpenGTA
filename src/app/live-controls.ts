import { DEFAULT_ORIGIN, readRuntimeConfig, type EndpointPolicy, type RuntimeConfig } from "../world/runtime/live-config.ts";
import { createGeocodeClient, GeocodeError, type GeocodeCandidate } from "./geocode.ts";
import { isTouchDevice } from "./touch-controls.ts";

function geocodeStatusMessage(cause: unknown): string {
  if (cause instanceof GeocodeError) {
    switch (cause.code) {
      case "rate-limited": return "Ricerca troppo frequente, riprova tra un momento.";
      case "timeout": return "Ricerca non riuscita: tempo scaduto.";
      case "network": return "Ricerca non riuscita: rete non disponibile.";
      case "http": return "Ricerca non riuscita: provider temporaneamente non disponibile.";
      case "invalid-response": return "Ricerca non riuscita: risposta non valida del provider.";
      default: return "Ricerca annullata.";
    }
  }
  return "Ricerca non riuscita.";
}

export function createLiveControls(root: HTMLElement, params: URLSearchParams, policy: EndpointPolicy, start: (config: RuntimeConfig) => Promise<void>) {
  const details = document.createElement("details"); details.id = "live-controls";
  // The enlarged touch zoom bar (with the street toggle) sits at the top-right.
  // Narrow the panel to clear it using the same isTouchDevice() check that
  // enables the touch controls: a plain `pointer: coarse` media query does not
  // fire on touchscreens reported with a fine primary pointer (e.g. laptops or
  // DevTools responsive mode with hardware touch).
  const panelWidth = isTouchDevice() ? "min(320px,calc(100vw - 100px))" : "min(320px,calc(100vw - 48px))";
  details.style.cssText = "position:fixed;left:12px;top:12px;z-index:2;box-sizing:border-box;background:#f4f5f7;color:#25272c;padding:10px 12px;border-radius:4px;width:" + panelWidth + ";box-shadow:0 2px 8px #0003;font-size:13px";
  const summary = document.createElement("summary"); summary.textContent = "OpenGTA / Area di gioco"; summary.style.cursor = "pointer";
  const form = document.createElement("form"); form.noValidate = true; form.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px";
  const field = (title: string, control: HTMLElement, full = false) => {
    const label = document.createElement("label"); label.textContent = title;
    label.style.cssText = "display:grid;gap:4px;min-width:0" + (full ? ";grid-column:1/-1" : "");
    control.style.cssText = "box-sizing:border-box;width:100%;min-width:0;border:1px solid #a7adb7;border-radius:3px;padding:7px;font:inherit;background:white;color:#25272c";
    label.append(control); form.append(label);
  };
  const mode = document.createElement("select"); mode.name = "mode";
  for (const [value, text] of [["offline", "Offline"], ["open-world-live", "Online OSM"]]) { const option = document.createElement("option"); option.value = value; option.textContent = text; mode.append(option); }
  mode.value = params.get("mode") === "offline" ? "offline" : "open-world-live";
  field("Modalita'", mode, true);
  // Place-name search: debounced Nominatim lookup that fills the coordinate
  // fields on selection. The container is a div (not a label) so clicking a
  // suggestion never re-dispatches a click on the input.
  const geocodeClient = createGeocodeClient();
  let searchController: AbortController | undefined;
  let searchTimer = 0;
  let candidates: GeocodeCandidate[] = [];
  let activeIndex = -1;
  let resolvedPlace = false;
  const place = document.createElement("input"); place.name = "place"; place.id = "place-query";
  place.type = "text"; place.placeholder = "es. Taranto"; place.autocomplete = "off"; place.spellcheck = false;
  place.setAttribute("role", "combobox"); place.setAttribute("aria-expanded", "false"); place.setAttribute("aria-controls", "place-suggestions"); place.setAttribute("aria-autocomplete", "list");
  place.style.cssText = "box-sizing:border-box;width:100%;min-width:0;border:1px solid #a7adb7;border-radius:3px;padding:7px;font:inherit;background:white;color:#25272c";
  const suggestions = document.createElement("ul"); suggestions.id = "place-suggestions";
  suggestions.setAttribute("role", "listbox"); suggestions.hidden = true;
  suggestions.style.cssText = "list-style:none;margin:0;padding:0;max-height:160px;overflow:auto;background:white;border:1px solid #a7adb7;border-radius:3px;box-shadow:0 2px 8px #0002";
  const placeStatus = document.createElement("span"); placeStatus.id = "place-status"; placeStatus.setAttribute("role", "status");
  placeStatus.style.cssText = "min-height:1.2em;display:block;color:#5a6068";
  const placeField = document.createElement("div"); placeField.style.cssText = "grid-column:1/-1;display:grid;gap:4px;min-width:0";
  const placeTitle = document.createElement("label"); placeTitle.htmlFor = "place-query"; placeTitle.textContent = "Cerca un luogo";
  placeField.append(placeTitle, place, suggestions, placeStatus); form.append(placeField);
  const hideList = () => { suggestions.hidden = true; activeIndex = -1; place.setAttribute("aria-expanded", "false"); place.removeAttribute("aria-activedescendant"); };
  const renderList = () => {
    suggestions.textContent = "";
    if (candidates.length === 0) { hideList(); placeStatus.textContent = "Nessun luogo trovato"; return; }
    candidates.forEach((candidate, index) => {
      const option = document.createElement("li");
      option.setAttribute("role", "option"); option.id = `place-option-${index}`;
      option.textContent = candidate.name;
      option.style.cssText = "padding:7px;cursor:pointer";
      option.addEventListener("click", () => selectCandidate(candidate));
      suggestions.append(option);
    });
    suggestions.hidden = false;
    place.setAttribute("aria-expanded", "true");
  };
  const paintActive = () => {
    const options = Array.from(suggestions.children) as HTMLElement[];
    options.forEach((option, index) => { option.style.background = index === activeIndex ? "#d8e8e5" : "white"; });
    place.setAttribute("aria-activedescendant", activeIndex >= 0 ? options[activeIndex]?.id ?? "" : "");
  };
  const selectCandidate = (candidate: GeocodeCandidate) => {
    resolvedPlace = true; candidates = []; hideList();
    place.value = candidate.name; place.readOnly = true;
    latitude.value = String(candidate.latitude); longitude.value = String(candidate.longitude);
    placeStatus.textContent = `Luogo: ${candidate.name}`; place.blur();
  };
  place.onclick = () => { if (resolvedPlace) { resolvedPlace = false; place.readOnly = false; place.value = ""; placeStatus.textContent = ""; } };
  place.oninput = () => {
    clearTimeout(searchTimer);
    const query = place.value.trim();
    if (query.length < 2) { hideList(); placeStatus.textContent = ""; return; }
    placeStatus.textContent = "Ricerca in corso...";
    searchTimer = window.setTimeout(() => {
      searchController?.abort();
      searchController = new AbortController();
      const controller = searchController;
      geocodeClient.search(query, controller.signal).then((results) => {
        if (controller.signal.aborted) return;
        candidates = results; renderList();
        if (results.length > 0) placeStatus.textContent = "";
      }).catch((cause: unknown) => {
        if (cause instanceof GeocodeError && cause.code === "aborted") return;
        hideList(); placeStatus.textContent = geocodeStatusMessage(cause);
      });
    }, 400);
  };
  place.onkeydown = (event: KeyboardEvent) => {
    const options = Array.from(suggestions.children) as HTMLElement[];
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (suggestions.hidden && candidates.length === 0) return;
      event.preventDefault();
      if (options.length === 0) return;
      activeIndex = (activeIndex + (event.key === "ArrowDown" ? 1 : options.length - 1) + options.length) % options.length;
      paintActive();
    } else if (event.key === "Enter") {
      if (activeIndex >= 0 && candidates[activeIndex]) { event.preventDefault(); selectCandidate(candidates[activeIndex]); }
    } else if (event.key === "Escape") {
      hideList();
    }
  };
  const latitude = document.createElement("input"); latitude.name = "lat"; latitude.type = "number"; latitude.step = "any"; latitude.min = "-90"; latitude.max = "90"; latitude.value = params.get("lat") ?? String(DEFAULT_ORIGIN.latitude);
  const longitude = document.createElement("input"); longitude.name = "lon"; longitude.type = "number"; longitude.step = "any"; longitude.min = "-180"; longitude.max = "180"; longitude.value = params.get("lon") ?? String(DEFAULT_ORIGIN.longitude);
  field("Latitudine", latitude); field("Longitudine", longitude);
  // In offline mode a fixed fixture is used, so the map origin is irrelevant:
  // disable the coordinate and place-search inputs to make the inactive state explicit.
  const syncCoordinates = () => { const offline = mode.value === "offline"; latitude.disabled = offline; longitude.disabled = offline; place.disabled = offline; if (offline) { searchController?.abort(); hideList(); } };
  mode.onchange = syncCoordinates; syncCoordinates();
  // The provider and endpoint are fixed to the pinned OpenFreeMap MVT source
  // and are not user-configurable, so they are omitted from the form entirely.
  const consent = document.createElement("input"); consent.type = "checkbox"; consent.id = "live-consent";
  consent.checked = true; consent.disabled = true;
  const consentLabel = document.createElement("label"); consentLabel.style.cssText = "grid-column:1/-1;display:flex;align-items:flex-start;gap:8px";
  consentLabel.append(consent, document.createTextNode("Autorizzo l'invio delle coordinate al provider")); form.append(consentLabel);
  const error = document.createElement("div"); error.id = "config-error"; error.setAttribute("role", "alert"); error.style.cssText = "grid-column:1/-1;color:#a72035;overflow-wrap:anywhere"; form.append(error);
  const submit = document.createElement("button"); submit.type = "submit"; submit.textContent = "Avvia"; submit.style.cssText = "padding:8px 14px;background:#156c60;color:white;border:0;border-radius:3px;font:inherit"; form.append(submit);
  form.onsubmit = (event) => {
    event.preventDefault(); error.textContent = "";
    searchController?.abort(); hideList();
    const input = new URLSearchParams({ mode: mode.value, lat: latitude.value, lon: longitude.value, provider: "openfreemap-mvt", consent: "1" });
    let config: RuntimeConfig;
    try { config = readRuntimeConfig(input, policy); }
    catch (cause) { error.textContent = cause instanceof Error ? cause.message : "Configurazione non valida"; return; }
    submit.disabled = true; submit.textContent = "Avvio in corso...";
    void start(config).then(() => { details.open = false; submit.blur(); (document.activeElement as HTMLElement | null)?.blur(); }).catch(() => { error.textContent = "Avvio non riuscito"; }).finally(() => { submit.disabled = false; submit.textContent = "Avvia"; });
  };
  details.append(summary, form); root.append(details);
  return { showError(text: string) { error.textContent = text; details.open = true; } };
}
