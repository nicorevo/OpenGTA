# Nomi via leggibili (dentro la carreggiata)

Data: 2026-09-21. Persona: fullstack-developer.
Stato: completato + verificato. Baseline: working tree post ZI (zoom
intermedio, non ancora commitato). Log: `tasks/executions/2026-09-21-LB-01.md`.

## Obiettivo

Il nome della via risultava praticamente illeggibile (screenshot MVT live al
zoom intermedio): banda sfocata, colori invertiti, e un'altezza (10 m) che
superava la carreggiata (6 m) → il testo escombeva fuori strada. Richiesta:
font più piccolo, caratteri chiari, testo compreso nella carreggiata.

## Diagnosi

- `fontSize: 10` era espresso in **unità di mondo (metri)**: il `Text` era
  rasterizzato a 1x (~10 px di texture) e poi ingrandito ~6x dal viewScale →
  upsampling → banda sfocata.
- `stroke` bianco da 2px su `fill` nero: a quel rapporto lo stroke copriva il
  fill → il nome sembrava una scritta bianca gonfia.
- Altezza 10 m > carreggiata 6 m: il nome escombeva sulla suola/marciapiede.

## Cosa è cambiato

- **Rasterizzazione ad alta densità**: il testo è renderizzato una volta a
  `LABEL_RASTER_SIZE = 128` px (design) e poi scalato in unità di mondo con
  `text.scale` → downsampling del raster a ogni viewScale, nitido a ogni zoom
  (stesso principio dei decal "GENERAL LEE", GL-03).
- **Altezza proporzionale alla carreggiata**: `labelWorldHeightM` = 42% della
  larghezza della strada (clamp 1.2–4 m); label "place" (parchi/acque/palazzi)
  fisse a 3 m. Strada 6 m → ~2.5 m; 3.5 m → ~1.5 m.
- **Fit per lunghezza**: `labelFitScale` riduce ulteriormente se il nome
  supererebbe l'80% della lunghezza della strada (`LABEL_MAX_LENGTH_RATIO`).
- **Caratteri chiari**: fill bianco `0xffffff` + contorno scuro sottile
  `0x211f26` (~5% dell'altezza) + bold: leggibile su asfalto scuro e suolo
  chiaro.
- `rebuildLabels` risolve la strada di ogni label road da
  `chunk.roads[featureId]` (larghezza + lunghezza centerline già nel chunk):
  nessun nuovo dato, nessun cambio di contratto.
- Solo presentazione: LOD, fisica, streaming e contratto chunk invariati.

## Verifica

- RED: `renderer-labels.test.ts` 7/12 falliti prima del GREEN.
- `npm run test:run`: 447/447 (era 440: +7 test).
- `npm run typecheck`, `npm run build`: verdi.
- `npm run test:e2e`: 27 passed + 1 canary skip. Il test LOD tiers ora probe
  gli scale reali dei `Text` nel browser: entrambi in `(0, 0.1)` → guard
  anti-regressione contro testo 1:1 in unità di mondo.

## Follow-up (non incluso)

- Ricalibrazione di `LABEL_RASTER_SIZE` se lo zoom estremo (near su 4K)
  risultasse morbido: oggi è un leggero upscale lì, trade-off accettato.
- Verifica visiva sul live MVT da registrare al prossimo checkpoint.
