import { DEFAULT_ORIGIN, readRuntimeConfig, type EndpointPolicy, type RuntimeConfig } from "../world/runtime/live-config.ts";

export function createLiveControls(root: HTMLElement, params: URLSearchParams, policy: EndpointPolicy, start: (config: RuntimeConfig) => Promise<void>) {
  const details = document.createElement("details"); details.id = "live-controls";
  details.style.cssText = "position:fixed;left:12px;top:12px;z-index:2;background:#f4f5f7;color:#25272c;padding:10px 12px;border-radius:4px;width:min(320px,calc(100vw - 48px));box-shadow:0 2px 8px #0003;font-size:13px";
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
  const latitude = document.createElement("input"); latitude.name = "lat"; latitude.type = "number"; latitude.step = "any"; latitude.min = "-90"; latitude.max = "90"; latitude.value = params.get("lat") ?? String(DEFAULT_ORIGIN.latitude);
  const longitude = document.createElement("input"); longitude.name = "lon"; longitude.type = "number"; longitude.step = "any"; longitude.min = "-180"; longitude.max = "180"; longitude.value = params.get("lon") ?? String(DEFAULT_ORIGIN.longitude);
  field("Latitudine", latitude); field("Longitudine", longitude);
  // In offline mode a fixed fixture is used, so the map origin is irrelevant:
  // disable the coordinate inputs to make the inactive state explicit.
  const syncCoordinates = () => { const offline = mode.value === "offline"; latitude.disabled = offline; longitude.disabled = offline; };
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
