# GTA 2D City — G2D-01: proporzioni taxi, strada e camera

Data: 2026-09-20. Persona: fullstack-developer.
Stato: completato + verificato (commit `df5be7b`, docs `723deb7`).
Scheda: `tasks/gta-2d/G2D-01.md`. Log: `tasks/executions/2026-09-20-G2D-01.md`.
Spec: `docs/specs/gta-2d-city-v1.md` (ADR-013). Prerequisito: G2D-00
(`docs/results/GTA-2D-BASELINE.md`).

## Obiettivo

Vista di guida in cui l'auto abbia la scala della figura e l'incrocio sia
leggibile: calibrare insieme preset di guida e `VEHICLE_VISUAL_SCALE`
(mantenendo l'aspect ratio del taxi), separando il livello di guida normale
dallo zoom massimo.

## Cosa è cambiato

- `src/app/camera.ts`: `ZOOM_STEPS` `[0.7, 0.85, 6.0, 12.0, 24.0]` — il
  livello 2 è il preset di guida GTA-2D (8 px/m a 640x480), i livelli 3-4 sono
  target separati di close-view, 0-1 restano far. (Il livello intermedio ×2.25
  è stato poi inserito dalla tranche ZI, portando la scala a 6 livelli.)
- `src/render/pixi/renderer.ts`: `VEHICLE_VISUAL_SCALE` 3.0 → **1.2**
  (intervallo spec 1.0-1.3); fix `changeZoom`: `zoomLevel` aggiornato PRIMA
  del rebuild del tier — prima il culling a far misurava i bounds con la scala
  del livello precedente (difetto preesistente, mascherato dai vecchi fattori,
  esposto dal fattore 6).
- Test: `camera.test.ts` 14/14 (fattori espliciti, preset separato dal
  massimo, ≥ 30 m di strada davanti); `tests/e2e/gta-city.spec.ts` AC1/scala
  (taxi 35-55 × 16-27 px a 640x480, strada 6 m ≥ 2 larghezze auto, lunghezza
  visiva 3.5-6 m); `tests/e2e/zoom.spec.ts` AC2 (zoom da tastiera non sposta
  la posa fisica a riposo).
- Deviazione documentata nel log: `tests/e2e/mvt-live.spec.ts` (sesto file) —
  il guard misurava la copertura streaming con la vecchia finestra (~±320 m);
  con il nuovo preset (~±50 m) gli stessi 600 m attraversavano 8 chunk invece
  di 10+ → la guard ora guida alla vista far (finestra come prima della
  ricalibrazione) così misura lo streaming, non il preset.

## Numeri (verifica visiva, screenshot 640x480 post-ricalibrazione)

- Taxi: bbox 34x16 px al centro (bounds misurati 37.1x17.3) — dentro AC1.
- Strada 6 m = 48 px, mezzeria bianca che la divide in due corsie da ~23 px
  (≥ 2 larghezze auto — AC1).
- Inquadratura ~±40 x ±30 m: l'incrocio X riempie la vista (AC2).
- Confronto prima/dopo alle tre viewport: `GTA-2D-BASELINE.md` (sezione
  confronto) + log.

## Verifica

- RED: `camera.test.ts` 2 falliti (fattori 12/24 attesi, ricevuti 4/14),
  asserzioni AC1/scala di `gta-city.spec.ts` fallite con i fattori vecchi.
- GREEN: `camera.test.ts` 14/14; suite E2E completa (esclusa canary) 27/27
  (1° run: 1 fallito — il fix `changeZoom` di cui sopra); suite unit 439/439;
  typecheck, build, `git diff --check` verdi.

## Limiti

- Fattori e scala visiva (1.2 / 6.0) restano parametri sperimentali: da
  confermare su GPU/dispositivo reale nel confronto visivo di G2D-18.
- La guard `mvt-live` ora guida alla vista far: la copertura dello streaming
  al preset di guida è coperta dagli altri 27 E2E ma non dal conteggio dei 10
  chunk di quella guard.

## Stato del look

Con G2D-01 (asset introdotto in `758255a`) il look "General Lee"
(`583e045`) è **sostituito**: lo sprite dell'auto è il taxi GTA-style con
provenienza in `src/render/pixi/assets/taxi.PROVENANCE.md`. I document
storici di quella tranche restano validi come record del momento.
