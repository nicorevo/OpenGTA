# Veicolo: velocità -20% e divieto d'ingresso in acqua

Data: 2026-09-21. Persona: fullstack-developer.
Stato: completato + verificato (working tree, non ancora commitato).
Baseline di partenza: `04d2b64`. Log: `tasks/executions/2026-09-21-WS-01.md`.

## Obiettivo

Richiesta utente: "diminuisci un pochino la velocità (20%) e non consentire
l'ingresso in acqua".

## Cosa è cambiato

- **Velocità (-20%)** — `src/gameplay/vehicle/controller.ts`,
  `VEHICLE_TUNING`:
  - `maxForwardSpeed` 84 → **67.2 m/s** (~302 → ~242 km/h);
  - `maxReverseSpeed` 14 → **11.2 m/s**;
  - accelerazioni, frenata, grip laterale e steering invariati: cambia solo
    il soffitto di velocità, il "feel" della curva resta lo stesso.
- **Divieto d'ingresso in acqua** — `src/world/compiler/compiled.ts`,
  `compileRegion`: ogni water **area** (laghi, bacini, coste) emette ora
  anche una collision shape poligonale, trattata dall'adapter Rapier come un
  muro perimetrale (stesso meccanismo degli edifici: `ColliderDesc.polyline`
  su anello outer + holes). Il veicolo non può mai attraversare il
  perimetro dell'acqua; i corsi d'acqua rappresentati solo come linea
  (senza poligono) non generano collisione, coerentemente con il fatto che
  non hanno superficie d'acqua compilata.
- **Invalidazione cache persistente** — `src/app/runtime-session.ts`:
  `compilerVersion` bumpato `"v0-runtime"` → `"v0-runtime-water-collision"`.
  La chiave del cache persistente include la versione del compiler: senza il
  bump i chunk già in IndexedDB (compilati prima, senza i muri d'acqua)
  verrebbero riusati in silenzio.
- Test: `controller.test.ts` (top speed 67.2, cap inversa 11.2) e
  `compiled.test.ts` (lago → collision poligonale; fiume line-only → nessuna
  collisione).

## Comportamento

- Top speed ~242 km/h; marcia inversa ~40 km/h; tempi di arresto e traiettorie
  in curva invariati.
- Guidando verso il mare/lago: il veicolo si ferma sul perimetro dell'acqua
  (stesso comportamento del contatto con un edificio), senza entrare.
- La spawn continua a evitare l'acqua (`spawn.ts`), quindi il veicolo non
  nasce mai dentro una water area.

## Verifica

- TDD: RED controller 3/3 → GREEN 9/9; RED compiled 1/1 → GREEN 13/13.
- `npm run test:run`: **474/474** (58 file).
- `npm run typecheck`, `npm run build`: verdi.
- `npm run test:e2e`: **34 passed + 1 canary skipped** (nessuna regressione
  sui test che guidano il veicolo).
- `git diff --check`: pulito.

## Follow-up (non incluso)

- Nuoto/galleggiamento: se servirà, si rimuove la collisione dal compilatore
  e si aggiunge una dinamica di galleggiamento nel controller (punti già
  isolati).
- Larghezza dei corsi d'acqua a linea (oggi nessuna collisione): richiederebbe
  una superficie d'acqua derivata (buffer della centerline) = cambio di
  schema, da pianificare a sé.
