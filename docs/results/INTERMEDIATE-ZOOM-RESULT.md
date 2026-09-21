# Zoom intermedio (overview → guida) — scala a 6 livelli

Data: 2026-09-21. Persona: fullstack-developer.
Stato: completato + verificato. Baseline: working tree post `df5be7b` (G2D-01).
Log: `tasks/executions/2026-09-21-ZI-01.md`.

## Obiettivo

Dare una vista intermedia di quartiere tra l'overview e il preset di guida:
il salto tra i due era 7x (×0.85 → ×6.0), il più grosso della scala, e un
clic `+` dall'overview saltava direttamente alla strada.

## Cosa è cambiato

- `camera.ts`: `ZOOM_STEPS = [0.7, 0.85, 2.25, 6.0, 12.0, 24.0]` (6 livelli,
  `ZoomLevel 0..5`). Livello 2 = ×2.25, mediana geometrica di 0.85 e 6.0:
  due passi ~2.6x al posto di uno 7x; guard unit: ogni passo della scala
  resta sotto 3x.
- Default = livello 3 (`DEFAULT_ZOOM_LEVEL`, exportato e usato dal renderer):
  il preset di guida resta ×6.0, quindi la resa visiva di partenza è
  identica a prima (le misure pixel di `gta-city` sono invariate).
- `lodForZoom`: 0-1 far, 2-3 medium, 4-5 near. Il livello intermedio entra in
  medium (facciate 0.6, casing, label >= 60): coerente col vecchio livello 2
  e monotono (zoomando in non si perde mai dettaglio).
- `renderer.ts`/`bootstrap.ts`: default e clamp allineati (default 3, max 5).
- Solo presentazione: fisica, posa veicolo, contratti chunk e streaming
  invariati (guard `zoom.spec` AC2 e `renderer-streaming` verdi).

## Verifica

- RED: `camera.test.ts` 9/15 falliti prima del GREEN.
- `npm run test:run`: 440/440 (era 438: +1 test "passi <3x", guard aggiornate).
- `npm run typecheck`, `npm run build`: verdi.
- `npm run test:e2e`: 27 passed + 1 canary skip. Allineati a default 3 /
  clamp 5: `zoom.spec`, `renderer-streaming.spec`, `gta-city.spec`; le
  asserzioni di scala pixel (480/800/390 / 360 × 6) invariate.
- Bench `tests/bench/zoom-demand.test.ts`: report esteso a 6 livelli, verde.

## Follow-up (non incluso)

- Ricalibrazione del fattore 2.25 se il confronto visivo la richiede
  (G2D-16/18); i livelli restano parametri di `ZOOM_STEPS`.
- Verifica visiva sul live MVT (screenshot overview → `+` → quartiere →
  `+` → strada) da registrare al prossimo checkpoint visivo.
