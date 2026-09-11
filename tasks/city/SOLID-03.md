# SOLID-03: Benchmark OSM patologici e assemblaggio ring

**Stato:** completato. Log: `tasks/executions/2026-09-11-SOLID-03.md`.
**Dipendenze:** SOLID-02.
**Persona:** test-engineer.
**Taglia:** M, 4 file di test/benchmark.

## Obiettivo

Fixture deterministiche con relation multipolygon da 100 a 20.000 membri:
misurare normalize time, peak memory (stima), long frames e abort
responsiveness. L'assemblaggio ring attuale usa `findIndex` in loop (rischio
O(n²)): indicizzare per endpoint (`nodeId -> candidate chains`) se le misure
mostrano crescita male; il fix deve preservare output identico (test di
equivalenza con fixture esistenti).

## READ

- `src/geo/normalize/osm.ts` (assemblaggio ring), `src/world/compiler/compiled.ts`,
  `src/world/runtime/source.ts`, log SOLID-02.
- `docs/testing/benchmark-protocol-v0.md`.

## MAY MODIFY / DO NOT TOUCH

Modificabili: normalize (solo struttura dati interna dell'assemblaggio) e
test/benchmark. Non cambiare semantica dei ring, holes, ordine degli output
o limiti pubblici. I benchmark non entrano nella suite normale se superano i
10 s; usare uno script separato in `tests/bench/`.

## Esecuzione TDD

1. Scrivere la fixture patologica sintetica (commitata) e il benchmark.
2. Test di equivalenza: output con/senza indicizzazione byte-identico.
3. Se il benchmark mostra crescita >= quadratica, applicare l'indicizzazione
   e verificare il miglioramento; registrare i numeri prima/dopo nel log.

## Accettazione

- [x] AC1: fixture 100/500/1k/5k/20k membri riproducibile, nessun crash.
- [x] AC2: budget dichiarato rispettato (es. nessun task > 50 ms senza
  yield su hardware di riferimento) o fix documentato con misure.
- [x] AC3: output equivalente alle fixture esistenti; decisione documentata.

## Verifica

`npm run test:run -- src/geo/normalize` + script benchmark + gate comune.

## Handoff

Le misure alimentano la decisione Worker (NEXT in FOLLOW-UPS) e il profilo
DESKTOP_LOW di SOLID-06/CITY-02.
