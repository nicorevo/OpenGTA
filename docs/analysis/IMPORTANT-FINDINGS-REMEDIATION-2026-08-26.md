# Remediation Finding Important — 2026-08-26

## Scope

Questa verifica chiude i finding R1–R8 del report storico
`END-TO-END-CODE-REVIEW-2026-08-25.md`. Il report storico resta immutato come
evidenza della review iniziale; questo documento registra le correzioni e le
verifiche successive.

## Esito

| Finding | Area | Stato | Evidenza |
|---|---|---|---|
| R1 | Multipolygon e ring assembly | Chiuso | Join per endpoint, outer multipli, validazione open/degenerate, test OSM |
| R2 | Hole in rendering e collisione | Chiuso | Cut PixiJS e collider Rapier per ring outer/inner, test dedicati |
| R3 | Clipping polyline multi-part | Chiuso | `clipPolylineToBounds` restituisce parti disconnesse, test exit/re-entry |
| R4 | Collision contract e diagnostics | Chiuso | Segment collider, barriere compilate, conteggio feature/skipped coerente |
| R5 | Metriche fixed-step | Chiuso | Frame e physics step separati, debt drop misurato esplicitamente |
| R6 | Brake crossing zero | Chiuso | Decelerazione monotona verso zero, test da velocità bassa |
| R7 | Mapping OSM e error path | Chiuso | Validazione nodi/way/relation, tag e misure, barriere/acqua/parking, test |
| R8 | Strategia test automatizzata | Chiuso | Vitest ristretto ai test source e smoke Playwright bootstrap/controlli |

## Verifica eseguita

- `npm run test:run`: 13 file, 50 test passati.
- `npm run test:e2e`: 1 smoke Playwright passato su Chrome locale.
- `npm run typecheck`: passato.
- `npm run build`: passato; resta il warning noto sul chunk PixiJS principale.
- `npm audit --audit-level=high`: 0 vulnerabilità.

Lo smoke browser verifica canvas accessibile, overlay F3, input W con movimento
del veicolo, toggle L e assenza di `pageerror`. Non usa mutazioni dello stato
applicativo dal test.

## Limiti residui

La baseline non ha ancora un lint configurato né una soglia coverage. Il warning
di bundle size e i warning WebGL del renderer software headless restano debito
non bloccante già noto. La review del gate è stata chiusa sul piano tecnico;
l’apertura di Phase 2 richiede comunque approvazione del nuovo piano attivo.
