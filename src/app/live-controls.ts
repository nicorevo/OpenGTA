import { DEFAULT_ENDPOINT_POLICY, DEFAULT_ORIGIN, readRuntimeConfig, type EndpointPolicy, type RuntimeConfig } from "../world/runtime/live-config.ts";

export function createLiveControls(root: HTMLElement, params: URLSearchParams, policy: EndpointPolicy, start: (config: RuntimeConfig) => Promise<void>, stop: (revoked: boolean) => void) {
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
  mode.value = params.get("mode") === "open-world-live" ? "open-world-live" : "offline";
  field("Modalita'", mode, true);
  const latitude = document.createElement("input"); latitude.name = "lat"; latitude.type = "number"; latitude.step = "any"; latitude.min = "-90"; latitude.max = "90"; latitude.value = params.get("lat") ?? String(DEFAULT_ORIGIN.latitude);
  const longitude = document.createElement("input"); longitude.name = "lon"; longitude.type = "number"; longitude.step = "any"; longitude.min = "-180"; longitude.max = "180"; longitude.value = params.get("lon") ?? String(DEFAULT_ORIGIN.longitude);
  field("Latitudine", latitude); field("Longitudine", longitude);
  const provider = document.createElement("select"); provider.name = "provider";
  const mvt = document.createElement("option"); mvt.value = "openfreemap-mvt"; mvt.textContent = "OpenFreeMap MVT"; provider.append(mvt);
  const osm = document.createElement("option"); osm.value = "osm"; osm.textContent = "OpenStreetMap"; provider.append(osm);
  if (policy.developmentOrigin || policy.httpsEndpoints.some((endpoint) => !DEFAULT_ENDPOINT_POLICY.httpsEndpoints.includes(endpoint))) {
    const http = document.createElement("option"); http.value = "http"; http.textContent = "Endpoint autorizzato"; provider.append(http);
  }
  // The http option exists only when the trusted policy authorises it: in a
  // production build with the default policy the select must fall back to the
  // only available option instead of submitting an empty provider value.
  const desiredProvider = params.get("provider") === "http" || (params.has("endpoint") && params.get("provider") !== "osm") ? "http" : params.get("provider") === "openfreemap-mvt" ? "openfreemap-mvt" : "osm";
  provider.value = [...provider.options].some((option) => option.value === desiredProvider) ? desiredProvider : provider.options[0].value;
  field("Provider", provider, true);
  const endpoint = document.createElement("input"); endpoint.type = "url"; endpoint.value = params.get("endpoint") ?? DEFAULT_ENDPOINT_POLICY.httpsEndpoints[0];
  field("Endpoint", endpoint, true);
  const consent = document.createElement("input"); consent.type = "checkbox"; consent.id = "live-consent";
  consent.checked = params.get("mode") === "open-world-live" && params.get("consent") === "1";
  const consentLabel = document.createElement("label"); consentLabel.style.cssText = "grid-column:1/-1;display:flex;align-items:flex-start;gap:8px";
  consentLabel.append(consent, document.createTextNode("Autorizzo l'invio delle coordinate al provider")); form.append(consentLabel);
  const error = document.createElement("div"); error.id = "config-error"; error.setAttribute("role", "alert"); error.style.cssText = "grid-column:1/-1;color:#a72035;overflow-wrap:anywhere"; form.append(error);
  const submit = document.createElement("button"); submit.type = "submit"; submit.textContent = "Avvia"; submit.style.cssText = "padding:8px 14px;background:#156c60;color:white;border:0;border-radius:3px;font:inherit"; form.append(submit);
  form.onsubmit = (event) => {
    event.preventDefault(); error.textContent = "";
    const input = new URLSearchParams({ mode: mode.value, lat: latitude.value, lon: longitude.value, provider: provider.value, endpoint: endpoint.value, consent: consent.checked ? "1" : "0" });
    let config: RuntimeConfig;
    try { config = readRuntimeConfig(input, policy); }
    catch (cause) { error.textContent = cause instanceof Error ? cause.message : "Configurazione non valida"; return; }
    submit.disabled = true; submit.textContent = "Avvio in corso...";
    void start(config).then(() => { details.open = false; submit.blur(); (document.activeElement as HTMLElement | null)?.blur(); }).catch(() => { error.textContent = "Avvio non riuscito"; }).finally(() => { submit.disabled = false; submit.textContent = "Avvia"; });
  };
  consent.onchange = () => { if (!consent.checked && mode.value === "open-world-live") stop(true); };
  details.append(summary, form); root.append(details);
  return { showError(text: string) { error.textContent = text; details.open = true; } };
}
