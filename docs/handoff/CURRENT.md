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
| Look auto "General Lee" (berlina rossa, ombra, decal) | Completata (commit `583e045`) — GL-01..04: sprite Dodge Charger rossa, ombra a terra che appoggia la scocca, scritta "GENERAL LEE"/"01" nitide, scale 3.0; look poi sostituito dal taxi GTA (G2D-00/01); risultato in `docs/results/GENERAL-LEE-VEHICLE-RESULT.md` |
| GTA 2D City (G2D-00..01) | Completata (commits `758255a` + `df5be7b`, docs `723deb7`) — G2D-00: quartiere di riferimento (fixture X/T/Y/curva/vicolo + 7 palazzi, boot offline nell'harness, baseline 3 viewport GPU/distinzione software) in `docs/results/GTA-2D-BASELINE.md`; G2D-01: sprite taxi GTA (37x17 px a 640x480, `VEHICLE_VISUAL_SCALE` 1.2, asset con provenienza), strada 6 m = 48 px (2 corsie ~23 px), preset guida ×6.0 con zoom max separato, fix culling a far in `changeZoom`; spec `docs/specs/gta-2d-city-v1.md`, ADR-013, risultato in `docs/results/GTA-2D-TAXI-PROPORTIONS-RESULT.md` |
| Zoom intermedio (overview → guida) | Completata (working tree post `df5be7b`) — ZI-01..03: scala zoom a 6 livelli, livello intermedio ×2.25 tra overview e preset di guida (default invariato su ×6.0, ora livello 3), LOD 0-1 far / 2-3 medium / 4-5 near; risultato in `docs/results/INTERMEDIATE-ZOOM-RESULT.md` |
| Nomi via leggibili (carreggiata) | Completata (commit `15c5f68`) — LB-01..03: label rasterizzate a 128px poi scalate in unità di mondo (nitide a ogni zoom), altezza = 42% della carreggiata (clamp 1.2–4 m), fit all'80% della lunghezza strada, bianco + contorno sottile; risultato in `docs/results/LEGIBLE-ROAD-LABELS-RESULT.md` |
| Nomi via/luoghi duplicati (dedup) | Completata (commit `15c5f68`) — ND-01..03: ogni chunk compila la propria copia dei label (via spezzate in `part:N`, metà poligono MVT) → dedup nel renderer per identità di feature (`labelDedupKey`, poi sostituita da NN), vince la copia più vicina alla camera; risultato in `docs/results/NO-DUPLICATE-LABELS-RESULT.md` |
| Nomi ripetuti su vie distinte (dedup per nome) | Completata (commit `15c5f68`) — NN-01..03: review pipeline (reperimento OK, difetto in assegnazione: un label per way OSM ma il nome è attributo della via) → dedup nel renderer per nome normalizzato (`labelTextKey`: trim+casefold), vince la copia più vicina alla camera; risultato in `docs/results/ONE-NAME-PER-ROAD-RESULT.md` |
| Veicolo: velocità -20% + divieto acqua | Completata (commit `4e687b9`) — WS-01..02: top speed 84 → 67.2 m/s (~242 km/h), inversa 11.2 m/s (solo i soffitti, feel invariato); water areas emesse dal compilatore come collision shape (muro perimetrale Rapier, come edifici), `compilerVersion` bumpato per invalidare i chunk persistenti senza muri; risultato in `docs/results/VEHICLE-WATER-SPEED-RESULT.md` |
 | Origine per nome del luogo (geocoding form) | Completata (commit `9ea0062`) — PN-01..04: campo "Cerca un luogo" tra Modalità e coordinate (Nominatim pinnato, debounce 400 ms, ≤ 5 candidati, 1 in-flight con abort, cache LRU 32, validazione per-candidato, selezione click/tastiera → valorizza lat/lon editabili, offline disabilitato); spec `docs/specs/place-name-origin-v1.md`, risultato in `docs/results/PLACE-NAME-ORIGIN-RESULT.md` |
 | Luogo corrente nella barra di stato | Completata (commit `0433da1`) — ZP-01..04: nello stato `ready` la scritta "Area pronta" diventa il luogo corrente via reverse geocoding Nominatim al cambio di zona 1000 m (intervallo min 5 s, 1 in-flight, a riposo zero richieste; errore/`{error}` → "Area pronta"; offline invariato); spec `docs/specs/current-place-name-v1.md`, risultato in `docs/results/CURRENT-PLACE-NAME-RESULT.md` |
 | Location Visual Profiles (LVP) | Completato (base `cd59f65`, esteso con LVP-08) — spec `docs/specs/OPEN-GTA-LOCATION-VISUAL-PROFILES-V1.md`, ADR-014, result `docs/results/LOCATION-VISUAL-PROFILES-V1-RESULT.md`; LVP-00..08 fatti, gate visuale utente GO (`docs/results/LVP-VALIDATION-RESULT.md`), 3 famiglie visuali rome/paris/tokyo validate |
  | Visual Profile Service (VPS) | Slice offline VPS-00..09 (2026-09-21, gate §140 GO) + **VPS-10 runtime API** + **VPS-11 modello vision** + **VPS-12 coverage QA** (2026-09-22) + **Gate VPS v1 GO** (2026-09-22) completati — spec `docs/specs/OPEN-GTA-VISUAL-PROFILE-SERVICE-V1.md`, ADR-015, result doc `docs/results/VISUAL-PROFILE-SERVICE-V1-RESULT.md`; servizio live `GET /v1/profile` (Overpass + Mapillary API correnti + DeepSeek `deepseek-flash` con stats §107, cache file TTL, fallback LVP immediato); gate formale §109: 7/7 punti (3 città live, $0.0022-0.0034/cella, cache hit 1,5 ms, mai 5xx, caveat determinismo documentato) + QA visuale §112 in e2e + campionatura §110 (68,7% celle urbane coperte, NO-GO non innescato); resta aperto per v2: campionamento stabile Mapillary + classi detection |
 | Tile Budgets Live (città dense) | Completata (baseline `cd59f65`, committed) — TB-01..02: budget decode 30k feature/100k punti + fetch/decode coerenti (16 MiB), fixture tile Parigi z14; risultato in `docs/results/DENSE-TILE-BUDGETS-RESULT.md` |
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
   **Look poi sostituito** dal taxi GTA nella tranche G2D che segue.
 - Tranche **GTA 2D City (G2D-00..01)** completata il 2026-09-20 (commits
   `758255a` + `df5be7b`, docs `723deb7`; spec
   [gta-2d-city-v1](../specs/gta-2d-city-v1.md), ADR-013, ingresso esecutore
   `tasks/gta-2d/`): G2D-00 = quartiere di riferimento ripetibile (fixture
   X/T/Y/curva/vicolo + 7 palazzi, boot offline nell'harness, baseline a 3
   viewport con distinzione GPU/software —
   [GTA-2D-BASELINE](../results/GTA-2D-BASELINE.md)); G2D-01 = proporzioni
   taxi/strada/camera: sprite taxi GTA-style (asset con provenienza, 37x17 px
   a 640x480, `VEHICLE_VISUAL_SCALE` 3.0 → 1.2, sostituisce il look General
   Lee), strada 6 m = 48 px (≥ 2 larghezze auto), preset di guida ×6.0 come
   livello separato dallo zoom massimo, fix `changeZoom` (culling a far
   misurava con la scala del livello precedente). Risultato
   [GTA-2D-TAXI-PROPORTIONS-RESULT](../results/GTA-2D-TAXI-PROPORTIONS-RESULT.md).
   Prossima scheda: G2D-02 (prova della profondità prospettica degli edifici,
   GO/NO-GO).
  - Tranche **Zoom intermedio (overview → guida)** completata il 2026-09-21
    (commit `e2fc332`, ZI-01..03): il salto di zoom tra l'overview
    (×0.85) e il preset di guida (×6.0) era 7x; aggiunta la scala a 6 livelli
    `[0.7, 0.85, 2.25, 6.0, 12.0, 24.0]` con livello intermedio ×2.25 (mediana
    geometrica, passi <3x), default invariato sul preset di guida (ora livello
    3, fattore 6.0) e LOD 0-1 far / 2-3 medium / 4-5 near. Solo presentazione:
    fisica e streaming invariati. Risultato
    [INTERMEDIATE-ZOOM-RESULT](../results/INTERMEDIATE-ZOOM-RESULT.md).
  - Tranche **Nomi via leggibili + dedup (LB/ND/NN)** completata il 2026-09-21
    (commit `15c5f68`): label rasterizzate a 128px poi scalate in unità di
    mondo (altezza 42% della carreggiata, clamp 1.2–4 m, fit 80% lunghezza
    strada, bianco + contorno sottile); review del pipeline nomi (reperimento
    OK, difetto in assegnazione: un label per way OSM ma il nome è attributo
    della via) → dedup nel renderer per nome normalizzato (`labelTextKey`),
    vince la copia più vicina alla camera. Risultati
    [LEGIBLE-ROAD-LABELS-RESULT](../results/LEGIBLE-ROAD-LABELS-RESULT.md),
    [NO-DUPLICATE-LABELS-RESULT](../results/NO-DUPLICATE-LABELS-RESULT.md) e
    [ONE-NAME-PER-ROAD-RESULT](../results/ONE-NAME-PER-ROAD-RESULT.md).
   - Tranche **Veicolo: velocità -20% + divieto acqua** completata il
     2026-09-21 (commit `4e687b9`, WS-01..02): `VEHICLE_TUNING`
     top speed 84 → 67.2 m/s (~242 km/h) e inversa 14 → 11.2 m/s (solo i
     soffitti; accel/freno/grip/steer invariati); `compileRegion` emette ogni
     water **area** anche come collision shape poligonale → muro perimetrale
     Rapier (stesso meccanismo degli edifici): il veicolo non entra in mare,
     laghi o bacini; corsi d'acqua solo-a-linea esclusi (nessuna superficie
     compilata); `compilerVersion` bumpato a `v0-runtime-water-collision`
     per invalidare i chunk persistenti compilati senza i muri. Risultato
     [VEHICLE-WATER-SPEED-RESULT](../results/VEHICLE-WATER-SPEED-RESULT.md).
   - Tranche **Origine per nome del luogo (geocoding form)** completata il
     2026-09-21 (commit `9ea0062`, PN-01..04): nel form di avvio,
     tra Modalità e coordinate, il campo "Cerca un luogo" cerca su Nominatim
     (OSM) pinnato — debounce 400 ms, min 2 caratteri, ≤ 5 candidati in
     italiano, 1 richiesta in-flight con `AbortController`, cache LRU 32
     (solo successi), validazione per-candidato (lat ±90 / lon ±180, nome
     ≤ 256 char) con scarto dei non validi; la selezione (click, Enter,
     frecce, Esc) valorizza i campi lat/lon che restano editabili, "Avvia"
     invariato (contratto di avvio e consenso intatti); offline → campo
     disabilitato e zero richieste; testo candidati solo via `textContent`.
     Nuovo modulo puro `src/app/geocode.ts` (fetcher/timeout/budget
     iniettabili, errori tipizzati) + 17 unit test e 7 e2e (Nominatim e tile
     mockati via `page.route`; l'evidenza "gioco a Taranto" = il tile
     centrale richiesto all'avvio è `latLonToTile(lat, lon, 14)` del luogo
     scelto). Nuova riga "Richieste geocoding" in SECURITY.md. Spec
      [place-name-origin-v1](../specs/place-name-origin-v1.md), risultato
      [PLACE-NAME-ORIGIN-RESULT](../results/PLACE-NAME-ORIGIN-RESULT.md).
    - Tranche **Luogo corrente nella barra di stato** completata il 2026-09-21
      (commit `0433da1`, ZP-01..04): nello stato `ready` la barra di stato mostra
      il luogo corrente al posto di "Area pronta": reverse geocoding Nominatim
      (`/reverse` pinnato, stesso impianto errori/timeout/budget di `search`)
      innescato al cambio di zona (cella 1000 m in coordinate di mondo,
      intervallo minimo 5 s tra richieste, mai 2 in-flight, a riposo zero
      richieste; modulo puro `src/app/place-status.ts` con clock iniettabile);
      errore o "nessun dato" → si mantiene "Area pronta"/nome precedente
      (retry entro l'intervallo solo sui fallimenti), offline invariato,
      dispose nel teardown; e2e `tests/e2e/place-status.spec.ts` (tile MVT =
      byte del fixture Lecce, reverse mockato) + fixture condivisa
      `tests/fixtures/geocode-mock.ts` per gli 8 spec preesistenti col guard
      "nessuna chiamata esterna inattesa". Spec
      [current-place-name-v1](../specs/current-place-name-v1.md), risultato
      [CURRENT-PLACE-NAME-RESULT](../results/CURRENT-PLACE-NAME-RESULT.md).
      - Tranche **Location Visual Profiles (LVP)** completata il 2026-09-21
        (baseline `0433da1`; spec
        [OPEN-GTA-LOCATION-VISUAL-PROFILES-V1](../specs/OPEN-GTA-LOCATION-VISUAL-PROFILES-V1.md),
        ADR-014, risultato
        [LOCATION-VISUAL-PROFILES-V1-RESULT](../results/LOCATION-VISUAL-PROFILES-V1-RESULT.md)):
        la stessa pipeline assume identità visiva locale in base alla
        posizione — reverse geocoding strutturato (`addressdetails=1`) →
        `LocationContext` provider-neutral (`src/app/location-context.ts`,
        `PlaceTracker.location()`) → `VisualProfileResolver` (registry chiusa:
        default, italy, rome, france, paris; regole locality/country, città
        qualificate dal paese) → `VisualProfile` completo consegnato al
        renderer (`src/render/theme/`, helper puri, merge esplicito, seed
        deterministico FNV-1a su `featureId:profile.id`). Cambio tema =
        solo-presentazione (rebuild chunk caricati; niente refetch/fisica/
        camera/rete); `CompiledChunkV0` senza themeId; override di sviluppo
        `?theme=auto|default|italy|rome|france|paris`; fallback offline/errore
        = default o ultimo profilo valido. LVP-00..08 fatti (base commit
         `cd59f65`; LVP-08 nel commit del 2026-09-21); finding `featureId`
         MVT non stabile tra window documentato nel result (follow-up stable
         visual identity). **Gate visuale utente: GO**
         ([LVP-VALIDATION-RESULT](../results/LVP-VALIDATION-RESULT.md),
         confronto manuale `?theme=france` vs `?theme=rome`); LVP-07 =
         raffino palette France/Paris sulle osservazioni del gate (tetti
         piu vari, facciate cream/limestone/taupe, separazione roof/facade
         senza saturazione in piu; screenshot prima/dopo + controllo Rome
         invariato nel result); re-gate post-raffino GO su scena densa
         reale (4 temi, zero errori). LVP-08 (LVP-2, spec §56) = profilo
         `tokyo` (concreto/acciaio/carbone) che estende `default`, regola
         resolver JP + registry chiusa estesa a 6 id, TDD 3 RED → GREEN e
         **gate a tre famiglie rome/paris/tokyo VALIDATO** su geometria
         reale comune (distinguibili a colpo d'occhio) → "LVP architecture
         = validated". Next (dal gate): validazione manuale
         auto-resolution in viaggio, poi solo il Visual Profile Service.
       - Tranche **Tile Budgets Live (città dense)** completata il 2026-09-21
         (baseline `cd59f65`, TB-01..02): in live, guidando su città dense
         compariva "Risposta geografica troppo grande" — la causa non era il
         budget byte (tile reali < 1.1 MiB) ma i budget di decode
         (feature 10,000 / punti 50,000 contro i picchi misurati a Parigi
         centro 16,952 / 52,043) più un bug latente: `maxTileBytes` (16 MiB)
         non veniva applicato al decode. Opzioni provider
         `maxFeaturesPerTile`/`maxPointsPerGeometry` + un'unica sorgente di
         verità fetch/decode; config live 16 MiB / 30k / 100k; fixture del
         tile reale Parigi z14 + 2 regression test; verifica live reale su
         Parigi centro (ready, zero errori). Risultato
         [DENSE-TILE-BUDGETS-RESULT](../results/DENSE-TILE-BUDGETS-RESULT.md).
         Committed (commit del 2026-09-21).
         - Tranche **Visual Profile Service (VPS)** (spec
           [OPEN-GTA-VISUAL-PROFILE-SERVICE-V1](../specs/OPEN-GTA-VISUAL-PROFILE-SERVICE-V1.md),
           ADR-015): i profili OpenGTA possono essere generati da
           evidenza geografica reale (OSM + street imagery) con pipeline a
           4 strati mai fusi (OBSERVE/INTERPRET/COMPILE/SERVE): il
           vision/provider osserva (vocabolario chiuso + confidence), il
           VisualCatalog decide i colori veri, il ProfileCompiler (funzione
           pura, deterministica, senza timestamp/`Math.random()`) traduce
           famiglie pesate in `GeneratedVisualProfile extends
           VisualProfile`; catalogo semiato dai 6 profili LVP validati;
           low-confidence < 0.35 → parent (mai inventare); cache evidence e
           profile separate; il browser non parla mai ai provider. Slice
            offline VPS-00..07 **completata il 2026-09-21**: ADR + tipi
            evidence + 3 fixture Rome/Paris/Tokyo-like + catalogo minimum +
            compiler puro + celle spaziali (h3-js res 9, banda 300-700 m) +
            `EvidenceCache`/`ProfileCache` separate con chiavi spec §55 +
            OSM evidence collector (tag espliciti, confidenza
            classificati/osservati, OSM non taggato → parent LVP) + provider
            street-imagery (contratto neutro `StreetImageryProvider`,
            selezione deterministica §14 — mai 20 shot della stessa
            sequence, TestImageryProvider offline, MapillaryImageryProvider
            dietro `MapillaryClient` iniettato: nessuna credenziale/HTTP nel
            core, errori tipizzati per degradare a OSM-only→parent) +
            visual analyzer (contratto `VisualAnalyzer` 7 assi v1,
            validatore stretto dell'output modello: schema chiuso,
            vocabolari chiusi, clip 0..1, fallback `unknown`, mai output non
             validato, `TestVisualAnalyzer` + fixture `VisualObservation[]`
             §115 coerenti con le evidence fixture) + evidence aggregator
             (OSM + vision + detections → `VisualEvidenceProfile`: aggregazione
             pesata §36 con source trust per asse configurabile §130 — OSM
             esplicito > imagery > eredità §40, OSM non taggato mai priorità,
             tie esatto → fonte prioritaria; recency a bande §37, damping
             cluster spaziale 1/√k §38, densità union, coverage §39,
             `evidenceRevision agg:v1:a<rev>:<hash>` versionata §57/§116) +
             pipeline end-to-end offline `createVisualPipeline`
             (collect OSM + imagery → analyze → aggregate → compile → cache
             → serve; fixture OSM per città + pool campioni sulle fixture
             observations; cache value-cached per revisione §55-57 con
             no-shadowing; degrado per provider failure §80: OSM down →
             vision-only, imagery down → OSM-only, tutto down → parent LVP,
              mai throw; 3 città pairwise distinte e deterministiche)
              (`src/vps/`, 117/117 test) + hook dev `?vps=`; gate slice §140
              **GO** (3 profili generati distinti e coerenti su stessa
              geometria live Roma; unit 667/667, e2e 42+1 skip) + **VPS-10
              runtime API** (2026-09-22): `GET /v1/profile?lat&lon` su
              `service/` (Node TS nativo, zero dipendenze) — client
              Overpass live + client Mapillary sulle **API correnti**
              (`graph.mapillary.com`, Bearer, bbox; la v1 REST documentata
              non esiste più, recon 2026-09-22), cache file JSON TTL
              (§54 lvl 2-3, sopravvive al restart), token bucket rate
              limit, parent LVP per cerchi città → `THEME_BY_ID`,
              fallback LVP immediato (mai 5xx per provider), 400/404/CORS,
              `.env` locale gitignored + `.env.example`, fix core
              `surface=sett` (sampietrini live Roma); 36 test offline +
              1 regressione, **smoke live Roma: 200 generated da OSM +
              Mapillary reali, cobblestone 0.88**) + **VPS-11 modello
              vision** (2026-09-22): DeepSeek `deepseek-flash` dietro
              `VisualAnalyzer` (scelta host: nessuna GPU locale, ~$0.005/
              cella; `DEEPSEEK_API_KEY` opzionale, senza chiave resta
              OSM-only); **due quirk live verificati**: egress DeepSeek
              non raggiunge la CDN Mapillary → thumbnail scaricate dal
              servizio (guardie 8 MiB/content-type/30 s, memo in-memory)
              e inviate base64; thinking mode default ON →
              `thinking:{type:"disabled"}`; output sempre attraverso il
              validatore stretto §30 (malformata → fallback 0, servizio
              down → throw → degrado §80); `VisionStats` §107 in response
              (requests/analyzed/fallbacks/latenza/tokens/costo peak);
              **smoke live Colosseo: urbanCharacter historic-dense 0.927
              da 11/13 foto reali validate, 2 fallback validatore;
              Parigi 10/7 + OSM ok; cache hit 19 ms zero scritture**) +
              **VPS-12 coverage QA** (2026-09-22): 7 generazioni live
              (centro Piazza Navona, periferia, industriale, suburbano
              EUR, scarsa imagery terra + mare, vision model down con
              chiave invalida) — urbanCharacter corretto per categoria
              (historic-dense centro / **suburban** periferia+EUR), matrice
              fallback completa (OSM down / imagery assente / vision down /
              tutto assente → **mai 5xx**; mare: profilo generato identico
              al parent per tutti i colori); costi $0.0014-0.0045/cella
              con vision, $0 senza; cache hit ~19 ms zero scritture;
              **finding: copertura Mapillary patchy a granularità di
              cella** (4/6 celle a 0 img esatte, 27-29 nel km circostante,
              verificato con bbox esatti: rischio §110 da campionare al
              gate); `VisionStats.errors` (fallimenti di servizio ora
              misurati: {8 req/0 analyzed/8 errors/$0} col model down);
              gate: unit 725/725, build ok) —
              [VISUAL-PROFILE-SERVICE-V1-RESULT](../results/VISUAL-PROFILE-SERVICE-V1-RESULT.md).
              **Gate VPS v1 (spec §109)** (2026-09-22): **verdetto GO** —
              7/7 punti su 3 generazioni live (Roma/Parigi/Tokyo:
              45-48/51 campi distinti, 6-8 campi evidence-driven vs
              country theme, determinismo 50/53 con caveat documentato,
              $0,0022-0,0034/cella, cache hit 1,5 ms, mai 5xx) + QA
              visuale §112 in e2e dedicato (rendering visibilmente guidato
              dal layer VPS: 9,1%/12,9% vs soglie 4%/7%, rumore 0,00%) +
              campionatura §110 (griglia h3 217 celle raggio ~5 km:
              **68,7%** copertura, in calo verso l'anello esterno; NO-GO
              "imagery insufficiente" non innescato: celle senza dati →
              profilo identico al parent, by design). Caveat: l'API
              Mapillary restituisce set di campioni diversi a ogni
              chiamata (mitigato dalla cache TTL 7 gg; v2: campionamento
              stabile). Resta aperto: ri-verifica classi detection
              Mapillary con la doc ufficiale. VPS enhances, LVP
              guarantees.
     - Resto aperto (fuori scope RV, da dettagliare): DATA-15..18 (PMTiles PoC,
    custom tile schema ADR, riuso cache compilata, curated region package).
     - Commits del 2026-09-21 (in ordine): `4e687b9` (feat WS), `0433da1`
       (feat ZP), `e2ccb41` (docs: result/log/spec/SECURITY delle due tranche),
       `4ea7d92` (docs: allineamento plan/todo/handoff/README allo stato G2D
       taxi + result doc G2D-01),        `f5594a8` (feat VPS-00..03 slice offline +
       gate), `c4505da` (feat VPS-04 celle spaziali + cache), `e8eec21`
        (feat VPS-05 OSM evidence collector), `70933ce` (feat VPS-06
        provider street-imagery), `076ce41` (feat VPS-07 visual analyzer),
        `879dde1` (feat VPS-08 evidence aggregator), `cb8b29d`
        (feat VPS-09 end-to-end offline Rome/Paris/Tokyo), `8f26607`
        (feat VPS-10 runtime API `GET /v1/profile`), `1a64b08`
        (feat VPS-11 DeepSeek vision analyzer), `4575347`
        (feat VPS-12 `VisionStats.errors`), `c003d43` (docs VPS-12
        coverage QA) + commit VPS-GATE-V1 (e2e QA visuale §112 + docs gate
        GO, questo documento).
    - Baseline stabile per test utente: commit `0433da1` (geocoding del form
      di avvio + luogo corrente nella barra di stato; su base `9ea0062`
      origine per nome del luogo, `15c5f68` nomi via leggibili + dedup,
      `e2fc332` zoom intermedio, `758255a`/`df5be7b` taxi GTA G2D-00/01,
      `4e687b9` velocità -20% + muri acqua, fisica `28fe0ee`, look GTA
      `bc635c6` + label acque `475dbae`; gate verde: 491 test unitari, 38 E2E
      + 1 canary skipped, typecheck e build verdi);
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
