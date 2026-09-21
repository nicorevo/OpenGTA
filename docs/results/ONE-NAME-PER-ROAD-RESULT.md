# Un nome per via — dedup per nome normalizzato

Data: 2026-09-21. Persona: fullstack-developer.
Stato: completato + verificato. Baseline: working tree post ND (dedup per
feature, non ancora commitato). Log: `tasks/executions/2026-09-21-NN-01.md`.

## Obiettivo

Richiesta utente: "i nomi delle vie spesso sono ripetuti anche su vie
completamente diverse, dovresti fare una review del meccanismo di reperimento,
assegnazione e visualizzazione dei nomi delle vie".

## Review del pipeline (reperimento → assegnazione → visualizzazione)

1. **Reperimento MVT — OK.** I nomi vengono dal layer `transportation_name`
   e sono joinati alle geometrie `transportation` per id OSM
   (`src/geo/normalize/mvt.ts:111-126`). Verificato su tile reale
   (fixture `lecce-z14-openfreemap.pbf`): 585 feature transportation, 445
   name, 0 id duplicati in entrambi i layer, 151 strade nominate, 294 name
   senza geometria drivabile nel tile (comportamento atteso: buffer del
   layer name + classi non drivabili). Nessun name mal assegnato: il join è
   per chiave, non per indice.
2. **Reperimento OSM — OK.** Il nome arriva dai tag della way stessa
   (`normalizeOsm`), senza join: assegnazione corretta per costruzione.
3. **Assegnazione — DIFETTO.** `compileRegion`
   (`src/world/compiler/compiled.ts:37`) emette un label per **way OSM**, ma
   il nome è un attributo della **via**: una via reale è composta da più way
   (segmenti tra incroci, doppia carreggiata, coppie senso unico), tutte con
   lo stesso tag `name`. Su tile reale: `Via Merine` = 2 way (2030539842,
   2030544120), `Viale Giacomo Leopardi` = 2 way, `Piazza Sant'Oronzo` = 2
   way drivabili. OSM porta anche varianti di casing per la stessa via
   (`Viale venticinque luglio` / `Viale Venticinque Luglio`) → label
   visivamente duplicati su "vie completamente diverse".
4. **Visualizzazione — INSUFFICIENTE.** Il dedup ND era per **identità di
   feature** (`labelDedupKey`): unisce le copie per-chunk della stessa way,
   ma non due way distinte che condividono il nome.

## Cosa è cambiato

- `src/render/pixi/renderer.ts`:
  - Nuovo helper puro esportato `labelTextKey(text)`: trim + collapse
    whitespace + casefold → chiave di nome stabile.
  - `rebuildLabels`: la chiave di dedup tra i chunk attivi passa da
    `labelDedupKey(featureId)` a `labelTextKey(label.text)`; per ogni nome
    vince la copia più vicina al bersaglio camera. Stessa feature ⇒ stesso
    testo ⇒ il dedup per nome **subsume** quello per identità (le copie
    per-chunk si uniscono come prima).
  - `labelDedupKey` rimosso (nessun altro uso).
- Provider-agnostic: vale per MVT (default) e per OSM/Overpass; nessun cambio
  a normalizer, contratto chunk, LOD o cache persistente.

## Comportamento atteso

- Via composta da N way (o N varianti di casing): **1 solo label**, sul
  tratto più vicino alla camera.
- Due vie con nomi diversi: tutti i label presenti (nessuna soppressione
  eccessiva — guard test dedicato).
- Stesso nome per due vie davvero distinte entrambe in viewport: etichettata
  solo la più vicina alla camera (scelta esplicita, comportamento mappa
  reale: un nome per via per viewport; è esattamente il difetto segnalato).

## Verifica

- RED: 5 falliti in `renderer-labels.test.ts` (helper mancante + 2 test
  comportamentali con 2 Text invece di 1).
- `npm run test:run`: 455/455 (due run verdi consecutivi; 1 flake isolato al
  primo run post-modifica, non replicato).
- `npm run typecheck`, `npm run build`: verdi.
- `npm run test:e2e`: 27 passed + 1 canary skip; il guard ND
  `labelTextCount === 1` (2 chunk, stessa feature) resta verde perché stessa
  feature ⇒ stesso testo.
- `git diff --check`: pulito.

## Follow-up (non incluso)

- Etichettatura "per tratto" lungo strade molto lunghe (il nome a ogni
  N metri): oggi un solo nome per via in viewport.
- Se in futuro servirà distinguere due vie omonime davvero distanti in
  viewport, la chiave può diventare `nome + area` (es. griglia): non
  necessario per il difetto segnalato.
