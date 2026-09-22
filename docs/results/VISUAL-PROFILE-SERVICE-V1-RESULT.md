# Visual Profile Service — slice offline VPS-00..09 + VPS-10 runtime API + VPS-11 modello vision + VPS-12 coverage QA + gate (2026-09-21/22)

Branch `opcl-location`. Spec: `docs/specs/OPEN-GTA-VISUAL-PROFILE-SERVICE-V1.md`
(§140: primo esperimento = 3 profili evidence manuali → compiler → rendering;
§152: gate offline prima di qualsiasi provider). Decisioni: `docs/adr/ADR-015-visual-profile-service.md`.

## Cosa è stato consegnato

- **VPS-00** — ADR-015 + allineamento `docs/SPEC.md`, `docs/adr/README.md`,
  `tasks/plan.md`, `tasks/todo.md`, `docs/handoff/CURRENT.md`.
- **VPS-01** — `src/vps/evidence/`: tipi provider-neutral con vocabolari
  chiusi (8 dimensioni di `Distribution<T>`), `SpatialCell` (contratto, H3 non
  esposto), `VisualEvidenceProfile`; 3 fixture offline Rome/Paris/Tokyo-like
  (`evidenceRevision: fixture-v1`, cell `vps-fixture-{rome-historic,
  paris-central, tokyo-dense}`). La fixture rome replica l'esempio spec §85
  (ocra dominante, terracotta-tile 0.63).
- **VPS-02** — `src/vps/catalog/`: `VisualCatalog` revision 1 con i minimi
  spec §138 (4 facade / 4 roof / 3 road / 4 sidewalk / 3 vegetation /
  3 furniture), semiato dai 6 profili LVP validati: i colori veri vivono solo
  qui (§47). Decisione: `cool-zinc` taggato solo `cool-grey` (con i tag
  extra batteva `cream-stone` su Parigi, 0.88 vs 0.68).
- **VPS-03** — `src/vps/compiler/`: `ProfileCompiler` puro (nessun DOM,
  network, provider, timestamp, `Math.random`):
  - famiglie pesate → palette concrete (§50-51): slot i, centro
    `(i+0.5)/8`, copertura cumulativa dei pesi normalizzati, variante
    `stableStringHash("<profileId>:roof:<i>") % n`;
  - confidenza categoria < 0.35 → valore parent LVP (§68; banda 0.35–0.60
    rinviata, §70);
  - id versionato `vps:v1:<cellId>:c<compilerRevision>` (§53; cellId senza
    due punti);
  - `generatedAt` = `retrievedAt` dell'evidence: il compiler resta puro, il
    service timbra la sua wall-clock al cache-write (§116);
  - decisione v1 documentata: roads (base+classes), ground base/water,
    typeStyles, outline, depth2d, markings ereditano il parent — il material
    della superficie stradale non determina la tint OpenGTA, quella è
    art direction LVP; le `roadFamilies` del catalogo restano versionate per
    una revisione compiler successiva;
   - hook dev `?vps=rome|paris|tokyo` in `src/app/bootstrap.ts` (registro
     chiuso, ignora silenzioso di id sconosciuti, stessa disciplina di
     `?theme=`): compila la fixture sul parent risolto da LVP, quindi la
     gerarchia di fallback generated → LVP → default è preservata e il
     renderer non blocca mai il client.
- **VPS-04** — `src/vps/cell/` + `src/vps/cache/`: `cellForCoordinates`
  (h3-js, res 9) e le due cache separate §56 (`EvidenceCache`,
  `ProfileCache`) con chiavi §55. Dettaglio nella sezione VPS-04 qui sotto.
- **VPS-05** — `src/vps/osm/`: OSM evidence collector puro
  (`collectOsmEvidence`). Dettaglio nella sezione VPS-05 qui sotto.
- **VPS-06** — `src/vps/providers/street-imagery/`: contratto
  `StreetImageryProvider` + selezione immagini deterministica +
  `TestImageryProvider` + `MapillaryImageryProvider` (dietro client
  iniettato). Dettaglio nella sezione VPS-06 qui sotto.
- **VPS-07** — `src/vps/analysis/`: contratto `VisualAnalyzer` +
  validatore stretto dell'output modello + `TestVisualAnalyzer` + fixture
  `VisualObservation[]`. Dettaglio nella sezione VPS-07 qui sotto.
- **VPS-08** — `src/vps/aggregate/`: `aggregateEvidence` (puro,
  OSM + vision + detections → `VisualEvidenceProfile`) + source trust per asse
  configurabile. Dettaglio nella sezione VPS-08 qui sotto.
- **VPS-09** — `src/vps/pipeline/` + `src/vps/osm/city-fixtures.ts`:
  pipeline offline end-to-end `createVisualPipeline` (collect → analyze →
  aggregate → compile → cache → serve) su Rome/Paris/Tokyo con coordinate
  note di test + fixture OSM sintetiche per città. Dettaglio nella sezione
  VPS-09 qui sotto.
- **VPS-10** — `service/` (fuori dal bundle browser, §82-83): runtime API
  `GET /v1/profile?lat&lon` su Node (TS nativo, zero dipendenze): client
  Overpass live, client Mapillary sulle API correnti (recon 2026-09-22),
  cache file JSON con TTL (§54 livelli 2-3), token bucket rate limit,
  fallback LVP immediato, config da `.env` locale (gitignored) +
  `.env.example`, script `npm run service`; fix core `surface=sett`
  (sampietrini reali di Roma). Dettaglio nella sezione VPS-10 qui sotto.
- **VPS-11** — `service/vision/`: modello vision server-side
  (DeepSeek `deepseek-flash`) dietro il contratto `VisualAnalyzer` +
  misurazione costo/latenza in response (spec §107). Dettaglio nella
  sezione VPS-11 qui sotto.
- **VPS-12** — coverage QA live (spec §108): 5 tipi di area + matrice
  fallback verificate; finding copertura patchy a granularità di cella;
  `VisionStats.errors` in `service/vision/`. Dettaglio nella sezione
  VPS-12 qui sotto.

## VPS-04 — celle spaziali + cache

- **Dipendenza**: `h3-js` (binding ufficiali H3). Nota: il pacchetto npm
  `h3` è la lib HTTP di Hono, **non** Uber H3 — il nome corretto è `h3-js`.
  Il contratto pubblico resta `SpatialCell` (§10): l'id è una stringa opaca
  `h3:<index>` e il codice non espone l'indice H3 altrove.
- **Risoluzione**: res 9. Misurato con il build h3-js in uso: bounding box
  ~413 m N-S / ~374 m E-W a 42°N → dentro la banda MVP 300-700 m (§12).
  (Res 8 misurerebbe ~1060 m: fuori banda; res 10 ~150 m: troppo fine.)
- **Celle**: deterministiche (stesse coordinate → stessa cella, sempre),
  punto ∈ bounds, ~50 m di offset restano nella stessa cella, le 3 città
  delle fixture + Lecce su celle distinte, validazione `RangeError` per
  lat/lon fuori range o non finiti. Limitazione MVP documentata: le bounds
  sono la scatola assiale dell'esagono, celle che attraversano l'antimeridiano
  (±180°) non supportate.
- **Cache** (in-memory pure, spec §54): `EvidenceCache` chiave
  `cell:<id>|schema:<v>|evidence:<rev>` (l'evidence non dipende da
  compiler/catalogo — §56: ricompilare non invalida l'analisi) e
  `ProfileCache` chiave `cell:<id>|schema:<v>|compiler:<c>|catalog:<k>`
  (esempio spec §55): nuovo catalogo o compiler → miss → ricompilazione,
  evidence intatta. Nuova revisione evidence non shadowing la precedente
  (§57). Persistenza/TTL sono concern del service (VPS-10), non del core.
- **Pipeline** (flusso §11): test end-to-end lat/lon → cell id → evidence
  cache → compiler → profile cache; la seconda richiesta alla stessa
  cella è servita interamente dalle cache (stessi riferimenti d'oggetto).
- Niente cambio bootstrap/hook: `?vps=` resta fixture-based; le celle
  servono il service (VPS-10) quando arriverà l'evidence reale per cella.

## VPS-05 — OSM evidence collector

- **Input neutro** (`OsmNode`/`OsmWay`/`OsmArea` = tags + size): il core
  non vede payload di provider; il service (VPS-10) trasforma i risultati
  Overpass/query in queste feature minime. Validazione al confine
  (`RangeError` su size non finiti/negativi).
- **Mapping solo tag espliciti** (spec §7/§40): `building:material` →
  materiali, `building:colour` → classi colore (mappa ristretta
  conservativa), `roof:material` + `roof:shape=flat` → tipi tetto
  (roof_tiles → terracotta-tile, come nell'esempio spec §41),
  `surface` su highway → asfalto/cotto/pavé/ghiaia/terra, `surface` su
  footway → pavimentazioni pedonali. Valori tag non riconosciuti: non
  classificati, mai tirati a indovinare.
- **Confidenza = classificati/osservati per categoria**: OSM non taggato
  (caso reale più comune) → confidenza 0 < 0.35 → il compiler ricade sul
  parent LVP (spec §40/§42). Pesi geometrici (area edificio, lunghezza
  via): un grande edificio taggato prevale su tanti piccoli non taggati.
- **Cosa OSM non asserisce mai** (documentato): vegetazione climatica
  (mediterranean/temperate/… → vision, spec §130), carattere urbano
  historic/modern, stile del furniture — quelle distribuzioni restano a
  confidenza 0. OSM asserisce solo la PRESENZA/ASSENZA di verde: cella con
  dati OSM ma < 2% di area verde → `sparse`.
- **Densità osservate** (spec §92-93): alberi/panchine/bloccacarri/luci/
  parcheggi contati dai tag (`natural=tree`, `amenity=bench`,
  `barrier=bollard`, `lighting=street`, `parking=*`) con saturazione
  `1 - exp(-count/10)` (guida stilizzata, non conteggio 1:1).
- **Determinismo/provenance** (spec §57/§116/§117): `evidenceRevision` =
  `osm:v1:<hash-canonical(input)>` (stesso input → stessa revisione →
  stesso profilo); `retrievedAt` iniettato dal service, mai generato dal
  core; `coverage` riporta requested/usable samples, copertura spaziale,
  `directionalCoverage` 0, `imageryConfidence` 0, `osmConfidence` = media
  delle 5 confidenze categorie, `overall` = media imagery+osm.

## VPS-06 — provider street-imagery

- **Contratto neutro** (spec §5): `StreetImageryProvider.sample(area,
  options, retrievedAt) → StreetSampleBatch`; tutto il resto del VPS dipende
  solo da questa interfaccia, mai da Mapillary. `retrievedAt` iniettato come
  dappertutto: il core resta senza wall-clock. `StreetSample`/
  `EvidenceProvenance`/`ProviderDetection` come da spec §15-16/§32.
- **Selezione deterministica** (`selectStreetSamples`, spec §13-14): pura e
  order-independent. Raggio di campionamento (baseline 400 m), dedup
  (stesso `sourceId` una volta; posizione+heading quasi identici una volta,
  vince il più recente), recency relativa al pool (nessun orologio: il
  riferimento è la capture più recente del pool), poi due passate greedy:
  (1) spread spaziale 30 m + spread heading 45° + cap **3 heading per
  posizione** (baseline §14 "5-10 posizioni × 2-3 heading" — mai 20 shot
  consecutivi della stessa sequence), (2) riempimento con le posizioni
  migliori rimanenti (solo vincolo spaziale). Cap `maxSamples` (baseline
  20-30). Costanti esportate: `MIN_POSITION_SPREAD_M`,
  `DEFAULT_HEADING_SPREAD_DEG`, `MAX_HEADINGS_PER_POSITION`.
- **`TestImageryProvider`** (spec §5/§82): pool sintetico deterministico
  (anello di 12 campioni seedato da `area.id`, nessun `Math.random`, nessuna
  immagine — solo dati, spec §17/§140) oppure pool iniettato; `pool`
  undefined → ring, `pool` esplicito (anche vuoto) → campionato quel pool.
  È il provider con cui il service (VPS-10) può far girare l'intera
  pipeline offline.
- **`MapillaryImageryProvider`** (spec §102): adapter `area → sample
  batch`, nessun analyzer (ancora). Parla solo con un `MapillaryClient`
  iniettato: il client è l'unico strato con credenziali/HTTP/rate limit
  (spec §82-83, server-side in VPS-10; il browser non ci arriva mai).
  L'adapter: valida i ref (id/coordinate finite; response non-array o tutti
  i ref invalidi → `invalid-response`), li mappa in `StreetSample` con
  provenance piena (§16: `sourceId`, `sourceUrl`, `capturedAt`,
  `attribution` "Mapillary contributors", `retrievedAt`), applica
  `selectStreetSamples`, e attacca le detections **solo sui campioni
  selezionati** (mai download indiscriminato, §8). Le classi detection
  provider-specific sono mappate su classi canonical con tabella documentata
  e **passthrough delle classi ignote** (mai assunte, mai perse, spec
  §31-32; la tabella va ri-verificata sull'API corrente in VPS-10).
- **Degradazione** (spec §80): i failure noti escono come
  `StreetImageryProviderError` tipizzato (`rate-limited` / `unavailable` /
  `auth` / `invalid-response`) — il client li getta, l'adapter li
  ri-getta; gli errori sconosciuti del client vengono wrappati in
  `unavailable`. Un fallimento delle detections di una singola immagine
  degrada a "nessuna detection" per quell'immagine (l'evidenza imagery
  resta valida). Il service (VPS-10) tradurrà l'errore in OSM-only
  evidence → parent LVP: il servizio risponde sempre.
- **Nessuna assunzione legale codificata** (spec §17): il campo `license`
  della provenance resta `undefined` — va fornito dal service dopo
  verifica; il provider resta disattivabile (bastano `TestImageryProvider`
  o OSM-only).

## VPS-07 — visual analyzer

- **Contratto** (spec §18): `VisualAnalyzer.analyze(sample) →
  Promise<VisualObservation>`; l'output principale è strutturato, mai testo
  libero. `VisualObservation` (spec §19) + `ClassificationResult<T>` con
  confidenza 0..1 (§20). **Scope v1 = 7 assi** (spec §103: facade color,
  facade material, roof type, sidewalk type, road surface, vegetation
  character, urban character) — `streetFurnitureCharacter` resta nello
  schema ma è fuori scope v1 e il validatore la **rifiuta** se presente.
- **Validatore stretto** (`validateVisualObservation`, spec §30/§78): il
  modello non è mai accettato di fiducia —
  - schema chiuso: campi extra → rifiuto dell'intero payload (niente
    accettazione parziale); `streetFurnitureCharacter` in v1 = campo extra;
  - vocabolari chiusi: un valore non presente nel vocabolario → rifiuto
    (il modello non inventa categorie, §21);
  - `sampleId` obbligatorio e **deve coincidere** con il `sourceId` del
    campione analizzato (nessuna osservazione orfana o spostata);
  - assi ben formati: esattamente `{value, confidence}`, confidence numero
    finito → clippato 0..1 (§20); `quality` obbligatorio, clippato;
  - limite di dimensione del payload serializzato (16 KB, §78);
  - qualsiasi deviazione → **fallback `unknown`** (§30): nessun asse,
    `quality: 0`, provenance del campione. Un'analisi fallita non inquina
    l'aggregazione: l'aggregator (VPS-08) salta le osservazioni a quality 0.
  - puro e deterministico: la provenance viene dal campione (mai orologio),
    stesso raw + stesso sample → stessa osservazione.
- **`TestVisualAnalyzer`**: analyzer offline deterministico (equivalente
  analyzer del `TestImageryProvider`). Le osservazioni grezze per
  `sampleId` sono conservate **non validate a scopo**: passano dallo stesso
  validatore dell'output di un modello live, quindi la pipeline offline
  esercita esattamente il path di validazione reale. Risoluzione: map
  esplicita → funzione → fallback. `ANALYZER_REVISION = 1` (spec §57/§116:
  l'analisi fa parte dell'identità dell'evidence, un nuovo analyzer cambia
  le osservazioni e deve comparire in `evidenceRevision`).
- **Fixture `VisualObservation[]`** (spec §115): provider-independent,
  niente immagini (licensing), 2 osservazioni per famiglia (rome-historic /
  paris-central / tokyo-dense) con dominanti coerenti con le evidence
  fixture VPS-01 (ocra/terracotta/historic-dense; crema/zinc/historic-
  medium; scuro/modern-dense). I `sampleId` sono valori di contratto
   stabili che l'aggregator (VPS-08) e l'e2e (VPS-09) consumeranno.
 - **Modello vision reale**: fuori dal core, server-side in VPS-10 (come il
   client Mapillary): qui esiste il contratto, il validatore e il test
   analyzer — il modello HTTP/VLM non entra mai nel browser (§82).

## VPS-08 — evidence aggregator

- **Contratto**: `src/vps/aggregate/types.ts` — `AggregationInput` (cell,
  `osmEvidence?`, `observations`, `samples?`, `requestedSamples`,
  `retrievedAt` iniettato), `AggregatorOptions` (trust/recency/raggio
  cluster sovrascrivibili), `DEFAULT_SOURCE_TRUST` per asse (spec §130:
  OSM 1.0 su roof/material/facade-colour, imagery 0.8-0.9; vegetation OSM
  0.6 vs imagery 0.8; streetFurniture 0.6/0.8 — v1: streetFurniture è
  OSM-only), `DEFAULT_RECENCY_BANDS` (§37: <2y 1.0, 2-5y 0.85, 5-8y 0.65,
  >8y 0.45; data mancante → 1.0 neutro, mai punire),
  `DEFAULT_SPATIAL_CLUSTER_METERS=30`, `VISION_CONFIDENCE_SAMPLE_CAP=2`,
  `AGGREGATOR_REVISION=1`. `aggregateEvidence` puro (nessun clock: recency
  relativa a `retrievedAt` iniettato), `createEvidenceAggregator(options?)`
  per la pipeline VPS-09/10.
- **Aggregazione per asse** (spec §33-42):
  - *vision*: weight = `confidenza × quality × recency × spaziale` per
    osservazione (quelle a quality 0 — fallback — non contribuiscono); i pesi
    per classe si normalizzano in una distribuzione; confidenza vision =
    `dominanza² × min(1, n/CAP)`: un pareggio tra due classi è evidenza
    debole e più foto concordi non rendono la classe più vera;
  - *blend*: `W_osm = confidenza_OSM × trust.osm(asse)`,
    `W_vis = confidenza_vision × trust.vision(asse)`; score e confidenza
    combinati = media pesata. Conseguenze verificate: OSM-only e vision-only
    passano invariati; OSM non taggato (conf 0) non ha mai priorità su una
    foto chiara; tag OSM esplicito (conf 1.0) resta dominante anche contro
    2 foto in conflitto (0.5556 > 0.5, spec §40-41); **tie esatto → vince la
    fonte prioritaria (OSM, §40)**;
  - *recency* §37: bande configurabili, vecchio ≠ invalido;
  - *spaziale* §38: weight `1/√k` con k = numero di campioni a < raggio
    cluster (30 m) — 8 foto nello stesso punto pesano come 1 isolata +
    damping, mai 20 shot della stessa sequence.
- **Densità** (spec §92-93): union OSM∪detections (`1-(1-a)(1-b)`), map
  `{tree, bench, bollard, street-light}`; **decisione documentata: `vehicle`
  non conta come parcheggio** (in un'immagine stradale le auto sono in
  prevalenza in movimento).
- **Coverage** §39: `usableSamples` (osservazioni quality > 0),
  `spatialCoverage` = max(OSM, griglia 4×4 dei campioni),
  `directionalCoverage` = 4 quadranti di 90°, `imageryConfidence` = media
  delle confidenze vision sui 7 assi, `osmConfidence` da
  `osmEvidence.coverage`, `overall` = media delle fonti presenti.
- **Identità**: `evidenceRevision = agg:v1:a<ANALYZER_REVISION>:<hash8>` su
  canonical deterministico (cell, revisione OSM, osservazioni e campioni
  ordinati, requested, opzioni attive) — deterministico, sensibile
  all'input, `retrievedAt` esclusa (spec §57/§116). `provenanceSummary`:
  provider uniti ordinati (OSM + provider dei campioni), `sampleCount`,
  finestra `earliest/latestCapturedAt` dai campioni, `retrievedAt` iniettato.
- **Test**: 16 in `aggregate.test.ts` (vision-only §42, OSM-only passthrough,
  OSM esplicito > vision §40/41, OSM non taggato mai priorità, recency,
  damping cluster, trust per asse che capovolge un asse in conflitto,
  union densità, vehicle escluso, coverage direzionale, fallback zero,
  revisione deterministica/versionata/sensibile, provenance,
  order-independence, input vuoto ben formato, sum~1 su 3 città).

## VPS-09 — end-to-end offline Rome/Paris/Tokyo

- **Pipeline**: `src/vps/pipeline/pipeline.ts` — `createVisualPipeline(deps).run(cell, retrievedAt)`:
  composizione pura delle layer già esistenti (nessun network/credenziale/
  wall-clock nel core): `osmSource(cell) → OsmCellFeatures` (iniettato;
  fixture offline qui, client Overpass server-side in VPS-10) →
  `collectOsmEvidence`; `imagery.sample(cell, {radiusMeters: 400,
  maxSamples: 24}, retrievedAt)` (§13) → `analyzer.analyze` per campione
  (il contratto valida l'output: un analyzer che lancia degrada al fallback,
  la pipeline mai); `aggregateEvidence`; le due cache §55;
  `compiler.compile` sul parent LVP risolto (`resolveParent` iniettato).
  `diagnostics` per run: stato delle fonti, campioni richiesti/analizzati,
  hit delle due cache.
- **Fixture per città** (`src/vps/osm/city-fixtures.ts`,
  `OSM_CITY_FEATURES`): celle sintetiche plausibili — Roma: tegole su
  muratura ocra/gialla + sampietrini (~4% verde, sopra la soglia di
  sparsità); Parigi: tetti zincati (tag `metal`) su pietra crema, asfalto,
  verde centrale < 2%; Tokyo: scatole flat-concrete grigie/scuri
  (concrete/glass), asfalto, quasi zero verde → `sparse`. Coordinate note di
  test §105: Roma 41.8992/12.4769, Parigi 48.8566/2.3522, Tokyo
  35.6762/139.6503. I pool di campioni usano i `sampleId` delle fixture
  observations VPS-07 (contratto stabile §115): 2 campioni matched (raw
  senza `provenance` — il modello non la produce, §30) + 2 unmatched
  (passo fallback §78), con detections su uno.
- **Comportamenti verificati** (12 test, `pipeline.test.ts`):
  - chain completa per città: Rome → roof `terracotta-tile` / facade
    `ochre` / character `historic-dense` (OSM+vision d'accordo); Paris →
    facade `cream` / roof `metal` / `historic-medium` / vegetation
    `temperate-urban` (blend §40: tag OSM espliciti vincono, vision
    concorda); Tokyo → roof `flat-concrete` / facade `cool-grey` /
    `modern-dense` / vegetation `sparse` (vision 2 osservazioni in conflitto
    → confidenza bassa, OSM vincente);
  - profili generati **pairwise distinti** (spec 109.1) e deterministici
    (deep-equal su due run fresche, stessa `evidenceRevision`);
  - **cache** (spec 55-57): secondo run → `evidenceCacheHit` +
    `profileCacheHit`, oggetti identici per riferimento; un'evidence run
    nuova (input cambiato) → revisione diversa, recompile (ma mai
    reanalyze), **no-shadowing** (entrambe le revisioni in cache);
    un profilo in cache è servito solo se compilato dalla stessa
    revisione evidence;
  - **degrado provider** (spec 80, 110-111): OSM down → vision-only
    (`providers: ["test-imagery"]`, `osmConfidence 0`, profilo comunque
    generato); imagery down → OSM-only (`imageryConfidence 0`); tutto down →
    `overall 0`, confidenza 0, profilo = parent LVP completo (facade/roof/
    ground/roads ereditati), **mai throw**;
  - fallback observations (quality 0) non inquinano: profilo identico (salvo
    revisione run, che per definizione cambia con campioni diversi) a
    quello senza i campioni unmatched; `usableSamples 2/4`.
- **Decisioni documentate**:
  - le cache restano value-cache chiavi revisione (spec 55); l'indice di
    freschezza servizio-livello (cella → revisione corrente, TTL,
    persistenza — livelli 2-3 di spec 54) è una responsabilità di VPS-10:
    il core non decide "quando ri-collegire", solo cosa vale una data
    revisione;
  - `imageryConfidence` della coverage = confidenza della parte **vision**
    dell'aggregazione (fix VPS-09: con l'aggregatore v1 usava la
    confidenza blendata, e una cella OSM-only forte la riportava
    erroneamente alta);
  - il "render" della chain §105 è coperto dalla completezza del profilo
    generato (niente `undefined` nei campi renderizzati) + il gate §140 già
    eseguito con i profili compilati; l'hook `?vps=` passerà sulla pipeline
    in VPS-10 quando arriverà il serve HTTP.
 
## VPS-10 — runtime API `GET /v1/profile` (2026-09-22)

- **Riconoscenza API live (bloccante, prima di scrivere il client)**: la v1
  REST documentata nella spec **non esiste più** — `api.mapillary.com` è
  NXDOMAIN (dominio ora su `ns.facebook.com`), e la nuova API è
  `https://graph.mapillary.com` (infra Meta) **senza** prefisso `/v1`:
  - auth: `Authorization: Bearer <credentiale>` (il `MLY|…` del pannello
    funziona come token; il param `client_id` legacy non viene più accettato);
  - ricerca: `GET /images?bbox=w,s,e,n&limit=N` (o `lat&lng&radius` con
    **radius ≤ 50 m** — il bbox copre l'intera cella in una chiamata);
  - item: `{ id, geometry: {type:"Point", coordinates:[lon,lat]},
    compass_angle?, captured_at? (epoch ms), thumb_2048_url? }`;
  - errori: JSON `{ error: { message, type:"MLYApiException", code } }`
    (429 → rate-limited, 401/403 → auth, altro → unavailable);
  - **detections**: l'API allega id di object ma non espone le label con i
    campi sondati → per spec §31-32 (mai assumere classi) `fetchDetections`
    risolve `[]`: degradazione a "no detections", da ri-verificare quando
    uscirà la documentazione ufficiale della nuova API;
  - i campi `camera_params`/`seq`/`tags` legacy sono ignorati silenziosamente.
- **`service/`** (Node ≥ 23.6 con type stripping nativo, zero dipendenze,
  nessun nuovo package):
  - `env.ts` — `parseEnvFile` + `loadConfig` puri: default come
    `.env.example`; client id mancante o placeholder → throw fail-fast
    (mai chiamate non autenticate);
  - `rate-limit.ts` — token bucket (burst = perMinute, refill lineare,
    clock iniettabile);
  - `file-cache.ts` — `createFileValueCache`: file JSON per chiave
    (sha256 troncato), TTL con clock iniettabile, write atomiche
    (tmp+rename), file corrotto → miss (mai crash);
  - `overpass-source.ts` — `createOsmSource({endpoint, fetchImpl?,
    rateLimiter?})`: query Overpass con il **vocabolario esatto del
    collector** VPS-05 (highway/surface/lighting/parking; building ways e
    relations; landuse/natural/leisure verdi; tree/bench/bollard), POST
    form-URL `data=` + User-Agent; mapping elementi → `OsmCellFeatures`
    con geometrie reali: lunghezza way (somma segmenti equirettangolare),
    area edificio single-way chiuso e multipolygon (ring esterno, shoelace
    equirettangolare; gli inner ring non contano); elementi senza tag
    scartati; errore HTTP o corpo non-JSON → throw (la pipeline VPS-09
    degrada la cella a vision-only, §80);
  - `mapillary-client.ts` — `createMapillaryClient`: l'unico layer con la
    credenziale (§82-83); bbox dall'area (fallback raggio se bounds
    degeneri), mapping item live → `MapillaryImageRef` (geometry
    `[lon,lat]`, `captured_at` ms → ISO), entry malformate scartate,
    errori mappati su `StreetImageryProviderError` tipizzato (la
    `MapillaryImageryProvider` VPS-06 consuma invariata);
  - `server.ts` — `createProfileHandler`: `GET /v1/profile?lat&lon` →
    400 coordinate, 404 path, altrimenti cella → **fast path §54 lvl 3**
    (entry servizio con TTL su disco: profilo+evidence+diagnostics serviti
    **senza rete** finché freschi) → pipeline VPS-09 con i client reali →
    200 `{source:"generated"|"cache", profile, evidence, diagnostics}`;
    eccezione → 200 `{source:"lvp", profile: parent}` (spec §106:
    fallback LVP immediato, mai 5xx per un provider); parent = cerchio di
    città (Roma 12 km / Parigi 12 km / Tokyo 20 km) → `THEME_BY_ID`
    (approx v1 del geocoding LVP, che resta client-side); CORS
    `access-control-allow-origin: *` per il dev browser;
  - `startServer` + main (`node service/server.ts`, `.env` locale con
    process-env vincente); `.env` gitignored, `.env.example` committed,
    `.vps-cache/` gitignored.
- **Fix core da dati live**: `surface=sett` → `cobblestone` nel collector
  OSM (le strade storiche di Roma sono mappate `sett`, non
  `cobblestone` — verificato su Overpass centrale Roma); regressione
  dedicata. Refactor strip-compatibilità: `StreetImageryProviderError`,
  `GeoDataSourceError`, `PbReader` da parameter-properties a campi
  espliciti (identici nel comportamento; Node strip-only non supporta le
  prime e il servizio importa il primo).
- **Comportamenti verificati** (36 test offline, fetch finto, zero rete):
  rate limit (burst + refill + clock logico), file cache (round-trip,
  persistenza tra istanze, TTL, file corrotto → miss, clear), env
  (parse, default, override, fail-fast su placeholder, non-numerici),
  overpass (forma query + bounds 6dp + header, mapping nodes/ways/areas
  con lunghezze/aree, 429/500 → throw, non-JSON → throw, rate limiter),
  mapillary (URL bbox/limit/fields + Bearer + UA, mapping item live,
  entry malformate, `[]`, 429/401/403/500 → kind tipizzati, fetch down /
  non-JSON, `fetchDetections → []`, rate limiter), server (200 generated
  con entrambe le fonti ok, cache senza re-fetch, **restart → cache da
  disco con 0 fetch**, Mapillary 500 → OSM-only 200, Overpass+Mapillary
  500 → parent LVP (facade/roof/ground/roads = LVP, Tokyo → tokyo),
  pipeline che lancia → `lvp`, 400 coordinate, 404 path).
- **Smoke test live (2026-09-22, quota free-plan minima)**: `npm run
  service`, cella Roma 41.8992/12.4769 → **200 generated** in 17 s:
  `osm: ok`, `imagery: ok` (7/24 campioni Mapillary reali, 2019-2025),
  `roadSurfaces` dominante **cobblestone 0.88** (dai `sett` reali),
  `osmConfidence 0.23`, `generation.confidence 0.43` (roads da OSM, resto
  parent rome — OSM romano scarsamente taggato sui tetti, comportamento
  corretto §40); seconda richiesta → `source:"cache"`; 400/404/CORS ok.

## VPS-11 — modello vision server-side (DeepSeek) + misurazione §107 (2026-09-22)

- **Scelta del modello (decisa con l'utente)**: DeepSeek
  `deepseek-flash` — l'unico modello vision dell'API DeepSeek
  (`deepseek-v4-pro` non supporta la visione), OpenAI-compatible su
  `https://api.deepseek.com`, tassi ~$0.15/$0.60 per M token (off-peak)
  → **~$0.005 per cella** (10-13 immagini). Alternativa locale
  esclusa: nessuna GPU in locale (30 GB RAM/8 core → minuti per
  immagine). La chiave va solo in `.env` (gitignored); senza chiave il
  servizio resta OSM-only (comportamento VPS-10 invariato).
- **`service/vision/deepseek-analyzer.ts`** — `createDeepSeekAnalyzer`
  implementa `VisualAnalyzer` (contratto VPS-07): `thinking:
  {type:"disabled"}` (vedi quirk 2), `temperature: 0`,
  `response_format: {type:"json_object"}`, `detail: "low"` (512×512,
  sufficiente per materiali/colori), system prompt con i 7 assi e i
  vocabolari chiusi **importati da `AXIS_VOCABULARIES`** del validatore
  (esportato a VPS-11: zero drift tra ciò che il modello è autorizzato a
  dire e ciò che viene accettato, spec 21).
- **Due quirk live verificati (bloccanti, scoperti allo smoke)**:
  1. **L'egress dei server DeepSeek non scarica le URL della CDN
     Mapillary** (400 "Failed to download image"; wikimedia anch'essa
     inaffidabile, `gstatic` ok) → le thumbnail sono scaricate **dal
     nostro servizio** (`fetch` con timeout 30 s, guardia
     `content-type: image/*`, cap 8 MiB, memo in-memory 24 voci condivisa
     tra generazioni: una via che attraversa due celle scarica ogni
     immagine una volta) e inviate come **base64 data URL**. Niente
     persistenza a disco delle immagini (spec 17: nessuna assunzione di
     licenza codificata).
  2. **Thinking mode ON di default**: `deepseek-flash` ragiona prima di
     rispondere e bruciava l'intero budget di completion →
     `content: null` → i 6/6 campioni del primo smoke morivano in
     "malformed envelope". Con `thinking:{type:"disabled"}` il JSON esce
     diretto (e `temperature` diventa efficace).
- **Semantica errori (spec 30/78/80)**: risposta del modello malformata
  (non-JSON, fuori vocabolario, campo extra, `sampleId` mismatch) →
  **fallback observation** (quality 0, mai throw, mai inquinare
  l'aggregazione); fallimento di servizio (rete, 4xx/5xx, immagine
  irrecuperabile, envelope non valido) → **throw** → la pipeline VPS-09
  degrada il campione/cella: modello morto = "no vision", mai "wrong
  vision".
- **Misurazione §107**: l'analyzer è creato per generazione (stats
  per-request) con rate limiter e image memo condivisi; `VisionStats`
  (`requests`, `analyzed`, `fallbacks`, `totalMs`, `promptTokens`,
  `completionTokens`, `estimatedCostUsd` a tassi **peak** USD/M = 0.30/
  1.20, upper bound conservativo) è nella response
  (`body.vision`) e persistita nell'entry servizio → presente anche
  sulla risposta `cache`.
- **Comportamenti verificati** (15 test offline, fetch finto: immagine +
  modello su un solo iniettato): forma request (Bearer, json mode,
  thinking disabled, vocabolari nel prompt, data URL con detail low),
  validazione (clamp confidenze, provenance dal campione, assi assenti),
  memo (stessa URL → 1 download per N campioni), fallback (non-JSON,
  fuori vocabolario, campi extra, `sampleId` mismatch, immagine
  assente → zero rete), throw (immagine 404 → nessuna request contata,
  content-type non-image, byte cap, 429/500, envelope malformato 4
  forme), rate limiter (1 acquire per request), stats (tokens/durata/
  costo), baseUrl/model custom.
- **Smoke test live (2026-09-22)**:
  - cella Colosseo (41.8902/12.4922, mai generata): **200 generated** in
    38 s — `vision: 13 requests, 11 analyzed, 2 fallbacks, 10.5 s,
    8194/1691 tokens, $0.0045`; `urbanCharacter` **historic-dense 0.927**
    (confidenza 0.86) dalle 11 foto reali; palette facciate/tetti nella
    famiglia ocra/terracotta (coerente col centro di Roma); in quella run
    OSM è fallito (Overpass pubblico instabile) → degrado §80 corretto
    (roads ereditate dal parent rome, `imageryConfidence 0.43`);
  - cella Parigi (48.8566/2.3522): **200 generated** in 44 s — `vision:
    10/7`, `osm: ok` + `imagery: ok`, `urbanCharacter historic-dense
    0.21`, coverage overall 0.49;
  - **cache**: seconda richiesta → `source:"cache"` in **19 ms, zero
    scritture**, `vision` identico (persistito con l'entry);
  - i 2/13 fallback del Colosseo = risposte del modello rifiutate dal
    validatore stretto: comportamento by design (§30), mai accettate.

## VPS-12 — Coverage QA (spec §108) + matrice fallback (2026-09-22)

- **Metodo**: 7 generazioni live dal servizio (Roma, DeepSeek attivo) sui 5
  tipi di area della spec + 1 scenario "model down". Per le celle a 0
  immagini è stata verificata contro l'API Mapillary la copertura sul bbox
  **esatto della cella h3** (non sul km circostante), per distinguere
  "copertura assente" da "copertura altrove".
- **Risultati per categoria**:
  | Categoria | Cella | Source | Vision | Evidenza chiave | Costo |
  | :--- | :--- | :--- | :--- | :--- | :--- |
  | Centro città | Piazza Navona `h3:891e805052fffff` | generated | 4 req / 3 ok / 1 fb | `historic-dense`; 23 img in cella → 4 selezionate (cap di diversità §14: mai 20 shot della stessa sequence) | $0.00155 |
  | Periferia | Tor Bella Monaca +1 `h3:891e80570bbffff` | generated | 5/5 | `urbanCharacter` **suburban** ✓, road asphalt, img conf 0.43 | $0.00142 |
  | Industriale | Valle Tiburtina +1 `h3:891e8052847ffff` | generated | 6/4 / 2 fb | `historic-dense` — la cella è sull'edge del tessuto antico e le 4 foto valide mostrano edilizia residenziale: accettabile (§113: nessun errore grosso), non industriale perché i capannoni stanno nella cella adiacente senza copertura | $0.00227 |
  | Suburbano/planned | EUR `h3:891e8051d7bffff` | generated | 7/7 | **suburban** ✓; `osm: failed` → roads ereditate dal parent (degrado §80 corretto) | $0.00199 |
  | Scarsa imagery (terra) | verso Mentana `h3:891e8056633ffff` | generated | 0/0 | 0 img nella cella esatta (verificato all'API); `osm: failed`; profilo dominato dal parent | $0 |
  | Scarsa imagery (estremo, mare) | Tirreno `h3:891e80590a3ffff` | generated | 0/0 | 0 img (mare); profilo generato **identico al parent** su tutti i colori (sky/ground/road/building/accent/ambient): nessun break visivo senza dati | $0 |
- **Finding chiave (rischio §110)**: la copertura Mapillary a granularità di
  cella (h3 res 9 ≈ 500 m) è **patchy**: 4 delle 6 celle iniziali avevano 0
  immagini nella cella esatta pur avendo 27-29 immagini nel km circostante
  (verificato con bbox esatti). La copertura è polarizzata su centro e
  zone turistiche. Mitigazione by design: il parent/LVP mantiene un profilo
  valido ovunque (VPS enhances, LVP guarantees) — il NO-GO "imagery
  insufficiente in gran parte delle aree" va ripreso al gate §109 con una
  campionatura statistica, non con 6 celle.
- **Matrice fallback (tutte verificate live, mai un 5xx)**:
  - OSM down (EUR, rurale): 200 generated, imagery + parent;
  - imagery assente (mare, rurale, periferia/industriale originali): 200
    generated, OSM + parent, `imageryConfidence 0`;
  - **vision model down** (seconda istanza del servizio con chiave DeepSeek
    invalida): 200 generated, `vision {requests 8, analyzed 0, fallbacks 0,
    errors 8, tokens 0, cost $0}`, roads da OSM (cobblestone), img conf 0 —
    "modello morto = no vision, mai wrong vision" (§80) ora misurabile;
  - tutto assente (mare): profilo ≈ parent (verificato per campo);
  - coordinate invalide: 400 (test offline VPS-10).
- **Gate §109 — validazione parziale live**: (1) città distinte:
  historic-dense (centro) vs suburban (periferia/EUR) ✓; (2) utile > country
  theme: il centro aggiunge cobblestone + historic-dense + palette dalle
  foto ✓; (3) determinismo: pipeline deterministica a parità di input
  (VPS-09); il provider live può restituire set di immagini diversi tra
  chiamate (13/8/10 sullo stesso Colosseo) → revisioni diverse,
  comportamento documentato e atteso; (4) costi: $0.0014-0.0045/cella con
  vision, $0 senza immagini ✓; (5) cache: hit ~19 ms, zero scritture, corpo
  identico (verificato periferia) ✓; (6) provider failure: tutte le righe
  sopra → 200 ✓; (7) coerenza stile OpenGTA: palette nel vocabolario theme,
  parent come base ✓ (la QA visuale §112 in-browser resta al gate).
- **Cambio di codice**: `VisionStats.errors` (deepseek-analyzer): i
  fallimenti di servizio (download immagine, rete, 4xx/5xx, corpo non-JSON,
  envelope malformato) ora incrementano `errors`; `fallbacks` resta per le
  risposte del modello rifiutate dal validatore. Invariante: `requests =
  analyzed + fallbacks + (chiamate finite in errore)`. 7 asserzioni sui 15
  test esistenti (nessun nuovo test: il contatore entra nei casi già
  coperti). Unit 725/725, typecheck, build ok.

## Test

- VPS-00..03: **19** (evidence 6, catalog 4, compiler 9): validità fixture,
  minimi catalogo + seed deep-equal da LVP + risolvibilità dei dominanti
  delle fixture, palette per città, distinzione 3 famiglie, determinismo
  (deep-equal + JSON), low-confidence → parent, completezza del
  `GeneratedVisualProfile` (id/versioni/confidenza, nessun `undefined`),
  ereditarietà campi non coperti, override `?vps=` (closed registry).
- VPS-04: **17** (cell 8, cache+pipeline 9): contratto `SpatialCell`,
  determinismo cella, stabilità a ~50 m, 3 città distinte, punto ∈ bounds,
  banda 300-700 m, altre risoluzioni, validazione coordinate; formato chiavi
  §55, round-trip cache, miss su nuovo compiler/catalogo (recompile senza
  reanalyze), no-shadowing revisioni evidence, pipeline lat/lon→cell→cache.
- VPS-05: **11**: cella vuota → tutto a confidenza 0; cella "rome-like" →
  dominanti attesi (terracotta-tile/ochre/brick/cobblestone/pavers) e
  pesi geometrici (0.8/0.2 tiles/flat, confidenza 23/27); OSM non taggato
  → confidenza 0 (no priorità alta, spec §40); verde < 2% → sparse, verde
  alto → nessun claim di carattere; densità saturate e bounded;
  determinismo + revisione sensibile all'input; coverage spec §39;
  validazione confini; end-to-end OSM→compiler: `roof_tiles` → famiglia
  `terracotta-urban` (spec §41) e cella non taggata → parent LVP (spec §42).
- VPS-06: **23** (sampling 8, test-provider 6, mapillary 9): raggio
  maxSamples/dedup, "mai 20 shot della stessa sequence" (cap per posizione),
  directional spread, recency nella finestra preferita, determinismo +
  order-independence, pool vuoto; test-provider deterministico (due run →
  stesso batch), radius filter, seed per area, pool iniettato; mapillary:
  mapping ref→`StreetSample` con provenance piena e `license` undefined,
  heading normalizzato 0-360, detection note→canonical + passthrough
  classi ignote + score fuori range scartato, detections solo sui
  selezionati, per-image failure → no detections, errori tipizzati
  propagati/wrappati, `invalid-response` (non-array, tutti i ref invalidi),
  ref invalidi filtrati, cap maxSamples senza duplicati.
- VPS-07: **19** (validate 11, test-analyzer + fixtures + wiring 8):
  payload completo accettato, clip confidence/quality, payload parziale
  (assi assenti restano assenti), valore fuori vocabolario → rifiuto,
  campo extra / `streetFurnitureCharacter` → rifiuto dell'intero payload,
  `sampleId` mismatch → rifiuto, payload non-oggetto (stringa/array/null/
  numero) → rifiuto, quality mancante / confidence non numerico / asse
  malformato → rifiuto, payload oltre il limite di dimensione → rifiuto,
  forma del fallback (nessun asse, quality 0, provenance campione),
  determinismo; test-analyzer: clamp attraverso il validatore, fallback per
  sample sconosciuto, raw invalido senza bypass, forma funzione +
  determinismo; fixture: passano il validatore, dominanti coerenti con le
   evidence fixture VPS-01, confidenze/quality in 0..1; wiring
   TestImageryProvider→TestVisualAnalyzer con catena di provenance intatta.
- VPS-08: **16**: vision-only (dominanti dalle osservazioni, campi OSM
  vuoti, §42), OSM-only passthrough invariato, OSM esplicito > vision in
  conflitto (roof terracotta 0.5556 > 0.5, §40/41), OSM non taggato mai
  priorità, recency (vecchia pesa meno, mai zero, §37), damping cluster
  (8 co-located < 8 sparse, concorrente lontano visibile, §38), trust per
  asse che capovolge un asse in conflitto (default mantiene OSM, §130),
  union densità OSM∪detections (§92-93), vehicle escluso da parkedVehicle,
  coverage (2 quadranti di 90° → 0.5, 1 quadrante → 0.25, §39), osservazioni
  fallback (quality 0) nulle, `evidenceRevision` deterministica +
  `^agg:v1:a1:[0-9a-f]{8}$` + sensibile all'input, provenance summary
  (provider, count, finestra dai campioni), order-independence, input vuoto
  ben formato (non lancia, non inventa), sum~1 su 3 città.
- VPS-09: **12**: chain completa per città (dominanti attesi Rome/Paris/
  Tokyo, provenance completa, `usableSamples 2/4`, id/revisioni corrette,
  cache popolate), profili pairwise distinti (spec 109.1), determinismo
  deep-equal su due run, secondo run dalle cache (oggetti identici per
  riferimento), no-shadowing (2 revisioni in cache, recompile su revisione
  nuova), OSM down → vision-only, imagery down → OSM-only, tutto down →
  parent LVP completo (mai throw), fallback senza inquinamento (profilo
  identico salvo revisione run), fixture observations = contratto stabile
  §115.
- VPS-10: **36** (rate-limit 5, file-cache 5, env 5, overpass-source 6,
  mapillary-client 8, server 7 — tutti offline con fetch finto) + **1**
  regressione core (`sett` → cobblestone).
- VPS-11: **21** (deepseek-analyzer 15, env deepseek 4, server vision
  2 — tutti offline con fetch finto: download immagine + chiamata modello
  sullo stesso iniettato).
- Gate completa (dopo VPS-09): `typecheck` pulito; unit **667/667**
  (baseline 550 + 19 + 17 + 11 + 23 + 19 + 16 + 12); `build` ok (warning
  chunk size preesistente); e2e **42 passed + 1 skipped** (canary) —
  identico alla baseline.
- Gate completa (dopo VPS-10, 2026-09-22): `typecheck` pulito; unit
  **704/704** (667 + 36 service + 1 regressione `sett`); `build` ok
  (stesso warning preesistente); e2e **42 passed + 1 skipped** — invariato
  (il servizio è fuori dal bundle browser; i refactors core strip-compat
  non cambiano comportamento).
- Gate completa (dopo VPS-11, 2026-09-22): `typecheck` pulito; unit
  **725/725** (704 + 21 VPS-11); `build` ok; e2e **42 passed + 1
  skipped** — invariato (l'analyzer vive solo in `service/`, fuori dal
  bundle browser; l'unica modifica core è l'export addittivo di
  `AXIS_VOCABULARIES` da `validate.ts`).
- Gate completa (dopo VPS-12, 2026-09-22): `typecheck` pulito; unit
  **725/725** (stesso conteggio: `VisionStats.errors` entra nei 15 test
  analyzer già esistenti, 7 asserzioni aggiunte); `build` ok; e2e non
  rieseguita (nessuna modifica core: solo `service/vision/`, fuori dal
  bundle browser — l'ultima e2e verde 42+1 è del commit VPS-11).
  Nota: `runtime-session.test.ts > drives a long looped route…` è un flake
  preesistente sotto carico della suite piena (test di timing ~5,7 s):
  nessun riferimento a vps/h3, 3/3 verde in isolamento, ricorre solo a suite
  completa (stesso pattern del flake 549/550 già documentato).

## Gate della slice (spec §140)

Geometria live Roma (lat 41.8992, lon 12.4769), 1280×720, dev server
effimero. Sei rendering, stessa geometria (strade/taxi/etichetta identici),
solo variabile il profilo applicato (verificato via
`window.__opengtaV0Debug.theme().id`):

- LVP (cura): `/tmp/vps-gate-rome-lvp.png` (sha256 `5304282e…`),
  `/tmp/vps-gate-paris-lvp.png` (`140d3e14…`),
  `/tmp/vps-gate-tokyo-lvp.png` (`d5ed0476…`);
- VPS generati (`vps:v1:vps-fixture-…:c1`):
  `/tmp/vps-gate-rome-vps.png` (`16a89ce7…`) — ocra/terracotta calda;
  `/tmp/vps-gate-paris-vps.png` (`dab69412…`) — zincato azzurro + facciate
  crema;
  `/tmp/vps-gate-tokyo-vps.png` (`fa895b5a…`) — carbone + acciaio, la più
  scura.

Esito: le 3 famiglie **generata** restano distinte a colpo d'occhio e
semanticamente coerenti (caldo romano / zincato parigino / scuro tokyota);
il rome generato è coerente con il rome curato LVP, come atteso perché il
catalogo è semiato da LVP. Zero pageerror sui tre casi VPS; un 504 transitorio
dell'endpoint OSM sul caso rome-lvp (fallback mirror, stato `ready`).

## Esito

**GO** — la slice offline (VPS-00..09), la **runtime API (VPS-10)**, il
**modello vision server-side (VPS-11)** e la **coverage QA (VPS-12)** sono
completati: evidence,
catalogo, compiler, celle spaziali, le due cache, il collettore OSM, il
layer street-imagery (contratto + selezione + provider di test + adapter
Mapillary), il layer di analisi (contratto + validatore stretto + test
analyzer + fixture), l'aggregator (OSM + vision + detections →
`VisualEvidenceProfile` con source trust per asse, spec §104/§130), la
pipeline end-to-end (spec §105, con degrado per provider failure §80) e il
servizio `GET /v1/profile` (spec §106: client Overpass + Mapillary live +
analyzer DeepSeek live con credenziali server-side §82-83, cache file TTL
§54 livelli 2-3, rate limit, fallback LVP immediato, parent per cerchi
città) sono pronti e testati, con smoke test live su Roma e Parigi
(profili generati da OSM + foto reali: cobblestone 0.88 dai `sett`,
`urbanCharacter historic-dense 0.927` da 11 foto del Colosseo,
~$0.005/cella). **Note operative**: la Mapillary v1 REST non esiste più —
il client parla la nuova API `graph.mapillary.com` (Bearer, bbox) e
`fetchDetections` risolve `[]` (id object senza label) in attesa della
documentazione ufficiale (spec §31-32: mai assumere classi); l'egress
DeepSeek non raggiunge la CDN Mapillary → thumbnail in base64 scaricate
dal servizio (guardie 8 MiB/content-type/30 s, memo in-memory); il
thinking mode è disabilitato (bruciava il budget di completion).
Prossima tranche (roadmap spec): **Gate VPS v1 (spec §109)** —
validazione formale dei 7 punti + QA visuale §112 in-browser; resta
aperto il re-verify delle classi detection Mapillary quando esce la doc
ufficiale della nuova API. **Attenzione al gate**: la copertura Mapillary
è patchy a granularità di cella (VPS-12) — il punto §110 "imagery
insufficiente in gran parte delle aree" va misurato con una campionatura
statistica prima di dichiarare GO. Se un gate fallisse: degrado a
recommender paese/città (§110-111), mai blocco del client.
