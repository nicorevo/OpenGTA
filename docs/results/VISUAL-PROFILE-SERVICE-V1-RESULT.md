# Visual Profile Service — slice offline VPS-00..07 + gate (2026-09-21)

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
- Gate completa (dopo VPS-07): `typecheck` pulito; unit **639/639**
  (baseline 550 + 19 + 17 + 11 + 23 + 19); `build` ok (warning chunk size
  preesistente); e2e **42 passed + 1 skipped** (canary) — identico alla
  baseline.
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

**GO** — la slice offline (VPS-00..07) è completa: evidence, catalogo,
compiler, celle spaziali, le due cache, il collectore OSM, il layer
street-imagery (contratto + selezione + provider di test + adapter
Mapillary) e il layer di analisi (contratto + validatore stretto + test
analyzer + fixture) sono pronti e testati; la pipeline
evidence→catalogo→profilo è dimostrata end-to-end con dati OSM sintetici e
il lato imagery è pronto per l'aggregazione. Prossime tranche (roadmap
spec): VPS-08 aggregator (OSM + vision + detections → `VisualEvidenceProfile`
con source trust e confidenza, spec §104/§130), VPS-09 end-to-end
Rome/Paris/Tokyo (spec §105) e poi VPS-10 runtime API (`GET
/v1/profile?lat&lon` sopra le cache qui definite, `MapillaryClient` HTTP
server-side con credenziali, modello vision server-side, rate limit,
verifica classi detection/licensing sull'API corrente, e2e del flow). Se un
gate futuro fallisse: degrado a recommender paese/città (§110-111), mai
blocco del client.
