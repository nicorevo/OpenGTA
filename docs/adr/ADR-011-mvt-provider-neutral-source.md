# ADR-011: Sorgente provider-neutral con Vector Tiles (MVT)

Data: 2026-09-11.
Stato: accettato.
Contesto: Overpass pubblico irraggiungibile dall'ambiente di sviluppo
(errori network su tutte le celle; mirror parziali). Spec
`docs/specs/provider-neutral-world-streaming.md`.

## Decisione

1. Il runtime consuma un `CanonicalRegionSource` (o, nel PoC, il seam
   `options.compile`): ogni provider produce `WorldRegion` → `compileRegion`
   → `CompiledChunkV0`. Niente RawOsm finti da MVT.
2. PoC MVT con OpenFreeMap/OpenMapTiles a z14 (massimo disponibile sulla
   public instance), dietro feature flag `provider=openfreemap-mvt`.
   Overpass resta come legacy/debug e come primo candidato al fallback di
   sviluppo (DATA-01), mai rimosso.
3. Decoder MVT interno e bounded (niente MapLibre, niente dipendenze
   renderer): PBF/MVT spec con limiti espliciti su bytes/feature/punti.
4. MVT zoom e camera zoom restano concetti separati: source gameplay a
   risoluzione fissa; la camera cambia solo presentazione.
5. La parity Lecce (DATA-09) decide GO / GO VISUAL ONLY / NO-GO GAMEPLAY
   per la source pubblica; PMTiles regionali e custom OpenGTA tile schema
   sono le fasi successive per il NEAR gameplay ad alta risoluzione.

## Motivazione

Misurato in questo ambiente: overpass-api.de e private.coffee irraggiungibili
(connection refused/timeout), osm.ch serve dataset vuoto, mail.ru e'
raggiungibile ma e' un mirror commerciale; tiles.openfreemap.org risponde
(200) e la tile z14 di Lecce pesa 321 KB con dati reali. Un servizio
pubblico di query non e' lo streaming di un videogioco: i tile statici
XYZ danno cache HTTP/CDN naturale, richieste deterministiche, failover
semplice e preparano PMTiles/self-hosting.

## Conseguenze

- Nuova tranche DATA-00..14 (eseguibile) + DATA-15..18 (fasi successive).
- `src/geo/mvt/` per tile math e decoder; `src/geo/normalize/mvt.ts` per il
  normalizer; `src/world/runtime/vector-tile/` per provider e compiler.
- La parity puo' dichiarare NO-GO GAMEPLAY a z14: in quel caso il lavoro
  resta riutilizzabile per custom tiles/PMTiles (caso previsto dal
  documento, sezione 34).
