# Location Visual Profiles v1 — identità visiva locale automatica

Data: 2026-09-21. Persona: fullstack-developer.
Stato: completato + verificato (working tree, non ancora commitata).
Spec: `docs/specs/OPEN-GTA-LOCATION-VISUAL-PROFILES-V1.md`.
ADR: `docs/adr/ADR-014-location-visual-profiles.md`.
Baseline: `0433da1`.

## Obiettivo

Far sì che il look del mondo cambi con il luogo (Roma ≠ Parigi ≠ altrove)
senza aggiungere un servizio: la reverse geocoding strutturata (già presente
per il nome nella barra di stato) alimenta un resolver puro che sceglie un
`VisualProfile` dal set chiuso {default, italy, rome, france, paris}; il
renderer Pixi applica il profilo come **cambio solo-presentazione**: nessuna
geometria, fisica, chunk o camera viene toccata, e non c'è mai refetch.
Override di debug `?theme=<id>` (registry chiusa; `auto`/invalido = auto).

## Cosa è cambiato

- `src/app/location-context.ts` (nuovo, puro):
  - `LocationContext` = {latitude, longitude, countryCode?, country?, region?,
    locality?, district?, source: "nominatim", placeId?, displayName?} —
    provider-neutral, il renderer non conosce Nominatim;
  - `normalizeCountryCode`: trim + uppercase + `/^[A-Z]{2}$/` (scarta i junk);
  - `toLocationContext`: mapping puro del payload strutturato, nessun import da
    `geocode.ts` (anti-cycle).
- `src/app/geocode.ts`:
  - `ReverseGeocodeResult` estende `GeocodeCandidate` con i 5 campi
    opzionali dell'indirizzo;
  - `reverse()` ora con `addressdetails=1`; `parseAddress` (puro, exportato)
    con priorità: region = `state` > `region`; locality = `city` > `town` >
    `village` > `municipality`; district = `city_district` > `borough` >
    `suburb` > `neighbourhood`; payload senza `address` = candidato puro.
- `src/app/place-status.ts`: `PlaceTracker.location()` ritorna l'ultimo
  `LocationContext` valido (mantenuto su fallimento/nessun dato: niente
  flicker del tema); contratto retro-compatibile.
- `src/render/theme/` (nuovo modulo puro, zero Pixi):
  - `types.ts`: `VisualProfile` schemaVersion 1 (ground{base,water,land},
    roads{base,classes,sidewalk,markings}, buildings{roofPalette,
    facadePalette,typeStyles,outline,depth2d}, identity{4 famiglie});
  - `hash.ts`: `stableStringHash` FNV-1a 32-bit (deterministico, nessuna
    dipendenza, niente `Math.random`);
  - `merge.ts`: `mergeVisualProfile(parent, patch)` — parent immutabile, map
    per-chiave, palette sostituite (mai concatenate), palette vuote → throw,
    nuova road class/typeStyle deve essere completa → throw;
  - `profiles/`: `default` (baseline del renderer **verbatim**: ogni valore è
    l'ex costante hardcoded; `ground.base` = tono di fondo viewport 0x91a477),
    `italy` (warm: oliva/sabbia, tetti terracotta, facciate crema/ocra,
    ombre calde), `rome` (da italy: più sabbia, marciapiedi travertino,
    terracotta più forte), `france` (cool: verde-grigio, asfalto grigio,
    facciate calcare/taupe, tetti zinco/lamiera, ombre morbide), `paris`
    (da france: tetti zinco dominanti, facciate crema chiare, selce chiara);
  - `resolver.ts`: registry chiusa `THEME_BY_ID`/`knownThemeIds`;
    gerarchia **forzato valido** > locality (IT: roma/rome; FR: paris/parigi,
    sempre qualificata da countryCode) > region (registry vuota, pronta) >
    country (IT→italy, FR→france) > default; `normalizeLocationToken`
    (trim/lowercase/collapse ws/diacritici, no fuzzy); forzato invalido →
    auto, mai throw;
  - `override.ts`: `themeOverrideFromSearch(search, validThemeIds)` — solo id
    della registry chiusa (case/whitespace normalizzati), `auto`/vuoto/altro →
    undefined: nessun URL/path/iniezione possibile;
  - `index.ts`: helper puri `groundFill(profile, kind, cls)`,
    `roadStyle(profile, cls)`, `buildingStyle(profile, cls, seed)` (tipizzati
    pinned, generici `seed % palette.length`).
- `src/render/pixi/renderer.ts`:
  - `createPixiRenderer(canvas, options?: { visualProfile? })` (default =
    defaultProfile); il background viewport = `ground.base` del profilo;
  - `setVisualProfile(profile)`: stesso id = **no-op**; id diverso = rebuild
    solo-presentazione dei chunk già compilati (pattern `applyTier`) + tono di
    fondo; mai refetch, mai fisica/camera/posa;
  - `visualProfileId()` per HUD/debug;
  - palette hardcoded rimossa: ground/roads/sidewalk/markings/buildings
    chiedono al profilo; outline edificio tematizzato (`drawPolygon` guadagna
    6° parametro opzionale, compatibilità test);
  - seed edificio = `stableStringHash(featureId + ":" + profile.id)`: lo stesso
    edificio mantiene la variante dentro il profilo e può variare al cambio
    profilo, senza casualità a runtime; `positionSeed` resta (wrapper su
    `stableStringHash`) per il fixture sintetico gta-city.
- `src/app/bootstrap.ts`:
  - resolver creato una volta per sessione; `?theme=` letto una volta
    (registry chiusa) e il profilo iniziale passato alla creazione del
    renderer (i primi chunk nascono già tinti);
  - `syncVisualTheme()` nel tick 200 ms: resolve sull'ultimo `location()`
    valido, applica solo se l'id cambia (no-op renderer, zero flicker);
  - `__opengtaV0Debug.theme()` = {id, location} per HUD/e2e.
- `src/render/pixi/renderer.test.ts`: i test palette ora usano gli helper
  theme su `defaultProfile` (stesse asserzioni, baseline invariata);
  `tests/fixtures/gta-city.ts`: commento + `GTA_CITY_SEED_POLICY` aggiornati.

## Comportamento

- Avvio online a Roma → barra di stato "Roma, …" + mondo tinto profilo
  rome; Parigi → profilo paris; altra città IT → italy; altra FR → france;
  altrove → default. Cambio zona → cambio tema fluido, senza reload.
- `?theme=paris` (valide: default/italy/rome/france/paris) vince su tutto,
  anche offline (nessun geocoding); `?theme=bogus` o `?theme=auto` →
  risoluzione automatica, nessun crash.
- Reverse 500 / nessun dato → il tema corrente resta (nessun fallback a
  default a metà sessione, niente flicker).
- Offline: zero richieste al geocoder; il tema forzato funziona comunque.

## Verifica

- TDD per task: RED → GREEN a ogni step.
  - LVP-01: `location-context.test.ts` nuovo + 6 test `geocode.test.ts`
    (addressdetails=1, parsing, priorità) + 3 test `place-status.test.ts`
    (`location()`) → 48/48 nei 3 file.
  - LVP-02: `merge.test.ts` (12): immutabilità parent, merge per-chiave,
    completezza nuovi tipi, guard palette vuote, hash deterministico,
    baseline default verbatim.
  - LVP-03: `resolver.test.ts` (17) + `override.test.ts` (7): tutti i casi
    spec (IT/FR, Roma/Rome, Paris/Parigi, US+Paris → default, città senza
    paese → default, forzato > auto, forzato invalido → auto, diacritici,
    registry esatta) + determinismo seed/varianti + helper.
  - LVP-04: `renderer-theme.test.ts` (7) con fake PixiJS (contatore Graphics +
    colore background): default/creazione con profilo, no-op stesso id,
    rebuild 7 Graphics/chunk al cambio id, conteggi e camera invariati,
    chunk trattenuti (re-set no-op), switch A-B-A stabile (no leak), posa
    veicolo intatta.
  - LVP-05: `tests/e2e/location-visual-profiles.spec.ts` (4): offline
    `?theme=paris` senza geocoding; registry completa + `bogus`/assente →
    default senza pageerror; open world con reverse mock strutturato
    (country_code it, city Roma) → tema rome + `addressdetails=1` nel
    request; reverse 500 → tema default mantenuto, stato ready.
- Gate: `npm run test:run` **548/548** (64 file); `npm run typecheck` pulito;
  `npm run build` verde; `npm run test:e2e` **42 passed + 1 canary skipped,
  0 failed** (baseline 38 + 4 nuovi); `git diff --check` pulito.
- Validazione visiva (dev server effimero, offline, stessa geometria del
  fixture Lecce, 1280×720, zero pageerror):
  - `/tmp/opengta-lvp-paris.png` — asfalto grigio cool, terreno verde-grigio,
    acqua blu-grigia, selce chiara, tetti zincati (sha256 `b0aedea0…`);
  - `/tmp/opengta-lvp-rome.png` — asfalto caldo, terreno olivo-sabbia,
    terracotta, facciate ocra (sha256 `93725931…`);
  - `/tmp/opengta-lvp-default.png` — baseline invariata (sha256 `220c90fe…`).
  - Hash distinti + ispezione visiva: le tre identità sono distinguibili,
    geometrie/strade/taxi identici (solo-presentazione confermato).
- Validazione live (rete disponibile al momento della verifica, 1 richiesta
  ciascuna, UA dichiarata): Nominatim `reverse?addressdetails=1` a Roma
  (41.9028, 12.4964) restituisce `country_code: "it"`, `city: "Roma"`,
  `state: "Lazio"`, `suburb: "Municipio Roma I"` → parsing → `rome`; a Parigi
  (48.8566, 2.3522) restituisce `country_code: "fr"`, `city: "Paris"`,
  `city_district: "Paris"` → parsing → `paris`. Entrambe le catene
   endpoint→resolver→tema verificate.
- **Gate visuale utente (GO)**: confronto manuale `?theme=france` vs
  `?theme=rome` sulla stessa geometria Lecce → esito **GO** ("la stessa
  geometria assume due identità chiaramente differenti"; Rome più espressivo,
  France ancora "troppo cartografica"). Registro completo:
  `docs/results/LVP-VALIDATION-RESULT.md` (scritto dal committente).
- **Raffino France/Paris (step 1 del gate utente, "stabilizzare LVP")**:
  per France i tetti ora spaziano da ardesia scura a zincato chiaro con
  voci calde e fredde, le facciate mescolano cream/limestone/taupe con più
  gamma tonale (senza saturazione in più); Paris con la stessa direzione,
  più fredda. Stesso setup offline 1280×720, rendering deterministico:
  - France: prima `5841872e…` → dopo `3779246c…`
    (`/tmp/opengta-lvp-france-{before,after}.png`);
  - Paris: prima `b0aedea0…` → dopo `adcdedc9…`
    (`/tmp/opengta-lvp-paris-{before,after}.png`);
  - Rome (controllo): invariato al byte `93725931…`.

- **Re-gate visuale del raffino France/Paris (GO)**: scena densa reale in live
  (centro Roma, z14 tile 8759/6088, 674 edifici / 170 strade, endpoint
  OpenFreeMap senza mock, 1280×720, zero pageerror, `runtime.errors = {}`
  su tutti e 4 i temi). Stessa geometria, sola variabile il `?theme=`
  forzato:
  - `/tmp/regate-default.png` (sha256 `25783e0a…`) — baseline neutra;
  - `/tmp/regate-rome.png` (`44929f09…`) — calda, terracotta/ocra;
  - `/tmp/regate-france.png` (`84e74b65…`) — raffino visibile: non più resa
    piatta (slate + oliva + cream con gamma tonale);
  - `/tmp/regate-paris.png` (`fc3f43b8…`) — la più chiara, zincato
    azzurro uniforme.
  Esito: le 4 identità sono distinguibili a colpo d'occhio. Coppia più debole
  france/paris (stessa famiglia cool, separate in luminosità e dalla
  variazione oliva presente solo in france); se un'iterazione futura lo
  richiederà, France può essere spinta verso un limestone più caldo-neutro.

## Estensione LVP-2 — Terzo profilo (tokyo) e gate a tre famiglie

Spec §56. `tokyo` estende `default` direttamente: terza famiglia visiva
**concreto/acciaio/carbone** — tetti carbone/ardesia scura (i più scuri di
tutti i profili), facciate grigi concreti con voci steel-blue e accento
off-white, asfalto scuro freddo, acqua blu profondo, ombre più marcate
(`shadowAlpha 0.20`). Resolver: `JP` + locality `tokyo` → `tokyo`; altre
città JP (es. Osaka) → `default`; `Tokyo` senza country qualificante →
`default`; `?theme=tokyo` sulla registry chiusa estesa (6 id).

- TDD: 3 test RED (JP+Tokyo, registry, catena di eredità) → GREEN
  (36/36 in `src/render/theme`); e2e registry esteso (`?theme=tokyo`
  offline applica il tema senza geocoding).
- **Gate a tre famiglie (step 4 del gate utente): VALIDATO** — stessa
  geometria reale (centro Roma, live, 674 edifici / 170 strade, zero
  errori, zero pageerror):
  - `/tmp/family-rome.png` (sha256 `44929f09…`) — calda, terracotta;
  - `/tmp/family-paris.png` (`fc3f43b8…`) — chiara, zincato azzurro;
  - `/tmp/family-tokyo.png` (`3e5c4d7d…`) — scura, carbone/acciaio.
  Le tre famiglie sono distinguibili a colpo d'occhio: il sistema non
  funziona solo con la coppia calda/fredda europea.

## Limiti noti / follow-up (non incluso)

- **featureId MVT non stabile tra window**: l'id del building
  `mvt:building:<sourceId>#h<index>` porta un indice per-assemblea, quindi la
  stessa sagoma può ricevere varianti cromatiche diverse passando da un
  chunk all'altro. In v1 è accettato (spec 15.2: uso + documento); follow-up
  dedicato a una visual identity stabile (es. hash del sourceId + baricentro
  quantizzato) prima di ogni tema "a tema forte".
- La registry region è vuota (solo country/locality); la struttura è pronta.
- `identity.*` (famiglie asset) è un hook semantico: nessun asset caricato in
  LVP, per design.
- `depth2d` è riservato alla direzione 2D+ (OpenGTA 2D+): il renderer MVP non
  ne consuma i campi.
- Il first-person renderer ha palette proprie: out of scope LVP (il tema
  copre solo la vista top-down, come la spec).
- Backlog raccomandato dal gate utente
  (`docs/results/LVP-VALIDATION-RESULT.md`), in ordine:
  1. re-gate visuale del raffino France/Paris — **fatto (GO, qui sopra)**;
  2. validazione auto-resolution end-to-end (già coperta da e2e con mock;
     manca il gate visuale manuale su città reali in viaggio);
  3. un terzo profilo molto diverso — **fatto (`tokyo`, LVP-2)**;
  4. validazione di tre famiglie visuali — **fatta (VALIDATO, qui sopra)**;
  5. solo dopo, avvio del `Visual Profile Service` (VisualEvidenceProfile →
     VisualCatalog → ProfileCompiler → fixtures → Mapillary → Vision →
     runtime service) — **prossimo**.
