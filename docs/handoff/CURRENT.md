# Punto di ingresso corrente

Data: 2026-09-21

Questo file sostituisce `CODEX-START-HERE.md` come avvio di sessione.

I file `PRE-CODE-COMPLETE.md`, `CODEX-START-HERE.md`,
`CODEX-EXECUTION-QUEUE.md` e `docs/execution/` restano archivio della coda V0.
Non rieseguirli come backlog corrente.

## Stato delle fasi

| Fase | Stato |
|---|---|
| 0 Documentazione e contratti | Completata — `docs/results/PHASE-0-COMPLETE.md` |
| 0B Esperimenti stack V0 | Assorbita dall'evidenza V0 / ADR-001–005 |
| 1 Vertical slice V0 | Implementata; remediation R1-R8 completata |
| 2 Fondazione Open World | Implementata; difetti del live riprodotti e aperti |
| Ripristino online | Completata — ONLINE-01..16 verificati, C1..C6; risultato in `docs/results/ONLINE-RUNTIME-RESULT.md` |
| City Drive Stable | Completata — SOLID/ZOOM/LOD/CACHE/CITY verificati, C-A..C-E; risultato in `docs/results/CITY-DRIVE-STABLE-RESULT.md` |
| Provider-Neutral World Streaming | Completata — DATA-00..14 verificati, D-A/D-B/D-C; risultato in `docs/results/PROVIDER-NEUTRAL-WORLD-STREAMING-RESULT.md` |
| First-Person Renderer | Completata (MVP) — FP-01..08 verificati (FP-08 = fix vista FPV, rework prospettiva vera + box 3D); guard e2e `tests/e2e/first-person-view.spec.ts` |
| Review Remediation (RV) | Completata — RV-01..12 verificati, checkpoint R-A/R-B/R-C; log in `tasks/executions/2026-09-17-RV-*.md`, stato in `tasks/plan.md` |
| Live Online di Default | Completata — online al load con MVT pinnata e consenso implicito; ADR-012, risultato in `docs/results/LIVE-ONLINE-DEFAULT-RESULT.md` |
| Controlli Touch Mobile | Completata — pulsanti on-screen, barra zoom + tasto `street`, pannello no-overlap; risultato in `docs/results/TOUCH-CONTROLS-RESULT.md` |
| Veicolo F1 (velocità, sprite, stabilità) | Completata — top speed 42 m/s (~150 km/h), sprite top-down F1, fix drift/zig-zag (controller autorevole); risultato in `docs/results/F1-VEHICLE-RESULT.md` |
| Zoom ravvicinato (look GTA 1) | Completata (commit `bc635c6`) — CZ-01..05: `ZOOM_STEPS` fino a ×14, striscia centrale bianca + marciapiedi (dati già nel chunk); spec `docs/specs/close-zoom-v1.md`, risultato in `docs/results/CLOSE-ZOOM-RESULT.md` |
| Dettaglio mondo GTA (classi nel chunk) | Completata (commit `bc635c6`) — WD-01..04: terreno/strada/edificio per `styleKey` di classe in preset GTA (helper puri + raggruppamento strade per classe); spec `docs/specs/gta-world-detail-v1.md`, risultato in `docs/results/GTA-WORLD-DETAIL-RESULT.md` |
| Label acque (fiumi/laghi) | Completata (commit `475dbae`) — nomi di laghi/fiumi ricevuti ma prima non pubblicati, ora emessi come label; test in `src/world/compiler/compiled.test.ts` |
| Fisica veicolo (peso, derapata, +velocità) | Completata (commit `28fe0ee`) — VP-01..03: curva motore, grip/derapata per velocità, coasting pesante, top speed 84 m/s (~302 km/h), skew scocca in curva; spec `docs/specs/vehicle-physics-v1.md`, risultato in `docs/results/VEHICLE-PHYSICS-RESULT.md` |
| Look auto "General Lee" (berlina rossa, ombra, decal) | Completata (commit `583e045`) — GL-01..04: sprite Dodge Charger rossa, ombra a terra che appoggia la scocca, scritta "GENERAL LEE"/"01" nitide, scale 3.0; risultato in `docs/results/GENERAL-LEE-VEHICLE-RESULT.md` |
| Zoom intermedio (overview → guida) | Completata (commit `e2fc332`) — ZI-01..03: scala zoom a 6 livelli, livello intermedio ×2.25 tra overview e preset di guida (default invariato su ×6.0, ora livello 3), LOD 0-1 far / 2-3 medium / 4-5 near; risultato in `docs/results/INTERMEDIATE-ZOOM-RESULT.md` |
| 3 Packager, AI, multiplayer | Non aperte |

## Gate di qualità corrente

La review end-to-end del 2026-08-25 ha avuto esito iniziale `REQUEST CHANGES`.
La remediation R1–R8 è stata completata il 2026-08-26:

- report: `docs/analysis/END-TO-END-CODE-REVIEW-2026-08-25.md`;
- evidenza operativa: `tasks/executions/2026-08-25-end-to-end-code-review.md`.
- remediation: `docs/analysis/IMPORTANT-FINDINGS-REMEDIATION-2026-08-26.md`;
- esecuzione: `tasks/executions/2026-08-26-important-findings-remediation.md`.

Le verifiche della baseline e i commit atomici sono registrati negli execution
log del 2026-08-26. Non certificano l'affidabilita' online: l'analisi dell'8
settembre ha riprodotto mondo vuoto, neighbor scartati e assenza di streaming
anche con suite verde.

## Lavoro corrente

- Analisi: [ONLINE-RUNTIME-ANALYSIS-2026-09-08.md](../analysis/ONLINE-RUNTIME-ANALYSIS-2026-09-08.md).
- Piano: [tasks/plan.md](../../tasks/plan.md).
- Checklist: [tasks/todo.md](../../tasks/todo.md).
- Ingresso esecutore: [tasks/online/README.md](../../tasks/online/README.md).
- Stato: tranche ONLINE completata il 2026-09-10 (ONLINE-01..16, checkpoint
  C1..C6, log in `tasks/executions/`). Risultato: [ONLINE-RUNTIME-RESULT](../results/ONLINE-RUNTIME-RESULT.md).
- Tranche **City Drive Stable** completata il 2026-09-11 (SOLID/ZOOM/LOD/
  CACHE/CITY, checkpoint C-A..C-E; risultato
  [CITY-DRIVE-STABLE-RESULT](../results/CITY-DRIVE-STABLE-RESULT.md),
  spec [city-drive-stable](../specs/city-drive-stable.md), ADR-010).
- Tranche **Provider-Neutral World Streaming** completata il 2026-09-11
  (DATA-00..14, checkpoint D-A..D-C; risultato
  [PROVIDER-NEUTRAL-WORLD-STREAMING-RESULT](../results/PROVIDER-NEUTRAL-WORLD-STREAMING-RESULT.md),
  ADR-011, analisi [MVT-LECCE-PARITY](../analysis/MVT-LECCE-PARITY.md) con
  decisione GO VISUAL ONLY). DATA-15..18 restano righe di piano da
  dettagliare; il flag `provider=openfreemap-mvt` è sperimentale, mai
  default.
- Tranche **First-Person Renderer** completata (MVP) il 2026-09-16
  (FP-01..08; FP-08 = fix vista FPV con rework in prospettiva vera
  `projectRoadPolygon` + edifici box 3D + densificazione centerline; guard
  e2e `tests/e2e/first-person-view.spec.ts`; spec
  [first-person-renderer-v0](../specs/first-person-renderer-v0.md)).
- Tranche **Review Remediation (RV)** completata il 2026-09-17
  (RV-01..12, checkpoint R-A/R-B/R-C): robustezza e performance del runtime
  (cancel stream su budget, cache tile + retry, label O(1), pre-filtro bbox,
  validazione codec, write IndexedDB serializzate, stop app inattiva,
  pre-cull strade FP, rimozione dead code, ring buffer metrics, Retry-After
  HTTP-date, superficie stradale per-frammento). Log in
  `tasks/executions/2026-09-17-RV-*.md`; stato in
  [tasks/plan.md](../../tasks/plan.md) e [tasks/todo.md](../../tasks/todo.md).
- Tranche **Live Online di Default** completata il 2026-09-17
  (ONLINE-DEFAULT-01..04): la modalità live parte online al load con sorgente
  MVT pinnata (OpenFreeMap) e consenso implicito non revocabile; opt-out =
  offline; provider opt-in in allowlist. ADR-012 (supersede ADR-009);
  risultato [LIVE-ONLINE-DEFAULT-RESULT](../results/LIVE-ONLINE-DEFAULT-RESULT.md).
- Tranche **Controlli Touch Mobile** completata il 2026-09-17 (TOUCH-01..04):
  pulsanti on-screen per guidare (stesso comportamento tastiera), barra zoom
  ingrandita con tasto `street` (effetto `L`), pannello configurazioni che non
  sovrappone la barra zoom; desktop invariato. Risultato
  [TOUCH-CONTROLS-RESULT](../results/TOUCH-CONTROLS-RESULT.md).
- Tranche **Veicolo F1** completata il 2026-09-17 (F1-01..04): velocità
  ~150 km/h (42 m/s) via `VEHICLE_TUNING` (pronta per UI), sprite top-down F1
  (`drawF1Vehicle`), e fix del drift/zig-zag senza sterzo (il controller arcade
  è autorevole per velocità+rotazione, Rapier corregge solo la posizione;
  commit `33bf6bf` + `568dcc0`). Risultato
   [F1-VEHICLE-RESULT](../results/F1-VEHICLE-RESULT.md).
- Tranche **Zoom ravvicinato (look GTA 1)** completata il 2026-09-18 (commit
  `bc635c6`, CZ-01..05): `ZOOM_STEPS` fino a ×14 (auto grande), striscia centrale
  bianca (dal tier medium in su, look GTA) e marciapiedi derivati da
  `centerline`+`widthMeters` già nel chunk; spec [close-zoom-v1](../specs/close-zoom-v1.md),
  risultato [CLOSE-ZOOM-RESULT](../results/CLOSE-ZOOM-RESULT.md).
- Tranche **Dettaglio mondo GTA** completata il 2026-09-18 (commit `bc635c6`,
  WD-01..04): ri-renderizzazione in preset GTA delle `styleKey` di classe già nel
  chunk — terreno per `landClass`, strade per `roadClass` (raggruppamento per
  larghezza+classe in `groupRoadsByStyleAndWidth`), edifici per `buildingType` o
  variabilità deterministica da posizione (seed FNV-1a, indipendente dal tile →
  niente cuciture). Helper puri testati; gate verde (435 unit, 25 E2E).
  Risultato [GTA-WORLD-DETAIL-RESULT](../results/GTA-WORLD-DETAIL-RESULT.md).
  Follow-up (alberi, `sourceLevels`, `laneCount`) = cambio schema compilato,
  da pianificare come tranche a sé.
- Tranche **Label acque** completata il 2026-09-18 (commit `475dbae`): i nomi di
  laghi/fiumi (`tags.name` su `waterAreas`) erano ricevuti ma non pubblicati; ora
  il compiler li emette come label (baricentro per le aree, punto medio per i corsi
   d'acqua, `kind:"place"`, priorità 105). Test in `src/world/compiler/compiled.test.ts`.
- Tranche **Fisica veicolo** completata il 2026-09-18 (commit `28fe0ee`,
  VP-01..03): guida con "peso" (niente galleggiamento) — curva motore (accel che
  cala verso la top speed), grip/derapata per velocità (agganciata a bassa velocità,
  ~18° di slide a 80 m/s), coasting più pesante; top speed 84 m/s (~302 km/h, 0→100
  in ~1.6 s, frenata ~69 m) e leggera flessione (skew) della scocca in curva da
  velocità laterale. Tutti i valori in `VEHICLE_TUNING` per ritocchi del feel.
  Spec [vehicle-physics-v1](../specs/vehicle-physics-v1.md), risultato
  [VEHICLE-PHYSICS-RESULT](../results/VEHICLE-PHYSICS-RESULT.md).
 - Tranche **Look auto "General Lee"** completata il 2026-09-18 (commit `583e045`,
   GL-01..04): sprite dell'auto da F1 a Dodge Charger rossa (il General Lee di
   *The Dukes of Hazzard*), ombra morbida a terra che appoggia la scocca e scivola
   con la piega in curva (niente galleggiamento), scritta "GENERAL LEE" sul tetto e
   "01" sulle porte nitide (rasterizzate a 128px via `makeWorldText`),
   `VEHICLE_VISUAL_SCALE` 3.0. Fisica/collider invariati. Risultato
   [GENERAL-LEE-VEHICLE-RESULT](../results/GENERAL-LEE-VEHICLE-RESULT.md).
  - Tranche **Zoom intermedio (overview → guida)** completata il 2026-09-21
    (ZI-01..03, working tree post `df5be7b`): il salto di zoom tra l'overview
    (×0.85) e il preset di guida (×6.0) era 7x; aggiunta la scala a 6 livelli
    `[0.7, 0.85, 2.25, 6.0, 12.0, 24.0]` con livello intermedio ×2.25 (mediana
    geometrica, passi <3x), default invariato sul preset di guida (ora livello
    3, fattore 6.0) e LOD 0-1 far / 2-3 medium / 4-5 near. Solo presentazione:
    fisica e streaming invariati. Risultato
    [INTERMEDIATE-ZOOM-RESULT](../results/INTERMEDIATE-ZOOM-RESULT.md).
  - Resto aperto (fuori scope RV, da dettagliare): DATA-15..18 (PMTiles PoC,
   custom tile schema ADR, riuso cache compilata, curated region package).
 - Baseline stabile per test utente: commit `583e045` (look auto "General Lee":
   berlina rossa Dodge Charger + ombra a terra + decal "GENERAL LEE"/"01" nitide;
   su base fisica veicolo `28fe0ee`, look GTA `bc635c6` + label acque `475dbae`;
   gate verde: 438 test unitari, 24 E2E non-flaky + 1 canary skipped, `bootstrap`
   flaky da carico come noto);
  istruzioni di prova, stati attesi e limiti noti nella sezione "Prova della
  baseline" del [README](../../README.md).
 - Worktree pulito su `opcl3D` (2026-09-18): tutte le tranche recenti (CZ, WD,
   label acque, fisica veicolo, look General Lee) commit, ultima `583e045`. Gate
   verde (typecheck, build, 438 unit, 24 E2E non-flaky; `bootstrap` flaky da
   carico come noto). Il bump della baseline (nuovo commit + hash) avviene al
   commit, su richiesta esplicita.

La pianificazione e' stata richiesta il 2026-09-08 e completata il 2026-09-09.
L'esecuzione procede per schede: ogni consegna e' registrata nel proprio log
con evidenze reali; un esecutore riceve il task da svolgere e usa scheda,
contratti comuni e log dei prerequisiti, senza ricostruire la conversazione
originale.

I precedenti piano/checklist completati sono archiviati in `tasks/archive/`.
Non usare `docs/execution/` o la vecchia coda V0 come lavoro da ripetere.

## Lettura minima prima di modificare il prodotto

1. `AGENTS.md`
2. `.opencode/agents/AGENTS.md` e solo le skill pertinenti
3. `CODING-STANDARDS.md`, `SECURITY.md`
4. `docs/intent/open-gta-web.md`
5. `docs/SPEC.md`
6. `docs/DECISIONS.md`
7. `docs/architecture/README.md`
8. `tasks/plan.md`, `tasks/todo.md`
9. ADR e spec citati dal task

## Fondazione precedente

La tranche implementata è la fondazione Open World definita in
`docs/specs/open-world-runtime-phase-2.md`. P2.1 è completata e documentata in
`tasks/executions/2026-08-26-p2-1-chunk-grid.md`; anche P2.2, lifecycle locale
dei chunk, è completata e documentata in
`tasks/executions/2026-08-26-p2-2-chunk-lifecycle.md`; anche P2.3, active window
e seam geometriche locali, è completata e documentata in
`tasks/executions/2026-08-26-p2-3-active-window.md`; anche P2.4, warm cache
in-memory, è completata e documentata in
`tasks/executions/2026-08-26-p2-4-warm-cache.md`; anche P2.5, boundary di
acquisizione runtime, è completata e documentata in
`tasks/executions/2026-08-26-p2-5-runtime-source.md`; anche P2.6, integrazione
della fondazione Open World Runtime, è completata e documentata in
`tasks/executions/2026-08-26-p2-6-open-world-runtime.md`. Le estensioni P3.1–P3.3
sono state completate e registrate in
`tasks/executions/2026-08-26-open-world-expansion.md`: partizione/ownership,
composizione multi-chunk e adapter HTTP live. P3.4 è definita in
`docs/adr/ADR-009-live-runtime-consent.md`: provider-neutral, endpoint esplicito
e consenso opt-in; il fixture offline resta il default. AI e multiplayer
restano fuori scope. Il piano ONLINE corrente definisce i successivi task con
obiettivi e criteri propri; il completamento storico della fondazione non
sostituisce le verifiche dei nuovi flussi.

## Comandi

Vedi `AGENTS.md` e `README.md`.

## Convenzione attiva di repository

- `docs/` contiene analisi, decisioni, contratti e risultati.
- `tasks/` contiene piano attivo, checklist e log di esecuzione.
