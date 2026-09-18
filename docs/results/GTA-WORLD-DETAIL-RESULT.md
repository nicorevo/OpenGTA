# Dettaglio mondo GTA — ri-renderizzazione delle classi già nel chunk

Data: 2026-09-18. Spec: `docs/specs/gta-world-detail-v1.md`. Persona: fullstack-developer.
Stato: completato + verificato; incluso nella baseline del commit di questa tranche.

## Obiettivo

Mantenendo il **preset GTA**, ri-renderizzare le `styleKey` di classe già presenti nel
chunk compilato (`landClass`, `roadClass`, `buildingType`, `waterClass`) che prima venivano
quasi tutte piatte a 1-2 colori. Nessun nuovo dato, nessun nuovo schema, nessun nuovo layer.

## Trovate sui dati (verificate prima di pianificare)

| Dato | Nel chunk | Provider live (MVT/OpenFreeMap z14) | OSM/Overpass |
|---|---|---|---|
| `landClass` | sì | **varia** (park/forest/sand/residential/commercial/industrial/parking/bare…) | varia |
| `roadClass` | sì | **varia** (motorway…service, `mvt-roads.ts`) | varia |
| `buildingType` | sì | **sempre `"unknown"`** (`mvt-buildings.ts:28`) | varia |
| `trees` / `sourceLevels` / `laneCount` | **scartati nel compilato** | trees ∅, livelli/lanes ∅ | presenti |
| `materialHint` / `roofTypeHint` | scartati | mai popolati | mai popolati |

Conseguenza: gli edifici in live non hanno il tipo → usano **variabilità deterministica da
posizione** (seed FNV-1a del baricentro in metri, indipendente dal tile → niente cuciture
tra chunk). Dove il tipo esiste (OSM) i tipi caratteristici (historic/civic/religious/
industrial/commercial) hanno un colore fisso.

## Cosa è cambiato (render-side, helper puri in `renderer.ts`)

- `groundFill(kind, cls)` — colore terreno per `landClass` (+ acqua), toni GTA muti.
- `roadStyle(cls)` — asfalto scuro di base; arterie (motorway/trunk/primary) più marcate,
  residenziali più sobri; default stabile per classi non mappate (= i vecchi colori).
- `buildingStyle(cls, seed)` — tetto/facciata da palette GTA muti; tipi caratteristici fissi.
- `positionSeed(x, y)` — FNV-1a 32-bit della posizione in metri (stabile, jitter-tollerante).
- `styleClass(styleKey)` — estrae la classe da `<kind>:<class>`.
- `scene-order.ts`: `ClassedRoadGroup` + `groupRoadsByStyleAndWidth` (raggruppa per
  **larghezza + classe** così ogni gruppo ha un colore; gli incroci della stessa classe
  restano fusi in un solo path). `strokeRoadNetwork` accetta ora colore per gruppo.

Wiring: terreno, strada (casing+superficie) e edifici (facciata+tetto) usano gli helper.
I 7 `Graphics` per chunk restano 7 (nessun nuovo oggetto → gli e2e di conteggio restano verdi).

## Verifica

- `npm run typecheck` verde.
- `npm run test:run`: **435/435** (426 dopo close-zoom + 8 palette/scene-order + 1
  label acqua).
- `npm run build` verde (warning chunk-size preesistente).
- `npm run test:e2e`: **25 passed + 1 canary skip**.
- Screenshot tier vicino (`/tmp/opengta-gta-road.png`): strada `residential` col tono della
  classe + fascia marciapiede grigia + striscia centrale bianca + auto F1 + etichetta
  strada, su
  terreno verde base. Nessun crash, nessun errore di pagina.

Nota: il fixture di test ha un solo edificio a ~455 m e nessuna area di landuse, quindi la
varietà edifici/terreno si apprezza su una mappa reale (il mondo live MVT ha `landClass` e
`roadClass` vari); il colore edificio è coperto dai test unit (`buildingStyle`) e il percorso
di disegno è esercitato senza errori dall'e2e.

## Follow-up (non incluso — richiede cambio schema compilato)

- Riportare `trees` nel chunk + render (beneficio soprattutto in modalità OSM; in MVT ∅).
- Riportare `sourceLevels`/`laneCount` per altezze/strisce per numero di corsie.
- Opzionale: griglia finestre su facciata (solo `near`) + ombra a terra edificio +
  pseudo-texture deterministiche.
