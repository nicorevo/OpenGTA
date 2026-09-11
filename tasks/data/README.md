# Esecuzione dei task DATA (Provider-Neutral World Streaming)

Data: 2026-09-11. Stato: linea principale completata (DATA-00..14, checkpoint D-A/D-B/D-C); DATA-15..18 restano da dettagliare.
Indice operativo: [piano](../plan.md), [checklist](../todo.md).
Spec: [`docs/specs/provider-neutral-world-streaming.md`](../../docs/specs/provider-neutral-world-streaming.md).
ADR: [`docs/adr/ADR-011-mvt-provider-neutral-source.md`](../../docs/adr/ADR-011-mvt-provider-neutral-source.md).
Riferimento completo: [`docs/OpenGTA-DATA-SOURCE-MIGRATION.md`](../../docs/OpenGTA-DATA-SOURCE-MIGRATION.md).

## Prompt di assegnazione

```text
Esegui il task DATA-NN in tasks/data/DATA-NN.md.
Leggi prima AGENTS.md e tasks/data/README.md, poi solo le letture richieste
dalla scheda. Verifica le dipendenze nel codice e nei log. Implementa con TDD
entro il perimetro indicato, esegui le verifiche e aggiorna piano, checklist
e log. Non implementare gli altri task.
```

## Regole di esecuzione e consegna

Come nelle tranche precedenti (`tasks/online/README.md`): un task alla volta,
TDD con rosso osservato, gate comune (`npm run typecheck`, `npm run test:run`,
`npm run test:e2e`, `npm run build`, smoke dist con `OPENGTA_E2E_PREVIEW=1`),
log in `tasks/executions/YYYY-MM-DD-DATA-NN.md` col [template](../online/EXECUTION-TEMPLATE.md),
checkbox aggiornate solo con evidenza, commit atomici senza push/deploy.
E2E offline e deterministici (catch-all di rete); la canary resta separata.

## Contratti condivisi

### C-MVT: tile math e decode (DATA-02..05)

- `latLonToTile(lat, lon, z)` deterministico con clamp Web Mercator
  (|lat| <= 85.05113); `tileBounds(z,x,y)` in lon/lat; nessun NaN/Infinity.
- Decoder MVT interno e bounded: max tile bytes (default 8 MiB), max
  features per tile (10.000), max punti per geometria (50.000), max
  proprieta' (256); superamento = `TileSourceError` con categoria
  `response-too-large`/`invalid-tile`; abort propagato; nessuna dipendenza
  renderer; nessun oggetto decoder esposto fuori da `src/geo/mvt/`.
- Modello decodificato `DecodedVectorFeature` (layer, id, properties,
  geometria tipizzata) e' l'unico confine verso il canonical world.

### C-PROVIDER: sorgenti e identita' (DATA-04, 11, 14)

- `VectorTileProvider.getTile(key, signal)` bounded/cancellabile; 404/204 =
  vuoto deterministico; retry network/5xx breve, 429 con Retry-After, abort
  mai ritentato.
- Identity cache: provider id + dataset version + schema id + MVT zoom +
  normalizer version + compiler version nel namespace; nessun riuso fra
  sorgenti incompatibili.
- Una tile = una fetch in-flight condivisa fra i consumatori; abort solo
  quando il consumer count arriva a zero (PoC: fetch breve).
- Overpass resta il provider legacy: nessun branch provider-specifico in
  renderer/fisica/gameplay; `provider=openfreemap-mvt` e' sperimentale e
  mai default finche' i gate G1-G8 del documento non passano.

### C-NORMALIZER: canonical unico (DATA-06..08, 13)

- Mapping OpenMapTiles → OpenGTA in `src/geo/normalize/mvt.ts`:
  transportation (motorway/trunk/primary/secondary/tertiary/minor/service/
  path/track) con warning per classi non supportate e larghezza dai
  fallback esistenti; building con render_height/render_min_height e
  fallback deterministico; park/landuse/landcover/water/waterway.
- Strade non guidabili (footway/path/steps/cycleway/rail) classificate
  `pedestrian`/`ignored`, mai trasformate in carreggiata.
- Clip ai bounds autorevoli OpenGTA, deduplica feature, ID deterministici
  per segmenti derivati da tile; nessun RawOsm finto.

### C-RUNTIME: seam e refactor (DATA-11..14)

- PoC via `options.compile` del runtime (nessun cambio di chunk grid,
  lifecycle, availability guard, spawn, renderer, fisica).
- Refactor finale: `CanonicalRegionSource.acquire(request, options) →
  WorldRegion`; il runtime compila con `compileRegion`; Overpass e MVT
  dietro lo stesso contratto; un solo compiler.
