# Spec: OpenGTA City Drive Stable

**Stato:** pianificata (tranche CITY, `tasks/plan.md`).
**Baseline:** `77312aa` (175 test unitari, 14 E2E, smoke produzione, tutti
rieseguiti il 2026-09-10).
**Riferimenti:** ADR-010, `docs/architecture/zoom-and-lod.md`,
`docs/OpenGTA_SOLIDITY_ZOOM_ROADMAP.md` (proposta esterna di partenza,
riconciliata con il codice).

## Obiettivo

Passare da "funziona bene con 8 chunk" a "continua a funzionare dopo
chilometri di guida": l'utente sceglie una zona urbana (Lecce per prima),
parte rapidamente, attraversa chunk in modo trasparente, usa zoom `+`/`-`,
vede il mondo arrivare progressivamente con LOD, continua a giocare durante
errori recuperabili, torna su aree visitate senza ricompilazioni inutili e
chiude sessioni lunghe senza crash, freeze o crescita illimitata delle
risorse.

Non e' in scope: traffico, pedoni, missioni, multiplayer, AI, deploy
pubblico, cambio di stack. Rimangono nei filoni differiti.

## Requisiti funzionali

### F-NAV. Navigazione continua

- F-NAV-1: avvio da coordinate valide con P0 giocabile prima dei neighbor
  (comportamento esistente, invariato).
- F-NAV-2: attraversamento di 100+ finestre di chunk senza crash,
  unhandled rejection, stale apply o ingresso in celle non applicate.
- F-NAV-3: chunk rimossi liberano renderer e fisica; warm cache bounded
  (9 chunk); record lifecycle bounded.
- F-NAV-4: ritorno su aree visitate: nessuna richiesta provider ripetuta in
  sessione; con cache persistente (Fase D), nessuna ricompilazione tra
  sessioni.

### F-ZOOM. Zoom a livelli discreti

- F-ZOOM-1: 5 livelli `ZOOM_STEPS` (default 1.0 al centro), fattori
  sperimentali `[0.70, 0.85, 1.0, 1.20, 1.45]`, finali decisi da benchmark.
- F-ZOOM-2: pulsanti `[-] [+]` accessibili (aria-label, focus visibile,
  stato disabilitato ai limiti) + scorciatoie `+`/`-`; i pulsanti non
  intrappolano i tasti di guida.
- F-ZOOM-3: zoom cambia solo presentazione: posizione/velocità/heading/
  collisioni/fixed-step invariati (testato).
- F-ZOOM-4: zoom out mostra piu' territorio (bounds crescono) e la domanda
  di streaming si aggiorna con il debounce esistente (max 5 Hz); nessuna
  tempesta di richieste con pressioni rapide `- - - + +`.
- F-ZOOM-5: la guardia di disponibilita' resta basata sui chunk APPLICATI:
  zoom out non rende guidabile territorio non ancora caricato.

### F-LOD. LOD 2D per tier

- F-LOD-1: `lodForZoom(level)` -> `near | medium | far`, pura e testabile.
- F-LOD-2: FAR = major roads, building blocks, parchi/acqua, label minime,
  facade ~0; MEDIUM = strade, edifici, facade ridotta, label selezionate;
  NEAR = dettaglio attuale completo (marking, facade piena, label).
- F-LOD-3: culling visuale delle feature sotto soglia in pixel quadrati al
  tier corrente; solo presentazione, mai il world model.

### F-ERR. Errori non bloccanti

- F-ERR-1: classificazione esistente (recoverable/degraded/fatal) preservata;
  Riprova e Interrompi restano affidabili su ogni percorso (regressioni).
- F-ERR-2: compilazione cooperativamente cancellabile: un chunk diventato
  inutile non occupa il main thread per centinaia di ms dopo l'abort.

## Requisiti non funzionali

- N-PERF-1: metriche compiler reali (`stageDurationsMs` misurato:
  acquisition/decode/normalize/compile/apply); nessuna metrica sempre zero.
- N-PERF-2: renderer incrementale per chunk: `setChunk`/`removeChunk` con
  costo `O(chunks_changed)`, zero rebuild per chunk invariati.
- N-PERF-3: benchmark su fixture patologiche (multipolygon 100..20.000
  membri, payload fino al budget byte) con budget dichiarato: nessun task
  sul main thread oltre la soglia senza yield.
- N-MEM-1: memory budget esplicito con stati ACTIVE/WARM/PERSISTED/EVICTED;
  contatori in snapshot diagnostica.
- N-SEC-1: SECURITY.md riallineato alle superfici reali (URL/coordinate,
  payload OSM, stream, normalizzatore, compiler, cache, canvas, WASM,
  future IndexedDB/Worker).
- N-TEST-1: canary live separata dalla CI (Lecce + lista estesa), non
  bloccante; il fallimento del provider non rende rossa la suite normale.
- N-TEST-2: long-drive regression (100+ transizioni) a clock simulato;
  nessuna richiesta pubblica nei test deterministici.

## Definition of Done "City Drive Stable"

Chiusura del gate `CITY-02` con:

- checklist funzionale/robustezza/performance/zoom della sezione
  corrispondente nel piano interamente spuntata con evidenze;
- matrice test -> requisito in `docs/results/CITY-DRIVE-STABLE-RESULT.md`;
- misure con ambiente dichiarato (headless per regressioni; profili
  DESKTOP_LOW/MID su hardware reale per l'esperienza);
- `docs/handoff/CURRENT.md`, piano e checklist concordi col codice.
